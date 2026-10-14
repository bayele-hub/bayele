-- ============================================================================
-- Migration:          Member review — security and money fixes (D1, O7, O8, D9)
-- Version:            20261014090000_0035
-- Date:               2026-10-14
-- Team:               Bayele Core Platform Engineering
-- Dependencies:       0001–0034 (latest bodies: 0005 is_admin, 0015 retainers, 0018 webhook funding,
--                     0027 partner apply + creator payout, 0033 refund, 0034 campaign funding)
-- Rollback Script:    supabase/migrations/rollback/20261014090000_0035_member_review_security_money.rollback.sql
-- Decisions:          briefs/CONTEXT-ADMIN-REVIEW.md « Decisions » (O6, O7, O8, D1, D9) · audit A1–A15, QA F1–F3, F10
-- ============================================================================
-- K8: no destructive keyword in this file; every function keeps its signature (CREATE OR REPLACE),
-- the one policy change uses ALTER POLICY, new objects use IF NOT EXISTS / guarded DO blocks.
--
-- D1 security
--   A7  private.is_admin requires the admin's profile to be 'active' (same signature).
--   A14 REVOKE TRUNCATE on every public table from anon/authenticated (+ default privileges).
--   A1  get_my_contact() (own phone + email) ships here so the new web can use it first; the actual
--       revoke of signed-in read of profiles.phone_e164 is migration 0037, applied AFTER the new web is
--       deployed (the old web still does select('*') on profiles). Release: 0035+0036 → web → 0037.
--   A15 private campaigns readable by creators (any non-blocked status, unchanged) and by ACTIVE
--       partners only (ALTER POLICY "browse open campaigns").
--   A6  partner_apply_for_creator requires the partner's profile to be active.
--   A3  handle_sokoclick_invoice_paid: a ref already used is returned only for the SAME campaign /
--       retainer, otherwise 'invoice_already_used' (0034 rule, now on the webhook + retainer path).
--   (A9 approval copy lives in 0036 with the moderation trigger rewrite.)
-- O8 brand gate: campaign and retainer funding raise 'owner_not_active' while a brand / partner owner
--   is not approved. Managed campaigns (owner_role super_admin) are unaffected.
-- O7 retainers: Bayele cut fixed at floor(25 %) server-side; partner accepts/declines before invoicing;
--   ending a funded retainer = admin settlement (refund and/or partner payout); completion creates a
--   partner payout; both confirmed by an admin from the payout queue (retainer_settlements).
-- D9 leftover escrow: when a campaign auto-completes, unused net money + the proportional fee become a
--   pending 'refund' escrow row for the brand, confirmed by the admin through admin_refund_campaign.
-- ============================================================================

-- ── A7: admins must be active ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.is_admin(p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
      JOIN public.profiles p ON p.id = ur.user_id
     WHERE ur.user_id = p_user_id AND ur.role = 'super_admin' AND p.status = 'active'
  );
$$;

-- ── A14: TRUNCATE is not subject to RLS — nobody on the API needs it ─────────
REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE TRUNCATE ON TABLES FROM anon, authenticated;

-- ── A1 (part 1): the member's own contact details (phone + account email) ────
-- The revoke itself is 0037 (release ordering, see header).
CREATE OR REPLACE FUNCTION public.get_my_contact()
RETURNS TABLE (phone_e164 text, email text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p.phone_e164, (SELECT to_jsonb(u) ->> 'email' FROM auth.users u WHERE u.id = p.id)
    FROM public.profiles p
   WHERE p.id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.get_my_contact() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_contact() TO authenticated;

-- ── A15: private campaigns — only ACTIVE partners (creators unchanged) ───────
CREATE OR REPLACE FUNCTION private.is_active_partner(p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.profiles p ON p.id = ur.user_id
                  WHERE ur.user_id = p_user_id AND ur.role = 'consultant' AND p.status = 'active');
$$;
REVOKE ALL ON FUNCTION private.is_active_partner(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_active_partner(uuid) TO anon, authenticated, service_role;

ALTER POLICY "browse open campaigns" ON public.campaigns USING (
  status IN ('published', 'in_progress', 'completed')
  AND (is_public OR private.is_creator((SELECT auth.uid())) OR private.is_active_partner((SELECT auth.uid())))
);

-- ── A6: a suspended (non-active) partner cannot act for creators ─────────────
CREATE OR REPLACE FUNCTION public.partner_apply_for_creator(p_campaign_id uuid, p_creator_id uuid)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_owner uuid; v_status public.campaign_status; v_payout bigint; v_title text;
  v_cc uuid; v_cstatus public.account_status; v_cname text; v_pname text; v_pstatus public.account_status;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT status, display_name INTO v_pstatus, v_pname FROM public.profiles WHERE id = v_actor;
  IF v_pstatus IS DISTINCT FROM 'active' THEN RAISE EXCEPTION 'partner_not_active'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.partner_creator_links
                  WHERE partner_id = v_actor AND creator_id = p_creator_id AND status = 'active') THEN
    RAISE EXCEPTION 'not_representing';
  END IF;
  SELECT status, display_name INTO v_cstatus, v_cname FROM public.profiles WHERE id = p_creator_id;
  IF v_cstatus IS NULL OR v_cstatus IN ('suspended', 'rejected') THEN RAISE EXCEPTION 'profile_not_eligible'; END IF;

  SELECT owner_id, status, payout_per_creator_fcfa, title
    INTO v_owner, v_status, v_payout, v_title
    FROM public.campaigns WHERE id = p_campaign_id FOR UPDATE;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'campaign_not_found'; END IF;
  IF v_owner IN (v_actor, p_creator_id) THEN RAISE EXCEPTION 'cannot_apply_own_campaign'; END IF;
  IF v_status NOT IN ('published', 'in_progress') THEN RAISE EXCEPTION 'campaign_not_open'; END IF;
  IF EXISTS (SELECT 1 FROM public.campaign_creators cc
              WHERE cc.campaign_id = p_campaign_id AND cc.creator_id = p_creator_id) THEN
    RAISE EXCEPTION 'already_applied';
  END IF;

  INSERT INTO public.campaign_creators (campaign_id, creator_id, status, agreed_payout_fcfa, applied_by)
  VALUES (p_campaign_id, p_creator_id, 'applied', v_payout, v_actor)
  RETURNING id INTO v_cc;

  INSERT INTO public.notifications (user_id, type, title, body, link) VALUES
    (v_owner, 'campaign_application', 'Nouvelle candidature',
     coalesce(v_pname, 'Un partenaire') || ' a proposé ' || coalesce(v_cname, 'un créateur') || ' pour « ' || v_title || ' ».',
     '/business/campaigns/' || p_campaign_id::text),
    (p_creator_id, 'partner_applied', 'Candidature envoyée pour vous',
     coalesce(v_pname, 'Votre partenaire') || ' a postulé pour vous à « ' || v_title || ' ».',
     '/creator/dashboard');
  RETURN v_cc;
END;
$function$;

-- ── O7: retainer consent, fixed cut, settlements ─────────────────────────────
ALTER TABLE public.agency_retainers
  ADD COLUMN IF NOT EXISTS partner_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS partner_declined_at timestamptz;

CREATE TABLE IF NOT EXISTS public.retainer_settlements (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retainer_id          uuid NOT NULL REFERENCES public.agency_retainers(id),
  kind                 text NOT NULL,
  recipient_id         uuid NOT NULL REFERENCES public.profiles(id),
  amount_fcfa          bigint NOT NULL,
  bayele_fee_kept_fcfa bigint NOT NULL DEFAULT 0,
  status               text NOT NULL DEFAULT 'pending',
  reason               text,
  provider             public.payment_provider,
  disbursement_ref     text,
  created_by           uuid REFERENCES public.profiles(id),
  confirmed_by         uuid REFERENCES public.profiles(id),
  confirmed_at         timestamptz,
  created_at           timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT retainer_settlements_kind CHECK (kind IN ('partner_payout', 'brand_refund')),
  CONSTRAINT retainer_settlements_status CHECK (status IN ('pending', 'paid')),
  CONSTRAINT retainer_settlements_amount CHECK (amount_fcfa > 0 AND bayele_fee_kept_fcfa >= 0),
  CONSTRAINT retainer_settlements_reason_len CHECK (reason IS NULL OR char_length(reason) <= 500),
  CONSTRAINT retainer_settlements_one_per_kind UNIQUE (retainer_id, kind)
);
COMMENT ON TABLE public.retainer_settlements IS
  'O7: money exits of a funded retainer (partner payout on completion / settlement, brand refund on early end). Admin confirms each from the payout queue.';
CREATE INDEX IF NOT EXISTS retainer_settlements_recipient_idx ON public.retainer_settlements (recipient_id);
CREATE INDEX IF NOT EXISTS retainer_settlements_created_by_idx ON public.retainer_settlements (created_by);
CREATE INDEX IF NOT EXISTS retainer_settlements_confirmed_by_idx ON public.retainer_settlements (confirmed_by);
CREATE INDEX IF NOT EXISTS retainer_settlements_pending_idx ON public.retainer_settlements (created_at) WHERE status = 'pending';

ALTER TABLE public.retainer_settlements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.retainer_settlements FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.retainer_settlements TO authenticated;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'retainer_settlements'
                    AND policyname = 'retainer parties read settlements') THEN
    CREATE POLICY "retainer parties read settlements" ON public.retainer_settlements FOR SELECT TO authenticated
      USING (private.is_admin((SELECT auth.uid())) OR EXISTS (
        SELECT 1 FROM public.agency_retainers ar
         WHERE ar.id = retainer_settlements.retainer_id
           AND (ar.business_id = (SELECT auth.uid()) OR ar.consultant_id = (SELECT auth.uid()))));
  END IF;
