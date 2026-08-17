-- ============================================================================
-- Rollback of:        20260817120700_0008_public_marketplace_roles.sql
-- Author:             Lead Security/Compliance Engineer
-- Inverse type:       TRUE INVERSE — restore the owner/admin-only user_roles SELECT policy
--                     (the 0007 form). NOTE: this re-breaks the anonymous public directory.
-- ============================================================================

DROP POLICY IF EXISTS "users read own roles" ON public.user_roles;
CREATE POLICY "users read own roles"
  ON public.user_roles FOR SELECT
  USING (user_id = (select auth.uid()) OR private.is_admin((select auth.uid())));

DELETE FROM supabase_migrations.schema_migrations WHERE version = '20260817120700';
