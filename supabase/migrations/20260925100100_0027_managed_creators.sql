-- ============================================================================
-- Migration:          Managed creators — partners represent creator portfolios
-- Version:            20260925100100_0027
-- Date:               2026-09-25
-- Team:               Bayele Core Platform Engineering
-- Dependencies:       0001, 0005, 0018, 0021, 0022
-- Rollback Script:    supabase/migrations/rollback/20260925100100_0027_managed_creators.rollback.sql
-- ============================================================================
-- Two ways to work on Bayele:
--   Independent creator:  Brand → Bayele → Creator            (Bayele keeps its platform fee)
--   Managed creator:      Brand → Bayele → Partner → Creator  (+ the partner's management commission)
--
-- Rules:
--   * CONSENT — a partner invites, the creator accepts. Nobody is represented without saying yes.
--   * EXCLUSIVE — a creator has at most one active partner at a time.
--   * The commission is a share of the CREATOR's payout (industry-standard talent management),
--     1 %–30 %, fixed per representation. The brand's price and Bayele's platform fee are unchanged.
--   * SNAPSHOT — the partner and rate are frozen on a deal when the brand approves it. Ending the
--     representation later never changes a deal already approved.
--   * At payout the admin sends net = payout − commission to the creator (recorded on the outbound
--     escrow row as fee/net) and the commission is booked in partner_commissions ('owed'), then
--     confirmed separately when the partner has been paid. The escrow pool maths are untouched:
--     the outbound row still releases the full agreed payout from the pool.
--   * A partner can apply to open campaigns ON BEHALF of a creator they actively represent.
--   * All writes go through SECURITY DEFINER RPCs; tables are read-only to clients (RLS).
-- ============================================================================

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'representation_status') THEN
  CREATE TYPE public.representation_status AS ENUM ('pending', 'active', 'declined', 'ended'); END IF; END $$;

-- ── Representation links ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.partner_creator_links (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  creator_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  commission_rate numeric(4,3) NOT NULL,
  status          public.representation_status NOT NULL DEFAULT 'pending',
  message         text,
  invited_at      timestamptz NOT NULL DEFAULT timezone('utc', now()),
  responded_at    timestamptz,
  ended_at        timestamptz,
  ended_by        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT pcl_not_self CHECK (partner_id <> creator_id),
  CONSTRAINT pcl_rate_bounds CHECK (commission_rate >= 0.010 AND commission_rate <= 0.300),
  CONSTRAINT pcl_message_len CHECK (message IS NULL OR char_length(message) <= 500)
);
CREATE UNIQUE INDEX IF NOT EXISTS pcl_one_active_partner_per_creator
  ON public.partner_creator_links (creator_id) WHERE status = 'active';
CREATE UNIQUE INDEX IF NOT EXISTS pcl_one_open_link_per_pair
  ON public.partner_creator_links (partner_id, creator_id) WHERE status IN ('pending', 'active');
CREATE INDEX IF NOT EXISTS pcl_partner_idx ON public.partner_creator_links (partner_id, status);
CREATE INDEX IF NOT EXISTS pcl_ended_by_idx ON public.partner_creator_links (ended_by);

ALTER TABLE public.partner_creator_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "representation parties read their links" ON public.partner_creator_links;
CREATE POLICY "representation parties read their links" ON public.partner_creator_links FOR SELECT USING (
  partner_id = (SELECT auth.uid()) OR creator_id = (SELECT auth.uid()) OR private.is_admin((SELECT auth.uid()))
);
REVOKE ALL ON public.partner_creator_links FROM anon, authenticated;
GRANT SELECT ON public.partner_creator_links TO authenticated;
GRANT ALL ON public.partner_creator_links TO service_role;

-- ── Deal snapshot on campaign_creators ──────────────────────────────────────
ALTER TABLE public.campaign_creators
  ADD COLUMN IF NOT EXISTS partner_id uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS partner_commission_rate numeric(4,3),
  ADD COLUMN IF NOT EXISTS applied_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cc_partner_snapshot_pair') THEN
    ALTER TABLE public.campaign_creators ADD CONSTRAINT cc_partner_snapshot_pair
      CHECK ((partner_id IS NULL) = (partner_commission_rate IS NULL));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS campaign_creators_partner_idx ON public.campaign_creators (partner_id);
