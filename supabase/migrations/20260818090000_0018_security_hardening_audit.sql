-- ============================================================================
-- Migration:          Security-audit hardening — escrow drain vectors, race conditions,
--                     double-funding, and PII column leakage
-- Version:            20260818090000_0018
-- Date:               2026-08-18
-- Author:             Lead Security, Cryptography & Compliance Engineer + Principal Backend/DB + QA/Chaos
-- Team:               Bayele Core Platform Engineering
-- Target Database:    Supabase Postgres 17.x (managed)
-- Infrastructure Ref: infra/terraform/ · supabase_project.bayele (ref oxesplxlshsdrijzckpq)
-- Feature Ticket:     BAY-SEC-018  (QA security audit remediation)
-- Dependencies:       0001,0002,0003,0012,0013,0015,0016,0017
-- Rollback Script:    supabase/migrations/rollback/20260818090000_0018_security_hardening_audit.rollback.sql
-- Estimated Duration: ~0.4s
-- ============================================================================
-- Description: Closes the findings from the production security audit:
--   [M1] guard_campaigns did not pin the economic columns (payout_per_creator_fcfa,
--        total_budget_fcfa, creator_count_target) on UPDATE, so a campaign owner could re-price a
--        FUNDED campaign via direct PostgREST and drain escrow. Now pinned (immutable post-create).
--   [M2] No escrow-pool solvency check existed: an outbound creator earmark could exceed the funded
--        inbound net. submit_proof_of_post now locks the inbound pool and rejects an earmark that
--        would push Σ(outbound) past the pool ('escrow_pool_exceeded'), and refuses if unfunded.
--   [M3] decide_application counted approvals without locking the campaign → concurrent approvals
--        could exceed creator_count_target. Now takes a campaign row lock first.
--   [M4] handle_sokoclick_invoice_paid was idempotent only on invoice id → a second invoice id for an
--        already-funded campaign double-funded it. Now no-ops if the campaign is already funded.
--   [M5] admin_refund_campaign checked "no paid-out" without locking outbound rows → TOCTOU with a
--        concurrent payout (creator paid AND business refunded). Now locks all outbound rows first.
--   [M6] verify_proof_of_post had no terminal guard → re-review could regress a 'paid' creator to
--        'verified'. Now a no-op once the creator is 'paid'.
--   [M7] admin_confirm_creator_payout completed a campaign while leaving 'applied' rows orphaned.
--        Now rejects outstanding applications on completion.
--   [M8] admin_confirm_campaign_funding sent no notification. Now notifies the business.
--   [S1/S2/S3] RLS is row-level, so the public-read policies exposed EVERY column of active
--        creator/consultant rows — including creators' Mobile-Money payout phone, consultants' tax_id,
--        and phone_e164 — to the browser anon key. Column privileges now REVOKE these; the owner reads
--        their own payout settings via the get_my_payout_settings() definer RPC.
-- Breaking Changes: The 3 owner-side reads of momo columns must call get_my_payout_settings() (app
--        updated in the same change set). No other flow reads these columns.
-- ============================================================================

