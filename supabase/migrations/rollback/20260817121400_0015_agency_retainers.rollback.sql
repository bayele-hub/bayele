-- ============================================================================
-- Rollback of:        20260817121400_0015_agency_retainers.sql
-- Author:             Principal Backend & Database Systems Engineer
-- Inverse type:       TRUE INVERSE — drop the four retainer façade RPCs only. The 0003 funding path
--                     (handle_sokoclick_invoice_paid) is untouched, and any agency_retainers /
--                     invoices / notifications rows they wrote REMAIN: unwinding a funded contract is a
--                     deliberate financial operation, never an automatic drop.
-- ============================================================================

DROP FUNCTION IF EXISTS public.transition_retainer(uuid, public.retainer_status);
DROP FUNCTION IF EXISTS public.admin_confirm_retainer_funding(uuid, text, text);
DROP FUNCTION IF EXISTS public.attach_retainer_invoice(uuid, text);
DROP FUNCTION IF EXISTS public.propose_retainer(uuid, bigint, bigint, bigint, bigint, bigint);

DELETE FROM supabase_migrations.schema_migrations WHERE version = '20260817121400';
