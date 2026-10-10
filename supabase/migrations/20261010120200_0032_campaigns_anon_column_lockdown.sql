-- ============================================================================
-- Migration:          Anonymous column lockdown on public.campaigns (+ no anon access to campaign_creators)
-- Version:            20261010120200_0032
-- Date:               2026-10-10
-- Team:               Bayele Core Platform Engineering
-- Dependencies:       0001, 0002, 0022, 0030
-- Rollback Script:    supabase/migrations/rollback/20261010120200_0032_campaigns_anon_column_lockdown.rollback.sql
-- Plan:               docs/CAMPAIGNS-PUBLIC-PAGE-PLAN.md §6 (D1 soft wall), §7 invariant #1
-- ============================================================================
-- Why: the "browse open campaigns" RLS policy lets anon read public published / in_progress /
-- completed rows, and anon held table-wide SELECT, so a logged-out client could read the total
-- budget, the fee rate and the full brief straight from the table, bypassing the soft wall.
--
-- After this migration anon may SELECT only the columns below (the RLS row filter still applies).
-- Excluded for anon: brief, mandatory_tags, total_budget_fcfa, platform_fee_rate, match_pass_paid,
-- and any column added later unless it is granted explicitly.
-- `authenticated` is unchanged (signed-in users still read the brief through RLS — soft wall).
--
-- Also revoked from anon: INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER. RLS already blocks anon
-- writes (the owner policy needs auth.uid()), but TRUNCATE is not subject to RLS — no anon client
-- path needs any of these.
--
-- Client impact: a PostgREST select by anon that names an excluded column (or uses select=*) now
-- fails with 42501 "permission denied for table campaigns". Call sites: lib/data/public-campaigns.ts getPublicCampaign()
-- (brief, mandatory_tags) must read those only with a signed-in session.
-- ============================================================================

REVOKE ALL ON public.campaigns FROM anon;

GRANT SELECT (
  id, owner_id, owner_role, title, category, target_country, status,
  payout_per_creator_fcfa, creator_count_target, created_at, updated_at, is_public,
  platforms, content_type, deliverable_quantity, deadline
) ON public.campaigns TO anon;

-- campaign_creators (QA D11): anon held every Supabase-default privilege, TRUNCATE included (not
-- subject to RLS). No logged-out code path reads it (the only web read, components/campaign-apply-cta.tsx,
-- runs after a session check); public counts come from the definer RPCs. Nothing is granted back.
-- Side effect: an anon SELECT on proof_of_post now raises "permission denied" (its policy subqueries
-- campaign_creators) instead of returning 0 rows — no logged-out path reads proof_of_post either.
REVOKE ALL ON public.campaign_creators FROM anon;
