-- ============================================================================
-- Migration:          Campaign cancel + escrow refund — close the dead money states
-- Version:            20260817122000_0017
-- Date:               2026-08-17
-- Author:             Principal Backend & Database Systems Engineer + Lead Security
-- Team:               Bayele Core Platform Engineering
-- Target Database:    Supabase Postgres 17.x (managed) — portable to Cloud SQL / RDS Postgres 15+
-- Infrastructure Ref: infra/terraform/ · supabase_project.bayele (ref oxesplxlshsdrijzckpq)
-- Feature Ticket:     BAY-ESC-017  (production-readiness audit — reachable refund/cancel)
-- Dependencies:       0001 (tables), 0003 (transition_escrow + escrow machine), 0012 (funding),
--                     0013 (execution loop), 0016 (column write-guards)
-- Rollback Script:    supabase/migrations/rollback/20260817122000_0017_campaign_cancel_refund.rollback.sql
-- Estimated Duration: ~0.2s
-- ============================================================================
-- Description:        The escrow_status machine already permits held→refunding→refunded and the
-- \                   *→disputed→refunding paths, but NO façade drove them, so a funded campaign's
--                     money could never come back: refunding / refunded / cancelled were unreachable.
--                     This adds two authenticated façades over the ONLY mutator (transition_escrow):
--                       • cancel_campaign(campaign)              — self-serve/admin cancel of an
--                         UNFUNDED campaign (draft / pending_funding, zero escrow rows). Sets
--                         status='cancelled'. If any escrow exists it refuses with
--                         'campaign_funded_use_refund' — money must go through the audited refund.
--                       • admin_refund_campaign(campaign, receipt, reason) — ADMIN ONLY. Unwinds the
--                         held campaign pool back to the business: releases every in-flight outbound
--                         creator earmark (…→refunding→refunded), refunds the inbound pool
--                         (held/disputed/pending→refunding→refunded), marks un-fulfilled creators
--                         'rejected', flips the campaign to 'cancelled', and notifies the business.
--                     Both run SECURITY DEFINER (owner), so the 0016 column-guards pass them through
--                     while still pinning direct writers. Every status change is one transition_escrow
--                     call → full escrow_audit_log trail.
-- Safety Scope:       admin_refund_campaign refuses ('partial_payouts_present') once ANY creator has
--                     been paid_out — partial (post-payout) refunds require net-of-disbursement
--                     accounting and are deferred to v2 ops. Idempotent: re-running after a completed
--                     refund is a no-op that still guarantees campaign='cancelled'.
-- Breaking Changes:   NONE. Purely additive RPCs; no column or existing-function changes.
-- Performance Impact: Row-locked single-campaign scope; a handful of transition_escrow calls. Negligible.
-- Compliance Notes:   Preserves invariant §3 — transition_escrow remains the sole escrow mutator; these
--                     façades carry their own authz (auth.uid() = owner OR private.is_admin).
-- ============================================================================

