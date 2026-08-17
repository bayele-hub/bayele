-- ============================================================================
-- Rollback of:        20260817120000_0001_core_schema.sql
-- Author:             Principal Backend & Database Systems Engineer
-- Inverse type:       TRUE INVERSE (greenfield create → full drop). Safe only while these tables
--                     hold no data you need; CASCADE removes dependent policies/FKs/indexes.
-- Drop order:         dependents first (functions in 0003 assumed already rolled back), then
--                     tables in reverse FK order, then enums, then the migration-history row.
-- ============================================================================

-- Tables (reverse dependency order). CASCADE clears FKs, indexes, and any 0002 policies.
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.agency_retainers CASCADE;
DROP TABLE IF EXISTS public.invoices CASCADE;
DROP TABLE IF EXISTS public.proof_of_post CASCADE;
DROP TABLE IF EXISTS public.escrow_audit_log CASCADE;
DROP TABLE IF EXISTS public.escrow_transactions CASCADE;
DROP TABLE IF EXISTS public.campaign_creators CASCADE;
DROP TABLE IF EXISTS public.campaigns CASCADE;
DROP TABLE IF EXISTS public.business_profiles CASCADE;
DROP TABLE IF EXISTS public.consultant_profiles CASCADE;
DROP TABLE IF EXISTS public.creator_profiles CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Enums.
DROP TYPE IF EXISTS public.invoice_type CASCADE;
DROP TYPE IF EXISTS public.retainer_status CASCADE;
DROP TYPE IF EXISTS public.payment_provider CASCADE;
DROP TYPE IF EXISTS public.escrow_status CASCADE;
DROP TYPE IF EXISTS public.creator_campaign_status CASCADE;
DROP TYPE IF EXISTS public.campaign_status CASCADE;
DROP TYPE IF EXISTS public.country_code CASCADE;
DROP TYPE IF EXISTS public.account_status CASCADE;
DROP TYPE IF EXISTS public.user_role CASCADE;

-- Extensions are intentionally NOT dropped (shared, harmless, may be used elsewhere).

DELETE FROM supabase_migrations.schema_migrations WHERE version = '20260817120000';

-- VERIFY: SELECT count(*) FROM information_schema.tables WHERE table_schema='public'; -- expect 0