-- ── [M1] Pin campaign economic terms after creation ─────────────────────────
CREATE OR REPLACE FUNCTION private.guard_campaigns()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.status := 'draft';
      NEW.match_pass_paid := false;
    ELSE
      NEW.status := OLD.status;
      NEW.platform_fee_rate := OLD.platform_fee_rate;
      NEW.match_pass_paid := OLD.match_pass_paid;
      NEW.owner_id := OLD.owner_id;
      NEW.owner_role := OLD.owner_role;
      -- Economic terms are immutable once the campaign exists (read by funding + payout).
      NEW.payout_per_creator_fcfa := OLD.payout_per_creator_fcfa;
      NEW.total_budget_fcfa := OLD.total_budget_fcfa;
      NEW.creator_count_target := OLD.creator_count_target;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ── [M2] Escrow-pool solvency at earmark time ───────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_proof_of_post(
  p_campaign_creator_id uuid, p_actor uuid, p_media_storage_path text, p_media_sha256 text,
  p_media_type text, p_gemini_raw jsonb DEFAULT NULL, p_verification_score numeric DEFAULT NULL,
  p_provider public.payment_provider DEFAULT 'mtn_momo'
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_creator_id uuid; v_campaign_id uuid; v_agreed bigint; v_txn_id uuid; v_proof_id uuid;
  v_pool bigint; v_earmarked bigint;
BEGIN
  SELECT cc.creator_id, cc.campaign_id, cc.agreed_payout_fcfa
    INTO v_creator_id, v_campaign_id, v_agreed
    FROM public.campaign_creators cc WHERE cc.id = p_campaign_creator_id FOR UPDATE;
  IF v_creator_id IS NULL THEN RAISE EXCEPTION 'campaign_creator % not found', p_campaign_creator_id; END IF;
  IF v_creator_id <> p_actor THEN RAISE EXCEPTION 'actor % is not the assigned creator for %', p_actor, p_campaign_creator_id; END IF;

  -- Lock the inbound pool row(s) so concurrent earmarks are serialized, then assert solvency.
  PERFORM 1 FROM public.escrow_transactions
    WHERE campaign_id = v_campaign_id AND direction = 'inbound' FOR UPDATE;
  SELECT COALESCE(SUM(net_amount_fcfa), 0) INTO v_pool
    FROM public.escrow_transactions
    WHERE campaign_id = v_campaign_id AND direction = 'inbound' AND status <> 'refunded';
  IF v_pool <= 0 THEN RAISE EXCEPTION 'campaign_not_funded'; END IF;
  SELECT COALESCE(SUM(amount_fcfa), 0) INTO v_earmarked
    FROM public.escrow_transactions
    WHERE campaign_id = v_campaign_id AND direction = 'outbound'
      AND status IN ('pending','held','proof_pending','releasable','paid_out');
  IF v_earmarked + v_agreed > v_pool THEN RAISE EXCEPTION 'escrow_pool_exceeded'; END IF;

  INSERT INTO public.proof_of_post (campaign_creator_id, media_storage_path, media_sha256, media_type, gemini_raw_response, verification_score, is_valid)
  VALUES (p_campaign_creator_id, p_media_storage_path, p_media_sha256, p_media_type, p_gemini_raw, p_verification_score, NULL)
  RETURNING id INTO v_proof_id;

  UPDATE public.campaign_creators SET status = 'content_submitted', updated_at = now() WHERE id = p_campaign_creator_id;

  INSERT INTO public.escrow_transactions (campaign_id, campaign_creator_id, recipient_profile_id, direction, amount_fcfa, fee_fcfa, net_amount_fcfa, provider, provider_ref, status)
  VALUES (v_campaign_id, p_campaign_creator_id, v_creator_id, 'outbound', v_agreed, 0, v_agreed, p_provider, 'payout:' || p_campaign_creator_id::text, 'pending')
  RETURNING id INTO v_txn_id;

  PERFORM public.transition_escrow(v_txn_id, 'held', p_actor, jsonb_build_object('reason','earmarked_from_campaign_pool','campaign_id',v_campaign_id));
  PERFORM public.transition_escrow(v_txn_id, 'proof_pending', p_actor, jsonb_build_object('proof_id',v_proof_id));
  RETURN v_proof_id;
END; $$;

-- ── [M6] Do not regress a paid creator on re-review ─────────────────────────
CREATE OR REPLACE FUNCTION public.verify_proof_of_post(
  p_proof_id uuid, p_approve boolean, p_actor uuid, p_rejection_reason text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_campaign_creator_id uuid; v_campaign_id uuid; v_owner_id uuid; v_txn_id uuid;
  v_cc_status public.creator_campaign_status;
BEGIN
  SELECT cc.id, cc.campaign_id, c.owner_id, cc.status
    INTO v_campaign_creator_id, v_campaign_id, v_owner_id, v_cc_status
    FROM public.proof_of_post pp
    JOIN public.campaign_creators cc ON cc.id = pp.campaign_creator_id
    JOIN public.campaigns c ON c.id = cc.campaign_id
    WHERE pp.id = p_proof_id;
  IF v_campaign_creator_id IS NULL THEN RAISE EXCEPTION 'proof % not found', p_proof_id; END IF;
  IF NOT (v_owner_id = p_actor OR private.is_admin(p_actor)) THEN
    RAISE EXCEPTION 'actor % not authorized to verify proofs on campaign %', p_actor, v_campaign_id;
  END IF;
  IF v_cc_status = 'paid' THEN RETURN; END IF;  -- terminal: a paid creator is never re-reviewed

  UPDATE public.proof_of_post
    SET is_valid = p_approve, reviewed_by = p_actor, reviewed_at = now(),
        rejection_reason = CASE WHEN p_approve THEN NULL ELSE p_rejection_reason END
    WHERE id = p_proof_id;
  UPDATE public.campaign_creators
    SET status = (CASE WHEN p_approve THEN 'verified' ELSE 'rejected' END)::public.creator_campaign_status,
        updated_at = now()
    WHERE id = v_campaign_creator_id;

  IF p_approve THEN
    SELECT id INTO v_txn_id FROM public.escrow_transactions
      WHERE campaign_creator_id = v_campaign_creator_id AND status = 'proof_pending' LIMIT 1;
    IF v_txn_id IS NOT NULL THEN PERFORM public.transition_escrow(v_txn_id, 'releasable', p_actor); END IF;
  END IF;
END; $$;

-- ── [M3] Serialize approvals per campaign ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.decide_application(p_campaign_creator_id uuid, p_approve boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_campaign uuid; v_creator uuid; v_cc_status public.creator_campaign_status;
  v_owner uuid; v_camp_status public.campaign_status; v_target int; v_title text; v_approved int;
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
  IF (p_approve AND v_cc_status = 'approved') OR (NOT p_approve AND v_cc_status = 'rejected') THEN RETURN; END IF;
  IF v_cc_status <> 'applied' THEN RAISE EXCEPTION 'not_pending'; END IF;

  IF p_approve THEN
    -- Lock the campaign so the capacity count is consistent across concurrent approvals.
    PERFORM 1 FROM public.campaigns WHERE id = v_campaign FOR UPDATE;
    SELECT count(*) INTO v_approved FROM public.campaign_creators
      WHERE campaign_id = v_campaign AND status IN ('approved','content_submitted','verified','paid');
    IF v_approved >= v_target THEN RAISE EXCEPTION 'campaign_full'; END IF;
    UPDATE public.campaign_creators SET status = 'approved', updated_at = now() WHERE id = p_campaign_creator_id;
    IF v_camp_status = 'published' THEN
      UPDATE public.campaigns SET status = 'in_progress', updated_at = now() WHERE id = v_campaign;
    END IF;
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (v_creator, 'application_approved', 'Candidature acceptée 🎉',
            'Vous êtes retenu pour « ' || v_title || ' ». Publiez puis soumettez votre preuve.',
            '/creator/dashboard');
  ELSE
    UPDATE public.campaign_creators SET status = 'rejected', updated_at = now() WHERE id = p_campaign_creator_id;
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (v_creator, 'application_rejected', 'Candidature non retenue',
            'Votre candidature à « ' || v_title || ' » n''a pas été retenue cette fois.',
            '/creator/dashboard');
  END IF;
END; $$;

-- ── [M4] No double-funding via a second invoice id ──────────────────────────
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

-- ── [M8] Notify the business when its campaign is funded ─────────────────────
CREATE OR REPLACE FUNCTION public.admin_confirm_campaign_funding(
  p_campaign_id uuid, p_sokoclick_invoice_id text,
  p_provider public.payment_provider DEFAULT 'mtn_momo', p_sokoclick_receipt_id text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_owner uuid; v_fee_rate numeric; v_budget bigint; v_status public.campaign_status; v_title text; v_fee bigint; v_net bigint; v_txn uuid;
BEGIN
  IF NOT private.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  SELECT owner_id, platform_fee_rate, total_budget_fcfa, status, title
    INTO v_owner, v_fee_rate, v_budget, v_status, v_title
    FROM public.campaigns WHERE id = p_campaign_id FOR UPDATE;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'campaign_not_found'; END IF;
  IF EXISTS (SELECT 1 FROM public.invoices WHERE sokoclick_invoice_id = p_sokoclick_invoice_id) THEN
    SELECT id INTO v_txn FROM public.escrow_transactions WHERE provider_ref = p_sokoclick_invoice_id LIMIT 1;
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
          '/business/campaigns');
  RETURN v_txn;
END; $$;

-- ── [M7] Reject orphaned applications when a campaign completes ──────────────
CREATE OR REPLACE FUNCTION public.admin_confirm_creator_payout(
  p_campaign_creator_id uuid, p_provider public.payment_provider DEFAULT 'mtn_momo', p_disbursement_ref text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_creator uuid; v_campaign uuid; v_amount bigint; v_title text;
  v_txn uuid; v_txn_status public.escrow_status; v_remaining int;
BEGIN
  IF NOT private.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  SELECT cc.creator_id, cc.campaign_id, cc.agreed_payout_fcfa, c.title
    INTO v_creator, v_campaign, v_amount, v_title
    FROM public.campaign_creators cc JOIN public.campaigns c ON c.id = cc.campaign_id
    WHERE cc.id = p_campaign_creator_id FOR UPDATE OF cc;
  IF v_creator IS NULL THEN RAISE EXCEPTION 'application_not_found'; END IF;
  SELECT id, status INTO v_txn, v_txn_status
    FROM public.escrow_transactions
    WHERE campaign_creator_id = p_campaign_creator_id AND direction = 'outbound' FOR UPDATE;
  IF v_txn IS NULL THEN RAISE EXCEPTION 'no_payout_txn'; END IF;
  IF v_txn_status = 'paid_out' THEN RETURN v_txn; END IF;
  IF v_txn_status <> 'releasable' THEN RAISE EXCEPTION 'payout_not_releasable'; END IF;
  UPDATE public.escrow_transactions SET provider = p_provider, updated_at = now() WHERE id = v_txn;
  PERFORM public.transition_escrow(v_txn, 'paid_out', auth.uid(),
          jsonb_build_object('source','admin_confirm_creator_payout','provider',p_provider,'disbursement_ref',p_disbursement_ref,'campaign_creator_id',p_campaign_creator_id));
  UPDATE public.campaign_creators SET status = 'paid', updated_at = now() WHERE id = p_campaign_creator_id;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (v_creator, 'payout_sent', 'Paiement envoyé 💸',
          'Votre paiement de ' || v_amount::text || ' FCFA pour « ' || v_title || ' » a été envoyé par Mobile Money.',
          '/creator/dashboard');
  SELECT count(*) INTO v_remaining FROM public.campaign_creators
    WHERE campaign_id = v_campaign AND status IN ('approved','content_submitted','verified');
  IF v_remaining = 0 THEN
    -- No work left in flight → close the campaign and reject any still-pending applications.
    UPDATE public.campaign_creators SET status = 'rejected', updated_at = now()
      WHERE campaign_id = v_campaign AND status = 'applied';
    UPDATE public.campaigns SET status = 'completed', updated_at = now()
      WHERE id = v_campaign AND status IN ('published','in_progress');
  END IF;
  RETURN v_txn;
END; $$;

-- ── [M5] Refund must lock outbound rows before asserting "no paid-out" ───────
CREATE OR REPLACE FUNCTION public.admin_refund_campaign(
  p_campaign_id uuid, p_sokoclick_receipt_id text DEFAULT NULL, p_reason text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_owner uuid; v_cstatus public.campaign_status; v_title text;
  v_in uuid; v_in_status public.escrow_status; v_paid int; v_out RECORD;
  v_meta jsonb := jsonb_build_object('source','admin_refund_campaign','receipt',p_sokoclick_receipt_id,'reason',p_reason);
BEGIN
  IF NOT private.is_admin(v_admin) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  SELECT owner_id, status, title INTO v_owner, v_cstatus, v_title
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
          '/business/campaigns');
  RETURN v_in;
END; $$;

-- ── [S1/S2/S3] Column-level PII protection ──────────────────────────────────
-- RLS is row-level; Supabase also grants anon/authenticated TABLE-level SELECT, which overrides any
-- column-level REVOKE. The only effective lever is: REVOKE the table grant, then GRANT back exactly
-- the safe columns. Sensitive columns (momo payout phone/provider, consultant tax_id, phone_e164) are
-- then unreadable via PostgREST; the owner reads their own payout settings via get_my_payout_settings().
REVOKE SELECT ON public.profiles FROM anon;  -- authenticated keeps full SELECT (getSession reads its own row with '*')
GRANT SELECT (id, handle, display_name, avatar_url, bio, city, country, status, created_at, updated_at)
  ON public.profiles TO anon;

REVOKE SELECT ON public.creator_profiles FROM anon, authenticated;
GRANT SELECT (user_id, categories, audience_size, is_pro, rating_avg, platforms, pro_expires_at)
  ON public.creator_profiles TO anon, authenticated;

REVOKE SELECT ON public.consultant_profiles FROM anon, authenticated;
GRANT SELECT (user_id, specialties, years_experience, agency_access)
  ON public.consultant_profiles TO anon, authenticated;

-- Owner-only read of one's own payout settings (replaces the direct creator_profiles read).
CREATE OR REPLACE FUNCTION public.get_my_payout_settings()
RETURNS TABLE (is_pro boolean, momo_payout_phone_e164 text, momo_provider public.payment_provider)
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT cp.is_pro, cp.momo_payout_phone_e164, cp.momo_provider
  FROM public.creator_profiles cp WHERE cp.user_id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.get_my_payout_settings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_payout_settings() TO authenticated;

-- ============================================================================
-- POST-APPLY VERIFICATION (negatives-first):
--   [M1] owner UPDATE payout/budget/count on funded campaign → UNCHANGED
--   [S1] anon SELECT momo_payout_phone_e164 → permission denied / empty
--   [M2] earmark beyond pool → 'escrow_pool_exceeded'; unfunded → 'campaign_not_funded'
--   [M4] second invoice id on funded campaign → no-op (no 2nd inbound)
--   [M3] approvals cannot exceed creator_count_target under concurrency
--   [M5] refund after a paid_out outbound → 'partial_payouts_present'
--   [M6] re-review of a paid creator → no-op (stays 'paid')
--   get_my_payout_settings() as the owner → returns own momo; seed intact
-- ============================================================================
