-- ============================================================================
-- Rollback of:        20260817121300_0014_fix_verify_proof_is_admin.sql
-- Author:             Lead Security, Cryptography & Compliance Engineer
-- Inverse type:       TRUE INVERSE — restores the pre-0014 (0003) definition, which references
--                     public.is_admin. WARNING: with 0005 applied, public.is_admin does NOT exist, so
--                     rolling back RE-INTRODUCES the runtime error in verify_proof_of_post. Only roll
--                     back together with (or below) 0005. Documented deliberately per the standard.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.verify_proof_of_post(
  p_proof_id UUID, p_approve BOOLEAN, p_actor UUID, p_rejection_reason TEXT DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_campaign_creator_id UUID; v_campaign_id UUID; v_owner_id UUID; v_txn_id UUID;
BEGIN
  SELECT cc.id, cc.campaign_id, c.owner_id INTO v_campaign_creator_id, v_campaign_id, v_owner_id
    FROM public.proof_of_post pp
    JOIN public.campaign_creators cc ON cc.id = pp.campaign_creator_id
    JOIN public.campaigns c ON c.id = cc.campaign_id
    WHERE pp.id = p_proof_id;
  IF v_campaign_creator_id IS NULL THEN RAISE EXCEPTION 'proof % not found', p_proof_id; END IF;

  IF NOT (v_owner_id = p_actor OR public.is_admin(p_actor)) THEN
    RAISE EXCEPTION 'actor % not authorized to verify proofs on campaign %', p_actor, v_campaign_id;
  END IF;

  UPDATE public.proof_of_post
    SET is_valid = p_approve, reviewed_by = p_actor, reviewed_at = now(),
        rejection_reason = CASE WHEN p_approve THEN NULL ELSE p_rejection_reason END
    WHERE id = p_proof_id;
  UPDATE public.campaign_creators
    SET status = CASE WHEN p_approve THEN 'verified' ELSE 'rejected' END, updated_at = now()
    WHERE id = v_campaign_creator_id;

  IF p_approve THEN
    SELECT id INTO v_txn_id FROM public.escrow_transactions
      WHERE campaign_creator_id = v_campaign_creator_id AND status = 'proof_pending' LIMIT 1;
    IF v_txn_id IS NOT NULL THEN PERFORM public.transition_escrow(v_txn_id, 'releasable', p_actor); END IF;
  END IF;
END;
$$;

DELETE FROM supabase_migrations.schema_migrations WHERE version = '20260817121300';
