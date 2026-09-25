-- ============================================================================
-- Rollback of:        20260925100100_0027_managed_creators.sql
-- Inverse type:       Restores the 0018 admin_confirm_creator_payout and the 0022 browse policy,
--                     then drops the representation tables, deal snapshot columns and RPCs.
-- WARNING: drops partner_creator_links and partner_commissions. Export any 'owed' commissions
--          first — they are money Bayele still has to pay partners.
-- ============================================================================

DROP FUNCTION IF EXISTS public.admin_confirm_partner_commission(uuid, public.payment_provider, text);
DROP FUNCTION IF EXISTS public.partner_deals();
DROP FUNCTION IF EXISTS public.my_partner_links();
DROP FUNCTION IF EXISTS public.partner_apply_for_creator(uuid, uuid);
DROP FUNCTION IF EXISTS public.end_representation(uuid);
DROP FUNCTION IF EXISTS public.respond_representation(uuid, boolean);
DROP FUNCTION IF EXISTS public.partner_invite_creator(text, numeric, text);

DROP TRIGGER IF EXISTS trg_snapshot_deal_partner ON public.campaign_creators;
DROP FUNCTION IF EXISTS private.snapshot_deal_partner();

DROP POLICY IF EXISTS "browse open campaigns" ON public.campaigns;
CREATE POLICY "browse open campaigns" ON public.campaigns FOR SELECT USING (
  status IN ('published','in_progress','completed')
  AND (is_public OR private.is_creator((SELECT auth.uid())))
);
DROP FUNCTION IF EXISTS private.is_partner(uuid);

-- 0018 payout (no split).
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
    UPDATE public.campaign_creators SET status = 'rejected', updated_at = now()
      WHERE campaign_id = v_campaign AND status = 'applied';
    UPDATE public.campaigns SET status = 'completed', updated_at = now()
      WHERE id = v_campaign AND status IN ('published','in_progress');
  END IF;
  RETURN v_txn;
END; $$;

DROP TABLE IF EXISTS public.partner_commissions;
ALTER TABLE public.campaign_creators DROP CONSTRAINT IF EXISTS cc_partner_snapshot_pair;
DROP INDEX IF EXISTS public.campaign_creators_partner_idx;
DROP INDEX IF EXISTS public.campaign_creators_applied_by_idx;
ALTER TABLE public.campaign_creators
  DROP COLUMN IF EXISTS partner_id, DROP COLUMN IF EXISTS partner_commission_rate, DROP COLUMN IF EXISTS applied_by;
DROP TABLE IF EXISTS public.partner_creator_links;
DROP TYPE IF EXISTS public.representation_status;

DELETE FROM supabase_migrations.schema_migrations WHERE version = '20260925100100';
