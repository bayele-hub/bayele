-- ============================================================================
-- Migration:          Sign-up attribution (source + referrer) and campaign alerts
-- Version:            20261010120100_0031
-- Date:               2026-10-10
-- Team:               Bayele Core Platform Engineering
-- Dependencies:       0001, 0005, 0010 (onboard_profile), 0030
-- Rollback Script:    supabase/migrations/rollback/20261010120100_0031_signup_attribution_and_alerts.rollback.sql
-- Plan:               docs/CAMPAIGNS-PUBLIC-PAGE-PLAN.md §6 Phase 2
-- ============================================================================
-- Design decisions:
--   * Attribution lives in its OWN table (public.signup_attribution), not in columns on profiles.
--     `authenticated` holds table-wide SELECT on profiles and the "public profiles are readable"
--     policy exposes active creator/partner rows to every signed-in user, so a column there would
--     leak who referred whom. The separate table is readable by its owner and admins only.
--   * Written once, by the user's own session, through record_signup_attribution() right after
--     onboarding (onboard_profile's signature is unchanged). No client INSERT/UPDATE/DELETE grant:
--     the row is immutable from the client side; ON CONFLICT DO NOTHING keeps the first write.
--     Calls more than 7 days after the profile was created are ignored (no retroactive referrals).
--   * Unknown source → 'direct'. Referrer resolved by handle, case-insensitively (leading '@'
--     stripped); unknown or ambiguous handles, self-referrals and suspended/rejected referrers are
--     ignored (referred_by NULL). No error is raised for bad
--     input, so a malformed ?ref= can never block onboarding.
--   * Campaign alerts: any signed-in user can keep up to 5 (country, category) filters, NULL = any
--     (council C5; the cap is public.campaign_alert_limit(), the single source of truth).
--     When a campaign becomes visible on the board (public AND published|in_progress), every matching subscriber (except the owner,
--     except suspended/rejected accounts) gets one 'campaign_alert' notification — at most once per
--     campaign per user, capped at 500 recipients per event.
-- ============================================================================

-- ── 1. Sign-up attribution ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.signup_attribution (
  user_id       uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  signup_source text NOT NULL DEFAULT 'direct'
                CONSTRAINT signup_attribution_source_check
                CHECK (signup_source IN ('campaigns_list','campaign_page','referral','home','direct')),
  referred_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT signup_attribution_no_self_referral CHECK (referred_by IS NULL OR referred_by <> user_id)
);

CREATE INDEX IF NOT EXISTS signup_attribution_referred_by_idx ON public.signup_attribution(referred_by);

ALTER TABLE public.signup_attribution ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner or admin reads attribution" ON public.signup_attribution;
CREATE POLICY "owner or admin reads attribution" ON public.signup_attribution FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()) OR private.is_admin((SELECT auth.uid())));

REVOKE ALL ON public.signup_attribution FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.signup_attribution TO authenticated;
GRANT ALL ON public.signup_attribution TO service_role;

-- Handles are lowercase (QA D4). onboard_profile already lowercases, but `authenticated` holds
-- UPDATE(handle) and handle_format uses ~*, so a user could rename to 'QA_C2' next to 'qa_c2'.
-- Production had 0 mixed-case handles of 80 at review time. NOT VALID + VALIDATE keeps the lock short.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = 'public.profiles'::regclass AND conname = 'handle_lowercase') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT handle_lowercase CHECK (handle = lower(handle)) NOT VALID;
  END IF;
END $$;
ALTER TABLE public.profiles VALIDATE CONSTRAINT handle_lowercase;

-- Case-insensitive handle lookup for referrer resolution.
CREATE INDEX IF NOT EXISTS profiles_handle_lower_idx ON public.profiles (lower(handle));

