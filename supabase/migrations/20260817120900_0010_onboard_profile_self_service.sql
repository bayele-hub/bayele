-- ============================================================================
-- Migration:          onboard_profile() — self-service via session (auth.uid guard)
-- Version:            20260817120900_0010
-- Date:               2026-08-17
-- Author:             Principal Backend & Database Systems Engineer + Security/Compliance
-- Team:               Bayele Core Platform Engineering
-- Target Database:    Supabase Postgres 17.x (managed) — portable to Cloud SQL / RDS Postgres 15+
-- Infrastructure Ref: infra/terraform/ · supabase_project.bayele (ref oxesplxlshsdrijzckpq)
-- Feature Ticket:     BAY-AUTH-010  (Milestone 3 — make onboarding work without the service key)
-- Dependencies:       20260817120800_0009 (onboard_profile)
-- Rollback Script:    supabase/migrations/rollback/20260817120900_0010_onboard_profile_self_service.rollback.sql
-- Estimated Duration: ~0.2s
-- ============================================================================
-- Description:        0009 made onboard_profile service-role-only. But the signup flow should not
--                     depend on the secret service key being present. This redefines it so an
--                     AUTHENTICATED user can onboard THEMSELVES from their own session: it now
--                     enforces auth.uid() = p_actor (an authenticated caller can only create their
--                     own profile) and GRANTs EXECUTE to authenticated. The service role
--                     (auth.uid() IS NULL) may still call it for future admin-created profiles.
-- Breaking Changes:   NONE for the signature (CREATE OR REPLACE, same 16 params → types unchanged).
--                     Grant widened from service-role-only to authenticated.
-- Performance Impact: None.
-- Compliance Notes:   auth.uid() is the caller's verified JWT subject and is NOT spoofable, so the
--                     p_actor guard is real authorization (invariant §3.3), not a trust-the-param.
--                     status is still hard-coded 'pending_review'. The advisor will list this as an
--                     "authenticated can execute SECURITY DEFINER" note — INTENTIONAL: this function
--                     is designed for authenticated self-service and self-authorizes via auth.uid().
-- ============================================================================

CREATE OR REPLACE FUNCTION public.onboard_profile(
  p_actor            uuid,
  p_role             public.user_role,
  p_handle           text,
  p_display_name     text,
  p_city             text,
  p_country          public.country_code,
  p_bio              text    DEFAULT NULL,
  p_avatar_url       text    DEFAULT NULL,
  p_categories       text[]  DEFAULT '{}',
  p_audience_size    int     DEFAULT 0,
  p_platforms        jsonb   DEFAULT '{}'::jsonb,
  p_specialties      text[]  DEFAULT '{}',
  p_years_experience int     DEFAULT 0,
  p_company_name     text    DEFAULT NULL,
  p_industry         text    DEFAULT NULL,
  p_billing_email    text    DEFAULT NULL
) RETURNS public.profiles LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_handle text := lower(trim(p_handle));
  v_uid    uuid := auth.uid();
  v_row    public.profiles;
BEGIN
  IF p_actor IS NULL THEN RAISE EXCEPTION 'actor required'; END IF;
  -- An authenticated caller may ONLY onboard themselves. Service role (v_uid NULL) is trusted.
  IF v_uid IS NOT NULL AND v_uid <> p_actor THEN RAISE EXCEPTION 'actor_mismatch'; END IF;
  IF p_role NOT IN ('creator','consultant','business') THEN RAISE EXCEPTION 'invalid onboarding role: %', p_role; END IF;
  IF v_handle !~ '^[a-z0-9_]{3,30}$' THEN RAISE EXCEPTION 'invalid_handle_format'; END IF;
  IF p_display_name IS NULL OR length(trim(p_display_name)) = 0 THEN RAISE EXCEPTION 'display_name_required'; END IF;
  IF p_city IS NULL OR length(trim(p_city)) = 0 THEN RAISE EXCEPTION 'city_required'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = p_actor) THEN RAISE EXCEPTION 'profile_already_exists'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE handle = v_handle) THEN RAISE EXCEPTION 'handle_taken'; END IF;

  INSERT INTO public.profiles (id, handle, display_name, avatar_url, bio, city, country, status)
  VALUES (p_actor, v_handle, p_display_name, p_avatar_url, p_bio, p_city, p_country, 'pending_review')
  RETURNING * INTO v_row;

  INSERT INTO public.user_roles (user_id, role) VALUES (p_actor, p_role);

  IF p_role = 'creator' THEN
    INSERT INTO public.creator_profiles (user_id, categories, audience_size, platforms)
    VALUES (p_actor, COALESCE(p_categories,'{}'), GREATEST(COALESCE(p_audience_size,0),0), COALESCE(p_platforms,'{}'::jsonb));
  ELSIF p_role = 'consultant' THEN
    INSERT INTO public.consultant_profiles (user_id, specialties, years_experience)
    VALUES (p_actor, COALESCE(p_specialties,'{}'), GREATEST(COALESCE(p_years_experience,0),0));
  ELSE
    IF p_company_name IS NULL OR length(trim(p_company_name)) = 0 THEN RAISE EXCEPTION 'company_name_required'; END IF;
    IF p_industry     IS NULL OR length(trim(p_industry))     = 0 THEN RAISE EXCEPTION 'industry_required';     END IF;
    INSERT INTO public.business_profiles (user_id, company_name, industry, billing_email)
    VALUES (p_actor, p_company_name, p_industry, p_billing_email);
  END IF;

  RETURN v_row;
END;
$$;

-- Self-service: authenticated users onboard themselves; anon cannot.
REVOKE ALL ON FUNCTION public.onboard_profile(uuid, public.user_role, text, text, text, public.country_code, text, text, text[], int, jsonb, text[], int, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.onboard_profile(uuid, public.user_role, text, text, text, public.country_code, text, text, text[], int, jsonb, text[], int, text, text, text) TO authenticated;

-- ============================================================================
-- POST-APPLY VERIFICATION (Part 6): as role authenticated with request.jwt.claims sub = X,
-- onboard_profile(X, ...) succeeds and onboard_profile(<other>, ...) raises 'actor_mismatch'.
-- ============================================================================
