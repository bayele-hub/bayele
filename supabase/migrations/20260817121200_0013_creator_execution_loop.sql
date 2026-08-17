-- ============================================================================
-- Migration:          Creator execution loop — apply → approve → proof → verify → payout
-- Version:            20260817121200_0013
-- Date:               2026-08-17
-- Author:             Principal Backend & Database Systems Engineer + Security/Compliance
-- Team:               Bayele Core Platform Engineering
-- Target Database:    Supabase Postgres 17.x (managed) — portable to Cloud SQL / RDS Postgres 15+
-- Infrastructure Ref: infra/terraform/ · supabase_project.bayele (ref oxesplxlshsdrijzckpq)
-- Feature Ticket:     BAY-ESCROW-013  (Milestone 7 — campaign execution & escrow release; ADR-001)
-- Dependencies:       0001 (campaign_creators/proof_of_post/escrow), 0003 (submit_/verify_proof,
--                     transition_escrow), 0005 (private.is_admin)
-- Rollback Script:    supabase/migrations/rollback/20260817121200_0013_creator_execution_loop.rollback.sql
-- Estimated Duration: ~0.3s
-- ============================================================================
-- Description:        The authenticated-callable façade over the M7 loop. The four money-path
--                     definers from 0003 (submit_proof_of_post, verify_proof_of_post,
--                     transition_escrow) are REVOKEd from authenticated (0004) and take a spoofable
--                     p_actor. These five wrappers are the ONLY execution surface the web app calls:
--                     each derives the actor from auth.uid() (unspoofable) and either enforces the
--                     role/ownership gate itself or delegates to the underlying definer, then emits
--                     the participant notification.
--                       • apply_to_campaign         — creator applies to a published campaign
--                       • decide_application        — owner/admin approves or rejects an application
--                       • creator_submit_proof      — creator submits proof (wraps submit_proof_of_post)
--                       • review_proof              — owner/admin verifies proof (wraps verify_proof_of_post)
--                       • admin_confirm_creator_payout — admin/MoMo-bridge releases the payout (releasable→paid_out)
-- Breaking Changes:   NONE (all new functions). CREATE OR REPLACE so re-apply is idempotent.
-- Performance Impact: Each RPC takes a FOR UPDATE lock on the single campaign_creators / escrow row it
--                     mutates and does a handful of single-row writes. No scans.
-- Compliance Notes:   Per ADR-001 Bayele is the escrow custodian; MoMo carries the money. Real
--                     outbound MoMo disbursement rails are external-gated, so admin_confirm_creator_payout
--                     is the launch bridge (admin confirms the MoMo transfer went out; a disbursement
--                     webhook replaces the human later) — exactly mirroring admin_confirm_campaign_funding
--                     on the inbound side. transition_escrow remains the ONLY status mutator and writes
--                     the audit row for every hop; the human-in-the-loop release rule (invariant §3.4)
--                     is preserved (no Gemini score auto-transitions escrow). Every wrapper is
--                     SECURITY DEFINER + search_path='' and self-authorizes via auth.uid() /
--                     private.is_admin(auth.uid()); a wrong caller raises before any write. Advisor will
--                     list these as intentional authenticated-execute definers (auth is internal).
-- ============================================================================

