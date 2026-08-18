-- ============================================================================
-- Rollback of:        20260818140000_0019_profile_self_and_counterparty_read.sql
-- Author:             Principal Backend & Database Systems Engineer
-- Inverse type:       TRUE INVERSE — drop the two additive SELECT policies.
-- WARNING: dropping "users read own profile" re-breaks getSession for pending users and ALL business
--          users (they lose the ability to read their own profile row), locking businesses out of their
--          dashboard. Only roll back if you are replacing these policies.
-- ============================================================================

DROP POLICY IF EXISTS "retainer parties read counterparty profile" ON public.profiles;
DROP POLICY IF EXISTS "users read own profile" ON public.profiles;

DELETE FROM supabase_migrations.schema_migrations WHERE version = '20260818140000';
