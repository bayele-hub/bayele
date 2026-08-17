-- ============================================================================
-- Migration:          Fix — verify_proof_of_post: private.is_admin + enum-cast on status
-- Version:            20260817121300_0014
-- Date:               2026-08-17
-- Author:             Lead Security, Cryptography & Compliance Engineer + Backend/DB
-- Team:               Bayele Core Platform Engineering
-- Target Database:    Supabase Postgres 17.x (managed) — portable to Cloud SQL / RDS Postgres 15+
-- Infrastructure Ref: infra/terraform/ · supabase_project.bayele (ref oxesplxlshsdrijzckpq)
-- Feature Ticket:     BAY-HOTFIX-014  (regression from 0005; found by M7/0013 verification)
-- Dependencies:       0003 (defines verify_proof_of_post), 0005 (moved is_admin → private)
-- Rollback Script:    supabase/migrations/rollback/20260817121300_0014_fix_verify_proof_is_admin.rollback.sql
-- Estimated Duration: ~0.1s
-- ============================================================================
-- Description:        Migration 0005 relocated is_admin() from public → private and repointed the
--                     ~13 RLS policies, but did NOT repoint the one SECURITY DEFINER RPC that also
--                     calls it in its body: verify_proof_of_post() still referenced public.is_admin,
--                     which 0005 dropped. Because that function runs with search_path='' and a fully
--                     schema-qualified call, the missing function is a hard runtime error — every
--                     proof review (owner OR admin) raised 'function public.is_admin(uuid) does not
--                     exist', breaking the entire escrow-release path. Re-creating it also surfaced a
--                     SECOND dormant defect one line down: `SET status = CASE WHEN p_approve THEN
--                     'verified' ELSE 'rejected' END` resolves the CASE to text, which does not
--                     implicitly cast to the creator_campaign_status enum column. Both were dormant
--                     because the body never ran past the is_admin line. This re-creates it from 0003
--                     with public.is_admin → private.is_admin AND an explicit enum cast on the CASE.
-- Breaking Changes:   NONE — pure fix. Signature, security, search_path and existing grants (the 0004
--                     REVOKE from PUBLIC/anon/authenticated) are preserved by CREATE OR REPLACE.
-- Performance Impact: None. Metadata replace of one function.
-- Compliance Notes:   Restores the human-review authorization gate (spec §0.1 #C): a proof can be
--                     verified only by the campaign owner or an admin, and self-approval by the
--                     assigned creator still raises. private.is_admin is EXECUTE-able by the definer
--                     owner, so the internal call resolves. Discovered by the negatives-first M7 suite
--                     (0013) — logged as a caught regression, fixed forward (applied migrations are
--                     never mutated).
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

  -- FIX (0014): private.is_admin, not public.is_admin (0005 relocation).
  IF NOT (v_owner_id = p_actor OR private.is_admin(p_actor)) THEN
    RAISE EXCEPTION 'actor % not authorized to verify proofs on campaign %', p_actor, v_campaign_id;
  END IF;

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
END;
$$;

-- ============================================================================
-- POST-APPLY VERIFICATION (Part 6):
--   • SELECT position('private.is_admin' in pg_get_functiondef('public.verify_proof_of_post'::regproc)) > 0;  -- true
--   • owner verifying an assigned proof succeeds; escrow moves proof_pending→releasable
--   • the assigned creator verifying their OWN proof → RAISES 'actor ... not authorized ...'
-- ============================================================================