END $$;

-- Settlement maths (shared with D9): the partner/creators were paid p out of net N = total − fee F;
-- Bayele keeps fee_kept = floor(F × p ÷ N); the brand gets total − p − fee_kept (≥ 0, no loss).
CREATE OR REPLACE FUNCTION private.proportional_fee_kept(p_fee bigint, p_used bigint, p_net bigint)
RETURNS bigint LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE WHEN coalesce(p_net, 0) <= 0 THEN coalesce(p_fee, 0)
              ELSE (p_fee * least(greatest(p_used, 0), p_net)) / p_net END;
$$;
REVOKE ALL ON FUNCTION private.proportional_fee_kept(bigint, bigint, bigint) FROM PUBLIC, anon, authenticated;

-- (1) propose — same signature; p_bayele_cut is IGNORED: cut = floor(contract × 25 %).
CREATE OR REPLACE FUNCTION public.propose_retainer(
  p_consultant_id  uuid,
  p_contract_value bigint,
  p_bayele_cut     bigint,
  p_consultant_fee bigint,
  p_media_budget   bigint,
  p_kpi_bonus      bigint DEFAULT 0
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_retainer uuid; v_cut bigint; v_brand text; v_fee bigint; v_media bigint;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = v_actor AND ur.role = 'business') THEN
    RAISE EXCEPTION 'not_a_business';
  END IF;
  SELECT p.display_name INTO v_brand FROM public.profiles p WHERE p.id = v_actor AND p.status = 'active';
  IF v_brand IS NULL THEN RAISE EXCEPTION 'profile_not_active'; END IF;
  SELECT coalesce(bp.company_name, v_brand) INTO v_brand FROM public.business_profiles bp WHERE bp.user_id = v_actor;
  v_brand := coalesce(v_brand, 'Une marque');

  IF p_consultant_id = v_actor THEN RAISE EXCEPTION 'cannot_retain_self'; END IF;
  IF NOT private.is_active_partner(p_consultant_id) THEN RAISE EXCEPTION 'consultant_not_found'; END IF;

  IF p_contract_value IS NULL OR p_contract_value <= 0 OR coalesce(p_consultant_fee, -1) < 0
     OR coalesce(p_media_budget, -1) < 0 OR coalesce(p_kpi_bonus, 0) < 0 THEN
    RAISE EXCEPTION 'invalid_amounts';
  END IF;
  v_cut := (p_contract_value * 25) / 100;                      -- O7: fixed, floor
  -- The client's cut is ignored. When fee + media do not add up to contract − cut (e.g. the pre-O7
  -- form, which let the brand type its own cut), the media budget absorbs the difference, then the
  -- fee if media would go negative. The stored row + the partner's notification show the final split.
  v_fee := p_consultant_fee; v_media := p_media_budget;
  IF v_fee + v_media <> p_contract_value - v_cut THEN
    v_media := p_contract_value - v_cut - v_fee;
    IF v_media < 0 THEN v_fee := p_contract_value - v_cut; v_media := 0; END IF;
  END IF;

  INSERT INTO public.agency_retainers
    (business_id, consultant_id, contract_value_fcfa, bayele_cut_fcfa, consultant_fee_fcfa, media_budget_fcfa, kpi_bonus_fcfa, status)
  VALUES (v_actor, p_consultant_id, p_contract_value, v_cut, v_fee, v_media, coalesce(p_kpi_bonus, 0), 'draft')
  RETURNING id INTO v_retainer;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (p_consultant_id, 'retainer_proposed', 'Nouveau contrat agence 📄',
          v_brand || ' vous propose un contrat agence de ' || p_contract_value::text || ' FCFA (honoraires ' ||
          v_fee::text || ' FCFA). Acceptez ou refusez dans l''application.',
          '/partner/retainers');
  RETURN v_retainer;
END;
$$;