-- (1) Creator applies to a published campaign. Self-scoped: creator_id is auth.uid(), never a param.
CREATE OR REPLACE FUNCTION public.apply_to_campaign(p_campaign_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_owner uuid; v_status public.campaign_status; v_payout bigint; v_title text;
  v_cc uuid;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  -- Caller must be an active creator (RLS-independent — this runs as owner).
  IF NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = v_actor AND ur.role = 'creator') THEN
    RAISE EXCEPTION 'not_a_creator';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v_actor AND p.status = 'active') THEN
    RAISE EXCEPTION 'profile_not_active';
  END IF;

  SELECT owner_id, status, payout_per_creator_fcfa, title
    INTO v_owner, v_status, v_payout, v_title
    FROM public.campaigns WHERE id = p_campaign_id FOR UPDATE;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'campaign_not_found'; END IF;
  IF v_owner = v_actor THEN RAISE EXCEPTION 'cannot_apply_own_campaign'; END IF;
  IF v_status NOT IN ('published','in_progress') THEN RAISE EXCEPTION 'campaign_not_open'; END IF;
  IF EXISTS (SELECT 1 FROM public.campaign_creators cc
             WHERE cc.campaign_id = p_campaign_id AND cc.creator_id = v_actor) THEN
    RAISE EXCEPTION 'already_applied';
  END IF;

  INSERT INTO public.campaign_creators (campaign_id, creator_id, status, agreed_payout_fcfa)
  VALUES (p_campaign_id, v_actor, 'applied', v_payout)
  RETURNING id INTO v_cc;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (v_owner, 'campaign_application', 'Nouvelle candidature',
          'Un créateur a postulé à « ' || v_title || ' ».',
          '/business/campaigns/' || p_campaign_id::text);

  RETURN v_cc;
END;
$$;

