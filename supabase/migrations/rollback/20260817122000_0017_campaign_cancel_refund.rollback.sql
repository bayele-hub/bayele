-- ============================================================================
-- Rollback of:        20260817122000_0017_campaign_cancel_refund.sql
-- Author:             Principal Backend & Database Systems Engineer
-- Inverse type:       TRUE INVERSE — drop the two façades. transition_escrow and the escrow machine
--                     are untouched, and any escrow_transactions / campaigns / notifications rows a
--                     refund already wrote REMAIN: unwinding a settled refund is a deliberate financial
--                     operation, never an automatic drop. After this, refunding/refunded/cancelled are
--                     once again unreachable from the API.
-- ============================================================================

DROP FUNCTION IF EXISTS public.admin_refund_campaign(uuid, text, text);
DROP FUNCTION IF EXISTS public.cancel_campaign(uuid);

DELETE FROM supabase_migrations.schema_migrations WHERE version = '20260817122000';
