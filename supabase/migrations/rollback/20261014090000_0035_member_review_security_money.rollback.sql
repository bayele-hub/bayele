-- ============================================================================
-- Rollback of:        20261014090000_0035_member_review_security_money.sql
-- Inverse type:       TRUE INVERSE — restores the pre-0035 bodies (0005 is_admin, 0015 retainers, 0018 webhook,
--                     0027 partner apply + creator payout, 0033 refund, 0034 campaign funding) and the TRUNCATE
--                     grants (RE-OPENS A14; granted on every public table).
-- Precondition:       roll back 0037, then 0036 first. Aborts if retainer settlements or leftover-refund escrow rows exist
--                     (money records would be lost). Run in the SQL editor (contains DROP/DELETE — not the connector).
-- ============================================================================

DO $$
BEGIN
  IF to_regclass('public.retainer_settlements') IS NOT NULL AND EXISTS (SELECT 1 FROM public.retainer_settlements) THEN
    RAISE EXCEPTION 'rollback_0035_blocked: retainer settlements exist';
  END IF;
  IF EXISTS (SELECT 1 FROM public.escrow_transactions WHERE direction = 'refund') THEN
    RAISE EXCEPTION 'rollback_0035_blocked: leftover refund escrow rows exist';
  END IF;
  IF NOT has_table_privilege('authenticated', 'public.profiles', 'SELECT') THEN
    RAISE EXCEPTION 'rollback_0035_blocked: roll back 0037 first';
  END IF;
  IF to_regclass('public.member_moderation_events') IS NOT NULL THEN
    RAISE EXCEPTION 'rollback_0035_blocked: roll back 0036 first';
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.admin_pending_leftover_refunds();
DROP FUNCTION IF EXISTS public.admin_confirm_retainer_settlement(uuid, public.payment_provider, text);
DROP FUNCTION IF EXISTS public.admin_retainer_settlements();
DROP FUNCTION IF EXISTS public.admin_terminate_retainer(uuid, bigint, text);
DROP FUNCTION IF EXISTS public.respond_retainer(uuid, boolean);
DROP FUNCTION IF EXISTS public.get_my_contact();
DROP FUNCTION IF EXISTS private.create_leftover_refund(uuid, uuid);
DROP FUNCTION IF EXISTS private.proportional_fee_kept(bigint, bigint, bigint);
DROP TABLE IF EXISTS public.retainer_settlements;
ALTER TABLE public.agency_retainers DROP COLUMN IF EXISTS partner_accepted_at, DROP COLUMN IF EXISTS partner_declined_at;

-- A15 policy back to 0027 (any consultant).
ALTER POLICY "browse open campaigns" ON public.campaigns USING (
  status IN ('published', 'in_progress', 'completed')
  AND (is_public OR private.is_creator((SELECT auth.uid())) OR private.is_partner((SELECT auth.uid())))
);
DROP FUNCTION IF EXISTS private.is_active_partner(uuid);

-- A14 inverse (re-opens TRUNCATE on every public table; prefer fixing forward). A1 is 0037's rollback.
GRANT TRUNCATE ON ALL TABLES IN SCHEMA public TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT TRUNCATE ON TABLES TO anon, authenticated;

-- Pre-0035 bodies.
CREATE OR REPLACE FUNCTION private.is_admin(p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = p_user_id AND ur.role = 'super_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.partner_apply_for_creator(p_campaign_id uuid, p_creator_id uuid)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_owner uuid; v_status public.campaign_status; v_payout bigint; v_title text;
  v_cc uuid; v_cstatus public.account_status; v_cname text; v_pname text;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.partner_creator_links
                  WHERE partner_id = v_actor AND creator_id = p_creator_id AND status = 'active') THEN
    RAISE EXCEPTION 'not_representing';
  END IF;
  SELECT status, display_name INTO v_cstatus, v_cname FROM public.profiles WHERE id = p_creator_id;
  IF v_cstatus IS NULL OR v_cstatus IN ('suspended', 'rejected') THEN RAISE EXCEPTION 'profile_not_eligible'; END IF;
  SELECT display_name INTO v_pname FROM public.profiles WHERE id = v_actor;

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
  v_retainer uuid;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = v_actor AND ur.role = 'business') THEN
    RAISE EXCEPTION 'not_a_business';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v_actor AND p.status = 'active') THEN
    RAISE EXCEPTION 'profile_not_active';
  END IF;

  IF p_consultant_id = v_actor THEN RAISE EXCEPTION 'cannot_retain_self'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'consultant'
    WHERE p.id = p_consultant_id AND p.status = 'active'
  ) THEN
    RAISE EXCEPTION 'consultant_not_found';
  END IF;

  IF p_contract_value <= 0 OR p_bayele_cut < 0 OR p_consultant_fee < 0 OR p_media_budget < 0 OR p_kpi_bonus < 0 THEN
    RAISE EXCEPTION 'invalid_amounts';
  END IF;
  IF p_contract_value <> (p_bayele_cut + p_consultant_fee + p_media_budget) THEN
    RAISE EXCEPTION 'invalid_split';  -- also enforced by retainer_math_integrity CHECK
  END IF;

  INSERT INTO public.agency_retainers
    (business_id, consultant_id, contract_value_fcfa, bayele_cut_fcfa, consultant_fee_fcfa, media_budget_fcfa, kpi_bonus_fcfa, status)
  VALUES (v_actor, p_consultant_id, p_contract_value, p_bayele_cut, p_consultant_fee, p_media_budget, p_kpi_bonus, 'draft')
  RETURNING id INTO v_retainer;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (p_consultant_id, 'retainer_proposed', 'Nouveau contrat agence 📄',
          'Une marque vous propose un rétainer de ' || p_consultant_fee::text || ' FCFA (honoraires).',
          '/consultant/dashboard');

  RETURN v_retainer;
