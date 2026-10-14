-- ============================================================================
-- Migration:          Member review — moderation, admin read model, access log, text limits
-- Version:            20261014090100_0036
-- Date:               2026-10-14
-- Team:               Bayele Core Platform Engineering
-- Dependencies:       0035 (A7 is_admin, A1 profiles column grants), 0010 onboard_profile, 0011 moderation
--                     trigger, 0016 guard_profiles, 0026 founder badge, 0028 partner payout, 0031 attribution
-- Rollback Script:    supabase/migrations/rollback/20261014090100_0036_member_moderation_read_model.rollback.sql
-- Decisions:          briefs/CONTEXT-ADMIN-REVIEW.md D1 (A9), D2, D3, D4, D5
-- ============================================================================
-- K8: no destructive keyword. Same signatures for replaced functions; new objects guarded.
--
-- D4  admin_moderate_member(member, action, reason_code, message, internal_note, fields):
--     approve | reject | request_changes | suspend | reactivate. reject / request_changes / suspend
--     need a reason code ('other' also needs a message). The member gets an in-app notification with
--     the plain-language reason + message (never the internal note). request_changes keeps the
--     status and opens a correction request; the member's next profile edit resolves it and stamps
--     profiles.resubmitted_at (queue top); a rejected member's edit puts them back to pending_review.
--     History: member_moderation_events. Never auto-approves.
-- A9  on_profile_status_change: role-aware copy (brands are not « visible dans l'annuaire »); status
--     changes made outside admin_moderate_member are logged as 'status_change' events.
-- D2  admin_member_detail(member) → jsonb, masked sensitive fields; admin_reveal_member_field(...)
--     returns one value and logs it; admin_member_list / admin_member_counts for the list page.
-- D3  admin_access_log, append-only: view (once per admin/member/UTC day), reveal and decision (every time).
-- D5  NOT VALID CHECKs city ≤ 60, display_name ≤ 80, bio ≤ 500. Rows that exist when this migration
--     runs are grandfathered (profiles.text_limits_grandfathered = true) until the MEMBER changes city,
--     bio or display_name: then the limits apply to all three (a save that keeps a bad old value in one
--     of them fails with a clear field error). Other member saves (avatar, phone…) and admin / system
--     updates keep the exemption and never fail (AR-8). onboard_profile checks too.
-- ============================================================================

-- ── profiles: resubmission stamp + D5 grandfathering ─────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS resubmitted_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS text_limits_grandfathered boolean NOT NULL DEFAULT true;
ALTER TABLE public.profiles ALTER COLUMN text_limits_grandfathered SET DEFAULT false;   -- new rows: limits apply
COMMENT ON COLUMN public.profiles.resubmitted_at IS 'D4: last time the member edited their profile after a correction request / rejection (admin queue top).';
COMMENT ON COLUMN public.profiles.text_limits_grandfathered IS
  'D5: true only for rows that existed before 0036 whose city/bio/display_name the member has not changed since; cleared by such a change.';
GRANT SELECT (resubmitted_at) ON public.profiles TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.profiles'::regclass AND conname = 'profiles_city_len') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_city_len
      CHECK (text_limits_grandfathered OR char_length(btrim(city)) BETWEEN 1 AND 60) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.profiles'::regclass AND conname = 'profiles_display_name_len') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_display_name_len
      CHECK (text_limits_grandfathered OR char_length(btrim(display_name)) BETWEEN 1 AND 80) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.profiles'::regclass AND conname = 'profiles_bio_len') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_bio_len
      CHECK (text_limits_grandfathered OR bio IS NULL OR char_length(bio) <= 500) NOT VALID;
  END IF;
END $$;

-- guard (0016 body) + pin the new system columns; a member save ends the grandfathering.
CREATE OR REPLACE FUNCTION private.guard_profiles()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    NEW.status := OLD.status;                 -- moderation status is not self-writable
    NEW.resubmitted_at := OLD.resubmitted_at;
    -- D5 / AR-8: the limits apply as soon as the member changes one of the limited fields; saving
    -- anything else (avatar, phone, socials…) keeps a legacy row's exemption.
    IF NEW.city IS DISTINCT FROM OLD.city OR NEW.bio IS DISTINCT FROM OLD.bio
       OR NEW.display_name IS DISTINCT FROM OLD.display_name THEN
      NEW.text_limits_grandfathered := false;
    ELSE
      NEW.text_limits_grandfathered := OLD.text_limits_grandfathered;   -- never self-set
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ── Tables ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.member_moderation_events (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  member_id         uuid NOT NULL REFERENCES public.profiles(id),
  admin_id          uuid REFERENCES public.profiles(id),
  action            text NOT NULL,
  from_status       public.account_status,
  to_status         public.account_status,
  reason_code       text,
  message           text,
  internal_note     text,
  correction_fields text[],
  created_at        timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT mme_action CHECK (action IN ('approve','reject','request_changes','suspend','reactivate','resubmitted','status_change')),
  CONSTRAINT mme_reason CHECK (reason_code IS NULL OR reason_code IN
    ('fake_or_unreachable','duplicate','incomplete','inappropriate','not_eligible','spam_or_test','other')),
  CONSTRAINT mme_lengths CHECK (coalesce(char_length(message), 0) <= 500 AND coalesce(char_length(internal_note), 0) <= 1000
                                AND coalesce(cardinality(correction_fields), 0) <= 10)
);
COMMENT ON TABLE public.member_moderation_events IS 'D4: moderation history (admin-only read; the member sees reason + message through my_moderation_status()).';
CREATE INDEX IF NOT EXISTS mme_member_idx ON public.member_moderation_events (member_id, created_at DESC);
CREATE INDEX IF NOT EXISTS mme_admin_idx ON public.member_moderation_events (admin_id);

CREATE TABLE IF NOT EXISTS public.member_correction_requests (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id         uuid NOT NULL REFERENCES public.profiles(id),
  event_id          bigint NOT NULL REFERENCES public.member_moderation_events(id),
  fields            text[] NOT NULL DEFAULT '{}',
  reason_code       text NOT NULL,
  message           text,
  status            text NOT NULL DEFAULT 'open',
  created_at        timestamptz NOT NULL DEFAULT timezone('utc', now()),
  closed_at         timestamptz,
  closed_event_id   bigint REFERENCES public.member_moderation_events(id),
  CONSTRAINT mcr_status CHECK (status IN ('open','resolved','cancelled')),
  CONSTRAINT mcr_fields CHECK (fields <@ ARRAY['city','bio','avatar','socials','payout_phone','display_name','company_info','phone','other']::text[]
                               AND cardinality(fields) <= 9),
  CONSTRAINT mcr_message_len CHECK (message IS NULL OR char_length(message) <= 500)
);
CREATE UNIQUE INDEX IF NOT EXISTS mcr_one_open_per_member ON public.member_correction_requests (member_id) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS mcr_event_idx ON public.member_correction_requests (event_id);
CREATE INDEX IF NOT EXISTS mcr_closed_event_idx ON public.member_correction_requests (closed_event_id);

CREATE TABLE IF NOT EXISTS public.admin_access_log (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  admin_id   uuid NOT NULL REFERENCES public.profiles(id),
  member_id  uuid NOT NULL REFERENCES public.profiles(id),
  action     text NOT NULL,
  field      text,
  reason     text,
  view_day   date,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT aal_action CHECK (action IN ('view','reveal','decision')),
  CONSTRAINT aal_lengths CHECK (coalesce(char_length(field), 0) <= 40 AND coalesce(char_length(reason), 0) <= 500),
  CONSTRAINT aal_view_day CHECK ((action = 'view') = (view_day IS NOT NULL))
);
COMMENT ON TABLE public.admin_access_log IS
  'D3: append-only audit of admin access to member data. Stores references, never revealed values. Retention (documented, no purge yet): views 12 months, reveals + decisions 5 years.';
CREATE UNIQUE INDEX IF NOT EXISTS aal_one_view_per_day ON public.admin_access_log (admin_id, member_id, view_day) WHERE action = 'view';
CREATE INDEX IF NOT EXISTS aal_member_idx ON public.admin_access_log (member_id, created_at DESC);

CREATE OR REPLACE FUNCTION private.admin_access_log_append_only()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'append_only'; END;
$$;
REVOKE ALL ON FUNCTION private.admin_access_log_append_only() FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE TRIGGER trg_admin_access_log_append_only BEFORE UPDATE ON public.admin_access_log
  FOR EACH ROW EXECUTE FUNCTION private.admin_access_log_append_only();

ALTER TABLE public.member_moderation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_correction_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_access_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.member_moderation_events, public.member_correction_requests, public.admin_access_log FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.member_moderation_events, public.member_correction_requests, public.admin_access_log TO authenticated;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='member_moderation_events' AND policyname='admins read moderation events') THEN
    CREATE POLICY "admins read moderation events" ON public.member_moderation_events FOR SELECT TO authenticated
      USING (private.is_admin((SELECT auth.uid())));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='member_correction_requests' AND policyname='admins read correction requests') THEN
    CREATE POLICY "admins read correction requests" ON public.member_correction_requests FOR SELECT TO authenticated
      USING (private.is_admin((SELECT auth.uid())));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='admin_access_log' AND policyname='admins read access log') THEN
    CREATE POLICY "admins read access log" ON public.admin_access_log FOR SELECT TO authenticated
      USING (private.is_admin((SELECT auth.uid())));
  END IF;
