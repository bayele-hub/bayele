-- ============================================================================
-- Migration:          Profiles phone lockdown (A1) — signed-in users can no longer read phone_e164
-- Version:            20261014090200_0037
-- Date:               2026-10-14
-- Team:               Bayele Core Platform Engineering
-- Dependencies:       0035 (get_my_contact), 0036 (profiles.resubmitted_at)
-- Rollback Script:    supabase/migrations/rollback/20261014090200_0037_profiles_phone_lockdown.rollback.sql
-- Decisions:          briefs/CONTEXT-ADMIN-REVIEW.md D1 (A1)
-- ============================================================================
-- RELEASE ORDER: apply 0035 + 0036 → deploy the web that no longer does select('*') on profiles and
-- reads its own phone via get_my_contact() → apply THIS migration. Applied before the new web, every
-- signed-in page of the old web fails (getSession select('*') → 42501).
--
-- authenticated keeps SELECT only on the listed columns (the RLS row filters are unchanged). Excluded:
-- phone_e164 and the internal text_limits_grandfathered flag. A column added later is NOT readable by
-- signed-in users unless granted explicitly. anon is unchanged (0018 column list, no phone).
-- K8: no destructive keyword.
-- ============================================================================

REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, handle, display_name, avatar_url, bio, city, country, status, created_at, updated_at, resubmitted_at)
  ON public.profiles TO authenticated;
