-- ============================================================================
-- Migration:          Admin moderation — approve/reject profiles + status→notification trigger
-- Version:            20260817121000_0011
-- Date:               2026-08-17
-- Author:             Principal Backend & Database Systems Engineer + Security/Compliance
-- Team:               Bayele Core Platform Engineering
-- Target Database:    Supabase Postgres 17.x (managed) — portable to Cloud SQL / RDS Postgres 15+
-- Infrastructure Ref: infra/terraform/ · supabase_project.bayele (ref oxesplxlshsdrijzckpq)
-- Feature Ticket:     BAY-ADMIN-011  (Milestone 4 — admin & moderation; spec §3.1 gate, §6)
-- Dependencies:       0001 (profiles/notifications), 0005 (private.is_admin)
-- Rollback Script:    supabase/migrations/rollback/20260817121000_0011_admin_moderation.rollback.sql
-- Estimated Duration: ~0.2s
-- ============================================================================
-- Description:        Two pieces: (1) moderate_profile() — the ONLY sanctioned way to change a
--                     profile's account_status, admin-gated by private.is_admin(auth.uid()); it is
--                     what flips a pending_review signup to 'active' (into the public directory) or
--                     'rejected'/'suspended'. (2) an AFTER UPDATE OF status trigger that emits a
--                     notification to the affected user — the single notify path for moderation.
-- Breaking Changes:   NONE (new function + trigger).
-- Performance Impact: Trigger fires only on a status change (single-row insert). Negligible.
-- Compliance Notes:   ENFORCES the moderation gate (spec §3.1): a profile only becomes publicly
--                     visible when an ADMIN approves it. moderate_profile self-authorizes via
--                     private.is_admin(auth.uid()) — a non-admin JWT raises 'not_authorized'
--                     (negative test first, §5). The trigger is SECURITY DEFINER so it can write to
--                     the RLS-protected notifications table. Advisor will list moderate_profile as an
--                     intentional authenticated-execute definer (admin check is internal).
-- ============================================================================

-- (1) Notification emitter on status change — the single moderation notify path.
CREATE OR REPLACE FUNCTION public.on_profile_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'active' THEN
      INSERT INTO public.notifications (user_id, type, title, body, link)
      VALUES (NEW.id, 'profile_approved', 'Votre compte est validé 🎉',
              'Vous êtes maintenant visible dans l''annuaire Bayele.', '/dashboard');
    ELSIF NEW.status = 'rejected' THEN
      INSERT INTO public.notifications (user_id, type, title, body, link)
      VALUES (NEW.id, 'profile_rejected', 'Profil non validé',
              'Votre profil n''a pas été validé pour le moment. Contactez le support pour en savoir plus.', '/dashboard');
    ELSIF NEW.status = 'suspended' THEN
      INSERT INTO public.notifications (user_id, type, title, body, link)
      VALUES (NEW.id, 'profile_suspended', 'Compte suspendu',
              'Votre compte a été suspendu. Contactez le support.', '/dashboard');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profile_status_change ON public.profiles;
CREATE TRIGGER trg_profile_status_change
  AFTER UPDATE OF status ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.on_profile_status_change();

-- A trigger function fires as the table owner regardless of caller grants, so it never needs to be
-- REST-callable. Revoke it from the API roles (advisor 0028/0029).
REVOKE ALL ON FUNCTION public.on_profile_status_change() FROM PUBLIC, anon, authenticated;

-- (2) Admin moderation RPC — the sanctioned status mutator.
CREATE OR REPLACE FUNCTION public.moderate_profile(p_target uuid, p_status public.account_status)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT private.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF p_status NOT IN ('active','rejected','suspended','pending_review') THEN RAISE EXCEPTION 'invalid_status'; END IF;
  UPDATE public.profiles SET status = p_status, updated_at = now() WHERE id = p_target;
  IF NOT FOUND THEN RAISE EXCEPTION 'profile_not_found'; END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.moderate_profile(uuid, public.account_status) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.moderate_profile(uuid, public.account_status) TO authenticated;

-- ============================================================================
-- POST-APPLY VERIFICATION (Part 6) — with throwaway admin + pending target:
--   • non-admin JWT calling moderate_profile → RAISES 'not_authorized'  (negative first)
--   • a non-admin cannot UPDATE another user's profile row (RLS)          (negative)
--   • admin moderate_profile(target,'active') → target.status='active' AND a 'profile_approved'
--     notification row exists for the target                              (positive)
-- ============================================================================