CREATE INDEX IF NOT EXISTS campaign_creators_applied_by_idx ON public.campaign_creators (applied_by);

-- ── Commission ledger ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.partner_commissions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_creator_id uuid NOT NULL UNIQUE REFERENCES public.campaign_creators(id) ON DELETE RESTRICT,
  partner_id          uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  creator_id          uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  gross_payout_fcfa   bigint NOT NULL CHECK (gross_payout_fcfa >= 0),
  commission_rate     numeric(4,3) NOT NULL,
  commission_fcfa     bigint NOT NULL CHECK (commission_fcfa >= 0),
  status              text NOT NULL DEFAULT 'owed' CHECK (status IN ('owed', 'paid')),
  provider            public.payment_provider,
  disbursement_ref    text,
  paid_at             timestamptz,
  created_at          timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT pc_commission_le_gross CHECK (commission_fcfa <= gross_payout_fcfa)
);
CREATE INDEX IF NOT EXISTS partner_commissions_partner_idx ON public.partner_commissions (partner_id, status);
CREATE INDEX IF NOT EXISTS partner_commissions_creator_idx ON public.partner_commissions (creator_id);

ALTER TABLE public.partner_commissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "commission parties read their ledger" ON public.partner_commissions;
CREATE POLICY "commission parties read their ledger" ON public.partner_commissions FOR SELECT USING (
  partner_id = (SELECT auth.uid()) OR creator_id = (SELECT auth.uid()) OR private.is_admin((SELECT auth.uid()))
);
REVOKE ALL ON public.partner_commissions FROM anon, authenticated;
GRANT SELECT ON public.partner_commissions TO authenticated;
GRANT ALL ON public.partner_commissions TO service_role;

-- ── Helpers ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.is_partner(p_user_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p_user_id AND ur.role = 'consultant');
$function$;
GRANT EXECUTE ON FUNCTION private.is_partner(uuid) TO anon, authenticated, service_role;

-- Partners browse the same open campaigns as creators (they apply on their creators' behalf).
DROP POLICY IF EXISTS "browse open campaigns" ON public.campaigns;
CREATE POLICY "browse open campaigns" ON public.campaigns FOR SELECT USING (
  status IN ('published', 'in_progress', 'completed')
  AND (is_public OR private.is_creator((SELECT auth.uid())) OR private.is_partner((SELECT auth.uid())))
);

-- Freeze partner + rate on the deal at the moment the brand approves it.
CREATE OR REPLACE FUNCTION private.snapshot_deal_partner()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
BEGIN
  IF NEW.status = 'approved' AND NEW.partner_id IS NULL
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'approved') THEN
    SELECT l.partner_id, l.commission_rate INTO NEW.partner_id, NEW.partner_commission_rate
      FROM public.partner_creator_links l
     WHERE l.creator_id = NEW.creator_id AND l.status = 'active'
     LIMIT 1;
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION private.snapshot_deal_partner() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_snapshot_deal_partner ON public.campaign_creators;
CREATE TRIGGER trg_snapshot_deal_partner BEFORE INSERT OR UPDATE OF status ON public.campaign_creators
  FOR EACH ROW EXECUTE FUNCTION private.snapshot_deal_partner();

