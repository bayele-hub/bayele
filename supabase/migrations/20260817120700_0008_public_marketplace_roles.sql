-- ============================================================================
-- Migration:          Public read of marketplace roles (unblocks the anonymous directory)
-- Version:            20260817120700_0008
-- Date:               2026-08-17
-- Author:             Lead Security/Compliance Engineer + Backend/DB
-- Team:               Bayele Core Platform Engineering
-- Target Database:    Supabase Postgres 17.x (managed) — portable to Cloud SQL / RDS Postgres 15+
-- Infrastructure Ref: infra/terraform/ · supabase_project.bayele (ref oxesplxlshsdrijzckpq)
-- Feature Ticket:     BAY-SEC-008  (spec §0.1 #B — the directory-visibility invariant)
-- Dependencies:       20260817120100_0002, 20260817120600_0007 (the user_roles SELECT policy)
-- Rollback Script:    supabase/migrations/rollback/20260817120700_0008_public_marketplace_roles.rollback.sql
-- Estimated Duration: ~0.2s
-- ============================================================================
-- Description:        The public directory reads profiles filtered by an EXISTS() over user_roles,
--                     and PostgREST embeds user_roles!inner(role). Under RLS the user_roles table
--                     was owner/admin-only, so an ANONYMOUS visitor's EXISTS() found nothing and the
--                     entire directory rendered empty (verified: anon saw 0 of 12 active profiles).
--                     This widens the user_roles SELECT policy to also expose the two PUBLIC
--                     marketplace roles — 'creator' and 'consultant' — to everyone. Business and
--                     super_admin role rows remain owner/admin-only.
-- Breaking Changes:   NONE. Strictly widens read for two non-sensitive roles.
-- Performance Impact: None. Same policy, one extra OR term (constant).
-- Compliance Notes:   Exposes only that a user_id carries a creator/consultant role — inherently
--                     public directory information. It does NOT expose profile data (still gated by
--                     the profiles policy, active-only) nor the private business/admin roles
--                     (invariant §3.7). Deliberately does NOT reference profiles to avoid RLS
--                     policy recursion (profiles↔user_roles).
-- ============================================================================

DROP POLICY IF EXISTS "users read own roles" ON public.user_roles;
CREATE POLICY "users read own roles"
  ON public.user_roles FOR SELECT
  USING (
    user_id = (select auth.uid())
    OR private.is_admin((select auth.uid()))
    OR role IN ('creator', 'consultant')   -- public marketplace roles (directory needs anon read)
  );

-- ============================================================================
-- POST-APPLY VERIFICATION (Part 6): as the anon role, the directory join returns the seeded rows.
--   SET LOCAL ROLE anon;
--   SELECT count(*) FROM public.profiles p JOIN public.user_roles ur ON ur.user_id=p.id
--     WHERE ur.role='creator' AND p.status='active';   -- expect > 0
-- ============================================================================
