-- ============================================================================
-- Rollback of:        20260817120800_0009_onboard_profile.sql
-- Author:             Principal Backend & Database Systems Engineer
-- Inverse type:       TRUE INVERSE — drop the function. (Profiles it created remain; a data
--                     rollback of onboarded users is a separate, explicit decision.)
-- ============================================================================

DROP FUNCTION IF EXISTS public.onboard_profile(
  uuid, public.user_role, text, text, text, public.country_code, text, text,
  text[], int, jsonb, text[], int, text, text, text
);

DELETE FROM supabase_migrations.schema_migrations WHERE version = '20260817120800';
