-- ============================================================================
-- Rollback of:        20260817120100_0002_rls_policies.sql
-- Author:             Lead Security, Cryptography & Compliance Engineer
-- Inverse type:       TRUE INVERSE — drop every policy this file created, drop is_admin(), and
--                     disable RLS on the tables it enabled. Order: policies → function → disable.
-- Note:               Disabling RLS returns tables to allow-by-grant. Only run as part of a full
--                     teardown (it is unsafe to leave tables with RLS disabled in production).
-- ============================================================================

DROP POLICY IF EXISTS "public profiles are readable" ON public.profiles;
DROP POLICY IF EXISTS "users update own profile" ON public.profiles;
DROP POLICY IF EXISTS "admins manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "public read active creator profiles" ON public.creator_profiles;
DROP POLICY IF EXISTS "creators manage own creator profile" ON public.creator_profiles;
DROP POLICY IF EXISTS "public read active consultant profiles" ON public.consultant_profiles;
DROP POLICY IF EXISTS "consultants manage own consultant profile" ON public.consultant_profiles;
DROP POLICY IF EXISTS "users read own roles" ON public.user_roles;
DROP POLICY IF EXISTS "businesses manage their own profile" ON public.business_profiles;
DROP POLICY IF EXISTS "campaign owners manage their campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "active campaigns are viewable by creators" ON public.campaigns;
DROP POLICY IF EXISTS "campaign_creators visible to creator, owner, admin" ON public.campaign_creators;
DROP POLICY IF EXISTS "businesses view their invoices" ON public.invoices;
DROP POLICY IF EXISTS "escrow visible to involved parties" ON public.escrow_transactions;
DROP POLICY IF EXISTS "users read own notifications" ON public.notifications;
DROP POLICY IF EXISTS "users mark own notifications read" ON public.notifications;

-- is_admin is referenced by 0004 policies too; only drop in a FULL teardown.
DROP FUNCTION IF EXISTS public.is_admin(uuid) CASCADE;

ALTER TABLE public.profiles             DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles           DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_profiles     DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultant_profiles  DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_profiles    DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns            DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_creators    DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.escrow_transactions  DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices             DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_retainers     DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications        DISABLE ROW LEVEL SECURITY;

DELETE FROM supabase_migrations.schema_migrations WHERE version = '20260817120100';
