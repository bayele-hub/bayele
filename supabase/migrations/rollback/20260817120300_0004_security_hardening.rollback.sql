-- ============================================================================
-- Rollback of:        20260817120300_0004_security_hardening.sql
-- Author:             Lead Security, Cryptography & Compliance Engineer
-- Inverse type:       PARTIAL INVERSE (documented). Reverses the policies, the search_path pins,
--                     the Realtime membership, and RE-GRANTS the money RPCs to the default roles.
--                     NOTE: re-granting and un-pinning search_path REDUCES security — only run this
--                     as part of a full teardown or an explicitly-approved break-glass, never to
--                     "relax" production. RLS is left ENABLED on proof_of_post/escrow_audit_log
--                     (disabling it would be less safe than the pre-0004 state and 0001/0002 own it).
-- ============================================================================

-- Policies added by 0004.
DROP POLICY IF EXISTS "proof visible to creator, owner, admin" ON public.proof_of_post;
DROP POLICY IF EXISTS "audit visible to involved parties and admin" ON public.escrow_audit_log;
DROP POLICY IF EXISTS "retainer visible to parties and admin" ON public.agency_retainers;
DROP POLICY IF EXISTS "admins manage retainers" ON public.agency_retainers;

-- Un-pin search_path (RESET restores the role/DB default).
ALTER FUNCTION public.is_admin(uuid) RESET search_path;
ALTER FUNCTION public.transition_escrow(uuid, public.escrow_status, uuid, jsonb) RESET search_path;
ALTER FUNCTION public.handle_sokoclick_invoice_paid(text, text, uuid, public.invoice_type, bigint, text, uuid, uuid) RESET search_path;
ALTER FUNCTION public.submit_proof_of_post(uuid, uuid, text, text, text, jsonb, numeric, public.payment_provider) RESET search_path;
ALTER FUNCTION public.verify_proof_of_post(uuid, boolean, uuid, text) RESET search_path;

-- Re-grant EXECUTE to the default roles (Postgres default is GRANT EXECUTE TO PUBLIC).
GRANT EXECUTE ON FUNCTION public.transition_escrow(uuid, public.escrow_status, uuid, jsonb) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_sokoclick_invoice_paid(text, text, uuid, public.invoice_type, bigint, text, uuid, uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_proof_of_post(uuid, uuid, text, text, text, jsonb, numeric, public.payment_provider) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_proof_of_post(uuid, boolean, uuid, text) TO PUBLIC;

-- Realtime membership.
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE public.notifications;
EXCEPTION WHEN undefined_object THEN NULL; WHEN undefined_table THEN NULL;
END $$;

DELETE FROM supabase_migrations.schema_migrations WHERE version = '20260817120300';
