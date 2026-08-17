-- ============================================================================
-- Rollback of:        20260817120200_0003_escrow_functions.sql
-- Author:             Principal Backend & Database Systems Engineer
-- Inverse type:       TRUE INVERSE — drop the four money-path functions. is_admin() belongs to
--                     0002 and is left intact. Safe to run independently of the table rollback.
-- ============================================================================

DROP FUNCTION IF EXISTS public.verify_proof_of_post(uuid, boolean, uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.submit_proof_of_post(uuid, uuid, text, text, text, jsonb, numeric, public.payment_provider) CASCADE;
DROP FUNCTION IF EXISTS public.handle_sokoclick_invoice_paid(text, text, uuid, public.invoice_type, bigint, text, uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.transition_escrow(uuid, public.escrow_status, uuid, jsonb) CASCADE;

DELETE FROM supabase_migrations.schema_migrations WHERE version = '20260817120200';