CREATE OR REPLACE FUNCTION public.record_signup_attribution(
  p_source          text DEFAULT NULL,
  p_referrer_handle text DEFAULT NULL
)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_uid      uuid := auth.uid();
  v_created  timestamptz;
  v_source   text := lower(btrim(coalesce(p_source, '')));
  v_handle   text := lower(ltrim(btrim(coalesce(p_referrer_handle, '')), '@'));
  v_referrer uuid;
  v_rows     integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT created_at INTO v_created FROM public.profiles WHERE id = v_uid;
  IF v_created IS NULL THEN RAISE EXCEPTION 'profile_required'; END IF;
  -- Attribution is a sign-up fact: ignore late calls instead of letting old accounts claim a referrer.
  IF v_created < timezone('utc', now()) - interval '7 days' THEN RETURN false; END IF;

  IF v_source NOT IN ('campaigns_list','campaign_page','referral','home','direct') THEN
    v_source := 'direct';
  END IF;

  -- Case-insensitive match (QA D4: handles can carry upper case); ambiguous → nobody.
  -- Suspended / rejected referrers are not credited (QA D3).
  IF v_handle ~ '^[a-z0-9_]{3,30}$' THEN
    SELECT CASE WHEN count(*) = 1 THEN (array_agg(p.id))[1] END INTO v_referrer
      FROM public.profiles p
     WHERE lower(p.handle) = v_handle;
    IF v_referrer = v_uid THEN v_referrer := NULL; END IF;  -- self-referral ignored
    IF v_referrer IS NOT NULL AND EXISTS (SELECT 1 FROM public.profiles p
                                          WHERE p.id = v_referrer AND p.status IN ('suspended','rejected')) THEN
      v_referrer := NULL;
    END IF;
  END IF;

  INSERT INTO public.signup_attribution (user_id, signup_source, referred_by)
  VALUES (v_uid, v_source, v_referrer)
  ON CONFLICT (user_id) DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows = 1;
END;
$function$;

