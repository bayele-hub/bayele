-- ============================================================================
-- Rollback of:        20261014090100_0036_member_moderation_read_model.sql
-- Inverse type:       TRUE INVERSE — removes the moderation history, correction requests and admin access log
--                     (DATA LOSS: audit trail; export first), the read-model RPCs, the D5 CHECKs and columns, and
--                     restores guard_profiles (0016), on_profile_status_change (0011) and onboard_profile (0010).
-- Run in the SQL editor (contains DROP/DELETE — not the connector). Roll back 0037 first.
-- ============================================================================

DO $$
BEGIN
  IF NOT has_table_privilege('authenticated', 'public.profiles', 'SELECT') THEN
    RAISE EXCEPTION 'rollback_0036_blocked: roll back 0037 first';
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_member_edit_profiles ON public.profiles;
DROP TRIGGER IF EXISTS trg_member_edit_creator_profiles ON public.creator_profiles;
DROP TRIGGER IF EXISTS trg_member_edit_consultant_profiles ON public.consultant_profiles;
DROP TRIGGER IF EXISTS trg_member_edit_business_profiles ON public.business_profiles;
DROP TRIGGER IF EXISTS trg_admin_access_log_append_only ON public.admin_access_log;

DROP FUNCTION IF EXISTS public.admin_member_counts(public.user_role, public.country_code);
DROP FUNCTION IF EXISTS public.admin_member_list(public.account_status, public.user_role, public.country_code, text, integer, integer);
DROP FUNCTION IF EXISTS public.admin_reveal_member_field(uuid, text, text);
DROP FUNCTION IF EXISTS public.admin_member_detail(uuid);
DROP FUNCTION IF EXISTS public.my_moderation_status();
DROP FUNCTION IF EXISTS public.admin_moderate_member(uuid, text, text, text, text, text[]);
DROP FUNCTION IF EXISTS private.on_member_profile_edit();
DROP FUNCTION IF EXISTS private.resubmit_my_profile();
DROP FUNCTION IF EXISTS private.log_admin_access(uuid, text, text, text);
DROP FUNCTION IF EXISTS private.moderation_reason_label(text);
DROP FUNCTION IF EXISTS private.sensitive(text, text);
DROP FUNCTION IF EXISTS private.mask_email(text);
DROP FUNCTION IF EXISTS private.mask_tail(text, integer);
DROP FUNCTION IF EXISTS private.admin_access_log_append_only();

DROP TABLE IF EXISTS public.admin_access_log;
DROP TABLE IF EXISTS public.member_correction_requests;
DROP TABLE IF EXISTS public.member_moderation_events;

-- Pre-0036 bodies (on_profile_status_change needs the events table gone first).
CREATE OR REPLACE FUNCTION private.guard_profiles()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    NEW.status := OLD.status;  -- moderation status is not self-writable
  END IF;
  RETURN NEW;
END;
$$;

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

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_city_len,
  DROP CONSTRAINT IF EXISTS profiles_display_name_len,
  DROP CONSTRAINT IF EXISTS profiles_bio_len,
  DROP COLUMN IF EXISTS text_limits_grandfathered,
  DROP COLUMN IF EXISTS resubmitted_at;

DELETE FROM supabase_migrations.schema_migrations WHERE version = '20261014090100';
