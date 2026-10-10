-- ============================================================================
-- Rollback of:        20261010120200_0032_campaigns_anon_column_lockdown.sql
-- Inverse type:       TRUE INVERSE — restores the pre-0032 table-wide anon grant (Supabase default
--                     ALL), which RE-EXPOSES brief / total budget / fee rate to logged-out clients.
-- Prefer fixing the client query over rolling this back.
-- ============================================================================

REVOKE SELECT (
  id, owner_id, owner_role, title, category, target_country, status,
  payout_per_creator_fcfa, creator_count_target, created_at, updated_at, is_public,
  platforms, content_type, deliverable_quantity, deadline
) ON public.campaigns FROM anon;

GRANT ALL ON public.campaigns TO anon;
GRANT ALL ON public.campaign_creators TO anon;

DELETE FROM supabase_migrations.schema_migrations WHERE version = '20261010120200';
