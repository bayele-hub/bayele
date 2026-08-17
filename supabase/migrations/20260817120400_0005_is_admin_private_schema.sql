-- ============================================================================
-- Migration:          Move is_admin() into a non-exposed schema (advisor 0028/0029 → clean)
-- Version:            20260817120400_0005
-- Date:               2026-08-17
-- Author:             Lead Security, Cryptography & Compliance Engineer
-- Team:               Bayele Core Platform Engineering
-- Target Database:    Supabase Postgres 17.x (managed) — portable to Cloud SQL / RDS Postgres 15+
-- Infrastructure Ref: infra/terraform/ · supabase_project.bayele (ref oxesplxlshsdrijzckpq)
-- Feature Ticket:     BAY-SEC-005  (closes the last two advisor WARNs after 0004)
-- Dependencies:       20260817120100_0002 (is_admin + policies), 20260817120300_0004 (policies)
-- Rollback Script:    supabase/migrations/rollback/20260817120400_0005_is_admin_private_schema.rollback.sql
-- Estimated Duration: ~0.3s
-- ============================================================================
-- Description:        public.is_admin() was reachable via /rest/v1/rpc/is_admin because PostgREST
--                     exposes the public schema. RLS needs to CALL it, but nothing should reach it
--                     over the API. Fix: recreate it as private.is_admin() in a schema PostgREST
--                     does not expose, repoint every policy at it, and drop the public copy. RLS
--                     still works (schema USAGE + EXECUTE granted to the request roles); the API
--                     surface no longer includes it.
-- Breaking Changes:   NONE for the app (policies are transparently repointed). The public.is_admin
--                     RPC is removed — nothing in the app called it directly.
-- Performance Impact: None. Same predicate, different schema.
-- Compliance Notes:   Removes the last EXTERNAL advisor WARNs. `private` is not in the Supabase
--                     "Exposed schemas" list, so private.is_admin is unreachable via PostgREST while
--                     remaining usable inside RLS (portability: mirrors the app.* shim pattern §9).
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS private;

-- private.is_admin — identical predicate, pinned search_path, in a non-exposed schema.
CREATE OR REPLACE FUNCTION private.is_admin(p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = p_user_id AND ur.role = 'super_admin'
  );
$$;

-- RLS evaluates policy functions as the querying role: it needs USAGE on the schema + EXECUTE.
-- (These grants do NOT expose the schema to PostgREST — API exposure is a separate setting.)
GRANT USAGE ON SCHEMA private TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_admin(uuid) TO anon, authenticated, service_role;

-- Repoint every policy that referenced public.is_admin at private.is_admin.
DROP POLICY IF EXISTS "admins manage all profiles" ON public.profiles;
CREATE POLICY "admins manage all profiles" ON public.profiles FOR ALL USING (private.is_admin(auth.uid()));

DROP POLICY IF EXISTS "creators manage own creator profile" ON public.creator_profiles;
CREATE POLICY "creators manage own creator profile" ON public.creator_profiles FOR ALL USING (user_id = auth.uid() OR private.is_admin(auth.uid()));

DROP POLICY IF EXISTS "consultants manage own consultant profile" ON public.consultant_profiles;
CREATE POLICY "consultants manage own consultant profile" ON public.consultant_profiles FOR ALL USING (user_id = auth.uid() OR private.is_admin(auth.uid()));

DROP POLICY IF EXISTS "users read own roles" ON public.user_roles;
CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT USING (user_id = auth.uid() OR private.is_admin(auth.uid()));

DROP POLICY IF EXISTS "businesses manage their own profile" ON public.business_profiles;
CREATE POLICY "businesses manage their own profile" ON public.business_profiles FOR ALL USING (user_id = auth.uid() OR private.is_admin(auth.uid()));

DROP POLICY IF EXISTS "campaign owners manage their campaigns" ON public.campaigns;
CREATE POLICY "campaign owners manage their campaigns" ON public.campaigns FOR ALL USING (owner_id = auth.uid() OR private.is_admin(auth.uid()));

DROP POLICY IF EXISTS "campaign_creators visible to creator, owner, admin" ON public.campaign_creators;
CREATE POLICY "campaign_creators visible to creator, owner, admin" ON public.campaign_creators FOR SELECT
  USING (creator_id = auth.uid() OR private.is_admin(auth.uid())
         OR EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id AND c.owner_id = auth.uid()));

DROP POLICY IF EXISTS "businesses view their invoices" ON public.invoices;
CREATE POLICY "businesses view their invoices" ON public.invoices FOR SELECT USING (business_id = auth.uid() OR private.is_admin(auth.uid()));

DROP POLICY IF EXISTS "escrow visible to involved parties" ON public.escrow_transactions;
CREATE POLICY "escrow visible to involved parties" ON public.escrow_transactions FOR SELECT
  USING (recipient_profile_id = auth.uid() OR private.is_admin(auth.uid())
         OR EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id AND c.owner_id = auth.uid()));

DROP POLICY IF EXISTS "proof visible to creator, owner, admin" ON public.proof_of_post;
CREATE POLICY "proof visible to creator, owner, admin" ON public.proof_of_post FOR SELECT
  USING (private.is_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.campaign_creators cc JOIN public.campaigns c ON c.id = cc.campaign_id
    WHERE cc.id = proof_of_post.campaign_creator_id AND (cc.creator_id = auth.uid() OR c.owner_id = auth.uid())));

DROP POLICY IF EXISTS "audit visible to involved parties and admin" ON public.escrow_audit_log;
CREATE POLICY "audit visible to involved parties and admin" ON public.escrow_audit_log FOR SELECT
  USING (private.is_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.escrow_transactions et LEFT JOIN public.campaigns c ON c.id = et.campaign_id
    WHERE et.id = escrow_audit_log.transaction_id AND (et.recipient_profile_id = auth.uid() OR c.owner_id = auth.uid())));

DROP POLICY IF EXISTS "retainer visible to parties and admin" ON public.agency_retainers;
CREATE POLICY "retainer visible to parties and admin" ON public.agency_retainers FOR SELECT
  USING (business_id = auth.uid() OR consultant_id = auth.uid() OR private.is_admin(auth.uid()));
DROP POLICY IF EXISTS "admins manage retainers" ON public.agency_retainers;
CREATE POLICY "admins manage retainers" ON public.agency_retainers FOR ALL USING (private.is_admin(auth.uid()));

-- Now nothing references public.is_admin; drop it.
DROP FUNCTION IF EXISTS public.is_admin(uuid);

-- ============================================================================
-- POST-APPLY VERIFICATION (Part 6):
--   (a) public.is_admin is gone (expect 0):
--       SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='is_admin';
--   (b) private.is_admin exists (expect 1):
--       SELECT count(*) FROM pg_proc WHERE pronamespace='private'::regnamespace AND proname='is_admin';
--   (c) get_advisors(security) returns no ERROR and no is_admin WARN.
-- NOTE for DevOps: ensure `private` is NOT added to the API "Exposed schemas" setting.
-- ============================================================================
