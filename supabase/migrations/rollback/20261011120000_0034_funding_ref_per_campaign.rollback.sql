-- ============================================================================
-- Rollback of:        20261011120000_0034_funding_ref_per_campaign.sql
-- Inverse type:       TRUE INVERSE — restores the 0033 body of admin_confirm_campaign_funding
--                     (ref-only idempotency: RE-OPENS the silent "already used ref" bug).
-- No destructive keywords (K8). If the migration was recorded in supabase_migrations.schema_migrations,
-- the owner removes version 20261011120000 there by hand in the SQL editor.
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
          CASE WHEN v_managed AND v_owner_role = 'super_admin' THEN '/admin/briefs' ELSE '/business/campaigns' END);
  RETURN v_txn;
END; $$;
REVOKE ALL ON FUNCTION public.admin_confirm_campaign_funding(uuid, text, public.payment_provider, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_confirm_campaign_funding(uuid, text, public.payment_provider, text) TO authenticated;