REVOKE ALL ON FUNCTION public.record_signup_attribution(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_signup_attribution(text, text) TO authenticated, service_role;

-- Admin dashboard: sign-ups per source (all five sources, zeros included) + top 10 referrers.
-- Rows with kind = 'source'   → signup_source, signups
-- Rows with kind = 'referrer' → referrer_handle, referrer_display_name, signups (desc, max 10)
CREATE OR REPLACE FUNCTION public.admin_signup_attribution_stats()
 RETURNS TABLE (
  kind                  text,
  signup_source         text,
  referrer_handle       text,
  referrer_display_name text,
  signups               integer
 )
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NOT private.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  RETURN QUERY
  SELECT 'source'::text, s.src, NULL::text, NULL::text,
         (SELECT count(*)::integer FROM public.signup_attribution sa WHERE sa.signup_source = s.src)
    FROM (VALUES (1,'campaigns_list'),(2,'campaign_page'),(3,'referral'),(4,'home'),(5,'direct')) AS s(ord, src)
   ORDER BY s.ord;
  RETURN QUERY
  SELECT 'referrer'::text, NULL::text, p.handle, p.display_name, r.n
    FROM (SELECT sa.referred_by, count(*)::integer AS n
            FROM public.signup_attribution sa
           WHERE sa.referred_by IS NOT NULL
           GROUP BY sa.referred_by) r
    JOIN public.profiles p ON p.id = r.referred_by
   ORDER BY r.n DESC, p.handle
   LIMIT 10;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_signup_attribution_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_signup_attribution_stats() TO authenticated, service_role;

-- Referrer view (council C3): only the NUMBER of sign-ups attributed to the caller — never who.
CREATE OR REPLACE FUNCTION public.my_referral_count()
 RETURNS integer
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  RETURN (SELECT count(*)::integer FROM public.signup_attribution sa WHERE sa.referred_by = auth.uid());
END;
$function$;

REVOKE ALL ON FUNCTION public.my_referral_count() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_referral_count() TO authenticated, service_role;

-- ── 2. Campaign alerts ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.campaign_alerts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  country    public.country_code,
  category   text CONSTRAINT campaign_alerts_category_len CHECK (category IS NULL OR char_length(category) BETWEEN 1 AND 60),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

-- One alert per (user, country, category); NULL = "any" and counts as a value (NULLS NOT DISTINCT).
CREATE UNIQUE INDEX IF NOT EXISTS campaign_alerts_user_filter_key
  ON public.campaign_alerts (user_id, country, lower(category)) NULLS NOT DISTINCT;
-- Fan-out lookup on publish.
CREATE INDEX IF NOT EXISTS campaign_alerts_country_idx ON public.campaign_alerts (country);

ALTER TABLE public.campaign_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner reads own alerts" ON public.campaign_alerts;
CREATE POLICY "owner reads own alerts" ON public.campaign_alerts FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

REVOKE ALL ON public.campaign_alerts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.campaign_alerts TO authenticated;
GRANT ALL ON public.campaign_alerts TO service_role;

-- Max alerts per user (council C5). Exposed so the UI can show « X alertes restantes ».
CREATE OR REPLACE FUNCTION public.campaign_alert_limit()
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 PARALLEL SAFE
 SET search_path TO ''
AS $function$ SELECT 5 $function$;

REVOKE ALL ON FUNCTION public.campaign_alert_limit() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.campaign_alert_limit() TO authenticated, service_role;

-- Idempotent: subscribing to an existing filter returns that alert's id.
CREATE OR REPLACE FUNCTION public.subscribe_campaign_alert(
  p_country  public.country_code DEFAULT NULL,
  p_category text DEFAULT NULL
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_uid      uuid := auth.uid();
  v_category text := nullif(btrim(coalesce(p_category, '')), '');
  v_id       uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_uid) THEN RAISE EXCEPTION 'profile_required'; END IF;
  IF v_category IS NOT NULL AND char_length(v_category) > 60 THEN RAISE EXCEPTION 'invalid_category'; END IF;

  -- Serialize per user so the alert cap holds under concurrent calls.
  PERFORM pg_advisory_xact_lock(hashtext('bayele.campaign_alerts:' || v_uid::text));

  SELECT a.id INTO v_id FROM public.campaign_alerts a
   WHERE a.user_id = v_uid
     AND a.country IS NOT DISTINCT FROM p_country
     AND lower(a.category) IS NOT DISTINCT FROM lower(v_category);
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  IF (SELECT count(*) FROM public.campaign_alerts a WHERE a.user_id = v_uid) >= public.campaign_alert_limit() THEN
    RAISE EXCEPTION 'alert_limit_reached';
  END IF;

  INSERT INTO public.campaign_alerts (user_id, country, category)
  VALUES (v_uid, p_country, v_category)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.subscribe_campaign_alert(public.country_code, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.subscribe_campaign_alert(public.country_code, text) TO authenticated, service_role;

-- Returns true when an alert was removed, false when it did not exist / is not the caller's.
CREATE OR REPLACE FUNCTION public.unsubscribe_campaign_alert(p_alert_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_rows integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  DELETE FROM public.campaign_alerts WHERE id = p_alert_id AND user_id = auth.uid();
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows = 1;
END;
$function$;

REVOKE ALL ON FUNCTION public.unsubscribe_campaign_alert(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unsubscribe_campaign_alert(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.my_campaign_alerts()
 RETURNS TABLE (id uuid, country public.country_code, category text, created_at timestamptz)
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  RETURN QUERY
  SELECT a.id, a.country, a.category, a.created_at
    FROM public.campaign_alerts a
   WHERE a.user_id = auth.uid()
   ORDER BY a.created_at, a.id;
END;
$function$;

REVOKE ALL ON FUNCTION public.my_campaign_alerts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_campaign_alerts() TO authenticated, service_role;

-- ── 3. Notify subscribers when a campaign goes public + published ────────────
CREATE OR REPLACE FUNCTION private.notify_campaign_alerts()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_link   text;
  v_amount text;
BEGIN
  -- Fires when the campaign first becomes visible on the board (QA D5): public AND open.
  IF NOT (NEW.is_public AND NEW.status IN ('published', 'in_progress')) THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.is_public AND OLD.status IN ('published', 'in_progress') THEN RETURN NEW; END IF;

  v_link := '/campaigns/' || NEW.id::text;
  -- French grouping: narrow no-break space (U+202F) between thousands.
  v_amount := replace(to_char(NEW.payout_per_creator_fcfa, 'FM999,999,999,999'), ',', U&'\202F');

  INSERT INTO public.notifications (user_id, type, title, body, link)
  SELECT s.user_id, 'campaign_alert', 'Nouvelle campagne',
         U&'\00AB\00A0' || NEW.title || U&'\00A0\00BB \2014 ' || v_amount || U&'\00A0FCFA par cr\00E9ateur.',
         v_link
    FROM (
      SELECT DISTINCT ON (a.user_id) a.user_id, a.created_at
        FROM public.campaign_alerts a
        JOIN public.profiles p ON p.id = a.user_id
       WHERE a.user_id <> NEW.owner_id
         AND p.status NOT IN ('suspended', 'rejected')
         AND (a.country IS NULL OR a.country = NEW.target_country)
         AND (a.category IS NULL OR lower(a.category) = lower(NEW.category))
         AND NOT EXISTS (SELECT 1 FROM public.notifications n
                          WHERE n.user_id = a.user_id AND n.type = 'campaign_alert' AND n.link = v_link)
       ORDER BY a.user_id, a.created_at
    ) s
   ORDER BY s.created_at, s.user_id
   LIMIT 500;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.notify_campaign_alerts() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_campaign_alerts ON public.campaigns;
CREATE TRIGGER trg_notify_campaign_alerts
  AFTER INSERT OR UPDATE OF status, is_public ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION private.notify_campaign_alerts();
