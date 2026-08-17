-- ============================================================================
-- Rollback of:        20260817121200_0013_creator_execution_loop.sql
-- Author:             Principal Backend & Database Systems Engineer
-- Inverse type:       TRUE INVERSE — drop the five façade RPCs only. The underlying 0003 money-path
--                     definers (submit_/verify_proof_of_post, transition_escrow) are untouched, and
--                     any campaign_creators / proof_of_post / escrow rows they wrote REMAIN: unwinding
--                     an in-flight payout is a deliberate financial operation, never an automatic drop.
-- ============================================================================

DROP FUNCTION IF EXISTS public.admin_confirm_creator_payout(uuid, public.payment_provider, text);
DROP FUNCTION IF EXISTS public.review_proof(uuid, boolean, text);
DROP FUNCTION IF EXISTS public.creator_submit_proof(uuid, text, text, text);
DROP FUNCTION IF EXISTS public.decide_application(uuid, boolean);
DROP FUNCTION IF EXISTS public.apply_to_campaign(uuid);

DELETE FROM supabase_migrations.schema_migrations WHERE version = '20260817121200';
