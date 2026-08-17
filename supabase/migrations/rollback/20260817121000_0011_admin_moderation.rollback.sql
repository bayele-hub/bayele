-- ============================================================================
-- Rollback of:        20260817121000_0011_admin_moderation.sql
-- Author:             Principal Backend & Database Systems Engineer
-- Inverse type:       TRUE INVERSE — drop the trigger, the trigger function, and the RPC.
-- ============================================================================

DROP TRIGGER IF EXISTS trg_profile_status_change ON public.profiles;
DROP FUNCTION IF EXISTS public.on_profile_status_change();
DROP FUNCTION IF EXISTS public.moderate_profile(uuid, public.account_status);

DELETE FROM supabase_migrations.schema_migrations WHERE version = '20260817121000';