-- ── Self-serve / admin cancel of an UNFUNDED campaign ───────────────────────
CREATE OR REPLACE FUNCTION public.cancel_campaign(p_campaign_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_actor  uuid := auth.uid();
  v_owner  uuid;
  v_status public.campaign_status;
  v_has_escrow boolean;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT owner_id, status INTO v_owner, v_status
    FROM public.campaigns WHERE id = p_campaign_id FOR UPDATE;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'campaign_not_found'; END IF;
  IF NOT (v_owner = v_actor OR private.is_admin(v_actor)) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF v_status = 'cancelled' THEN RETURN; END IF;  -- idempotent

  -- Any escrow row means funds were (or are being) held → route through the audited refund.
  SELECT EXISTS (SELECT 1 FROM public.escrow_transactions WHERE campaign_id = p_campaign_id)
    INTO v_has_escrow;
  IF v_has_escrow OR v_status NOT IN ('draft', 'pending_funding') THEN
    RAISE EXCEPTION 'campaign_funded_use_refund';
  END IF;

  UPDATE public.campaigns SET status = 'cancelled', updated_at = now() WHERE id = p_campaign_id;
END;
$$;

-- ── Admin refund of a funded campaign (no payouts yet) ──────────────────────
CREATE OR REPLACE FUNCTION public.admin_refund_campaign(
  p_campaign_id uuid,
  p_sokoclick_receipt_id text DEFAULT NULL,
  p_reason text DEFAULT NULL
) RETURNS uuid  -- inbound (pool) escrow txn id
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_owner uuid; v_cstatus public.campaign_status; v_title text;
  v_in uuid; v_in_status public.escrow_status;
  v_paid int;
  v_out RECORD;
  v_meta jsonb := jsonb_build_object('source','admin_refund_campaign','receipt',p_sokoclick_receipt_id,'reason',p_reason);
BEGIN
  IF NOT private.is_admin(v_admin) THEN RAISE EXCEPTION 'not_authorized'; END IF;

  SELECT owner_id, status, title INTO v_owner, v_cstatus, v_title
    FROM public.campaigns WHERE id = p_campaign_id FOR UPDATE;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'campaign_not_found'; END IF;

  SELECT id, status INTO v_in, v_in_status
    FROM public.escrow_transactions
    WHERE campaign_id = p_campaign_id AND direction = 'inbound'
    FOR UPDATE;
  IF v_in IS NULL THEN RAISE EXCEPTION 'campaign_not_funded'; END IF;

  -- Idempotent: a completed refund re-run is a no-op.
  IF v_in_status = 'refunded' AND v_cstatus = 'cancelled' THEN RETURN v_in; END IF;

  -- Safety: no partial refunds once any creator disbursement has left the platform.
  SELECT count(*) INTO v_paid FROM public.escrow_transactions
    WHERE campaign_id = p_campaign_id AND direction = 'outbound' AND status = 'paid_out';
  IF v_paid > 0 THEN RAISE EXCEPTION 'partial_payouts_present'; END IF;

  -- Unwind every in-flight outbound creator earmark back into the pool.
  FOR v_out IN
    SELECT id, status FROM public.escrow_transactions
    WHERE campaign_id = p_campaign_id AND direction = 'outbound'
      AND status IN ('pending','held','proof_pending','releasable','disputed')
    FOR UPDATE
  LOOP
    -- 'releasable' cannot go straight to 'refunding' (machine allows releasable→disputed only).
    IF v_out.status = 'releasable' THEN
      PERFORM public.transition_escrow(v_out.id, 'disputed', v_admin, v_meta);
      PERFORM public.transition_escrow(v_out.id, 'refunding', v_admin, v_meta);
    ELSIF v_out.status = 'disputed' THEN
      PERFORM public.transition_escrow(v_out.id, 'refunding', v_admin, v_meta);
    ELSE  -- pending / held / proof_pending → refunding
      PERFORM public.transition_escrow(v_out.id, 'refunding', v_admin, v_meta);
    END IF;
    PERFORM public.transition_escrow(v_out.id, 'refunded', v_admin, v_meta);
  END LOOP;

  -- Un-fulfilled creators on a cancelled campaign: no 'cancelled' status exists → 'rejected'.
  UPDATE public.campaign_creators
    SET status = 'rejected', updated_at = now()
    WHERE campaign_id = p_campaign_id
      AND status IN ('invited','applied','approved','content_submitted','verified','disputed');

  -- Refund the campaign pool to the business.
  IF v_in_status = 'refunded' THEN
    NULL;  -- already returned; fall through to guarantee campaign is cancelled
  ELSIF v_in_status IN ('pending','held','disputed') THEN
    PERFORM public.transition_escrow(v_in, 'refunding', v_admin, v_meta);
    PERFORM public.transition_escrow(v_in, 'refunded',  v_admin, v_meta);
  ELSIF v_in_status = 'refunding' THEN
    PERFORM public.transition_escrow(v_in, 'refunded',  v_admin, v_meta);
  ELSE
    RAISE EXCEPTION 'inbound_not_refundable';  -- e.g. paid_out (never valid for inbound)
  END IF;

  UPDATE public.escrow_transactions
    SET provider_ref = COALESCE(p_sokoclick_receipt_id, provider_ref), updated_at = now()
    WHERE id = v_in;

  UPDATE public.campaigns SET status = 'cancelled', updated_at = now() WHERE id = p_campaign_id;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (v_owner, 'campaign_refunded', 'Remboursement effectué 💶',
          'Votre campagne « ' || v_title || ' » a été annulée et le séquestre remboursé'
            || COALESCE(' : ' || p_reason, '') || '.',
          '/business/campaigns');

  RETURN v_in;
END;
$$;

-- ── Grants: match the 0013 façade convention ────────────────────────────────
REVOKE ALL ON FUNCTION public.cancel_campaign(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.cancel_campaign(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_refund_campaign(uuid, text, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_refund_campaign(uuid, text, text) TO authenticated;

-- ============================================================================
-- POST-APPLY VERIFICATION (Part 6):
--   • cancel_campaign as a non-owner            → 'not_authorized'
--   • cancel_campaign on a funded campaign      → 'campaign_funded_use_refund'
--   • cancel_campaign as owner on a draft       → status='cancelled'
--   • admin_refund_campaign as non-admin        → 'not_authorized'
--   • admin_refund_campaign on funded (no pay)  → inbound refunded, campaign cancelled,
--                                                 audit_log has held→refunding→refunded
--   • admin_refund_campaign re-run              → idempotent no-op
--   • admin_refund_campaign with a paid_out     → 'partial_payouts_present'
-- ============================================================================
