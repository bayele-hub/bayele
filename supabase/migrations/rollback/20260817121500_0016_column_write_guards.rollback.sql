-- ============================================================================
-- Rollback of:        20260817121500_0016_column_write_guards.sql
-- Author:             Lead Security, Cryptography & Compliance Engineer
-- Inverse type:       TRUE INVERSE — drop the five BEFORE-write guard triggers and their private
--                     functions. WARNING: this re-opens the direct-PostgREST column-escalation holes
--                     (profiles.status self-approve, campaigns self-publish / fee tamper,
--                     creator_profiles self-Pro / self-rating, consultant agency_access,
--                     business is_verified). Only roll back to reapply a corrected guard set — never
--                     leave the tables unguarded in production. No data is modified.
-- ============================================================================

DROP TRIGGER IF EXISTS trg_guard_business_profiles   ON public.business_profiles;
DROP TRIGGER IF EXISTS trg_guard_consultant_profiles ON public.consultant_profiles;
DROP TRIGGER IF EXISTS trg_guard_creator_profiles    ON public.creator_profiles;
DROP TRIGGER IF EXISTS trg_guard_campaigns           ON public.campaigns;
DROP TRIGGER IF EXISTS trg_guard_profiles            ON public.profiles;

DROP FUNCTION IF EXISTS private.guard_business_profiles();
DROP FUNCTION IF EXISTS private.guard_consultant_profiles();
DROP FUNCTION IF EXISTS private.guard_creator_profiles();
DROP FUNCTION IF EXISTS private.guard_campaigns();
DROP FUNCTION IF EXISTS private.guard_profiles();

DELETE FROM supabase_migrations.schema_migrations WHERE version = '20260817121500';
