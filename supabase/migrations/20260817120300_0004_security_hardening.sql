-- ============================================================================
-- Migration:          Security hardening — remaining RLS, pinned search_path, RPC lockdown
-- Version:            20260817120300_0004
-- Date:               2026-08-17
-- Author:             Lead Security, Cryptography & Compliance Engineer + Backend/DB
-- Team:               Bayele Core Platform Engineering
-- Target Database:    Supabase Postgres 17.x (managed) — portable to Cloud SQL / RDS Postgres 15+
-- Infrastructure Ref: infra/terraform/ · supabase_project.bayele (ref oxesplxlshsdrijzckpq)
-- Feature Ticket:     BAY-SEC-004  (closes advisor findings after 0001–0003)
-- Dependencies:       20260817120000_0001, 20260817120100_0002, 20260817120200_0003
-- Rollback Script:    supabase/migrations/rollback/20260817120300_0004_security_hardening.rollback.sql
-- Estimated Duration: ~0.3s
-- ============================================================================
-- Description:        Closes every finding from get_advisors(security) after the base schema:
--                     RLS + policies on proof_of_post and escrow_audit_log (were RLS-disabled),
--                     a policy set for agency_retainers (was RLS-enabled-no-policy = deny-all),
--                     pinned search_path on all SECURITY DEFINER functions, and REVOKE of the
--                     money-path RPCs from PUBLIC/anon/authenticated. Enables Realtime on
--                     notifications for the M5 bell.
-- Breaking Changes:   NONE. Tightening only. The money RPCs are henceforth reachable solely via the
--                     service role (server actions / webhook), which is how they were always called.
-- Performance Impact: Negligible. Policy predicates hit PK/unique indexes; ALTER FUNCTION is metadata.
-- Compliance Notes:   Removes the search_path-injection vector on SECURITY DEFINER functions
--                     (advisor 0011) and the "anon can call a definer RPC" exposure (advisors
--                     0028/0029). is_admin stays EXECUTE-able by anon+authenticated ON PURPOSE —
--                     RLS policy expressions require EXECUTE for the querying role; it only reveals
--                     whether a user_id is an admin.
-- ============================================================================

-- 1. proof_of_post — creator, campaign owner, admin can read. Writes only via RPCs (service role).
ALTER TABLE public.proof_of_post ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "proof visible to creator, owner, admin" ON public.proof_of_post;
CREATE POLICY "proof visible to creator, owner, admin"
  ON public.proof_of_post FOR SELECT
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.campaign_creators cc
      JOIN public.campaigns c ON c.id = cc.campaign_id
      WHERE cc.id = proof_of_post.campaign_creator_id
        AND (cc.creator_id = auth.uid() OR c.owner_id = auth.uid())
    )
  );

-- 2. escrow_audit_log — the money ledger. Append-only via transition_escrow (definer); readable by
--    the two involved parties + admin. No write policy.
ALTER TABLE public.escrow_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit visible to involved parties and admin" ON public.escrow_audit_log;
CREATE POLICY "audit visible to involved parties and admin"
  ON public.escrow_audit_log FOR SELECT
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.escrow_transactions et
      LEFT JOIN public.campaigns c ON c.id = et.campaign_id
      WHERE et.id = escrow_audit_log.transaction_id
        AND (et.recipient_profile_id = auth.uid() OR c.owner_id = auth.uid())
    )
  );

-- 3. agency_retainers had RLS enabled in 0002 but no policy (deny-all). Parties + admin read;
--    management flows through service-role server actions.
DROP POLICY IF EXISTS "retainer visible to parties and admin" ON public.agency_retainers;
CREATE POLICY "retainer visible to parties and admin"
  ON public.agency_retainers FOR SELECT
  USING (business_id = auth.uid() OR consultant_id = auth.uid() OR public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "admins manage retainers" ON public.agency_retainers;
CREATE POLICY "admins manage retainers"
  ON public.agency_retainers FOR ALL USING (public.is_admin(auth.uid()));

-- 4. Pin search_path on every SECURITY DEFINER function (advisor 0011). Bodies are fully
--    schema-qualified, so empty search_path is safe and removes the injection vector.
ALTER FUNCTION public.is_admin(uuid) SET search_path = '';
ALTER FUNCTION public.transition_escrow(uuid, public.escrow_status, uuid, jsonb) SET search_path = '';
ALTER FUNCTION public.handle_sokoclick_invoice_paid(text, text, uuid, public.invoice_type, bigint, text, uuid, uuid) SET search_path = '';
ALTER FUNCTION public.submit_proof_of_post(uuid, uuid, text, text, text, jsonb, numeric, public.payment_provider) SET search_path = '';
ALTER FUNCTION public.verify_proof_of_post(uuid, boolean, uuid, text) SET search_path = '';

-- 5. Money-path RPCs are called ONLY from trusted server context (service role, which bypasses
--    grants). Revoke from PUBLIC/anon/authenticated so they are unreachable via /rpc (advisors
--    0028/0029; invariants §3.3, §3.5). is_admin intentionally NOT revoked (RLS needs it).
REVOKE ALL ON FUNCTION public.transition_escrow(uuid, public.escrow_status, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_sokoclick_invoice_paid(text, text, uuid, public.invoice_type, bigint, text, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_proof_of_post(uuid, uuid, text, text, text, jsonb, numeric, public.payment_provider) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.verify_proof_of_post(uuid, boolean, uuid, text) FROM PUBLIC, anon, authenticated;

-- 6. Realtime for the notification bell (Milestone 5).
-- SUPABASE-SPECIFIC: adds notifications to the Realtime publication. Portable form is LISTEN/NOTIFY
-- or a CDC stream (DATABASE-MIGRATIONS.md §9). Guarded so it is a no-op off Supabase / on re-apply.
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

-- ============================================================================
-- POST-APPLY VERIFICATION (Part 6):
--   (a) No RLS-enabled public table lacks a policy (expect 0 rows):
--       SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
--       WHERE n.nspname='public' AND c.relrowsecurity
--         AND NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname='public' AND p.tablename=c.relname);
--   (b) All 5 definer functions have a non-empty proconfig search_path (expect 5):
--       SELECT count(*) FROM pg_proc WHERE prosecdef AND proconfig IS NOT NULL
--         AND pronamespace = 'public'::regnamespace;
--   (c) get_advisors(security) returns no ERROR-level lints.
-- ============================================================================