END $$;

-- ── Helpers ─────────────────────────────────────────────────────────────────
-- Keep the last p_keep characters: '+237690000301' → '••••••0301'.
CREATE OR REPLACE FUNCTION private.mask_tail(p_value text, p_keep integer)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE
           WHEN nullif(btrim(p_value), '') IS NULL THEN NULL
           WHEN char_length(btrim(p_value)) <= p_keep THEN repeat('•', char_length(btrim(p_value)))
           ELSE repeat('•', least(char_length(btrim(p_value)) - p_keep, 6)) || right(btrim(p_value), p_keep)
         END;
$$;
-- 'jane.doe@gmail.com' → 'j•••@gmail.com'
CREATE OR REPLACE FUNCTION private.mask_email(p_value text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE
           WHEN nullif(btrim(p_value), '') IS NULL THEN NULL
           WHEN position('@' in p_value) <= 1 THEN private.mask_tail(p_value, 3)
           ELSE left(btrim(p_value), 1) || '•••' || substr(btrim(p_value), position('@' in btrim(p_value)))
         END;
$$;
CREATE OR REPLACE FUNCTION private.sensitive(p_value text, p_masked text)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT jsonb_build_object('present', nullif(btrim(coalesce(p_value, '')), '') IS NOT NULL, 'masked', p_masked);
$$;
-- Plain-language reason shown to the member.
CREATE OR REPLACE FUNCTION private.moderation_reason_label(p_code text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE p_code
    WHEN 'fake_or_unreachable' THEN 'Informations fausses ou impossibles à vérifier'
    WHEN 'duplicate'           THEN 'Doublon d''un autre compte'
    WHEN 'incomplete'          THEN 'Profil incomplet'
    WHEN 'inappropriate'       THEN 'Contenu inapproprié'
    WHEN 'not_eligible'        THEN 'Profil non éligible pour le moment'
    WHEN 'spam_or_test'        THEN 'Compte de test ou indésirable'
    WHEN 'other'               THEN 'Autre motif'
  END;
$$;
CREATE OR REPLACE FUNCTION private.log_admin_access(p_member uuid, p_action text, p_field text DEFAULT NULL, p_reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_action = 'view' THEN
    INSERT INTO public.admin_access_log (admin_id, member_id, action, view_day)
    VALUES (auth.uid(), p_member, 'view', (timezone('utc', now()))::date)
    ON CONFLICT (admin_id, member_id, view_day) WHERE action = 'view' DO NOTHING;
  ELSE
    INSERT INTO public.admin_access_log (admin_id, member_id, action, field, reason)
    VALUES (auth.uid(), p_member, p_action, p_field, left(p_reason, 500));
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.mask_tail(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.mask_email(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.sensitive(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.moderation_reason_label(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.log_admin_access(uuid, text, text, text) FROM PUBLIC, anon, authenticated;

-- ── A9: role-aware status notifications; non-RPC status changes are logged ──
CREATE OR REPLACE FUNCTION public.on_profile_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_brand boolean;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    -- admin_moderate_member / resubmission write their own event + notification.
    IF coalesce(current_setting('bayele.moderation_rpc', true), '') = 'on' THEN RETURN NEW; END IF;
    INSERT INTO public.member_moderation_events (member_id, admin_id, action, from_status, to_status)
    VALUES (NEW.id, CASE WHEN private.is_admin(auth.uid()) THEN auth.uid() END, 'status_change', OLD.status, NEW.status);
    v_brand := EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.id AND role = 'business')
               AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.id AND role IN ('creator','consultant'));
    IF NEW.status = 'active' THEN
      INSERT INTO public.notifications (user_id, type, title, body, link)
      VALUES (NEW.id, 'profile_approved',
              CASE WHEN v_brand THEN 'Votre compte marque est validé 🎉' ELSE 'Votre compte est validé 🎉' END,
              CASE WHEN v_brand THEN 'Vous pouvez maintenant financer vos campagnes sur Bayele.'
                   ELSE 'Vous êtes maintenant visible dans l''annuaire Bayele.' END,
              '/dashboard');
    ELSIF NEW.status = 'rejected' THEN
      INSERT INTO public.notifications (user_id, type, title, body, link)
      VALUES (NEW.id, 'profile_rejected', 'Profil non validé',
              'Votre profil n''a pas été validé pour le moment. Modifiez-le pour le soumettre à nouveau.', '/profile');
    ELSIF NEW.status = 'suspended' THEN
      INSERT INTO public.notifications (user_id, type, title, body, link)
      VALUES (NEW.id, 'profile_suspended', 'Compte suspendu',
              'Votre compte a été suspendu. Contactez le support.', '/dashboard');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ── D4: the moderation RPC ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_moderate_member(
  p_user_id       uuid,
  p_action        text,
  p_reason_code   text    DEFAULT NULL,
  p_message       text    DEFAULT NULL,
  p_internal_note text    DEFAULT NULL,
  p_fields        text[]  DEFAULT NULL
) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_from public.account_status; v_to public.account_status;
  v_msg text := nullif(btrim(coalesce(p_message, '')), '');
  v_note text := nullif(btrim(coalesce(p_internal_note, '')), '');
  v_code text := nullif(btrim(coalesce(p_reason_code, '')), '');
  v_fields text[] := coalesce(p_fields, '{}');
  v_event bigint; v_brand boolean; v_label text; v_body text;
BEGIN
  IF NOT private.is_admin(v_admin) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF p_action IS NULL OR p_action NOT IN ('approve','reject','request_changes','suspend','reactivate') THEN
    RAISE EXCEPTION 'invalid_action';
  END IF;
  IF p_user_id = v_admin THEN RAISE EXCEPTION 'cannot_moderate_self'; END IF;
  SELECT status INTO v_from FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF v_from IS NULL THEN RAISE EXCEPTION 'member_not_found'; END IF;

  IF p_action IN ('reject','request_changes','suspend') AND v_code IS NULL THEN RAISE EXCEPTION 'reason_required'; END IF;
  IF v_code IS NOT NULL AND private.moderation_reason_label(v_code) IS NULL THEN RAISE EXCEPTION 'invalid_reason_code'; END IF;
  IF v_code = 'other' AND v_msg IS NULL THEN RAISE EXCEPTION 'message_required'; END IF;
  IF char_length(v_msg) > 500 THEN RAISE EXCEPTION 'message_too_long'; END IF;
  IF char_length(v_note) > 1000 THEN RAISE EXCEPTION 'note_too_long'; END IF;
  IF p_action <> 'request_changes' THEN v_fields := '{}'; END IF;
  IF NOT (v_fields <@ ARRAY['city','bio','avatar','socials','payout_phone','display_name','company_info','phone','other']::text[]) THEN
    RAISE EXCEPTION 'invalid_fields';
  END IF;

  v_to := CASE
    WHEN p_action = 'approve'         AND v_from = 'pending_review'                 THEN 'active'
    WHEN p_action = 'reject'          AND v_from = 'pending_review'                 THEN 'rejected'
    WHEN p_action = 'request_changes' AND v_from IN ('pending_review','active')     THEN v_from
    WHEN p_action = 'suspend'         AND v_from IN ('active','pending_review')     THEN 'suspended'
    WHEN p_action = 'reactivate'      AND v_from IN ('suspended','rejected')        THEN 'active'
  END;
  IF v_to IS NULL THEN RAISE EXCEPTION 'invalid_transition' USING DETAIL = format('%s from %s', p_action, v_from); END IF;

  INSERT INTO public.member_moderation_events (member_id, admin_id, action, from_status, to_status, reason_code, message, internal_note, correction_fields)
  VALUES (p_user_id, v_admin, p_action, v_from, v_to, v_code, v_msg, v_note, CASE WHEN p_action = 'request_changes' THEN v_fields END)
  RETURNING id INTO v_event;

  -- Close any open correction request; request_changes opens a fresh one.
  UPDATE public.member_correction_requests SET status = 'cancelled', closed_at = now(), closed_event_id = v_event
   WHERE member_id = p_user_id AND status = 'open';
  IF p_action = 'request_changes' THEN
    INSERT INTO public.member_correction_requests (member_id, event_id, fields, reason_code, message)
    VALUES (p_user_id, v_event, v_fields, v_code, v_msg);
  END IF;

  IF v_to IS DISTINCT FROM v_from THEN
    PERFORM set_config('bayele.moderation_rpc', 'on', true);
    UPDATE public.profiles SET status = v_to, updated_at = now() WHERE id = p_user_id;
    PERFORM set_config('bayele.moderation_rpc', 'off', true);
  END IF;

  PERFORM private.log_admin_access(p_user_id, 'decision', p_action, v_code);

  v_brand := EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_user_id AND role = 'business')
             AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_user_id AND role IN ('creator','consultant'));
  v_label := private.moderation_reason_label(v_code);
  v_body := CASE WHEN v_label IS NOT NULL THEN 'Motif : ' || v_label || '.' ELSE '' END
            || CASE WHEN v_msg IS NOT NULL THEN ' ' || v_msg ELSE '' END;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  SELECT p_user_id, n.type, n.title, btrim(n.body), n.link FROM (VALUES
    ('approve', 'profile_approved',
     CASE WHEN v_brand THEN 'Votre compte marque est validé 🎉' ELSE 'Votre compte est validé 🎉' END,
     CASE WHEN v_brand THEN 'Vous pouvez maintenant financer vos campagnes sur Bayele.'
          ELSE 'Vous êtes maintenant visible dans l''annuaire Bayele.' END || coalesce(' ' || v_msg, ''),
     '/dashboard'),
    ('reject', 'profile_rejected', 'Profil non validé',
     v_body || ' Modifiez votre profil pour le soumettre à nouveau.', '/profile'),
    ('request_changes', 'profile_changes_requested', 'Correction demandée',
     v_body || ' Modifiez votre profil : il repassera automatiquement en revue.', '/profile'),
    ('suspend', 'profile_suspended', 'Compte suspendu', v_body, '/dashboard'),
    ('reactivate', 'profile_reactivated', 'Compte réactivé', 'Votre compte est de nouveau actif.' || coalesce(' ' || v_msg, ''), '/dashboard')
  ) AS n(action, type, title, body, link)
  WHERE n.action = p_action;

  RETURN v_event;
END;
$$;

-- ── D4: resubmission on the member's own profile edit ───────────────────────
CREATE OR REPLACE FUNCTION private.resubmit_my_profile()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_uid uuid := auth.uid(); v_status public.account_status; v_req uuid; v_event bigint; v_to public.account_status;
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;
  SELECT status INTO v_status FROM public.profiles WHERE id = v_uid FOR UPDATE;
  IF v_status IS NULL THEN RETURN; END IF;
  SELECT id INTO v_req FROM public.member_correction_requests WHERE member_id = v_uid AND status = 'open' FOR UPDATE;
  IF v_req IS NULL AND v_status <> 'rejected' THEN RETURN; END IF;
  v_to := CASE WHEN v_status = 'rejected' THEN 'pending_review' ELSE v_status END;

  INSERT INTO public.member_moderation_events (member_id, action, from_status, to_status)
  VALUES (v_uid, 'resubmitted', v_status, v_to) RETURNING id INTO v_event;
  UPDATE public.member_correction_requests SET status = 'resolved', closed_at = now(), closed_event_id = v_event WHERE id = v_req;
  PERFORM set_config('bayele.moderation_rpc', 'on', true);
  UPDATE public.profiles SET status = v_to, resubmitted_at = now(), updated_at = now() WHERE id = v_uid;
  PERFORM set_config('bayele.moderation_rpc', 'off', true);
END;
$$;
REVOKE ALL ON FUNCTION private.resubmit_my_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.resubmit_my_profile() TO authenticated;   -- acts only on auth.uid()

CREATE OR REPLACE FUNCTION private.on_member_profile_edit()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF current_user = 'authenticated' AND auth.uid() IS NOT NULL
     AND coalesce(to_jsonb(NEW) ->> 'user_id', to_jsonb(NEW) ->> 'id') = auth.uid()::text
     AND to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD) THEN
    PERFORM private.resubmit_my_profile();
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION private.on_member_profile_edit() FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE TRIGGER trg_member_edit_profiles AFTER UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION private.on_member_profile_edit();
CREATE OR REPLACE TRIGGER trg_member_edit_creator_profiles AFTER UPDATE ON public.creator_profiles
  FOR EACH ROW EXECUTE FUNCTION private.on_member_profile_edit();
CREATE OR REPLACE TRIGGER trg_member_edit_consultant_profiles AFTER UPDATE ON public.consultant_profiles
  FOR EACH ROW EXECUTE FUNCTION private.on_member_profile_edit();
CREATE OR REPLACE TRIGGER trg_member_edit_business_profiles AFTER UPDATE ON public.business_profiles
  FOR EACH ROW EXECUTE FUNCTION private.on_member_profile_edit();

-- The member's own moderation state (pending page): reason + message, never internal notes or admin identity.
CREATE OR REPLACE FUNCTION public.my_moderation_status()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'status', p.status,
    'resubmitted_at', p.resubmitted_at,
    'open_correction', (SELECT jsonb_build_object('fields', r.fields, 'reason_code', r.reason_code,
                                                  'reason_label', private.moderation_reason_label(r.reason_code),
                                                  'message', r.message, 'requested_at', r.created_at)
                          FROM public.member_correction_requests r WHERE r.member_id = p.id AND r.status = 'open'),
    'last_decision', (SELECT jsonb_build_object('action', e.action, 'reason_code', e.reason_code,
                                                'reason_label', private.moderation_reason_label(e.reason_code),
                                                'message', e.message, 'at', e.created_at)
                        FROM public.member_moderation_events e
                       WHERE e.member_id = p.id AND e.action IN ('approve','reject','request_changes','suspend','reactivate')
                       ORDER BY e.created_at DESC, e.id DESC LIMIT 1))
    FROM public.profiles p WHERE p.id = auth.uid();
$$;

-- ── D2: admin read model ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_member_detail(p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  p public.profiles; v_auth jsonb; v_roles text[];
  cp public.creator_profiles; kp public.consultant_profiles; bp public.business_profiles;
  v_creator jsonb; v_partner jsonb; v_business jsonb; v_checklist text[] := '{}';
  v_has_platform boolean;
BEGIN
  IF NOT private.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  SELECT * INTO p FROM public.profiles WHERE id = p_user_id;
  IF p.id IS NULL THEN RAISE EXCEPTION 'member_not_found'; END IF;
  PERFORM private.log_admin_access(p_user_id, 'view');

  SELECT to_jsonb(u) INTO v_auth FROM auth.users u WHERE u.id = p_user_id;
  SELECT coalesce(array_agg(ur.role::text ORDER BY ur.role::text), '{}') INTO v_roles FROM public.user_roles ur WHERE ur.user_id = p_user_id;

  IF 'creator' = ANY (v_roles) THEN
    SELECT * INTO cp FROM public.creator_profiles WHERE user_id = p_user_id;
    v_has_platform := EXISTS (SELECT 1 FROM jsonb_each(coalesce(cp.platforms, '{}'::jsonb)) e
                               WHERE jsonb_typeof(e.value) = 'object' AND nullif(e.value ->> 'url', '') IS NOT NULL);
    v_creator := jsonb_build_object(
      'categories', coalesce(to_jsonb(cp.categories), '[]'::jsonb), 'audience_size', cp.audience_size,
      'platforms', coalesce(cp.platforms, '{}'::jsonb), 'is_pro', coalesce(cp.is_pro, false), 'pro_expires_at', cp.pro_expires_at,
      'rating', jsonb_build_object('value', cp.rating_avg, 'is_default', true, 'reviews', 0),
      'payout', jsonb_build_object('phone', private.sensitive(cp.momo_payout_phone_e164, private.mask_tail(cp.momo_payout_phone_e164, 4)),
                                   'provider', cp.momo_provider),
      'founder_number', (SELECT founder_number FROM public.founder_creators WHERE user_id = p_user_id),
      'partner', (SELECT jsonb_build_object('id', pp.id, 'handle', pp.handle, 'display_name', pp.display_name,
                                            'commission_rate', l.commission_rate, 'since', l.responded_at)
                    FROM public.partner_creator_links l JOIN public.profiles pp ON pp.id = l.partner_id
                   WHERE l.creator_id = p_user_id AND l.status = 'active' LIMIT 1),
      'pending_partner_offers', (SELECT count(*) FROM public.partner_creator_links WHERE creator_id = p_user_id AND status = 'pending'),
      'stats', jsonb_build_object(
        'applications', coalesce((SELECT jsonb_object_agg(s, n) FROM (SELECT status::text s, count(*) n FROM public.campaign_creators
                                   WHERE creator_id = p_user_id GROUP BY 1) x), '{}'::jsonb),
        'earnings_gross_fcfa', (SELECT coalesce(sum(amount_fcfa), 0) FROM public.escrow_transactions
                                 WHERE direction = 'outbound' AND recipient_profile_id = p_user_id AND status = 'paid_out'),
        'earnings_net_fcfa', (SELECT coalesce(sum(net_amount_fcfa), 0) FROM public.escrow_transactions
                               WHERE direction = 'outbound' AND recipient_profile_id = p_user_id AND status = 'paid_out'),
        'partner_commission_fcfa', (SELECT coalesce(sum(fee_fcfa), 0) FROM public.escrow_transactions
                                     WHERE direction = 'outbound' AND recipient_profile_id = p_user_id AND status = 'paid_out'),
        'pending_payout_fcfa', (SELECT coalesce(sum(amount_fcfa), 0) FROM public.escrow_transactions
                                 WHERE direction = 'outbound' AND recipient_profile_id = p_user_id AND status = 'releasable'),
        'proofs_rejected', (SELECT count(*) FROM public.proof_of_post pp JOIN public.campaign_creators cc ON cc.id = pp.campaign_creator_id
                             WHERE cc.creator_id = p_user_id AND pp.is_valid = false)));
    IF NOT v_has_platform THEN v_checklist := v_checklist || 'no_platform'::text; END IF;
    IF nullif(cp.momo_payout_phone_e164, '') IS NULL THEN v_checklist := v_checklist || 'no_payout_number'::text; END IF;
  END IF;

  IF 'consultant' = ANY (v_roles) THEN
    SELECT * INTO kp FROM public.consultant_profiles WHERE user_id = p_user_id;
    v_partner := jsonb_build_object(
      'specialties', coalesce(to_jsonb(kp.specialties), '[]'::jsonb), 'years_experience', kp.years_experience,
      'agency_access', coalesce(kp.agency_access, false),
      'rating', jsonb_build_object('value', NULL, 'is_default', true, 'reviews', 0),
      'tax_id', private.sensitive(kp.tax_id, private.mask_tail(kp.tax_id, 3)),
      'payout', jsonb_build_object('phone', private.sensitive(kp.momo_payout_phone_e164, private.mask_tail(kp.momo_payout_phone_e164, 4)),
                                   'provider', kp.momo_provider),
      'stats', jsonb_build_object(
        'creators_active', (SELECT count(*) FROM public.partner_creator_links WHERE partner_id = p_user_id AND status = 'active'),
        'creators_ended', (SELECT count(*) FROM public.partner_creator_links WHERE partner_id = p_user_id AND status = 'ended'),
        'invites_pending', (SELECT count(*) FROM public.partner_creator_links WHERE partner_id = p_user_id AND status = 'pending'),
        'applications_made', (SELECT count(*) FROM public.campaign_creators WHERE applied_by = p_user_id),
        'commission_owed_fcfa', (SELECT coalesce(sum(commission_fcfa), 0) FROM public.partner_commissions WHERE partner_id = p_user_id AND status = 'owed'),
        'commission_paid_fcfa', (SELECT coalesce(sum(commission_fcfa), 0) FROM public.partner_commissions WHERE partner_id = p_user_id AND status = 'paid'),
        'retainers', coalesce((SELECT jsonb_object_agg(s, n) FROM (SELECT status::text s, count(*) n FROM public.agency_retainers
                                WHERE consultant_id = p_user_id GROUP BY 1) x), '{}'::jsonb),
        'settlements_pending_fcfa', (SELECT coalesce(sum(amount_fcfa), 0) FROM public.retainer_settlements WHERE recipient_id = p_user_id AND status = 'pending'),
        'settlements_paid_fcfa', (SELECT coalesce(sum(amount_fcfa), 0) FROM public.retainer_settlements WHERE recipient_id = p_user_id AND status = 'paid')));
    IF nullif(kp.momo_payout_phone_e164, '') IS NULL THEN v_checklist := v_checklist || 'no_payout_number'::text; END IF;
  END IF;

  IF 'business' = ANY (v_roles) THEN
    SELECT * INTO bp FROM public.business_profiles WHERE user_id = p_user_id;
    v_business := jsonb_build_object(
      'company_name', bp.company_name, 'industry', bp.industry, 'website', bp.website, 'is_verified', coalesce(bp.is_verified, false),
      'sokoclick_customer_id', bp.sokoclick_customer_id,
      'billing_email', private.sensitive(bp.billing_email, private.mask_email(bp.billing_email)),
      'billing_address', private.sensitive(bp.billing_address, private.mask_tail(bp.billing_address, 4)),
      'tax_id', private.sensitive(bp.tax_id, private.mask_tail(bp.tax_id, 3)),
      'stats', jsonb_build_object(
        'campaigns', coalesce((SELECT jsonb_object_agg(s, n) FROM (SELECT status::text s, count(*) n FROM public.campaigns
                                WHERE owner_id = p_user_id GROUP BY 1) x), '{}'::jsonb),
        'funded_total_fcfa', (SELECT coalesce(sum(et.amount_fcfa), 0) FROM public.escrow_transactions et JOIN public.campaigns c ON c.id = et.campaign_id
                               WHERE c.owner_id = p_user_id AND et.direction = 'inbound' AND et.status <> 'refunded'),
        'fees_fcfa', (SELECT coalesce(sum(et.fee_fcfa), 0) FROM public.escrow_transactions et JOIN public.campaigns c ON c.id = et.campaign_id
                       WHERE c.owner_id = p_user_id AND et.direction = 'inbound' AND et.status <> 'refunded'),
        'escrow_held_net_fcfa', (SELECT coalesce(sum(et.net_amount_fcfa), 0) FROM public.escrow_transactions et JOIN public.campaigns c ON c.id = et.campaign_id
                                  WHERE c.owner_id = p_user_id AND et.direction = 'inbound' AND et.status = 'held'),
        'refunded_total_fcfa', (SELECT coalesce(sum(et.amount_fcfa), 0) FROM public.escrow_transactions et JOIN public.campaigns c ON c.id = et.campaign_id
                                 WHERE c.owner_id = p_user_id AND et.direction IN ('inbound', 'refund') AND et.status = 'refunded'),
        'leftover_refund_pending_fcfa', (SELECT coalesce(sum(et.amount_fcfa), 0) FROM public.escrow_transactions et JOIN public.campaigns c ON c.id = et.campaign_id
                                          WHERE c.owner_id = p_user_id AND et.direction = 'refund' AND et.status IN ('pending','refunding')),
        'retainers', coalesce((SELECT jsonb_object_agg(s, n) FROM (SELECT status::text s, count(*) n FROM public.agency_retainers
                                WHERE business_id = p_user_id GROUP BY 1) x), '{}'::jsonb),
        'retainer_funded_value_fcfa', (SELECT coalesce(sum(contract_value_fcfa), 0) FROM public.agency_retainers
                                        WHERE business_id = p_user_id AND status IN ('funded','active','completed'))));
    IF nullif(btrim(coalesce(bp.company_name, '')), '') IS NULL THEN v_checklist := v_checklist || 'no_company_name'::text; END IF;
    IF nullif(btrim(coalesce(bp.billing_email, '')), '') IS NULL THEN v_checklist := v_checklist || 'no_billing_email'::text; END IF;
  END IF;

  IF nullif(p.phone_e164, '') IS NULL THEN v_checklist := v_checklist || 'no_phone'::text; END IF;
  IF nullif(p.avatar_url, '') IS NULL THEN v_checklist := v_checklist || 'no_avatar'::text; END IF;
  IF char_length(btrim(p.city)) > 60 THEN v_checklist := v_checklist || 'city_too_long'::text; END IF;
  IF char_length(btrim(p.display_name)) > 80 THEN v_checklist := v_checklist || 'display_name_too_long'::text; END IF;
  IF char_length(p.bio) > 500 THEN v_checklist := v_checklist || 'bio_too_long'::text; END IF;

  RETURN jsonb_build_object(
    'profile', jsonb_build_object(
      'id', p.id, 'handle', p.handle, 'display_name', p.display_name, 'avatar_url', p.avatar_url, 'bio', p.bio,
      'city', p.city, 'country', p.country, 'status', p.status, 'created_at', p.created_at, 'updated_at', p.updated_at,
      'resubmitted_at', p.resubmitted_at, 'roles', to_jsonb(v_roles),
      'phone', private.sensitive(p.phone_e164, private.mask_tail(p.phone_e164, 4)),
      'email', private.sensitive(v_auth ->> 'email', private.mask_email(v_auth ->> 'email')),
      'last_sign_in_at', v_auth ->> 'last_sign_in_at',
      'email_confirmed_at', v_auth ->> 'email_confirmed_at'),
    'creator', v_creator,
    'partner', v_partner,
    'business', v_business,
    'trust', jsonb_build_object(
      'disputes', (SELECT count(*) FROM public.campaign_creators cc JOIN public.campaigns c ON c.id = cc.campaign_id
                    WHERE cc.status = 'disputed' AND (cc.creator_id = p_user_id OR c.owner_id = p_user_id)),
      'conversations', (SELECT count(*) FROM public.conversations WHERE business_id = p_user_id OR counterparty_id = p_user_id),
      'reports_involving', (SELECT count(DISTINCT n.link) FROM public.notifications n
                             JOIN public.conversations cv ON n.link = '/messages/' || cv.id::text
                            WHERE n.type = 'conversation_reported' AND (cv.business_id = p_user_id OR cv.counterparty_id = p_user_id))),
    'attribution', (SELECT jsonb_build_object('signup_source', sa.signup_source,
                                              'referred_by', (SELECT jsonb_build_object('id', r.id, 'handle', r.handle) FROM public.profiles r WHERE r.id = sa.referred_by),
                                              'created_at', sa.created_at)
                      FROM public.signup_attribution sa WHERE sa.user_id = p_user_id),
    'referrals', (SELECT count(*) FROM public.signup_attribution WHERE referred_by = p_user_id),
    'moderation', jsonb_build_object(
      'open_correction', (SELECT jsonb_build_object('id', r.id, 'fields', r.fields, 'reason_code', r.reason_code, 'message', r.message, 'requested_at', r.created_at)
                            FROM public.member_correction_requests r WHERE r.member_id = p_user_id AND r.status = 'open'),
      'history', coalesce((SELECT jsonb_agg(jsonb_build_object('id', e.id, 'action', e.action, 'from_status', e.from_status, 'to_status', e.to_status,
                                                               'reason_code', e.reason_code, 'message', e.message, 'internal_note', e.internal_note,
                                                               'correction_fields', e.correction_fields, 'admin_handle', a.handle, 'at', e.created_at)
                                            ORDER BY e.created_at DESC, e.id DESC)
                             FROM (SELECT * FROM public.member_moderation_events WHERE member_id = p_user_id ORDER BY created_at DESC, id DESC LIMIT 50) e
                             LEFT JOIN public.profiles a ON a.id = e.admin_id), '[]'::jsonb)),
    'checklist', to_jsonb(v_checklist)
  );
END;
$$;

-- One sensitive value, logged (D3 'reveal').
CREATE OR REPLACE FUNCTION public.admin_reveal_member_field(p_user_id uuid, p_field text, p_reason text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v text;
BEGIN
  IF NOT private.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN RAISE EXCEPTION 'member_not_found'; END IF;
  IF p_field IS NULL OR p_field NOT IN ('phone','email','creator_payout_phone','partner_payout_phone','business_tax_id',
                                        'partner_tax_id','billing_email','billing_address') THEN
    RAISE EXCEPTION 'invalid_field';
  END IF;
  IF char_length(p_reason) > 500 THEN RAISE EXCEPTION 'reason_too_long'; END IF;
  v := CASE p_field
    WHEN 'phone'                THEN (SELECT phone_e164 FROM public.profiles WHERE id = p_user_id)
    WHEN 'email'                THEN (SELECT to_jsonb(u) ->> 'email' FROM auth.users u WHERE u.id = p_user_id)
    WHEN 'creator_payout_phone' THEN (SELECT momo_payout_phone_e164 FROM public.creator_profiles WHERE user_id = p_user_id)
    WHEN 'partner_payout_phone' THEN (SELECT momo_payout_phone_e164 FROM public.consultant_profiles WHERE user_id = p_user_id)
    WHEN 'business_tax_id'      THEN (SELECT tax_id FROM public.business_profiles WHERE user_id = p_user_id)
    WHEN 'partner_tax_id'       THEN (SELECT tax_id FROM public.consultant_profiles WHERE user_id = p_user_id)
    WHEN 'billing_email'        THEN (SELECT billing_email FROM public.business_profiles WHERE user_id = p_user_id)
    WHEN 'billing_address'      THEN (SELECT billing_address FROM public.business_profiles WHERE user_id = p_user_id)
  END;
  PERFORM private.log_admin_access(p_user_id, 'reveal', p_field, nullif(btrim(coalesce(p_reason, '')), ''));
  RETURN v;
END;
$$;

-- List page: server-side filters, pagination, search (incl. phone digits for admins).
CREATE OR REPLACE FUNCTION public.admin_member_list(
  p_status  public.account_status DEFAULT NULL,
  p_role    public.user_role DEFAULT NULL,
  p_country public.country_code DEFAULT NULL,
  p_search  text DEFAULT NULL,
  p_limit   integer DEFAULT 50,
  p_offset  integer DEFAULT 0
) RETURNS TABLE (
  id uuid, handle text, display_name text, avatar_url text, city text, country public.country_code,
  status public.account_status, roles public.user_role[], company_name text, created_at timestamptz,
  resubmitted_at timestamptz, open_correction boolean, has_phone boolean, total_count bigint
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_q text := nullif(btrim(coalesce(p_search, '')), '');
  v_digits text := regexp_replace(coalesce(p_search, ''), '\D', '', 'g');
BEGIN
  IF NOT private.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  RETURN QUERY
  WITH m AS (
    SELECT p.id, p.handle, p.display_name, p.avatar_url, p.city, p.country, p.status,
           (SELECT array_agg(ur.role ORDER BY ur.role) FROM public.user_roles ur WHERE ur.user_id = p.id) AS roles,
           bp.company_name, p.created_at, p.resubmitted_at,
           EXISTS (SELECT 1 FROM public.member_correction_requests r WHERE r.member_id = p.id AND r.status = 'open') AS open_correction,
           p.phone_e164 IS NOT NULL AS has_phone
      FROM public.profiles p
      LEFT JOIN public.business_profiles bp ON bp.user_id = p.id
     WHERE (p_status IS NULL OR p.status = p_status)
       AND (p_country IS NULL OR p.country = p_country)
       AND (p_role IS NULL OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id AND ur.role = p_role))
       AND (v_q IS NULL
            OR p.display_name ILIKE '%' || v_q || '%' OR p.handle ILIKE '%' || ltrim(v_q, '@') || '%'
            OR p.city ILIKE '%' || v_q || '%' OR bp.company_name ILIKE '%' || v_q || '%'
            OR (char_length(v_digits) >= 4 AND regexp_replace(coalesce(p.phone_e164, ''), '\D', '', 'g') LIKE '%' || v_digits || '%'))
  )
  SELECT m.id, m.handle, m.display_name, m.avatar_url, m.city, m.country, m.status, m.roles, m.company_name,
         m.created_at, m.resubmitted_at, m.open_correction, m.has_phone, count(*) OVER ()
    FROM m
   ORDER BY CASE WHEN p_status = 'pending_review' THEN m.resubmitted_at END DESC NULLS LAST,
            CASE WHEN p_status = 'pending_review' THEN m.created_at END ASC,
            m.created_at DESC, m.id
   LIMIT least(greatest(coalesce(p_limit, 50), 1), 100) OFFSET greatest(coalesce(p_offset, 0), 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_member_counts(
  p_role public.user_role DEFAULT NULL, p_country public.country_code DEFAULT NULL
) RETURNS TABLE (status public.account_status, members bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT private.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  RETURN QUERY
  SELECT p.status, count(*) FROM public.profiles p
   WHERE (p_country IS NULL OR p.country = p_country)
     AND (p_role IS NULL OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id AND ur.role = p_role))
   GROUP BY p.status ORDER BY p.status;
END;
$$;

-- ── D5: onboarding enforces the same limits (same 16-arg signature as 0010) ──
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
  v_name   text := regexp_replace(btrim(coalesce(p_display_name, '')), '\s+', ' ', 'g');
  v_city   text := regexp_replace(btrim(coalesce(p_city, '')), '\s+', ' ', 'g');
  v_bio    text := nullif(btrim(coalesce(p_bio, '')), '');
  v_row    public.profiles;
BEGIN
  IF p_actor IS NULL THEN RAISE EXCEPTION 'actor required'; END IF;
  IF v_uid IS NOT NULL AND v_uid <> p_actor THEN RAISE EXCEPTION 'actor_mismatch'; END IF;
  IF p_role NOT IN ('creator','consultant','business') THEN RAISE EXCEPTION 'invalid onboarding role: %', p_role; END IF;
  IF v_handle !~ '^[a-z0-9_]{3,30}$' THEN RAISE EXCEPTION 'invalid_handle_format'; END IF;
  IF v_name = '' THEN RAISE EXCEPTION 'display_name_required'; END IF;
  IF char_length(v_name) > 80 THEN RAISE EXCEPTION 'display_name_too_long'; END IF;
  IF v_city = '' THEN RAISE EXCEPTION 'city_required'; END IF;
  IF char_length(v_city) > 60 THEN RAISE EXCEPTION 'city_too_long'; END IF;
  IF char_length(v_bio) > 500 THEN RAISE EXCEPTION 'bio_too_long'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = p_actor) THEN RAISE EXCEPTION 'profile_already_exists'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE handle = v_handle) THEN RAISE EXCEPTION 'handle_taken'; END IF;

  INSERT INTO public.profiles (id, handle, display_name, avatar_url, bio, city, country, status)
  VALUES (p_actor, v_handle, v_name, p_avatar_url, v_bio, v_city, p_country, 'pending_review')
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

-- ── Grants ──────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.admin_moderate_member(uuid, text, text, text, text, text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_moderation_status() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_member_detail(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_reveal_member_field(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_member_list(public.account_status, public.user_role, public.country_code, text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_member_counts(public.user_role, public.country_code) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_moderate_member(uuid, text, text, text, text, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_moderation_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_member_detail(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reveal_member_field(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_member_list(public.account_status, public.user_role, public.country_code, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_member_counts(public.user_role, public.country_code) TO authenticated;
