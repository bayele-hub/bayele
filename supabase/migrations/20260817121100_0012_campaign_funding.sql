-- ============================================================================
-- Migration:          Campaign funding bridge — admin-confirmed inbound collection
-- Version:            20260817121100_0012
-- Date:               2026-08-17
-- Author:             Principal Backend & Database Systems Engineer + Security/Compliance
-- Team:               Bayele Core Platform Engineering
-- Target Database:    Supabase Postgres 17.x (managed) — portable to Cloud SQL / RDS Postgres 15+
-- Infrastructure Ref: infra/terraform/ · supabase_project.bayele (ref oxesplxlshsdrijzckpq)
-- Feature Ticket:     BAY-ESCROW-012  (Milestone 6 — business workspace & funding; ADR-001)
-- Dependencies:       0001 (campaigns/escrow/invoices), 0003 (transition_escrow), 0005 (is_admin)
-- Rollback Script:    supabase/migrations/rollback/20260817121100_0012_campaign_funding.rollback.sql
-- Estimated Duration: ~0.2s
-- ============================================================================
-- Description:        Per ADR-001, SokoClick does NOT confirm payment — Bayele is the escrow
--                     custodian and money arrives over Mobile Money. This RPC is the funding trigger
--                     the launch bridge uses: an ADMIN (or, later, a MoMo collection webhook) confirms
--                     that a campaign's invoice was paid, and it atomically records the invoice,
--                     opens the inbound escrow, and moves it pending → held (via transition_escrow),
--                     then publishes the campaign. Idempotent on sokoclick_invoice_id.
-- Breaking Changes:   NONE (new function).
-- Performance Impact: FOR UPDATE lock on the single campaign row; a few single-row writes.
-- Compliance Notes:   Admin-gated via private.is_admin(auth.uid()); a non-admin raises
--                     'not_authorized'. Fee is read from campaigns.platform_fee_rate at funding time
--                     (invariant §9), never re-derived. transition_escrow remains the only status
--                     mutator and writes the audit row. A redelivered confirmation is a no-op
--                     (idempotency §5). provider records the actual MoMo rail.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_confirm_campaign_funding(
  p_campaign_id          uuid,
  p_sokoclick_invoice_id text,
  p_provider             public.payment_provider DEFAULT 'mtn_momo',
  p_sokoclick_receipt_id text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_owner uuid; v_fee_rate numeric; v_budget bigint; v_status public.campaign_status;
  v_fee bigint; v_net bigint; v_txn uuid;
BEGIN
  IF NOT private.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;

  SELECT owner_id, platform_fee_rate, total_budget_fcfa, status
    INTO v_owner, v_fee_rate, v_budget, v_status
    FROM public.campaigns WHERE id = p_campaign_id FOR UPDATE;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'campaign_not_found'; END IF;

  -- Idempotency FIRST: a redelivered confirmation returns the existing escrow row and is a no-op —
  -- even after the campaign has already been published by the first call (no double-funding).
  IF EXISTS (SELECT 1 FROM public.invoices WHERE sokoclick_invoice_id = p_sokoclick_invoice_id) THEN
    SELECT id INTO v_txn FROM public.escrow_transactions WHERE provider_ref = p_sokoclick_invoice_id LIMIT 1;
    RETURN v_txn;
  END IF;

  -- Only genuinely-new funding requires the campaign to still be fundable.
  IF v_status NOT IN ('draft','pending_funding') THEN RAISE EXCEPTION 'campaign_not_fundable'; END IF;

  v_fee := floor(v_budget * v_fee_rate);
  v_net := v_budget - v_fee;

  INSERT INTO public.invoices (sokoclick_invoice_id, sokoclick_receipt_id, business_id, invoice_type, amount_fcfa, status)
  VALUES (p_sokoclick_invoice_id, p_sokoclick_receipt_id, v_owner, 'campaign_escrow', v_budget, 'paid');

  INSERT INTO public.escrow_transactions (campaign_id, direction, amount_fcfa, fee_fcfa, net_amount_fcfa, provider, provider_ref, status)
  VALUES (p_campaign_id, 'inbound', v_budget, v_fee, v_net, p_provider, p_sokoclick_invoice_id, 'pending')
  RETURNING id INTO v_txn;

  PERFORM public.transition_escrow(v_txn, 'held', auth.uid(),
          jsonb_build_object('source','admin_confirm_campaign_funding','campaign_id',p_campaign_id));

  UPDATE public.campaigns SET status = 'published', match_pass_paid = true, updated_at = now()
    WHERE id = p_campaign_id;

  RETURN v_txn;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_confirm_campaign_funding(uuid, text, public.payment_provider, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_confirm_campaign_funding(uuid, text, public.payment_provider, text) TO authenticated;

-- ============================================================================
-- POST-APPLY VERIFICATION (Part 6) — with a throwaway business + draft campaign:
--   • non-admin call → RAISES 'not_authorized'                                      (negative)
--   • admin call → escrow row exists, status 'held'; campaign 'published'; invoice
--     'paid'; escrow_audit_log has pending→held                                     (positive)
--   • second call with the same invoice id → returns the same txn, no new escrow     (idempotency)
-- ============================================================================
