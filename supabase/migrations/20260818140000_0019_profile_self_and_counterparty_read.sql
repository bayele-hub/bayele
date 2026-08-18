-- ============================================================================
-- Migration:          Profile self-read + retainer counterparty read policies
-- Version:            20260818140000_0019
-- Date:               2026-08-18
-- Author:             Principal Backend & Database Systems Engineer + QA
-- Team:               Bayele Core Platform Engineering
-- Target Database:    Supabase Postgres 17.x (managed)
-- Feature Ticket:     BAY-QA-019 (consultant/business journey audit)
-- Dependencies:       0001 (tables), 0002 (base RLS), 0007 (retainer RLS), 0018 (column grants)
-- Rollback Script:    supabase/migrations/rollback/20260818140000_0019_profile_self_and_counterparty_read.rollback.sql
-- Estimated Duration: ~0.1s
-- ============================================================================
-- Description: The only SELECT policy on public.profiles was "public profiles are readable"
--   (status='active' AND role IN creator/consultant). That silently blocked two legitimate reads that
--   getSession() and the retainer UI depend on:
--     [B1] A user reading their OWN profile when it is NOT an active creator/consultant — i.e. any
--          pending_review / suspended / rejected user, AND every BUSINESS user (role 'business' is never
--          in the public policy). getSession() returned profile=null for them, so the dispatcher looped
--          them back to onboarding and business users were locked out of their dashboard entirely.
--     [B2] A retainer's consultant reading the counterparty BUSINESS profile's name (the embed returned
--          null → the UI always showed the generic "Marque").
--   Both are fixed with additive SELECT policies. Neither widens public exposure: self-read matches only
--   your own row; counterparty-read matches only a profile you share an agency_retainer with.
-- Breaking Changes: NONE (purely additive policies).
-- Compliance Notes: business profiles remain absent from the public directory; only a contracted
--   counterparty (or the owner) can now read the row, which is the intended B2B relationship scope.
-- ============================================================================

-- [B1] Any authenticated user may read their own profile row (all statuses / all roles).
DROP POLICY IF EXISTS "users read own profile" ON public.profiles;
CREATE POLICY "users read own profile" ON public.profiles
  FOR SELECT USING ((SELECT auth.uid()) = id);

-- [B2] The two parties of an agency retainer may read each other's profile (name/city/etc.), so the
-- consultant can see the brand and the brand can see the consultant. Subquery hits agency_retainers,
-- whose own SELECT policy is party-or-admin — no recursion back into profiles.
DROP POLICY IF EXISTS "retainer parties read counterparty profile" ON public.profiles;
CREATE POLICY "retainer parties read counterparty profile" ON public.profiles
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.agency_retainers ar
    WHERE (ar.consultant_id = (SELECT auth.uid()) AND ar.business_id = profiles.id)
       OR (ar.business_id   = (SELECT auth.uid()) AND ar.consultant_id = profiles.id)
  ));

-- ============================================================================
-- POST-APPLY VERIFICATION:
--   • pending_review user self-read → 1 row
--   • business user self-read → 1 row
--   • consultant reading a retainer's business profile → business display_name visible
--   • anon still sees only active creators/consultants (unchanged)
-- ============================================================================
