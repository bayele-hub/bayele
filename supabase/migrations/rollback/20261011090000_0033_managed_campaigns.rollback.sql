-- ============================================================================
-- Rollback of:        20261011090000_0033_managed_campaigns.sql
-- Inverse type:       TRUE INVERSE — removes the managed-campaign columns, board/stats v2, pay_floors,
--                     managed_briefs (DATA LOSS: intake tracker rows and pay floors), the enum, and
--                     restores private.guard_campaigns, admin_confirm_campaign_funding and admin_refund_campaign to their 0018 bodies.
-- Precondition:       no campaign with is_managed = true should exist (its brand line would fall back
--                     to the owner profile name on the v1 board). The guard below aborts if one does.
-- Run in the SQL editor (contains DROP/DELETE — not for the connector, K8).
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'campaigns' AND column_name = 'is_managed') THEN
    IF EXISTS (SELECT 1 FROM public.campaigns WHERE is_managed) THEN
      RAISE EXCEPTION 'rollback_0033_blocked: managed campaigns exist';
    END IF;
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_sync_managed_brief_status ON public.campaigns;
DROP FUNCTION IF EXISTS private.sync_managed_brief_status();

DROP FUNCTION IF EXISTS public.admin_publish_managed_brief(uuid);
DROP FUNCTION IF EXISTS public.admin_decline_managed_brief(uuid, text);
DROP FUNCTION IF EXISTS public.managed_net_preview(bigint, integer, integer);
DROP FUNCTION IF EXISTS private.decline_managed_brief(uuid, text);
DROP FUNCTION IF EXISTS private.managed_campaign_live(uuid);
DROP FUNCTION IF EXISTS private.category_needs_claims_check(text);
DROP FUNCTION IF EXISTS private.normalize_category(text);
DROP FUNCTION IF EXISTS public.admin_list_managed_briefs();
DROP FUNCTION IF EXISTS public.admin_upsert_managed_brief(jsonb);
DROP FUNCTION IF EXISTS public.pay_floor_list();
DROP FUNCTION IF EXISTS public.pay_floors_public();
DROP FUNCTION IF EXISTS public.admin_clear_pay_floor(public.deliverable_type);
DROP FUNCTION IF EXISTS public.admin_set_pay_floor(public.deliverable_type, integer);
DROP FUNCTION IF EXISTS private.managed_floor_check(bigint, integer, integer, public.deliverable_type);

DROP TABLE IF EXISTS public.managed_briefs;
DROP TABLE IF EXISTS public.pay_floors;
DROP TYPE IF EXISTS public.deliverable_type;

DROP FUNCTION IF EXISTS public.public_campaign_stats_v2(uuid);
DROP FUNCTION IF EXISTS public.public_campaign_board_v2(public.country_code, text, integer);

-- admin_confirm_campaign_funding: 0018 [M8] body (link always /business/campaigns).
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

-- admin_refund_campaign: 0018 [M5] body.
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

-- guard_campaigns: 0018 body.
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

-- Dropping the columns also removes their anon column grants.
ALTER TABLE public.campaigns
  DROP CONSTRAINT IF EXISTS campaigns_managed_fields,
  DROP CONSTRAINT IF EXISTS campaigns_managed_text_lengths,
  DROP COLUMN IF EXISTS is_managed,
  DROP COLUMN IF EXISTS brand_label,
  DROP COLUMN IF EXISTS brand_consent,
  DROP COLUMN IF EXISTS brand_city,
  DROP COLUMN IF EXISTS language,
  DROP COLUMN IF EXISTS usage_rights,
  DROP COLUMN IF EXISTS creator_requirements,
  DROP COLUMN IF EXISTS equipment,
  DROP COLUMN IF EXISTS claims_verified;

DELETE FROM supabase_migrations.schema_migrations WHERE version = '20261011090000';
