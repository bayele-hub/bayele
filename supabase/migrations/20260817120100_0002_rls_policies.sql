-- ============================================================================
-- Migration:          Row-Level Security — the real RBAC boundary
-- Version:            20260817120100_0002
-- Date:               2026-08-17
-- Author:             Lead Security, Cryptography & Compliance Engineer + Backend/DB
-- Team:               Bayele Core Platform Engineering
-- Target Database:    Supabase Postgres 17.x (managed) — portable to Cloud SQL / RDS Postgres 15+
-- Infrastructure Ref: infra/terraform/ · supabase_project.bayele (ref oxesplxlshsdrijzckpq)
-- Feature Ticket:     BAY-SEC-002  (spec: bayele-production-spec-v1.1.2 §3.2)
-- Dependencies:       20260817120000_0001 (all tables must exist)
-- Rollback Script:    supabase/migrations/rollback/20260817120100_0002_rls_policies.rollback.sql
-- Estimated Duration: ~0.4s
-- ============================================================================
-- Description:        Enables RLS on every public table and installs the policy set. RLS — not
--                     middleware — is the authorization boundary (invariant §3.1). Public
--                     marketplace = active creators/consultants only; businesses + escrow + PII
--                     are owner/party/admin-scoped. is_admin() is the shared admin predicate.
-- Breaking Changes:   NONE additive, but SEMANTICALLY load-bearing: without these policies the
--                     directory is deny-all. proof_of_post, escrow_audit_log and agency_retainers
--                     RLS are completed in 0004 (kept there with the advisor-driven hardening).
-- Performance Impact: Policy predicates use EXISTS subqueries against user_roles/campaigns; these
--                     hit PKs/unique indexes. is_admin() is STABLE so it is cached per statement.
-- Compliance Notes:   Directly enforces PII boundaries: business_profiles (tax_id, billing_address)
--                     has NO public SELECT; notifications are strictly private; the public directory
--                     exposes creators + consultants only, never businesses (invariants §3.6, §3.7).
--                     SUPABASE-SPECIFIC: policies call auth.uid(); portable form in §9 (app.current_user_id).
-- ============================================================================

ALTER TABLE public.profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultant_profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_creators    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escrow_transactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_retainers     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications        ENABLE ROW LEVEL SECURITY;

-- Admin predicate. Param renamed so it can never shadow a column (spec §0 #1). search_path pinned
-- in 0004. Stays EXECUTE-able by anon/authenticated ON PURPOSE — RLS policies below call it.
CREATE OR REPLACE FUNCTION public.is_admin(p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = p_user_id AND ur.role = 'super_admin'
  );
$$;

-- profiles: public marketplace (creators & consultants, active only) + self + admin.
DROP POLICY IF EXISTS "public profiles are readable" ON public.profiles;
CREATE POLICY "public profiles are readable"
  ON public.profiles FOR SELECT
  USING (
    status = 'active'
    AND EXISTS (SELECT 1 FROM public.user_roles ur
                WHERE ur.user_id = profiles.id AND ur.role IN ('creator','consultant'))
  );
DROP POLICY IF EXISTS "users update own profile" ON public.profiles;
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
DROP POLICY IF EXISTS "admins manage all profiles" ON public.profiles;
CREATE POLICY "admins manage all profiles" ON public.profiles FOR ALL USING (public.is_admin(auth.uid()));

-- role-profile public reads (spec §0.1 #B) — without these the directory is dead.
DROP POLICY IF EXISTS "public read active creator profiles" ON public.creator_profiles;
CREATE POLICY "public read active creator profiles"
  ON public.creator_profiles FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles p
                 JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'creator'
                 WHERE p.id = creator_profiles.user_id AND p.status = 'active'));
DROP POLICY IF EXISTS "creators manage own creator profile" ON public.creator_profiles;
CREATE POLICY "creators manage own creator profile"
  ON public.creator_profiles FOR ALL USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "public read active consultant profiles" ON public.consultant_profiles;
CREATE POLICY "public read active consultant profiles"
  ON public.consultant_profiles FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles p
                 JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'consultant'
                 WHERE p.id = consultant_profiles.user_id AND p.status = 'active'));
DROP POLICY IF EXISTS "consultants manage own consultant profile" ON public.consultant_profiles;
CREATE POLICY "consultants manage own consultant profile"
  ON public.consultant_profiles FOR ALL USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "users read own roles" ON public.user_roles;
CREATE POLICY "users read own roles"
  ON public.user_roles FOR SELECT USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- businesses: owner + admin only. NO public policy (invariant §3.7).
DROP POLICY IF EXISTS "businesses manage their own profile" ON public.business_profiles;
CREATE POLICY "businesses manage their own profile"
  ON public.business_profiles FOR ALL USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- campaigns.
DROP POLICY IF EXISTS "campaign owners manage their campaigns" ON public.campaigns;
CREATE POLICY "campaign owners manage their campaigns"
  ON public.campaigns FOR ALL USING (owner_id = auth.uid() OR public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "active campaigns are viewable by creators" ON public.campaigns;
CREATE POLICY "active campaigns are viewable by creators"
  ON public.campaigns FOR SELECT USING (status IN ('published','in_progress','completed'));

DROP POLICY IF EXISTS "campaign_creators visible to creator, owner, admin" ON public.campaign_creators;
CREATE POLICY "campaign_creators visible to creator, owner, admin"
  ON public.campaign_creators FOR SELECT
  USING (
    creator_id = auth.uid()
    OR public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id AND c.owner_id = auth.uid())
  );

-- invoices: business + admin.
DROP POLICY IF EXISTS "businesses view their invoices" ON public.invoices;
CREATE POLICY "businesses view their invoices"
  ON public.invoices FOR SELECT USING (business_id = auth.uid() OR public.is_admin(auth.uid()));

-- escrow: the two involved parties + admin.
DROP POLICY IF EXISTS "escrow visible to involved parties" ON public.escrow_transactions;
CREATE POLICY "escrow visible to involved parties"
  ON public.escrow_transactions FOR SELECT
  USING (
    recipient_profile_id = auth.uid()
    OR public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id AND c.owner_id = auth.uid())
  );

-- notifications: strictly private (spec §0.1 #E).
DROP POLICY IF EXISTS "users read own notifications" ON public.notifications;
CREATE POLICY "users read own notifications"
  ON public.notifications FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "users mark own notifications read" ON public.notifications;
CREATE POLICY "users mark own notifications read"
  ON public.notifications FOR UPDATE USING (user_id = auth.uid());

-- ============================================================================
-- POST-APPLY VERIFICATION (Part 6):
--   Every RLS-enabled public table has ≥1 policy (expect zero rows returned):
--     SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
--     WHERE n.nspname='public' AND c.relrowsecurity
--       AND NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname='public' AND p.tablename=c.relname);
--   (proof_of_post, escrow_audit_log, agency_retainers are completed in 0004.)
-- ============================================================================
