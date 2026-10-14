-- ============================================================================
-- Rollback of:        20261014120000_0038_partner_assignment_context.sql
-- Inverse type:       NO-OP — Postgres cannot remove an enum value without recreating the type. The value
--                     'partner_assignment' is inert once 0039 is rolled back (no row or function uses it).
--                     Roll back 0039 first. This file only unrecords the migration.
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.conversations WHERE context_type::text = 'partner_assignment') THEN
    RAISE EXCEPTION 'rollback_0038_blocked: partner_assignment conversations exist (roll back 0039 first)';
  END IF;
END $$;

DELETE FROM supabase_migrations.schema_migrations WHERE version = '20261014120000';
