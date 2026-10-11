-- ============================================================================
-- Migration:          Funding confirmation idempotency per campaign (invoice_already_used)
-- Version:            20261011120000_0034
-- Date:               2026-10-11
-- Team:               Bayele Core Platform Engineering
-- Dependencies:       0012, 0018, 0033 (admin_confirm_campaign_funding, E2 notification link)
-- Rollback Script:    supabase/migrations/rollback/20261011120000_0034_funding_ref_per_campaign.rollback.sql
-- Context:            briefs/CONTEXT-FIX-FUNDING.md — incident 2026-10-11, decision F1
-- ============================================================================
-- Bug: the idempotency short-circuit keyed on the invoice ref ALONE. Confirming campaign B with a ref
-- already used for campaign A returned A's escrow txn id with no error, so nothing was written for B
-- while the admin UI reported success (FINEX SARL stayed pending_funding).
-- Fix (F1): if the ref exists and its escrow txn belongs to p_campaign_id → return it (double-submit,
-- unchanged behaviour); otherwise RAISE 'invoice_already_used' (nothing written, transaction aborts).
-- Everything else is byte-for-byte the 0033 body. Same signature; CREATE OR REPLACE only; no
-- destructive keywords (K8) — safe for the Supabase connector.
-- ============================================================================

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
REVOKE ALL ON FUNCTION public.admin_confirm_campaign_funding(uuid, text, public.payment_provider, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_confirm_campaign_funding(uuid, text, public.payment_provider, text) TO authenticated;
