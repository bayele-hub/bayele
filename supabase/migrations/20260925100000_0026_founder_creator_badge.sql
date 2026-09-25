-- ============================================================================
-- Migration:          "Créateur fondateur" — free, numbered, permanent badge for the first
--                     10 000 registered creators
-- Version:            20260925100000_0026
-- Date:               2026-09-25
-- Team:               Bayele Core Platform Engineering
-- Dependencies:       0001, 0005, 0019
-- Rollback Script:    supabase/migrations/rollback/20260925100000_0026_founder_creator_badge.rollback.sql
-- ============================================================================
-- Rules (product):
--   * Earned by timing only — never purchasable ("la confiance ne s'achète pas", /pricing).
--   * Numbered 1…10 000 in the order accounts received the `creator` role — the same population the
--     launch gate counts (lib/data/launch-gate.ts), so badge #10 000 lands with the directory opening.
--   * Permanent: the number stays with the account. It is shown publicly only while the profile is
--     'active' (a suspended/rejected account keeps its row but the badge disappears from view).
--     Numbers are never handed out twice while their holder exists.
--   * Writes happen only through the trigger below (SECURITY DEFINER); clients can only read.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.founder_creators (
  user_id        uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  founder_number integer NOT NULL UNIQUE CHECK (founder_number BETWEEN 1 AND 10000),
  awarded_at     timestamptz NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.founder_creators ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "founder badges are readable" ON public.founder_creators;
CREATE POLICY "founder badges are readable" ON public.founder_creators FOR SELECT USING (
  user_id = (SELECT auth.uid())
  OR private.is_admin((SELECT auth.uid()))
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = founder_creators.user_id AND p.status = 'active')
);

REVOKE ALL ON public.founder_creators FROM anon, authenticated;
GRANT SELECT ON public.founder_creators TO anon, authenticated;
GRANT ALL ON public.founder_creators TO service_role;

-- Award on creator sign-up. Serialized with a transaction-scoped advisory lock so two concurrent
-- sign-ups can never draw the same number (the UNIQUE constraint is the backstop).
CREATE OR REPLACE FUNCTION private.award_founder_badge()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_next integer;
BEGIN
  IF NEW.role <> 'creator' THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('bayele.founder_creators'));
  IF EXISTS (SELECT 1 FROM public.founder_creators WHERE user_id = NEW.user_id) THEN RETURN NEW; END IF;
  SELECT coalesce(max(founder_number), 0) + 1 INTO v_next FROM public.founder_creators;
  IF v_next > 10000 THEN RETURN NEW; END IF;  -- the founding cohort is full
  INSERT INTO public.founder_creators (user_id, founder_number) VALUES (NEW.user_id, v_next);
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (NEW.user_id, 'founder_badge', 'Vous êtes Créateur fondateur 🏅',
          'Badge n° ' || v_next::text || ' sur 10 000. Il est gratuit, permanent et visible sur votre profil.',
          '/creator/dashboard');
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION private.award_founder_badge() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_award_founder_badge ON public.user_roles;
CREATE TRIGGER trg_award_founder_badge AFTER INSERT ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION private.award_founder_badge();

-- Backfill every creator who signed up before this migration, in sign-up order. No notification
-- for the backfill (the dashboard shows the badge on their next visit).
INSERT INTO public.founder_creators (user_id, founder_number, awarded_at)
SELECT s.user_id, s.rn, s.granted_at
  FROM (SELECT ur.user_id, ur.granted_at,
               row_number() OVER (ORDER BY ur.granted_at, ur.user_id) AS rn
          FROM public.user_roles ur WHERE ur.role = 'creator') s
 WHERE s.rn <= 10000
ON CONFLICT (user_id) DO NOTHING;

-- Public counter for the home page ("X places fondateur restantes"). Exposes only two integers.
CREATE OR REPLACE FUNCTION public.founder_badge_stats()
 RETURNS TABLE (awarded integer, remaining integer)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT count(*)::integer, greatest(10000 - coalesce(max(founder_number), 0), 0)::integer
    FROM public.founder_creators;
$function$;
REVOKE ALL ON FUNCTION public.founder_badge_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.founder_badge_stats() TO anon, authenticated, service_role;