-- ── RPC: partner invites a creator (by handle) ──────────────────────────────
CREATE OR REPLACE FUNCTION public.partner_invite_creator(
  p_creator_handle text, p_commission_rate numeric, p_message text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_creator uuid; v_cstatus public.account_status; v_partner_name text;
  v_rate numeric(4,3); v_msg text := nullif(btrim(coalesce(p_message, '')), ''); v_link uuid;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT private.is_partner(v_actor) THEN RAISE EXCEPTION 'not_a_partner'; END IF;
  SELECT p.display_name INTO v_partner_name FROM public.profiles p WHERE p.id = v_actor AND p.status = 'active';
  IF v_partner_name IS NULL THEN RAISE EXCEPTION 'partner_not_active'; END IF;
  IF p_commission_rate IS NULL OR p_commission_rate < 0.01 OR p_commission_rate > 0.30 THEN
    RAISE EXCEPTION 'invalid_commission_rate';
  END IF;
  v_rate := round(p_commission_rate, 3);
  IF v_msg IS NOT NULL AND char_length(v_msg) > 500 THEN RAISE EXCEPTION 'message_too_long'; END IF;

  SELECT p.id, p.status INTO v_creator, v_cstatus
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'creator'
   WHERE p.handle = lower(btrim(ltrim(btrim(coalesce(p_creator_handle, '')), '@')));
  IF v_creator IS NULL THEN RAISE EXCEPTION 'creator_not_found'; END IF;
  IF v_creator = v_actor THEN RAISE EXCEPTION 'cannot_represent_self'; END IF;
  IF v_cstatus IN ('suspended', 'rejected') THEN RAISE EXCEPTION 'creator_not_eligible'; END IF;

  -- Serialize invites per creator so the checks below can't race.
  PERFORM pg_advisory_xact_lock(hashtext('bayele.representation:' || v_creator::text));
  IF EXISTS (SELECT 1 FROM public.partner_creator_links
              WHERE creator_id = v_creator AND partner_id = v_actor AND status = 'active') THEN
    RAISE EXCEPTION 'already_representing';
  END IF;
  IF EXISTS (SELECT 1 FROM public.partner_creator_links WHERE creator_id = v_creator AND status = 'active') THEN
    RAISE EXCEPTION 'creator_already_represented';
  END IF;
  IF EXISTS (SELECT 1 FROM public.partner_creator_links
              WHERE creator_id = v_creator AND partner_id = v_actor AND status = 'pending') THEN
    RAISE EXCEPTION 'invite_already_pending';
  END IF;
  IF (SELECT count(*) FROM public.partner_creator_links WHERE partner_id = v_actor AND status = 'pending') >= 100 THEN
    RAISE EXCEPTION 'too_many_pending_invites';
  END IF;

  INSERT INTO public.partner_creator_links (partner_id, creator_id, commission_rate, message)
  VALUES (v_actor, v_creator, v_rate, v_msg)
  RETURNING id INTO v_link;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (v_creator, 'representation_invite', 'Proposition de représentation',
          v_partner_name || ' propose de vous représenter sur Bayele (commission ' ||
          to_char(v_rate * 100, 'FM990.#') || ' % de vos gains). Acceptez ou refusez.',
          '/creator/partner');
  RETURN v_link;
END;
$function$;

-- ── RPC: creator accepts / declines ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.respond_representation(p_link_id uuid, p_accept boolean)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_partner uuid; v_creator uuid; v_status public.representation_status; v_name text;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT partner_id, creator_id, status INTO v_partner, v_creator, v_status
    FROM public.partner_creator_links WHERE id = p_link_id;
  IF v_partner IS NULL THEN RAISE EXCEPTION 'link_not_found'; END IF;
  IF v_creator <> v_actor THEN RAISE EXCEPTION 'not_authorized'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('bayele.representation:' || v_creator::text));
  SELECT status INTO v_status FROM public.partner_creator_links WHERE id = p_link_id FOR UPDATE;
  IF (p_accept AND v_status = 'active') OR (NOT p_accept AND v_status = 'declined') THEN RETURN; END IF;
  IF v_status <> 'pending' THEN RAISE EXCEPTION 'not_pending'; END IF;
  SELECT display_name INTO v_name FROM public.profiles WHERE id = v_creator;

  IF p_accept THEN
    IF EXISTS (SELECT 1 FROM public.partner_creator_links WHERE creator_id = v_creator AND status = 'active') THEN
      RAISE EXCEPTION 'creator_already_represented';
    END IF;
    UPDATE public.partner_creator_links SET status = 'active', responded_at = now() WHERE id = p_link_id;
    -- Exclusive representation: any other open offers lapse.
    UPDATE public.partner_creator_links SET status = 'declined', responded_at = now()
     WHERE creator_id = v_creator AND status = 'pending' AND id <> p_link_id;
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (v_partner, 'representation_accepted', 'Représentation acceptée 🤝',
            v_name || ' a accepté votre représentation. Vous pouvez postuler aux campagnes pour ce créateur.',
            '/partner/creators');
  ELSE
    UPDATE public.partner_creator_links SET status = 'declined', responded_at = now() WHERE id = p_link_id;
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (v_partner, 'representation_declined', 'Proposition refusée',
            v_name || ' a refusé votre proposition de représentation.', '/partner/creators');
  END IF;