-- (1b) the partner accepts or declines (draft, or legacy invoiced rows created before this rule).
CREATE OR REPLACE FUNCTION public.respond_retainer(p_retainer_id uuid, p_accept boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_business uuid; v_consultant uuid; v_status public.retainer_status;
  v_acc timestamptz; v_dec timestamptz; v_name text;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT business_id, consultant_id, status, partner_accepted_at, partner_declined_at
    INTO v_business, v_consultant, v_status, v_acc, v_dec
    FROM public.agency_retainers WHERE id = p_retainer_id FOR UPDATE;
  IF v_business IS NULL THEN RAISE EXCEPTION 'retainer_not_found'; END IF;
  IF v_actor <> v_consultant THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF (p_accept AND v_acc IS NOT NULL) OR (NOT p_accept AND v_dec IS NOT NULL) THEN RETURN; END IF;   -- idempotent
  IF v_acc IS NOT NULL OR v_dec IS NOT NULL OR v_status NOT IN ('draft', 'invoiced') THEN
    RAISE EXCEPTION 'not_awaiting_response';
  END IF;
  IF NOT private.is_active_partner(v_actor) THEN RAISE EXCEPTION 'partner_not_active'; END IF;
  SELECT display_name INTO v_name FROM public.profiles WHERE id = v_actor;

  IF p_accept THEN
    -- An invoice reference attached before acceptance (pre-O7 web flow) becomes active now.
    UPDATE public.agency_retainers
       SET partner_accepted_at = now(),
           status = CASE WHEN status = 'draft' AND sokoclick_invoice_id IS NOT NULL THEN 'invoiced'::public.retainer_status ELSE status END
     WHERE id = p_retainer_id;
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (v_business, 'retainer_accepted', 'Contrat accepté 🤝',
            coalesce(v_name, 'Le partenaire') || ' a accepté votre contrat agence. Vous pouvez maintenant régler la facture.',
            '/business/retainers');
  ELSE
    UPDATE public.agency_retainers SET partner_declined_at = now(), status = 'terminated' WHERE id = p_retainer_id;
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (v_business, 'retainer_declined', 'Contrat refusé',
            coalesce(v_name, 'Le partenaire') || ' a refusé votre contrat agence.', '/business/retainers');
  END IF;
END;
$$;

-- (2) invoice only after acceptance, never with a ref already used.
CREATE OR REPLACE FUNCTION public.attach_retainer_invoice(
  p_retainer_id          uuid,
  p_sokoclick_invoice_id text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_business uuid; v_status public.retainer_status; v_existing text; v_acc timestamptz;
  v_ref text := btrim(coalesce(p_sokoclick_invoice_id, ''));
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF v_ref = '' THEN RAISE EXCEPTION 'missing_invoice_id'; END IF;

  SELECT business_id, status, sokoclick_invoice_id, partner_accepted_at
    INTO v_business, v_status, v_existing, v_acc
    FROM public.agency_retainers WHERE id = p_retainer_id FOR UPDATE;
  IF v_business IS NULL THEN RAISE EXCEPTION 'retainer_not_found'; END IF;
  IF NOT (v_business = v_actor OR private.is_admin(v_actor)) THEN RAISE EXCEPTION 'not_authorized'; END IF;

  IF v_existing IS NOT NULL AND v_existing = v_ref THEN RETURN; END IF;   -- idempotent
  IF v_status <> 'draft' THEN RAISE EXCEPTION 'not_draft'; END IF;
  IF EXISTS (SELECT 1 FROM public.invoices WHERE sokoclick_invoice_id = v_ref)
     OR EXISTS (SELECT 1 FROM public.agency_retainers WHERE sokoclick_invoice_id = v_ref AND id <> p_retainer_id) THEN
    RAISE EXCEPTION 'invoice_already_used';
  END IF;
  IF v_acc IS NULL THEN
    -- Pre-O7 web flow attaches right after proposing: keep the reference, stay 'draft'; the partner's
    -- acceptance (respond_retainer) moves it to 'invoiced'. Funding refuses it until then.
    UPDATE public.agency_retainers SET sokoclick_invoice_id = v_ref WHERE id = p_retainer_id;
    RETURN;
  END IF;

  UPDATE public.agency_retainers SET sokoclick_invoice_id = v_ref, status = 'invoiced' WHERE id = p_retainer_id;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (v_business, 'retainer_invoiced', 'Facture prête',
          'Votre facture SokoClick pour le contrat agence est prête. Réglez-la par Mobile Money pour l''activer.',
          '/business/retainers');
END;
$$;

-- ── A3 + O8: the webhook funding path ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_sokoclick_invoice_paid(
  p_sokoclick_invoice_id text, p_sokoclick_receipt_id text, p_business_id uuid,
  p_invoice_type public.invoice_type, p_amount_fcfa bigint, p_pdf_url text,
  p_campaign_id uuid DEFAULT NULL, p_retainer_id uuid DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_fee_rate numeric; v_fee_fcfa bigint; v_net_fcfa bigint; v_txn_id uuid; v_camp_status public.campaign_status;
        v_owner uuid; v_owner_role public.user_role; v_owner_status public.account_status;
BEGIN
  IF EXISTS (SELECT 1 FROM public.invoices WHERE sokoclick_invoice_id = p_sokoclick_invoice_id) THEN
    -- A3 (0034 rule): a redelivery is a no-op only for the SAME campaign / retainer.
    IF p_campaign_id IS NOT NULL THEN
      IF EXISTS (SELECT 1 FROM public.escrow_transactions
                  WHERE provider_ref = p_sokoclick_invoice_id AND campaign_id = p_campaign_id) THEN RETURN; END IF;
      RAISE EXCEPTION 'invoice_already_used';
    ELSIF p_retainer_id IS NOT NULL THEN
      IF EXISTS (SELECT 1 FROM public.agency_retainers
                  WHERE id = p_retainer_id AND sokoclick_invoice_id = p_sokoclick_invoice_id
                    AND status IN ('funded', 'active', 'completed', 'terminated')) THEN RETURN; END IF;
      RAISE EXCEPTION 'invoice_already_used';
    END IF;
    RETURN;   -- other invoice types (match pass, subscription): plain idempotency
  END IF;

  IF p_campaign_id IS NOT NULL THEN
    SELECT c.status, c.owner_id, c.owner_role, p.status INTO v_camp_status, v_owner, v_owner_role, v_owner_status
      FROM public.campaigns c JOIN public.profiles p ON p.id = c.owner_id WHERE c.id = p_campaign_id;
    IF v_camp_status IS NULL THEN RAISE EXCEPTION 'campaign % not found', p_campaign_id; END IF;
    IF v_owner_role <> 'super_admin' AND v_owner_status IS DISTINCT FROM 'active' THEN RAISE EXCEPTION 'owner_not_active'; END IF;  -- O8
    -- Never fund a campaign twice (a different invoice id for an already-funded campaign is a no-op).
    IF v_camp_status NOT IN ('draft','pending_funding')
       OR EXISTS (SELECT 1 FROM public.escrow_transactions
                  WHERE campaign_id = p_campaign_id AND direction = 'inbound' AND status <> 'refunded')
    THEN RETURN; END IF;
  ELSIF p_retainer_id IS NOT NULL THEN
    SELECT p.status INTO v_owner_status
      FROM public.agency_retainers ar JOIN public.profiles p ON p.id = ar.business_id WHERE ar.id = p_retainer_id;
    IF v_owner_status IS DISTINCT FROM 'active' THEN RAISE EXCEPTION 'owner_not_active'; END IF;                                -- O8
    IF NOT EXISTS (SELECT 1 FROM public.agency_retainers WHERE id = p_retainer_id AND partner_accepted_at IS NOT NULL) THEN
      RAISE EXCEPTION 'partner_not_accepted';                                                                                 -- O7
    END IF;
  END IF;

  INSERT INTO public.invoices (sokoclick_invoice_id, sokoclick_receipt_id, business_id, invoice_type, amount_fcfa, pdf_url, status)
  VALUES (p_sokoclick_invoice_id, p_sokoclick_receipt_id, p_business_id, p_invoice_type, p_amount_fcfa, p_pdf_url, 'paid');

  IF p_campaign_id IS NOT NULL THEN
    SELECT platform_fee_rate INTO v_fee_rate FROM public.campaigns WHERE id = p_campaign_id;
    IF v_fee_rate IS NULL THEN RAISE EXCEPTION 'campaign % has no platform_fee_rate set', p_campaign_id; END IF;
    v_fee_fcfa := floor(p_amount_fcfa * v_fee_rate); v_net_fcfa := p_amount_fcfa - v_fee_fcfa;
    UPDATE public.campaigns SET status = 'published', match_pass_paid = true, updated_at = now() WHERE id = p_campaign_id;
    INSERT INTO public.escrow_transactions (campaign_id, direction, amount_fcfa, fee_fcfa, net_amount_fcfa, provider, provider_ref, status)
    VALUES (p_campaign_id, 'inbound', p_amount_fcfa, v_fee_fcfa, v_net_fcfa, 'mtn_momo', p_sokoclick_invoice_id, 'pending')
    RETURNING id INTO v_txn_id;
    PERFORM public.transition_escrow(v_txn_id, 'held', p_business_id);
  ELSIF p_retainer_id IS NOT NULL THEN
    UPDATE public.agency_retainers SET status = 'funded' WHERE id = p_retainer_id;
  END IF;
END; $$;

-- (3) admin retainer funding: consent + brand gate + verified outcome before notifying (A3).
CREATE OR REPLACE FUNCTION public.admin_confirm_retainer_funding(
  p_retainer_id          uuid,
  p_sokoclick_receipt_id text DEFAULT NULL,
  p_pdf_url              text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_business uuid; v_consultant uuid; v_value bigint; v_status public.retainer_status; v_invoice text;
  v_acc timestamptz;
BEGIN
  IF NOT private.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;

  SELECT business_id, consultant_id, contract_value_fcfa, status, sokoclick_invoice_id, partner_accepted_at
    INTO v_business, v_consultant, v_value, v_status, v_invoice, v_acc
    FROM public.agency_retainers WHERE id = p_retainer_id FOR UPDATE;
  IF v_business IS NULL THEN RAISE EXCEPTION 'retainer_not_found'; END IF;
  IF v_status IN ('funded', 'active', 'completed') THEN RETURN; END IF;   -- idempotent
  IF v_status = 'terminated' THEN RAISE EXCEPTION 'retainer_terminated'; END IF;
  IF v_acc IS NULL THEN RAISE EXCEPTION 'partner_not_accepted'; END IF;
  IF v_invoice IS NULL OR v_status <> 'invoiced' THEN RAISE EXCEPTION 'not_invoiced'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_business AND status = 'active') THEN
    RAISE EXCEPTION 'owner_not_active';                                                       -- O8
  END IF;

  PERFORM public.handle_sokoclick_invoice_paid(
    v_invoice, p_sokoclick_receipt_id, v_business, 'agency_retainer', v_value, p_pdf_url, NULL, p_retainer_id);

  -- A3: never announce a funding that was not recorded.
  IF NOT EXISTS (SELECT 1 FROM public.agency_retainers WHERE id = p_retainer_id AND status = 'funded') THEN
    RAISE EXCEPTION 'funding_not_recorded';
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (v_business, 'retainer_funded', 'Contrat financé ✅',
          'Votre paiement est confirmé et conservé par Bayele jusqu''à la fin de la mission.', '/business/retainers'),
         (v_consultant, 'retainer_funded', 'Contrat financé ✅',
          'La marque a financé le contrat. Vous pouvez démarrer la mission.', '/partner/retainers');
END;
$$;

-- (4) lifecycle: completion → partner payout settlement; a funded retainer ends only by admin settlement.
CREATE OR REPLACE FUNCTION public.transition_retainer(
  p_retainer_id uuid,
  p_to_status   public.retainer_status
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_business uuid; v_consultant uuid; v_from public.retainer_status; v_is_admin boolean; v_allowed boolean;
  v_value bigint; v_cut bigint;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT business_id, consultant_id, status, contract_value_fcfa, bayele_cut_fcfa
    INTO v_business, v_consultant, v_from, v_value, v_cut
    FROM public.agency_retainers WHERE id = p_retainer_id FOR UPDATE;
  IF v_business IS NULL THEN RAISE EXCEPTION 'retainer_not_found'; END IF;
  IF v_from = p_to_status THEN RETURN; END IF;

  v_is_admin := private.is_admin(v_actor);

  v_allowed := CASE
    WHEN v_from = 'funded' AND p_to_status = 'active'                                    THEN TRUE
    WHEN v_from = 'active' AND p_to_status = 'completed'                                 THEN TRUE
    WHEN v_from IN ('draft','invoiced','funded','active') AND p_to_status = 'terminated' THEN TRUE
    ELSE FALSE
  END;
  IF NOT v_allowed THEN RAISE EXCEPTION 'illegal_retainer_transition'; END IF;
  -- O7: money is held once funded — ending it needs a settlement (admin_terminate_retainer).
  IF p_to_status = 'terminated' AND v_from IN ('funded', 'active') THEN
    RAISE EXCEPTION 'retainer_funded_use_settlement';
  END IF;

  IF p_to_status IN ('active','completed') THEN
    IF NOT v_is_admin THEN RAISE EXCEPTION 'not_authorized'; END IF;
  ELSE
    IF NOT (v_is_admin OR v_actor = v_business OR v_actor = v_consultant) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  END IF;

  UPDATE public.agency_retainers SET status = p_to_status WHERE id = p_retainer_id;

  IF p_to_status = 'active' THEN
    INSERT INTO public.notifications (user_id, type, title, body, link) VALUES
      (v_consultant, 'retainer_active', 'Mission démarrée 🚀', 'Le contrat agence est actif. Bon travail !', '/partner/retainers'),
      (v_business,   'retainer_active', 'Mission démarrée 🚀', 'Votre partenaire a démarré la mission.', '/business/retainers');
  ELSIF p_to_status = 'completed' THEN
    -- O7: the partner is paid everything except Bayele's cut (fee + media budget); admin confirms.
    INSERT INTO public.retainer_settlements (retainer_id, kind, recipient_id, amount_fcfa, bayele_fee_kept_fcfa, reason, created_by)
    VALUES (p_retainer_id, 'partner_payout', v_consultant, v_value - v_cut, v_cut, 'completed', v_actor)
    ON CONFLICT (retainer_id, kind) DO NOTHING;
    INSERT INTO public.notifications (user_id, type, title, body, link) VALUES
      (v_consultant, 'retainer_completed', 'Contrat terminé 🎉',
       'La mission est clôturée. Votre paiement de ' || (v_value - v_cut)::text || ' FCFA est en préparation par Bayele.', '/partner/retainers'),
      (v_business,   'retainer_completed', 'Contrat terminé 🎉', 'La mission agence est clôturée.', '/business/retainers');
  ELSE
    INSERT INTO public.notifications (user_id, type, title, body, link) VALUES
      (v_consultant, 'retainer_terminated', 'Contrat annulé', 'Le contrat agence a été annulé avant paiement.', '/partner/retainers'),
      (v_business,   'retainer_terminated', 'Contrat annulé', 'Le contrat agence a été annulé avant paiement.', '/business/retainers');
  END IF;
END;
$$;

-- (5) admin ends a FUNDED/ACTIVE retainer with a settlement: p_partner_payout_fcfa of the net goes to
-- the partner; Bayele keeps the proportional cut; the rest is refunded to the brand.
CREATE OR REPLACE FUNCTION public.admin_terminate_retainer(
  p_retainer_id uuid, p_partner_payout_fcfa bigint, p_reason text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_business uuid; v_consultant uuid; v_from public.retainer_status; v_value bigint; v_cut bigint;
  v_net bigint; v_kept bigint; v_refund bigint; v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
BEGIN
  IF NOT private.is_admin(v_admin) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF v_reason IS NULL THEN RAISE EXCEPTION 'reason_required'; END IF;
  IF char_length(v_reason) > 500 THEN RAISE EXCEPTION 'reason_too_long'; END IF;
  SELECT business_id, consultant_id, status, contract_value_fcfa, bayele_cut_fcfa
    INTO v_business, v_consultant, v_from, v_value, v_cut
    FROM public.agency_retainers WHERE id = p_retainer_id FOR UPDATE;
  IF v_business IS NULL THEN RAISE EXCEPTION 'retainer_not_found'; END IF;
  IF v_from = 'terminated' AND EXISTS (SELECT 1 FROM public.retainer_settlements WHERE retainer_id = p_retainer_id) THEN RETURN; END IF;
  IF v_from NOT IN ('funded', 'active') THEN RAISE EXCEPTION 'retainer_not_funded'; END IF;

  v_net := v_value - v_cut;
  IF p_partner_payout_fcfa IS NULL OR p_partner_payout_fcfa < 0 OR p_partner_payout_fcfa > v_net THEN
    RAISE EXCEPTION 'invalid_amount' USING DETAIL = format('0 ≤ partner payout ≤ %s', v_net);
  END IF;
  v_kept   := private.proportional_fee_kept(v_cut, p_partner_payout_fcfa, v_net);
  v_refund := v_value - p_partner_payout_fcfa - v_kept;

  IF p_partner_payout_fcfa > 0 THEN
    INSERT INTO public.retainer_settlements (retainer_id, kind, recipient_id, amount_fcfa, bayele_fee_kept_fcfa, reason, created_by)
    VALUES (p_retainer_id, 'partner_payout', v_consultant, p_partner_payout_fcfa, v_kept, v_reason, v_admin);
  END IF;
  IF v_refund > 0 THEN
    INSERT INTO public.retainer_settlements (retainer_id, kind, recipient_id, amount_fcfa, bayele_fee_kept_fcfa, reason, created_by)
    VALUES (p_retainer_id, 'brand_refund', v_business, v_refund, v_kept, v_reason, v_admin);
  END IF;
  UPDATE public.agency_retainers SET status = 'terminated' WHERE id = p_retainer_id;

  INSERT INTO public.notifications (user_id, type, title, body, link) VALUES
    (v_consultant, 'retainer_terminated', 'Contrat clôturé',
     'Le contrat agence a été clôturé par Bayele' ||
       CASE WHEN p_partner_payout_fcfa > 0 THEN ' : ' || p_partner_payout_fcfa::text || ' FCFA vous seront versés.' ELSE '.' END,
     '/partner/retainers'),
    (v_business, 'retainer_terminated', 'Contrat clôturé',
     'Le contrat agence a été clôturé par Bayele' ||
       CASE WHEN v_refund > 0 THEN ' : ' || v_refund::text || ' FCFA vous seront remboursés.' ELSE '.' END,
     '/business/retainers');
END;
$$;

-- (6) admin payout queue for retainer settlements (with where to send the money).
CREATE OR REPLACE FUNCTION public.admin_retainer_settlements()
RETURNS TABLE (
  id uuid, retainer_id uuid, kind text, status text, amount_fcfa bigint, bayele_fee_kept_fcfa bigint,
  recipient_id uuid, recipient_name text, recipient_handle text,
  payout_phone text, payout_provider public.payment_provider,
  contract_value_fcfa bigint, reason text, created_at timestamptz
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT private.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  RETURN QUERY
  SELECT s.id, s.retainer_id, s.kind, s.status, s.amount_fcfa, s.bayele_fee_kept_fcfa,
         s.recipient_id, p.display_name, p.handle,
         CASE WHEN s.kind = 'partner_payout' THEN kp.momo_payout_phone_e164 ELSE p.phone_e164 END,
         CASE WHEN s.kind = 'partner_payout' THEN kp.momo_provider ELSE NULL END,
         ar.contract_value_fcfa, s.reason, s.created_at
    FROM public.retainer_settlements s
    JOIN public.agency_retainers ar ON ar.id = s.retainer_id
    JOIN public.profiles p ON p.id = s.recipient_id
    LEFT JOIN public.consultant_profiles kp ON kp.user_id = s.recipient_id
   WHERE s.status = 'pending'
   ORDER BY s.created_at
   LIMIT 200;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_confirm_retainer_settlement(
  p_settlement_id uuid, p_provider public.payment_provider DEFAULT 'mtn_momo', p_disbursement_ref text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_recipient uuid; v_status text; v_amount bigint; v_kind text; v_ref text := nullif(btrim(coalesce(p_disbursement_ref, '')), '');
BEGIN
  IF NOT private.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF v_ref IS NULL THEN RAISE EXCEPTION 'ref_required'; END IF;
  SELECT recipient_id, status, amount_fcfa, kind INTO v_recipient, v_status, v_amount, v_kind
    FROM public.retainer_settlements WHERE id = p_settlement_id FOR UPDATE;
  IF v_recipient IS NULL THEN RAISE EXCEPTION 'settlement_not_found'; END IF;
  IF v_status = 'paid' THEN RETURN; END IF;
  UPDATE public.retainer_settlements
     SET status = 'paid', provider = p_provider, disbursement_ref = v_ref, confirmed_by = auth.uid(), confirmed_at = now()
   WHERE id = p_settlement_id;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (v_recipient, 'retainer_settlement_paid',
          CASE WHEN v_kind = 'partner_payout' THEN 'Paiement envoyé 💸' ELSE 'Remboursement effectué' END,
          CASE WHEN v_kind = 'partner_payout' THEN 'Votre paiement de ' ELSE 'Votre remboursement de ' END ||
            v_amount::text || ' FCFA pour le contrat agence a été envoyé.',
          CASE WHEN v_kind = 'partner_payout' THEN '/partner/retainers' ELSE '/business/retainers' END);
END;
$$;

-- ── O8: brand gate on admin campaign funding (0034 body + owner check) ───────
CREATE OR REPLACE FUNCTION public.admin_confirm_campaign_funding(
  p_campaign_id uuid, p_sokoclick_invoice_id text,
  p_provider public.payment_provider DEFAULT 'mtn_momo', p_sokoclick_receipt_id text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_owner uuid; v_fee_rate numeric; v_budget bigint; v_status public.campaign_status; v_title text; v_fee bigint; v_net bigint; v_txn uuid;
        v_managed boolean; v_owner_role public.user_role;
BEGIN
  IF NOT private.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  SELECT owner_id, platform_fee_rate, total_budget_fcfa, status, title, is_managed, owner_role
    INTO v_owner, v_fee_rate, v_budget, v_status, v_title, v_managed, v_owner_role
    FROM public.campaigns WHERE id = p_campaign_id FOR UPDATE;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'campaign_not_found'; END IF;
  IF EXISTS (SELECT 1 FROM public.invoices WHERE sokoclick_invoice_id = p_sokoclick_invoice_id) THEN
    -- F1: idempotent only for the SAME campaign (true double-submit); a ref already used by another
    -- campaign (or by no campaign) is an error, never a silent success.
    SELECT id INTO v_txn FROM public.escrow_transactions
     WHERE provider_ref = p_sokoclick_invoice_id AND campaign_id = p_campaign_id LIMIT 1;
    IF v_txn IS NULL THEN RAISE EXCEPTION 'invoice_already_used'; END IF;
    RETURN v_txn;
  END IF;
  -- O8: a brand / partner owner must be approved before money is taken (managed campaigns exempt).
  IF v_owner_role <> 'super_admin'
     AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_owner AND status = 'active') THEN
    RAISE EXCEPTION 'owner_not_active';
  END IF;
  IF v_status NOT IN ('draft','pending_funding') THEN RAISE EXCEPTION 'campaign_not_fundable'; END IF;
  v_fee := floor(v_budget * v_fee_rate); v_net := v_budget - v_fee;
  INSERT INTO public.invoices (sokoclick_invoice_id, sokoclick_receipt_id, business_id, invoice_type, amount_fcfa, status)
  VALUES (p_sokoclick_invoice_id, p_sokoclick_receipt_id, v_owner, 'campaign_escrow', v_budget, 'paid');
  INSERT INTO public.escrow_transactions (campaign_id, direction, amount_fcfa, fee_fcfa, net_amount_fcfa, provider, provider_ref, status)
  VALUES (p_campaign_id, 'inbound', v_budget, v_fee, v_net, p_provider, p_sokoclick_invoice_id, 'pending')
  RETURNING id INTO v_txn;
  PERFORM public.transition_escrow(v_txn, 'held', auth.uid(), jsonb_build_object('source','admin_confirm_campaign_funding','campaign_id',p_campaign_id));
  UPDATE public.campaigns SET status = 'published', match_pass_paid = true, updated_at = now() WHERE id = p_campaign_id;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (v_owner, 'campaign_funded', 'Campagne financée ✅',
          'Le séquestre de « ' || v_title || ' » est actif — les créateurs peuvent désormais postuler.',
          CASE WHEN v_managed AND v_owner_role = 'super_admin' THEN '/admin/briefs' ELSE '/business/campaigns' END);
  RETURN v_txn;
END; $$;

-- ── D9: leftover escrow on completion ────────────────────────────────────────
-- Exact maths (A = inbound amount, F = inbound fee, N = A − F = pool):
--   1. dead earmarks (outbound rows of creators whose deal ended 'rejected', never paid) go back
--      to the pool: refunding → refunded;
--   2. C = Σ outbound amount not refunded (paid out + any still committed);  L = N − C (unused net);
--   3. fee_kept = floor(F × C ÷ N);  fee_back = F − fee_kept;  R = L + fee_back  (refund to brand);
--   4. A = C + fee_kept + R exactly (integer, the rounding remainder goes to the brand).
-- R > 0 → one escrow row direction 'refund', status 'pending', provider_ref 'leftover:<campaign>',
-- recipient = campaign owner, amount R, fee_fcfa = fee_back, net_amount_fcfa = L. The admin confirms
-- it with admin_refund_campaign (pending → refunding → refunded). No money moves automatically.
CREATE OR REPLACE FUNCTION private.create_leftover_refund(p_campaign_id uuid, p_actor uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_owner uuid; v_title text; v_managed boolean; v_owner_role public.user_role; v_cstatus public.campaign_status;
  v_in uuid; v_amount bigint; v_fee bigint; v_net bigint; v_provider public.payment_provider; v_in_status public.escrow_status;
  v_dead RECORD; v_committed bigint; v_left bigint; v_kept bigint; v_back bigint; v_refund bigint; v_txn uuid;
  v_meta jsonb := jsonb_build_object('source', 'leftover_on_completion', 'campaign_id', p_campaign_id);
BEGIN
  SELECT owner_id, title, is_managed, owner_role, status INTO v_owner, v_title, v_managed, v_owner_role, v_cstatus
    FROM public.campaigns WHERE id = p_campaign_id;
  IF v_owner IS NULL OR v_cstatus <> 'completed' THEN RETURN NULL; END IF;
  IF EXISTS (SELECT 1 FROM public.escrow_transactions WHERE provider_ref = 'leftover:' || p_campaign_id::text) THEN
    RETURN (SELECT id FROM public.escrow_transactions WHERE provider_ref = 'leftover:' || p_campaign_id::text);
  END IF;
  SELECT id, amount_fcfa, fee_fcfa, net_amount_fcfa, provider, status INTO v_in, v_amount, v_fee, v_net, v_provider, v_in_status
    FROM public.escrow_transactions WHERE campaign_id = p_campaign_id AND direction = 'inbound' FOR UPDATE;
  IF v_in IS NULL OR v_in_status IN ('refunding', 'refunded') THEN RETURN NULL; END IF;

  FOR v_dead IN
    SELECT et.id, et.status FROM public.escrow_transactions et
      JOIN public.campaign_creators cc ON cc.id = et.campaign_creator_id
     WHERE et.campaign_id = p_campaign_id AND et.direction = 'outbound' AND cc.status = 'rejected'
       AND et.status IN ('pending', 'held', 'proof_pending', 'disputed')
     FOR UPDATE OF et
  LOOP
    PERFORM public.transition_escrow(v_dead.id, 'refunding', p_actor, v_meta);
    PERFORM public.transition_escrow(v_dead.id, 'refunded',  p_actor, v_meta);
  END LOOP;

  SELECT coalesce(sum(amount_fcfa), 0) INTO v_committed FROM public.escrow_transactions
   WHERE campaign_id = p_campaign_id AND direction = 'outbound' AND status <> 'refunded';
  v_left := v_net - v_committed;
  IF v_left <= 0 THEN RETURN NULL; END IF;
  v_kept   := private.proportional_fee_kept(v_fee, v_committed, v_net);
  v_back   := v_fee - v_kept;
  v_refund := v_left + v_back;

  INSERT INTO public.escrow_transactions (campaign_id, recipient_profile_id, direction, amount_fcfa, fee_fcfa, net_amount_fcfa,
                                          provider, provider_ref, status)
  VALUES (p_campaign_id, v_owner, 'refund', v_refund, v_back, v_left, v_provider, 'leftover:' || p_campaign_id::text, 'pending')
  RETURNING id INTO v_txn;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (v_owner, 'campaign_leftover_refund_pending', 'Reste du séquestre à rembourser',
          'La campagne « ' || v_title || ' » est terminée. ' || v_refund::text ||
          ' FCFA non utilisés (frais Bayele inclus au prorata) vous seront remboursés après confirmation par Bayele.',
          CASE WHEN v_managed AND v_owner_role = 'super_admin' THEN '/admin/briefs' ELSE '/business/campaigns' END);
  RETURN v_txn;
END;
$$;
REVOKE ALL ON FUNCTION private.create_leftover_refund(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- creator payout (0027 body) + D9 leftover at auto-completion.
CREATE OR REPLACE FUNCTION public.admin_confirm_creator_payout(
  p_campaign_creator_id uuid, p_provider public.payment_provider DEFAULT 'mtn_momo', p_disbursement_ref text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_creator uuid; v_campaign uuid; v_amount bigint; v_title text;
  v_partner uuid; v_rate numeric(4,3); v_commission bigint := 0; v_net bigint;
  v_txn uuid; v_txn_status public.escrow_status; v_remaining int;
BEGIN
  IF NOT private.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  SELECT cc.creator_id, cc.campaign_id, cc.agreed_payout_fcfa, c.title, cc.partner_id, cc.partner_commission_rate
    INTO v_creator, v_campaign, v_amount, v_title, v_partner, v_rate
    FROM public.campaign_creators cc JOIN public.campaigns c ON c.id = cc.campaign_id
    WHERE cc.id = p_campaign_creator_id FOR UPDATE OF cc;
  IF v_creator IS NULL THEN RAISE EXCEPTION 'application_not_found'; END IF;
  SELECT id, status INTO v_txn, v_txn_status
    FROM public.escrow_transactions
    WHERE campaign_creator_id = p_campaign_creator_id AND direction = 'outbound' FOR UPDATE;
  IF v_txn IS NULL THEN RAISE EXCEPTION 'no_payout_txn'; END IF;
  IF v_txn_status = 'paid_out' THEN RETURN v_txn; END IF;
  IF v_txn_status <> 'releasable' THEN RAISE EXCEPTION 'payout_not_releasable'; END IF;

  IF v_partner IS NOT NULL AND v_rate IS NOT NULL THEN
    v_commission := floor(v_amount * v_rate)::bigint;
  END IF;
  v_net := v_amount - v_commission;

  UPDATE public.escrow_transactions
     SET provider = p_provider, fee_fcfa = v_commission, net_amount_fcfa = v_net, updated_at = now()
   WHERE id = v_txn;
  PERFORM public.transition_escrow(v_txn, 'paid_out', auth.uid(),
          jsonb_build_object('source','admin_confirm_creator_payout','provider',p_provider,'disbursement_ref',p_disbursement_ref,
                             'campaign_creator_id',p_campaign_creator_id,'partner_id',v_partner,'partner_commission_fcfa',v_commission));
  UPDATE public.campaign_creators SET status = 'paid', updated_at = now() WHERE id = p_campaign_creator_id;

  IF v_commission > 0 THEN
    INSERT INTO public.partner_commissions (campaign_creator_id, partner_id, creator_id, gross_payout_fcfa, commission_rate, commission_fcfa)
    VALUES (p_campaign_creator_id, v_partner, v_creator, v_amount, v_rate, v_commission)
    ON CONFLICT (campaign_creator_id) DO NOTHING;
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (v_partner, 'commission_owed', 'Commission enregistrée 💼',
            'Votre commission de ' || v_commission::text || ' FCFA sur « ' || v_title || ' » est enregistrée et sera versée par Bayele.',
            '/partner/creators');
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (v_creator, 'payout_sent', 'Paiement envoyé 💸',
          'Votre paiement de ' || v_net::text || ' FCFA pour « ' || v_title || ' » a été envoyé par Mobile Money.' ||
          CASE WHEN v_commission > 0 THEN ' (Commission partenaire déduite : ' || v_commission::text || ' FCFA.)' ELSE '' END,
          '/creator/dashboard');

  SELECT count(*) INTO v_remaining FROM public.campaign_creators
    WHERE campaign_id = v_campaign AND status IN ('approved','content_submitted','verified');
  IF v_remaining = 0 THEN
    UPDATE public.campaign_creators SET status = 'rejected', updated_at = now()
      WHERE campaign_id = v_campaign AND status = 'applied';
    UPDATE public.campaigns SET status = 'completed', updated_at = now()
      WHERE id = v_campaign AND status IN ('published','in_progress');
    IF FOUND THEN PERFORM private.create_leftover_refund(v_campaign, auth.uid()); END IF;   -- D9
  END IF;
  RETURN v_txn;
END; $$;

-- refund (0033 body) + D9: a pending leftover refund is confirmed through the same admin RPC.
CREATE OR REPLACE FUNCTION public.admin_refund_campaign(
  p_campaign_id uuid, p_sokoclick_receipt_id text DEFAULT NULL, p_reason text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_owner uuid; v_cstatus public.campaign_status; v_title text;
  v_managed boolean; v_owner_role public.user_role;
  v_in uuid; v_in_status public.escrow_status; v_paid int; v_out RECORD;
  v_left uuid; v_left_status public.escrow_status; v_left_amount bigint;
  v_meta jsonb := jsonb_build_object('source','admin_refund_campaign','receipt',p_sokoclick_receipt_id,'reason',p_reason);
BEGIN
  IF NOT private.is_admin(v_admin) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  SELECT owner_id, status, title, is_managed, owner_role INTO v_owner, v_cstatus, v_title, v_managed, v_owner_role
    FROM public.campaigns WHERE id = p_campaign_id FOR UPDATE;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'campaign_not_found'; END IF;

  -- D9: leftover refund of a completed campaign.
  SELECT id, status, amount_fcfa INTO v_left, v_left_status, v_left_amount
    FROM public.escrow_transactions WHERE campaign_id = p_campaign_id AND direction = 'refund' FOR UPDATE;
  IF v_left IS NOT NULL THEN
    IF v_left_status = 'refunded' THEN RETURN v_left; END IF;   -- idempotent
    PERFORM public.transition_escrow(v_left, 'refunding', v_admin, v_meta);
    PERFORM public.transition_escrow(v_left, 'refunded',  v_admin, v_meta);
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (v_owner, 'campaign_leftover_refunded', 'Remboursement effectué',
            'Le reste du séquestre de « ' || v_title || ' » (' || v_left_amount::text || ' FCFA) vous a été remboursé.',
            CASE WHEN v_managed AND v_owner_role = 'super_admin' THEN '/admin/briefs' ELSE '/business/campaigns' END);
    RETURN v_left;
  END IF;

  SELECT id, status INTO v_in, v_in_status
    FROM public.escrow_transactions WHERE campaign_id = p_campaign_id AND direction = 'inbound' FOR UPDATE;
  IF v_in IS NULL THEN RAISE EXCEPTION 'campaign_not_funded'; END IF;
  IF v_in_status = 'refunded' AND v_cstatus = 'cancelled' THEN RETURN v_in; END IF;

  -- Lock ALL outbound rows before counting paid-out, closing the TOCTOU vs admin_confirm_creator_payout.
  PERFORM 1 FROM public.escrow_transactions
    WHERE campaign_id = p_campaign_id AND direction = 'outbound' FOR UPDATE;
  SELECT count(*) INTO v_paid FROM public.escrow_transactions
    WHERE campaign_id = p_campaign_id AND direction = 'outbound' AND status = 'paid_out';
  IF v_paid > 0 THEN RAISE EXCEPTION 'partial_payouts_present'; END IF;

  FOR v_out IN
    SELECT id, status FROM public.escrow_transactions
    WHERE campaign_id = p_campaign_id AND direction = 'outbound'
      AND status IN ('pending','held','proof_pending','releasable','disputed') FOR UPDATE
  LOOP
    IF v_out.status = 'releasable' THEN
      PERFORM public.transition_escrow(v_out.id, 'disputed', v_admin, v_meta);
      PERFORM public.transition_escrow(v_out.id, 'refunding', v_admin, v_meta);
    ELSIF v_out.status = 'disputed' THEN
      PERFORM public.transition_escrow(v_out.id, 'refunding', v_admin, v_meta);
    ELSE
      PERFORM public.transition_escrow(v_out.id, 'refunding', v_admin, v_meta);
    END IF;
    PERFORM public.transition_escrow(v_out.id, 'refunded', v_admin, v_meta);
  END LOOP;

  UPDATE public.campaign_creators SET status = 'rejected', updated_at = now()
    WHERE campaign_id = p_campaign_id
      AND status IN ('invited','applied','approved','content_submitted','verified','disputed');

  IF v_in_status = 'refunded' THEN
    NULL;
  ELSIF v_in_status IN ('pending','held','disputed') THEN
    PERFORM public.transition_escrow(v_in, 'refunding', v_admin, v_meta);
    PERFORM public.transition_escrow(v_in, 'refunded',  v_admin, v_meta);
  ELSIF v_in_status = 'refunding' THEN
    PERFORM public.transition_escrow(v_in, 'refunded',  v_admin, v_meta);
  ELSE
    RAISE EXCEPTION 'inbound_not_refundable';
  END IF;

  UPDATE public.escrow_transactions SET provider_ref = COALESCE(p_sokoclick_receipt_id, provider_ref), updated_at = now() WHERE id = v_in;
  UPDATE public.campaigns SET status = 'cancelled', updated_at = now() WHERE id = p_campaign_id;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (v_owner, 'campaign_refunded', 'Remboursement effectué',
          'Votre campagne « ' || v_title || ' » a été annulée et le séquestre remboursé' || COALESCE(' : ' || p_reason, '') || '.',
          CASE WHEN v_managed AND v_owner_role = 'super_admin' THEN '/admin/briefs' ELSE '/business/campaigns' END);
  RETURN v_in;
END; $$;

-- Admin queue of pending leftover refunds (for the existing refund queue page).
CREATE OR REPLACE FUNCTION public.admin_pending_leftover_refunds()
RETURNS TABLE (
  refund_txn_id uuid, campaign_id uuid, campaign_title text, owner_id uuid, owner_name text, is_managed boolean,
  inbound_amount_fcfa bigint, inbound_fee_fcfa bigint, pool_net_fcfa bigint, used_net_fcfa bigint,
  unused_net_fcfa bigint, fee_returned_fcfa bigint, refund_fcfa bigint, created_at timestamptz
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT private.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  RETURN QUERY
  SELECT r.id, c.id, c.title, c.owner_id, p.display_name, c.is_managed,
         i.amount_fcfa, i.fee_fcfa, i.net_amount_fcfa, i.net_amount_fcfa - r.net_amount_fcfa,
         r.net_amount_fcfa, r.fee_fcfa, r.amount_fcfa, r.created_at
    FROM public.escrow_transactions r
    JOIN public.campaigns c ON c.id = r.campaign_id
    JOIN public.profiles p ON p.id = c.owner_id
    JOIN public.escrow_transactions i ON i.campaign_id = c.id AND i.direction = 'inbound'
   WHERE r.direction = 'refund' AND r.status IN ('pending', 'refunding')
   ORDER BY r.created_at
   LIMIT 200;
END;
$$;

-- Backfill: completed campaigns already holding unused escrow get their pending refund now (no money moves).
DO $$
DECLARE v_c uuid;
BEGIN
  FOR v_c IN
    SELECT c.id FROM public.campaigns c
     WHERE c.status = 'completed'
       AND EXISTS (SELECT 1 FROM public.escrow_transactions i WHERE i.campaign_id = c.id AND i.direction = 'inbound' AND i.status = 'held')
       AND NOT EXISTS (SELECT 1 FROM public.escrow_transactions r WHERE r.campaign_id = c.id AND r.direction = 'refund')
  LOOP
    PERFORM private.create_leftover_refund(v_c, (SELECT owner_id FROM public.campaigns WHERE id = v_c));
  END LOOP;
END $$;

-- ── Grants ──────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.respond_retainer(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_terminate_retainer(uuid, bigint, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_retainer_settlements() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_confirm_retainer_settlement(uuid, public.payment_provider, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_pending_leftover_refunds() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_retainer(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_terminate_retainer(uuid, bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_retainer_settlements() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_confirm_retainer_settlement(uuid, public.payment_provider, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_pending_leftover_refunds() TO authenticated;
