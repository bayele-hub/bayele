-- ============================================================================
-- Rollback of:        20260925100000_0026_founder_creator_badge.sql
-- Inverse type:       TRUE INVERSE — drop the trigger, functions and table.
-- WARNING: dropping founder_creators deletes every awarded founder number. Re-applying 0026 would
--          re-number creators from their role grant order (the same result unless accounts were
--          deleted in between). Only roll back deliberately.
-- ============================================================================

DROP TRIGGER IF EXISTS trg_award_founder_badge ON public.user_roles;
DROP FUNCTION IF EXISTS private.award_founder_badge();
DROP FUNCTION IF EXISTS public.founder_badge_stats();
DROP TABLE IF EXISTS public.founder_creators;

DELETE FROM supabase_migrations.schema_migrations WHERE version = '20260925100000';
