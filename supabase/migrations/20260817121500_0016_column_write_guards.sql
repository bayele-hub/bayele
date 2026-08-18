-- ============================================================================
-- Migration:          Column write-guards — close the direct-table RLS column holes
-- Version:            20260817121500_0016
-- Date:               2026-08-17
-- Author:             Lead Security, Cryptography & Compliance Engineer + Backend/DB
-- Team:               Bayele Core Platform Engineering
-- Target Database:    Supabase Postgres 17.x (managed) — portable to Cloud SQL / RDS Postgres 15+
-- Infrastructure Ref: infra/terraform/ · supabase_project.bayele (ref oxesplxlshsdrijzckpq)
-- Feature Ticket:     BAY-SEC-016  (production-readiness audit — S1/S2/S3)
-- Dependencies:       0001 (tables), 0002 (owner policies), 0005 (private schema)
-- Rollback Script:    supabase/migrations/rollback/20260817121500_0016_column_write_guards.rollback.sql
-- Estimated Duration: ~0.3s
-- ============================================================================
-- Description:        The "manage own row" RLS policies (profiles / campaigns / creator_profiles /
--                     consultant_profiles / business_profiles) gate WHICH ROW a user may write but,
--                     lacking a WITH CHECK column scope, not WHICH COLUMNS. That let a user, via a
--                     direct PostgREST write, escalate privileged columns:
--                       • profiles.status          → self-approve, bypassing moderation (spec §3.1)
--                       • campaigns.status / fee    → publish unfunded, bypassing escrow custody (ADR-001)
--                       • creator_profiles.is_pro / rating_avg → self-grant Pro, inflate trust signal
--                       • consultant_profiles.agency_access, business_profiles.is_verified → self-grant
--                     Fix: BEFORE INSERT/UPDATE guard triggers that, ONLY when the writer is a direct
--                     API role (current_user IN 'authenticated','anon'), pin these columns to their
--                     safe/previous value. SECURITY DEFINER RPCs run as the function owner (current_user
--                     = table owner, not 'authenticated'), so onboard_profile / moderate_profile /
--                     admin_confirm_* / the escrow machine keep full control. service_role (webhooks)
--                     is likewise unaffected. No application code changes required.
-- Breaking Changes:   NONE for legitimate flows — the app never writes these columns directly (status
--                     goes through moderate_profile; campaign lifecycle through the funding/execution
--                     RPCs; is_pro/rating are system-owned). A direct attempt now silently no-ops
--                     instead of escalating.
-- Performance Impact: One BEFORE-row trigger per write on five low-volume tables. Negligible.
-- Compliance Notes:   Restores the moderation gate and escrow-custody invariant as hard constraints at
--                     the data tier (defense in depth beneath RLS). Guards live in the non-exposed
--                     `private` schema; trigger functions need no EXECUTE grant (fired by the engine).
-- ============================================================================

-- profiles.status — only a definer RPC (moderate_profile) may change it.
CREATE OR REPLACE FUNCTION private.guard_profiles()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    NEW.status := OLD.status;  -- moderation status is not self-writable
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_profiles ON public.profiles;
CREATE TRIGGER trg_guard_profiles BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION private.guard_profiles();

-- campaigns — lifecycle + money columns are system-owned (funding/execution RPCs).
CREATE OR REPLACE FUNCTION private.guard_campaigns()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.status := 'draft';          -- a business always creates a draft; funding publishes it
      NEW.match_pass_paid := false;
    ELSE
      NEW.status := OLD.status;
      NEW.platform_fee_rate := OLD.platform_fee_rate;  -- fee set once at creation, read at funding (§9)
      NEW.match_pass_paid := OLD.match_pass_paid;
      NEW.owner_id := OLD.owner_id;
      NEW.owner_role := OLD.owner_role;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_campaigns ON public.campaigns;
CREATE TRIGGER trg_guard_campaigns BEFORE INSERT OR UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION private.guard_campaigns();

-- creator_profiles — is_pro / pro_expires_at / rating_avg are system-owned (subscription + reviews).
CREATE OR REPLACE FUNCTION private.guard_creator_profiles()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.is_pro := false; NEW.pro_expires_at := NULL; NEW.rating_avg := 5.00;
    ELSE
      NEW.is_pro := OLD.is_pro; NEW.pro_expires_at := OLD.pro_expires_at; NEW.rating_avg := OLD.rating_avg;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_creator_profiles ON public.creator_profiles;
CREATE TRIGGER trg_guard_creator_profiles BEFORE INSERT OR UPDATE ON public.creator_profiles
  FOR EACH ROW EXECUTE FUNCTION private.guard_creator_profiles();

-- consultant_profiles — agency_access is admin-granted, not self-granted.
CREATE OR REPLACE FUNCTION private.guard_consultant_profiles()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN NEW.agency_access := false;
    ELSE NEW.agency_access := OLD.agency_access; END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_consultant_profiles ON public.consultant_profiles;
CREATE TRIGGER trg_guard_consultant_profiles BEFORE INSERT OR UPDATE ON public.consultant_profiles
  FOR EACH ROW EXECUTE FUNCTION private.guard_consultant_profiles();

-- business_profiles — is_verified badge + sokoclick_customer_id are system-owned.
CREATE OR REPLACE FUNCTION private.guard_business_profiles()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN NEW.is_verified := false;
    ELSE NEW.is_verified := OLD.is_verified; NEW.sokoclick_customer_id := OLD.sokoclick_customer_id; END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_business_profiles ON public.business_profiles;
CREATE TRIGGER trg_guard_business_profiles BEFORE INSERT OR UPDATE ON public.business_profiles
  FOR EACH ROW EXECUTE FUNCTION private.guard_business_profiles();

-- ============================================================================
-- POST-APPLY VERIFICATION (Part 6) — as role `authenticated` impersonating a user:
--   • UPDATE profiles SET status='active' WHERE id=self         → status UNCHANGED (guarded)
--   • UPDATE creator_profiles SET is_pro=true WHERE user_id=self → is_pro UNCHANGED
--   • UPDATE campaigns SET status='published' WHERE owner_id=self→ status UNCHANGED
--   • moderate_profile(self,'active') as ADMIN                   → status DOES change (definer bypass)
--   • onboard_profile / funding / execution RPCs                → unaffected (run as owner)
-- ============================================================================
