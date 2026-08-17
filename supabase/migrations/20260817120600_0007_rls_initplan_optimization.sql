-- ============================================================================
-- Migration:          RLS initplan optimization — wrap auth.uid() in (select …)
-- Version:            20260817120600_0007
-- Date:               2026-08-17
-- Author:             Principal Backend & Database Systems Engineer
-- Team:               Bayele Core Platform Engineering
-- Target Database:    Supabase Postgres 17.x (managed) — portable to Cloud SQL / RDS Postgres 15+
-- Infrastructure Ref: infra/terraform/ · supabase_project.bayele (ref oxesplxlshsdrijzckpq)
-- Feature Ticket:     BAY-PERF-007  (closes get_advisors(performance) auth_rls_initplan)
-- Dependencies:       20260817120100_0002, 20260817120300_0004, 20260817120400_0005
-- Rollback Script:    supabase/migrations/rollback/20260817120600_0007_rls_initplan_optimization.rollback.sql
-- Estimated Duration: ~0.4s
-- ============================================================================
-- Description:        Postgres re-evaluates a volatile-looking auth.uid()/current_setting() call
--                     once PER ROW inside an RLS predicate. Wrapping it as (select auth.uid())
--                     makes the planner treat it as an initplan and evaluate it ONCE per query.
--                     This recreates every policy that references the caller identity with the
--                     wrapped form. No semantic change — pure performance at scale.
-- Breaking Changes:   NONE (identical predicates, wrapped subselect).
-- Performance Impact: Large positive at scale (per-row → per-query identity evaluation). Policies
--                     with no identity reference (public reads, active-campaign read) are untouched.
-- Compliance Notes:   None. Authorization semantics are byte-for-byte equivalent.
-- ============================================================================

-- profiles
DROP POLICY IF EXISTS "users update own profile" ON public.profiles;
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE USING ((select auth.uid()) = id);
DROP POLICY IF EXISTS "admins manage all profiles" ON public.profiles;
CREATE POLICY "admins manage all profiles" ON public.profiles FOR ALL USING (private.is_admin((select auth.uid())));

-- creator_profiles
DROP POLICY IF EXISTS "creators manage own creator profile" ON public.creator_profiles;
CREATE POLICY "creators manage own creator profile" ON public.creator_profiles FOR ALL
  USING (user_id = (select auth.uid()) OR private.is_admin((select auth.uid())));

-- consultant_profiles
DROP POLICY IF EXISTS "consultants manage own consultant profile" ON public.consultant_profiles;
CREATE POLICY "consultants manage own consultant profile" ON public.consultant_profiles FOR ALL
  USING (user_id = (select auth.uid()) OR private.is_admin((select auth.uid())));

-- user_roles
DROP POLICY IF EXISTS "users read own roles" ON public.user_roles;
CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT
  USING (user_id = (select auth.uid()) OR private.is_admin((select auth.uid())));

-- business_profiles
DROP POLICY IF EXISTS "businesses manage their own profile" ON public.business_profiles;
CREATE POLICY "businesses manage their own profile" ON public.business_profiles FOR ALL
  USING (user_id = (select auth.uid()) OR private.is_admin((select auth.uid())));

-- campaigns
DROP POLICY IF EXISTS "campaign owners manage their campaigns" ON public.campaigns;
CREATE POLICY "campaign owners manage their campaigns" ON public.campaigns FOR ALL
  USING (owner_id = (select auth.uid()) OR private.is_admin((select auth.uid())));

-- campaign_creators
DROP POLICY IF EXISTS "campaign_creators visible to creator, owner, admin" ON public.campaign_creators;
CREATE POLICY "campaign_creators visible to creator, owner, admin" ON public.campaign_creators FOR SELECT
  USING (creator_id = (select auth.uid()) OR private.is_admin((select auth.uid()))
         OR EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id AND c.owner_id = (select auth.uid())));

-- invoices
DROP POLICY IF EXISTS "businesses view their invoices" ON public.invoices;
CREATE POLICY "businesses view their invoices" ON public.invoices FOR SELECT
  USING (business_id = (select auth.uid()) OR private.is_admin((select auth.uid())));

-- escrow_transactions
DROP POLICY IF EXISTS "escrow visible to involved parties" ON public.escrow_transactions;
CREATE POLICY "escrow visible to involved parties" ON public.escrow_transactions FOR SELECT
  USING (recipient_profile_id = (select auth.uid()) OR private.is_admin((select auth.uid()))
         OR EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id AND c.owner_id = (select auth.uid())));

-- notifications
DROP POLICY IF EXISTS "users read own notifications" ON public.notifications;
CREATE POLICY "users read own notifications" ON public.notifications FOR SELECT USING (user_id = (select auth.uid()));
DROP POLICY IF EXISTS "users mark own notifications read" ON public.notifications;
CREATE POLICY "users mark own notifications read" ON public.notifications FOR UPDATE USING (user_id = (select auth.uid()));

-- proof_of_post
DROP POLICY IF EXISTS "proof visible to creator, owner, admin" ON public.proof_of_post;
CREATE POLICY "proof visible to creator, owner, admin" ON public.proof_of_post FOR SELECT
  USING (private.is_admin((select auth.uid())) OR EXISTS (
    SELECT 1 FROM public.campaign_creators cc JOIN public.campaigns c ON c.id = cc.campaign_id
    WHERE cc.id = proof_of_post.campaign_creator_id AND (cc.creator_id = (select auth.uid()) OR c.owner_id = (select auth.uid()))));

-- escrow_audit_log
DROP POLICY IF EXISTS "audit visible to involved parties and admin" ON public.escrow_audit_log;
CREATE POLICY "audit visible to involved parties and admin" ON public.escrow_audit_log FOR SELECT
  USING (private.is_admin((select auth.uid())) OR EXISTS (
    SELECT 1 FROM public.escrow_transactions et LEFT JOIN public.campaigns c ON c.id = et.campaign_id
    WHERE et.id = escrow_audit_log.transaction_id AND (et.recipient_profile_id = (select auth.uid()) OR c.owner_id = (select auth.uid()))));

-- agency_retainers
DROP POLICY IF EXISTS "retainer visible to parties and admin" ON public.agency_retainers;
CREATE POLICY "retainer visible to parties and admin" ON public.agency_retainers FOR SELECT
  USING (business_id = (select auth.uid()) OR consultant_id = (select auth.uid()) OR private.is_admin((select auth.uid())));
DROP POLICY IF EXISTS "admins manage retainers" ON public.agency_retainers;
CREATE POLICY "admins manage retainers" ON public.agency_retainers FOR ALL USING (private.is_admin((select auth.uid())));

-- ============================================================================
-- POST-APPLY VERIFICATION (Part 6): get_advisors(performance) returns no auth_rls_initplan.
-- Remaining INFO lints are expected on a fresh DB: unused_index (no traffic yet) and, by design,
-- multiple_permissive_policies where a public-read policy coexists with an owner/admin-manage
-- policy — accepted tradeoff, documented here.
-- ============================================================================