END;
$function$;

-- ── RPC: either side ends a representation (or the partner withdraws an offer) ──
CREATE OR REPLACE FUNCTION public.end_representation(p_link_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_partner uuid; v_creator uuid; v_status public.representation_status; v_other uuid; v_name text;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT partner_id, creator_id, status INTO v_partner, v_creator, v_status
    FROM public.partner_creator_links WHERE id = p_link_id FOR UPDATE;
  IF v_partner IS NULL THEN RAISE EXCEPTION 'link_not_found'; END IF;
  IF v_actor <> v_partner AND v_actor <> v_creator AND NOT private.is_admin(v_actor) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  IF v_status IN ('ended', 'declined') THEN RETURN; END IF;
  -- A creator answers a pending offer with respond_representation, not end.
  IF v_status = 'pending' AND v_actor = v_creator THEN RAISE EXCEPTION 'use_respond'; END IF;

  UPDATE public.partner_creator_links SET status = 'ended', ended_at = now(), ended_by = v_actor WHERE id = p_link_id;
  IF v_status = 'active' THEN
    v_other := CASE WHEN v_actor = v_creator THEN v_partner ELSE v_creator END;
    SELECT display_name INTO v_name FROM public.profiles WHERE id = v_actor;
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (v_other, 'representation_ended', 'Représentation terminée',
            coalesce(v_name, 'Un participant') || ' a mis fin à la représentation. Les missions déjà acceptées gardent leurs conditions.',
            CASE WHEN v_other = v_creator THEN '/creator/partner' ELSE '/partner/creators' END);
  END IF;
END;
$function$;

-- ── RPC: partner applies to a campaign on behalf of a represented creator ───
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

-- ── RPC: my representation links (partner or creator side) with live stats ──
CREATE OR REPLACE FUNCTION public.my_partner_links()
 RETURNS TABLE (
   id uuid, my_side text, counterpart_id uuid, counterpart_handle text, counterpart_name text,
   counterpart_avatar text, counterpart_status public.account_status, commission_rate numeric,
   status public.representation_status, message text, invited_at timestamptz,
   responded_at timestamptz, ended_at timestamptz,
   deals_in_flight integer, deals_paid integer, commission_owed_fcfa bigint, commission_paid_fcfa bigint
 ) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  SELECT l.id,
         CASE WHEN l.partner_id = auth.uid() THEN 'partner' ELSE 'creator' END,
         cp.id, cp.handle, cp.display_name, cp.avatar_url, cp.status,
         l.commission_rate, l.status, l.message, l.invited_at, l.responded_at, l.ended_at,
         (SELECT count(*)::int FROM public.campaign_creators cc
           WHERE cc.creator_id = l.creator_id
             AND (cc.partner_id = l.partner_id OR (cc.partner_id IS NULL AND cc.applied_by = l.partner_id))
             AND cc.status IN ('applied', 'approved', 'content_submitted', 'verified')),
         (SELECT count(*)::int FROM public.campaign_creators cc
           WHERE cc.creator_id = l.creator_id AND cc.partner_id = l.partner_id AND cc.status = 'paid'),
         (SELECT coalesce(sum(pc.commission_fcfa), 0)::bigint FROM public.partner_commissions pc
           WHERE pc.partner_id = l.partner_id AND pc.creator_id = l.creator_id AND pc.status = 'owed'),
         (SELECT coalesce(sum(pc.commission_fcfa), 0)::bigint FROM public.partner_commissions pc
           WHERE pc.partner_id = l.partner_id AND pc.creator_id = l.creator_id AND pc.status = 'paid')
    FROM public.partner_creator_links l
    JOIN public.profiles cp ON cp.id = CASE WHEN l.partner_id = auth.uid() THEN l.creator_id ELSE l.partner_id END
   WHERE auth.uid() IS NOT NULL AND (l.partner_id = auth.uid() OR l.creator_id = auth.uid())
   ORDER BY CASE l.status WHEN 'pending' THEN 0 WHEN 'active' THEN 1 ELSE 2 END, l.invited_at DESC;
$function$;

-- ── RPC: the partner's deal pipeline across their portfolio ─────────────────
CREATE OR REPLACE FUNCTION public.partner_deals()
 RETURNS TABLE (
   campaign_creator_id uuid, campaign_id uuid, campaign_title text, creator_id uuid,
   creator_handle text, creator_name text, status public.creator_campaign_status,
   agreed_payout_fcfa bigint, commission_rate numeric, commission_fcfa bigint,
   commission_status text, applied_by_me boolean, updated_at timestamptz
 ) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  SELECT cc.id, c.id, c.title, p.id, p.handle, p.display_name, cc.status, cc.agreed_payout_fcfa,
         coalesce(pc.commission_rate, cc.partner_commission_rate, l.commission_rate),
         coalesce(pc.commission_fcfa,
                  floor(cc.agreed_payout_fcfa * coalesce(cc.partner_commission_rate, l.commission_rate, 0))::bigint),
         coalesce(pc.status, 'estimated'),
         cc.applied_by = auth.uid(),
         cc.updated_at
    FROM public.campaign_creators cc
    JOIN public.campaigns c ON c.id = cc.campaign_id
    JOIN public.profiles p ON p.id = cc.creator_id
    LEFT JOIN public.partner_commissions pc ON pc.campaign_creator_id = cc.id
    LEFT JOIN public.partner_creator_links l
           ON l.partner_id = auth.uid() AND l.creator_id = cc.creator_id AND l.status = 'active'
   WHERE auth.uid() IS NOT NULL
     AND (cc.partner_id = auth.uid()
          OR (cc.partner_id IS NULL AND cc.status IN ('applied', 'invited')
              AND (cc.applied_by = auth.uid() OR l.id IS NOT NULL)))
   ORDER BY cc.updated_at DESC
   LIMIT 300;
$function$;

-- ── Payout: split the creator payout when the deal is managed ───────────────
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

-- ── Payout: admin confirms the partner commission was sent ──────────────────
CREATE OR REPLACE FUNCTION public.admin_confirm_partner_commission(
  p_commission_id uuid, p_provider public.payment_provider DEFAULT 'mtn_momo', p_disbursement_ref text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_partner uuid; v_status text; v_amount bigint;
BEGIN
  IF NOT private.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF nullif(btrim(coalesce(p_disbursement_ref, '')), '') IS NULL THEN RAISE EXCEPTION 'ref_required'; END IF;
  SELECT partner_id, status, commission_fcfa INTO v_partner, v_status, v_amount
    FROM public.partner_commissions WHERE id = p_commission_id FOR UPDATE;
  IF v_partner IS NULL THEN RAISE EXCEPTION 'commission_not_found'; END IF;
  IF v_status = 'paid' THEN RETURN; END IF;
  UPDATE public.partner_commissions
     SET status = 'paid', provider = p_provider, disbursement_ref = btrim(p_disbursement_ref), paid_at = now()
   WHERE id = p_commission_id;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (v_partner, 'commission_paid', 'Commission versée 💸',
          'Votre commission de ' || v_amount::text || ' FCFA a été envoyée.', '/partner/creators');
END;
$function$;

-- ── Grants ──────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.partner_invite_creator(text, numeric, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.respond_representation(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.end_representation(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.partner_apply_for_creator(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_partner_links() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.partner_deals() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_confirm_partner_commission(uuid, public.payment_provider, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.partner_invite_creator(text, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_representation(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.end_representation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.partner_apply_for_creator(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_partner_links() TO authenticated;
GRANT EXECUTE ON FUNCTION public.partner_deals() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_confirm_partner_commission(uuid, public.payment_provider, text) TO authenticated;