-- (2) Owner (or admin) approves/rejects an application. Capacity is enforced at APPROVAL, not apply.
CREATE OR REPLACE FUNCTION public.decide_application(p_campaign_creator_id uuid, p_approve boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_campaign uuid; v_creator uuid; v_cc_status public.creator_campaign_status;
  v_owner uuid; v_camp_status public.campaign_status; v_target int; v_title text;
  v_approved int;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT cc.campaign_id, cc.creator_id, cc.status, c.owner_id, c.status, c.creator_count_target, c.title
    INTO v_campaign, v_creator, v_cc_status, v_owner, v_camp_status, v_target, v_title
    FROM public.campaign_creators cc
    JOIN public.campaigns c ON c.id = cc.campaign_id
    WHERE cc.id = p_campaign_creator_id
    FOR UPDATE OF cc;
  IF v_campaign IS NULL THEN RAISE EXCEPTION 'application_not_found'; END IF;

  IF NOT (v_owner = v_actor OR private.is_admin(v_actor)) THEN RAISE EXCEPTION 'not_authorized'; END IF;

  -- Idempotent no-op if already in the requested terminal decision.
  IF (p_approve AND v_cc_status = 'approved') OR (NOT p_approve AND v_cc_status = 'rejected') THEN
    RETURN;
  END IF;
  IF v_cc_status <> 'applied' THEN RAISE EXCEPTION 'not_pending'; END IF;

  IF p_approve THEN
    SELECT count(*) INTO v_approved FROM public.campaign_creators
      WHERE campaign_id = v_campaign AND status IN ('approved','content_submitted','verified','paid');
    IF v_approved >= v_target THEN RAISE EXCEPTION 'campaign_full'; END IF;

    UPDATE public.campaign_creators SET status = 'approved', updated_at = now()
      WHERE id = p_campaign_creator_id;
    IF v_camp_status = 'published' THEN
      UPDATE public.campaigns SET status = 'in_progress', updated_at = now() WHERE id = v_campaign;
    END IF;

    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (v_creator, 'application_approved', 'Candidature acceptée 🎉',
            'Vous êtes retenu pour « ' || v_title || ' ». Publiez puis soumettez votre preuve.',
            '/creator/dashboard');
  ELSE
    UPDATE public.campaign_creators SET status = 'rejected', updated_at = now()
      WHERE id = p_campaign_creator_id;

    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (v_creator, 'application_rejected', 'Candidature non retenue',
            'Votre candidature à « ' || v_title || ' » n''a pas été retenue cette fois.',
            '/creator/dashboard');
  END IF;
END;
$$;

-- (3) Creator submits proof. Wraps submit_proof_of_post (which earmarks the payout from the pool and
--     moves the outbound escrow pending→held→proof_pending). The sha256 is computed app-side and
--     passed in so this function stays free of an extension-schema dependency (portability).
CREATE OR REPLACE FUNCTION public.creator_submit_proof(
  p_campaign_creator_id uuid,
  p_post_url            text,
  p_media_sha256        text,
  p_media_type          text DEFAULT 'url'
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_creator uuid; v_status public.creator_campaign_status; v_campaign uuid;
  v_owner uuid; v_title text; v_proof uuid;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_post_url IS NULL OR length(btrim(p_post_url)) = 0 THEN RAISE EXCEPTION 'missing_post_url'; END IF;
  IF p_media_sha256 IS NULL OR length(btrim(p_media_sha256)) = 0 THEN RAISE EXCEPTION 'missing_media_hash'; END IF;

  SELECT cc.creator_id, cc.status, cc.campaign_id, c.owner_id, c.title
    INTO v_creator, v_status, v_campaign, v_owner, v_title
    FROM public.campaign_creators cc
    JOIN public.campaigns c ON c.id = cc.campaign_id
    WHERE cc.id = p_campaign_creator_id
    FOR UPDATE OF cc;
  IF v_creator IS NULL THEN RAISE EXCEPTION 'application_not_found'; END IF;
  IF v_creator <> v_actor THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF v_status = 'content_submitted' THEN RAISE EXCEPTION 'already_submitted'; END IF;
  IF v_status <> 'approved' THEN RAISE EXCEPTION 'not_approved'; END IF;

  -- Delegate to the 0003 money-path definer with the unspoofable actor.
  v_proof := public.submit_proof_of_post(
    p_campaign_creator_id, v_actor, p_post_url, p_media_sha256, p_media_type, NULL, NULL, 'mtn_momo');

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (v_owner, 'proof_submitted', 'Preuve reçue',
          'Un créateur a soumis sa preuve pour « ' || v_title ||' ». À vérifier.',
          '/business/campaigns/' || v_campaign::text);

  RETURN v_proof;
END;
$$;

-- (4) Owner (or admin) verifies proof. Wraps verify_proof_of_post (which self-authorizes owner/admin
--     and, on approval, moves the outbound escrow proof_pending→releasable). Emits the creator notice.
CREATE OR REPLACE FUNCTION public.review_proof(
  p_proof_id uuid, p_approve boolean, p_reason text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_creator uuid; v_title text;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  -- verify_proof_of_post raises if the actor is neither the campaign owner nor an admin.
  PERFORM public.verify_proof_of_post(p_proof_id, p_approve, v_actor, p_reason);

  SELECT cc.creator_id, c.title INTO v_creator, v_title
    FROM public.proof_of_post pp
    JOIN public.campaign_creators cc ON cc.id = pp.campaign_creator_id
    JOIN public.campaigns c ON c.id = cc.campaign_id
    WHERE pp.id = p_proof_id;

  IF p_approve THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (v_creator, 'proof_approved', 'Preuve validée ✅',
            'Votre preuve pour « ' || v_title || ' » est validée. Le paiement est en préparation.',
            '/creator/dashboard');
  ELSE
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (v_creator, 'proof_rejected', 'Preuve refusée',
            'Votre preuve pour « ' || v_title || ' » a été refusée' ||
            COALESCE(' : ' || p_reason, '') || '.',
            '/creator/dashboard');
  END IF;
END;
$$;

-- (5) Admin confirms the outbound MoMo disbursement (the launch bridge; a disbursement webhook
--     replaces the human later). Moves the creator's outbound escrow releasable→paid_out and marks
--     the assignment 'paid'. Idempotent: a redelivered confirmation on an already-paid row is a no-op.
CREATE OR REPLACE FUNCTION public.admin_confirm_creator_payout(
  p_campaign_creator_id uuid,
  p_provider            public.payment_provider DEFAULT 'mtn_momo',
  p_disbursement_ref    text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_creator uuid; v_campaign uuid; v_amount bigint; v_title text;
  v_txn uuid; v_txn_status public.escrow_status;
  v_remaining int;
BEGIN
  IF NOT private.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;

  SELECT cc.creator_id, cc.campaign_id, cc.agreed_payout_fcfa, c.title
    INTO v_creator, v_campaign, v_amount, v_title
    FROM public.campaign_creators cc
    JOIN public.campaigns c ON c.id = cc.campaign_id
    WHERE cc.id = p_campaign_creator_id
    FOR UPDATE OF cc;
  IF v_creator IS NULL THEN RAISE EXCEPTION 'application_not_found'; END IF;

  SELECT id, status INTO v_txn, v_txn_status
    FROM public.escrow_transactions
    WHERE campaign_creator_id = p_campaign_creator_id AND direction = 'outbound'
    FOR UPDATE;
  IF v_txn IS NULL THEN RAISE EXCEPTION 'no_payout_txn'; END IF;

  -- Idempotency FIRST: already disbursed → no-op, return the same txn (no double-pay).
  IF v_txn_status = 'paid_out' THEN RETURN v_txn; END IF;
  IF v_txn_status <> 'releasable' THEN RAISE EXCEPTION 'payout_not_releasable'; END IF;

  UPDATE public.escrow_transactions SET provider = p_provider, updated_at = now() WHERE id = v_txn;
  PERFORM public.transition_escrow(v_txn, 'paid_out', auth.uid(),
          jsonb_build_object('source','admin_confirm_creator_payout',
                             'provider', p_provider,
                             'disbursement_ref', p_disbursement_ref,
                             'campaign_creator_id', p_campaign_creator_id));

  UPDATE public.campaign_creators SET status = 'paid', updated_at = now()
    WHERE id = p_campaign_creator_id;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (v_creator, 'payout_sent', 'Paiement envoyé 💸',
          'Votre paiement de ' || v_amount::text || ' FCFA pour « ' || v_title ||
          ' » a été envoyé par Mobile Money.',
          '/creator/dashboard');

  -- Close the campaign once every approved/submitted assignment has been paid.
  SELECT count(*) INTO v_remaining FROM public.campaign_creators
    WHERE campaign_id = v_campaign AND status IN ('approved','content_submitted','verified');
  IF v_remaining = 0 THEN
    UPDATE public.campaigns SET status = 'completed', updated_at = now()
      WHERE id = v_campaign AND status IN ('published','in_progress');
  END IF;

  RETURN v_txn;
END;
$$;

-- Grants: authenticated may call the façade (each self-authorizes); anon/PUBLIC may not.
REVOKE ALL ON FUNCTION public.apply_to_campaign(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.apply_to_campaign(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.decide_application(uuid, boolean) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.decide_application(uuid, boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.creator_submit_proof(uuid, text, text, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.creator_submit_proof(uuid, text, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.review_proof(uuid, boolean, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.review_proof(uuid, boolean, text) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_confirm_creator_payout(uuid, public.payment_provider, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_confirm_creator_payout(uuid, public.payment_provider, text) TO authenticated;

-- ============================================================================
-- POST-APPLY VERIFICATION (Part 6) — with a throwaway business + published campaign + creator:
--   • non-creator JWT apply_to_campaign            → RAISES 'not_a_creator'         (negative first)
--   • non-owner/non-admin decide_application        → RAISES 'not_authorized'        (negative)
--   • creator_submit_proof before approval          → RAISES 'not_approved'          (negative)
--   • creator reviewing own proof (review_proof)    → RAISES 'not authorized...'     (self-approval blocked)
--   • non-admin admin_confirm_creator_payout        → RAISES 'not_authorized'        (negative)
--   • happy path: apply→approve→submit→verify→payout ends with campaign_creators.status='paid',
--     outbound escrow 'paid_out', escrow_audit_log has proof_pending→releasable→paid_out,
--     and a 'payout_sent' notification for the creator                              (positive)
--   • second admin_confirm_creator_payout on the paid row → returns same txn, no 2nd audit hop (idempotent)
-- ============================================================================
