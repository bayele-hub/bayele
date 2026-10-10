-- ============================================================================
-- Rollback of:        20261010120000_0030_public_campaign_board.sql
-- Inverse type:       TRUE INVERSE (the is_public value of rows created while the default was
--                     true is kept — those campaigns stay public; flip them per campaign with
--                     set_campaign_visibility if needed).
-- Apply only after the web app no longer calls public_campaign_board / public_campaign_stats.
-- ============================================================================

ALTER TABLE public.campaigns ALTER COLUMN is_public SET DEFAULT false;

DROP FUNCTION IF EXISTS public.public_campaign_stats(uuid);
DROP FUNCTION IF EXISTS public.public_campaign_board(public.country_code, text, integer);

DELETE FROM supabase_migrations.schema_migrations WHERE version = '20261010120000';