END;
$$;

CREATE OR REPLACE FUNCTION public.attach_retainer_invoice(
  p_retainer_id          uuid,
  p_sokoclick_invoice_id text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_business uuid; v_status public.retainer_status; v_existing text;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_sokoclick_invoice_id IS NULL OR length(btrim(p_sokoclick_invoice_id)) = 0 THEN
    RAISE EXCEPTION 'missing_invoice_id';
  END IF;

  SELECT business_id, status, sokoclick_invoice_id
    INTO v_business, v_status, v_existing
    FROM public.agency_retainers WHERE id = p_retainer_id FOR UPDATE;
  IF v_business IS NULL THEN RAISE EXCEPTION 'retainer_not_found'; END IF;
  IF NOT (v_business = v_actor OR private.is_admin(v_actor)) THEN RAISE EXCEPTION 'not_authorized'; END IF;

  -- Idempotent: same invoice already attached → no-op.
  IF v_existing IS NOT NULL AND v_existing = p_sokoclick_invoice_id THEN RETURN; END IF;
  IF v_status <> 'draft' THEN RAISE EXCEPTION 'not_draft'; END IF;

  UPDATE public.agency_retainers
    SET sokoclick_invoice_id = p_sokoclick_invoice_id, status = 'invoiced'
    WHERE id = p_retainer_id;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (v_business, 'retainer_invoiced', 'Facture prête',
          'Votre facture SokoClick pour le rétainer est prête. Réglez-la par Mobile Money pour activer le contrat.',
          '/business/retainers');
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_sokoclick_invoice_paid(
  p_sokoclick_invoice_id text, p_sokoclick_receipt_id text, p_business_id uuid,
  p_invoice_type public.invoice_type, p_amount_fcfa bigint, p_pdf_url text,
  p_campaign_id uuid DEFAULT NULL, p_retainer_id uuid DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_fee_rate numeric; v_fee_fcfa bigint; v_net_fcfa bigint; v_txn_id uuid; v_camp_status public.campaign_status;
BEGIN
  IF EXISTS (SELECT 1 FROM public.invoices WHERE sokoclick_invoice_id = p_sokoclick_invoice_id) THEN RETURN; END IF;

  -- Guard: never fund a campaign twice (a different invoice id for an already-funded campaign is a no-op).
  IF p_campaign_id IS NOT NULL THEN
    SELECT status INTO v_camp_status FROM public.campaigns WHERE id = p_campaign_id;
    IF v_camp_status IS NULL THEN RAISE EXCEPTION 'campaign % not found', p_campaign_id; END IF;
    IF v_camp_status NOT IN ('draft','pending_funding')
       OR EXISTS (SELECT 1 FROM public.escrow_transactions
                  WHERE campaign_id = p_campaign_id AND direction = 'inbound' AND status <> 'refunded')
    THEN RETURN; END IF;
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

CREATE OR REPLACE FUNCTION public.admin_confirm_retainer_funding(
  p_retainer_id          uuid,
  p_sokoclick_receipt_id text DEFAULT NULL,
  p_pdf_url              text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_business uuid; v_consultant uuid; v_value bigint; v_status public.retainer_status; v_invoice text;
BEGIN
  IF NOT private.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;

  SELECT business_id, consultant_id, contract_value_fcfa, status, sokoclick_invoice_id
    INTO v_business, v_consultant, v_value, v_status, v_invoice
    FROM public.agency_retainers WHERE id = p_retainer_id FOR UPDATE;
  IF v_business IS NULL THEN RAISE EXCEPTION 'retainer_not_found'; END IF;
  IF v_status = 'funded' OR v_status = 'active' OR v_status = 'completed' THEN RETURN; END IF;  -- idempotent
  IF v_invoice IS NULL THEN RAISE EXCEPTION 'not_invoiced'; END IF;

  -- Single funding path: records the invoice (idempotent) and flips the retainer to 'funded'.
  PERFORM public.handle_sokoclick_invoice_paid(
    v_invoice, p_sokoclick_receipt_id, v_business, 'agency_retainer', v_value, p_pdf_url, NULL, p_retainer_id);

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (v_business, 'retainer_funded', 'Rétainer financé ✅',
          'Votre paiement est confirmé — le contrat agence est actif côté financement.',
          '/business/retainers');
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (v_consultant, 'retainer_funded', 'Rétainer financé ✅',
          'La marque a financé le contrat. Vous pouvez démarrer la mission.',
          '/consultant/dashboard');
END;
$$;

CREATE OR REPLACE FUNCTION public.transition_retainer(
  p_retainer_id uuid,
  p_to_status   public.retainer_status
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_business uuid; v_consultant uuid; v_from public.retainer_status; v_is_admin boolean; v_allowed boolean;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT business_id, consultant_id, status INTO v_business, v_consultant, v_from
    FROM public.agency_retainers WHERE id = p_retainer_id FOR UPDATE;
  IF v_business IS NULL THEN RAISE EXCEPTION 'retainer_not_found'; END IF;
  IF v_from = p_to_status THEN RETURN; END IF;

  v_is_admin := private.is_admin(v_actor);

  -- Hop matrix.
  v_allowed := CASE
    WHEN v_from = 'funded' AND p_to_status = 'active'                                    THEN TRUE
    WHEN v_from = 'active' AND p_to_status = 'completed'                                 THEN TRUE
    WHEN v_from IN ('draft','invoiced','funded','active') AND p_to_status = 'terminated' THEN TRUE
    ELSE FALSE
  END;
  IF NOT v_allowed THEN RAISE EXCEPTION 'illegal_retainer_transition'; END IF;

  -- Authorization by target: active/completed are admin-only; terminate is party-or-admin.
  IF p_to_status IN ('active','completed') THEN
    IF NOT v_is_admin THEN RAISE EXCEPTION 'not_authorized'; END IF;
  ELSE  -- terminated
    IF NOT (v_is_admin OR v_actor = v_business OR v_actor = v_consultant) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  END IF;

  UPDATE public.agency_retainers SET status = p_to_status WHERE id = p_retainer_id;

  IF p_to_status = 'active' THEN
    INSERT INTO public.notifications (user_id, type, title, body, link) VALUES
      (v_consultant, 'retainer_active', 'Mission démarrée 🚀', 'Le contrat agence est actif. Bon travail !', '/consultant/dashboard'),
      (v_business,   'retainer_active', 'Mission démarrée 🚀', 'Votre consultant a démarré la mission.', '/business/retainers');
  ELSIF p_to_status = 'completed' THEN
    INSERT INTO public.notifications (user_id, type, title, body, link) VALUES
      (v_consultant, 'retainer_completed', 'Contrat terminé 🎉', 'La mission est clôturée — honoraires et bonus KPI en cours de versement.', '/consultant/dashboard'),
      (v_business,   'retainer_completed', 'Contrat terminé 🎉', 'La mission agence est clôturée.', '/business/retainers');
  ELSE  -- terminated
    INSERT INTO public.notifications (user_id, type, title, body, link) VALUES
      (v_consultant, 'retainer_terminated', 'Contrat annulé', 'Le contrat agence a été annulé.', '/consultant/dashboard'),
      (v_business,   'retainer_terminated', 'Contrat annulé', 'Le contrat agence a été annulé.', '/business/retainers');
  END IF;
END;
$$;

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

  -- Managed deal: the partner's share comes out of the creator payout, rounded down (in the
  -- creator's favour). The full agreed amount still leaves the pool.
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
  END IF;
  RETURN v_txn;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_refund_campaign(
  p_campaign_id uuid, p_sokoclick_receipt_id text DEFAULT NULL, p_reason text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_owner uuid; v_cstatus public.campaign_status; v_title text;
  v_managed boolean; v_owner_role public.user_role;
  v_in uuid; v_in_status public.escrow_status; v_paid int; v_out RECORD;
  v_meta jsonb := jsonb_build_object('source','admin_refund_campaign','receipt',p_sokoclick_receipt_id,'reason',p_reason);
BEGIN
  IF NOT private.is_admin(v_admin) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  SELECT owner_id, status, title, is_managed, owner_role INTO v_owner, v_cstatus, v_title, v_managed, v_owner_role
    FROM public.campaigns WHERE id = p_campaign_id FOR UPDATE;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'campaign_not_found'; END IF;
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

DELETE FROM supabase_migrations.schema_migrations WHERE version = '20261014090000';
