-- ============================================================================
-- Rollback of:        20261014090200_0037_profiles_phone_lockdown.sql
-- Inverse type:       TRUE INVERSE — restores authenticated's table-wide SELECT on profiles, which RE-EXPOSES
--                     phone_e164 of every profile a signed-in user can see. Roll back 0037 before 0036/0035.
-- ============================================================================

REVOKE SELECT (id, handle, display_name, avatar_url, bio, city, country, status, created_at, updated_at) ON public.profiles FROM authenticated;
GRANT SELECT ON public.profiles TO authenticated;

DELETE FROM supabase_migrations.schema_migrations WHERE version = '20261014090200';
