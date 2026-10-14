-- ============================================================================
-- Migration:          Partner governance — specialties list, delisting, assignments, contact requests,
--                     pre-contract masking, fraud controls, consents, WhatsApp proof screenshots, cities
-- Version:            20261014120100_0039
-- Date:               2026-10-14
-- Team:               Bayele Core Platform Engineering
-- Dependencies:       0038 (conversation_context 'partner_assignment'), 0035 (retainers, settlements),
--                     0036 (moderation, admin_access_log, admin_member_detail), 0023–0025 messaging
-- Rollback Script:    supabase/migrations/rollback/20261014120100_0039_partner_governance.rollback.sql
-- Decisions:          briefs/CONTEXT-PARTNER-GOV.md G1–G9 (release order G11)
-- ============================================================================
-- SAFE WHILE THE OLD WEB RUNS (origin/main and the admin-review web): every replaced function keeps its
-- signature and its old behaviour for old call paths; new behaviour is either new RPCs or only reachable
-- through new data (assignments, flags, recapture requests). The validations that WOULD break the old web
-- (specialty codes, retainer only to an assigned partner, retainer-thread gating) are in 0040.
-- K8: no destructive keyword in this file.
--
-- G1  partner_specialties (14 codes) + aliases for the 0040 mapping; consultant_profiles.specialties_legacy.
-- G2  directory_listed (+ reason) with RLS (ALTER POLICY), conversation freeze on suspension, admin RPCs:
--     listing, assignment, end representation (logged), commission rate (admin-only change), overview,
--     flags queue.
-- G3  partner_assignments (admin match or approved contact request) are ACTIVE at once (owner P3: no partner
--     acceptance) and open an on-platform 'partner_assignment' conversation (30 days, extended by retainer
--     activity). The partner can ask the admin to end it (« Demander la fin », assignment_end_requests).
-- G4  partner_contact_requests + admin queue with reason codes. A thread whose 30-day window passed
--     without a funded retainer ends its assignment ('window_expired') and expires the request
--     (private.expire_assignment_windows, run lazily by the request / assignment / queue RPCs).
-- G5  private.mask_contacts inside send_message for brand↔partner threads without a funded retainer:
--     phones, e-mails, WhatsApp/Telegram links, social handles → markers; message_flags (no raw values).
--     Owner P5: the raw original of a MASKED message is kept in message_originals (admin-only, RLS deny-all,
--     not published to realtime, never in notifications), read only via admin_read_masked_original (reason
--     required, logged), and nulled after 90 days by private.purge_masked_originals (pg_cron when available,
--     and opportunistically from the admin flags queue).
-- G6  self-dealing flags (shared phone / payout number / e-mail) → partner payouts on hold; rate lock
--     verified (no client write path) + admin_set_commission_rate; « Signaler » → flags queue.
-- G7  member_consents (version + timestamp) + record_consent / my_consents: the one-time CGU
--     non-circumvention acknowledgement, and the brand's consent on each contact request.
-- G8  private bucket 'proofs' (5 MB, jpeg/png/webp) + policies, proof_media, creator_submit_whatsapp_proof
--     (delegates to submit_proof_of_post), request_proof_recapture (« Demander une nouvelle capture »).
-- G9  cities (country, name, sort) seeded with real cities, normalisation trigger + profiles.city_in_list.
-- ============================================================================

-- ── Helpers ─────────────────────────────────────────────────────────────────
-- Accent/case/space-insensitive key (FR + EN names).
CREATE OR REPLACE FUNCTION private.text_key(p text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT btrim(regexp_replace(translate(lower(normalize(coalesce(p, ''), NFKC)),
                                        'éèêëàâäîïôöûüùçñ''’-', 'eeeeaaaiioouuucn   '), '\s+', ' ', 'g'));
$$;
REVOKE ALL ON FUNCTION private.text_key(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.notify_admins(p_type text, p_title text, p_body text, p_link text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  INSERT INTO public.notifications (user_id, type, title, body, link)
  SELECT ur.user_id, p_type, p_title, p_body, p_link
    FROM public.user_roles ur JOIN public.profiles p ON p.id = ur.user_id
   WHERE ur.role = 'super_admin' AND p.status = 'active';
$$;
REVOKE ALL ON FUNCTION private.notify_admins(text, text, text, text) FROM PUBLIC, anon, authenticated;

-- ── G1: specialties list ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.partner_specialties (
  code     text PRIMARY KEY,
  label_fr text NOT NULL,
  label_en text NOT NULL,
  sort     smallint NOT NULL DEFAULT 100,
  active   boolean NOT NULL DEFAULT true,
  CONSTRAINT partner_specialties_code CHECK (code ~ '^[a-z0-9_]{2,40}$')
);
INSERT INTO public.partner_specialties (code, label_fr, label_en, sort) VALUES
  ('talent_management',       'Gestion de talents',             'Talent management',          10),
  ('content_strategy',        'Stratégie de contenu',           'Content strategy',           20),
  ('video_production',        'Production vidéo',               'Video production',           30),
  ('photography',             'Photographie',                   'Photography',                40),
  ('social_media_management', 'Gestion des réseaux sociaux',    'Social media management',    50),
  ('influencer_campaigns',    'Campagnes d''influence',         'Influencer campaigns',       60),
  ('ugc',                     'UGC',                            'UGC',                        70),
  ('brand_partnerships',      'Partenariats de marque',         'Brand partnerships',         80),
  ('event_coverage',          'Couverture d''événements',       'Event coverage',             90),
  ('music_entertainment',     'Musique et divertissement',      'Music & entertainment',     100),
  ('fashion_beauty',          'Mode et beauté',                 'Fashion & beauty',          110),
  ('food_hospitality',        'Gastronomie et hôtellerie',      'Food & hospitality',        120),
  ('tech_fintech',            'Tech et fintech',                'Tech & fintech',            130),
  ('ngo_impact',              'ONG et impact social',           'NGO & social impact',       140)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.partner_specialty_aliases (
  alias_key text PRIMARY KEY,
  code      text NOT NULL REFERENCES public.partner_specialties(code)
);
CREATE INDEX IF NOT EXISTS partner_specialty_aliases_code_idx ON public.partner_specialty_aliases (code);
-- labels (FR + EN) and the codes themselves are aliases; plus common free-text synonyms.
INSERT INTO public.partner_specialty_aliases (alias_key, code)
SELECT private.text_key(v), s.code
  FROM public.partner_specialties s, LATERAL (VALUES (s.label_fr), (s.label_en), (replace(s.code, '_', ' '))) x(v)
ON CONFLICT (alias_key) DO NOTHING;
INSERT INTO public.partner_specialty_aliases (alias_key, code)
SELECT private.text_key(a), c FROM (VALUES
  ('talent', 'talent_management'), ('talents', 'talent_management'), ('management', 'talent_management'),
  ('gestion de talent', 'talent_management'), ('agent', 'talent_management'), ('manager', 'talent_management'),
  ('strategie', 'content_strategy'), ('strategie digitale', 'content_strategy'), ('contenu', 'content_strategy'), ('content', 'content_strategy'),
  ('video', 'video_production'), ('videos', 'video_production'), ('montage', 'video_production'), ('videaste', 'video_production'),
  ('photo', 'photography'), ('photos', 'photography'), ('photographe', 'photography'),
  ('reseaux sociaux', 'social_media_management'), ('social media', 'social_media_management'),
  ('community management', 'social_media_management'), ('community manager', 'social_media_management'),
  ('influence', 'influencer_campaigns'), ('influenceur', 'influencer_campaigns'), ('influenceurs', 'influencer_campaigns'),
  ('marketing d influence', 'influencer_campaigns'), ('influencer marketing', 'influencer_campaigns'),
  ('user generated content', 'ugc'), ('partenariat', 'brand_partnerships'), ('partenariats', 'brand_partnerships'),
  ('evenementiel', 'event_coverage'), ('evenements', 'event_coverage'), ('events', 'event_coverage'),
  ('musique', 'music_entertainment'), ('music', 'music_entertainment'), ('divertissement', 'music_entertainment'),
  ('mode', 'fashion_beauty'), ('beaute', 'fashion_beauty'), ('fashion', 'fashion_beauty'), ('beauty', 'fashion_beauty'),
  ('food', 'food_hospitality'), ('restauration', 'food_hospitality'), ('hotellerie', 'food_hospitality'), ('gastronomie', 'food_hospitality'),
  ('tech', 'tech_fintech'), ('fintech', 'tech_fintech'), ('technologie', 'tech_fintech'),
  ('ong', 'ngo_impact'), ('ngo', 'ngo_impact'), ('impact social', 'ngo_impact')) a(a, c)
ON CONFLICT (alias_key) DO NOTHING;

ALTER TABLE public.partner_specialties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_specialty_aliases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.partner_specialties, public.partner_specialty_aliases FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.partner_specialties TO anon, authenticated;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='partner_specialties' AND policyname='specialties are public') THEN
    CREATE POLICY "specialties are public" ON public.partner_specialties FOR SELECT USING (true);
  END IF;
END $$;

-- Free text → code (NULL when unknown). Used by the 0040 mapping and by the admin read model.
CREATE OR REPLACE FUNCTION private.specialty_code_for(p_value text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce((SELECT s.code FROM public.partner_specialties s WHERE s.code = btrim(p_value) AND s.active),
                  (SELECT a.code FROM public.partner_specialty_aliases a JOIN public.partner_specialties s ON s.code = a.code
                    WHERE a.alias_key = private.text_key(p_value) AND s.active));
$$;
REVOKE ALL ON FUNCTION private.specialty_code_for(text) FROM PUBLIC, anon, authenticated;

-- ── G2: listing columns + guard ──────────────────────────────────────────────
ALTER TABLE public.consultant_profiles
  ADD COLUMN IF NOT EXISTS specialties_legacy text[],
  ADD COLUMN IF NOT EXISTS directory_listed boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS listing_reason text,
  ADD COLUMN IF NOT EXISTS listing_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS listing_changed_by uuid REFERENCES public.profiles(id);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.consultant_profiles'::regclass AND conname='consultant_listing_reason_len') THEN
    ALTER TABLE public.consultant_profiles ADD CONSTRAINT consultant_listing_reason_len CHECK (listing_reason IS NULL OR char_length(listing_reason) <= 500);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS consultant_profiles_listing_changed_by_idx ON public.consultant_profiles (listing_changed_by);
GRANT SELECT (directory_listed) ON public.consultant_profiles TO anon, authenticated;

-- 0016 body + the new admin-owned columns.
CREATE OR REPLACE FUNCTION private.guard_consultant_profiles()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.agency_access := false;
      NEW.directory_listed := true; NEW.listing_reason := NULL; NEW.listing_changed_at := NULL; NEW.listing_changed_by := NULL;
      NEW.specialties_legacy := NULL;
    ELSE
      NEW.agency_access := OLD.agency_access;
      NEW.directory_listed := OLD.directory_listed; NEW.listing_reason := OLD.listing_reason;
      NEW.listing_changed_at := OLD.listing_changed_at; NEW.listing_changed_by := OLD.listing_changed_by;
      NEW.specialties_legacy := OLD.specialties_legacy;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- A member whose only public role is partner and who is delisted is not publicly readable.
CREATE OR REPLACE FUNCTION private.is_hidden_partner(p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.consultant_profiles kp WHERE kp.user_id = p_user_id AND NOT kp.directory_listed)
     AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p_user_id AND ur.role = 'creator');
$$;
REVOKE ALL ON FUNCTION private.is_hidden_partner(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_hidden_partner(uuid) TO anon, authenticated, service_role;

ALTER POLICY "public profiles are readable" ON public.profiles USING (
  status = 'active'
  AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = profiles.id AND ur.role IN ('creator', 'consultant'))
  AND NOT private.is_hidden_partner(profiles.id)
);
ALTER POLICY "public read active consultant profiles" ON public.consultant_profiles USING (
  directory_listed AND EXISTS (
    SELECT 1 FROM public.profiles p JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'consultant'
     WHERE p.id = consultant_profiles.user_id AND p.status = 'active')
);

-- ── G2: conversation freeze / window ─────────────────────────────────────────
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS frozen_at timestamptz,
  ADD COLUMN IF NOT EXISTS frozen_reason text,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.conversations'::regclass AND conname='conversations_frozen_reason') THEN
    ALTER TABLE public.conversations ADD CONSTRAINT conversations_frozen_reason
      CHECK (frozen_reason IS NULL OR frozen_reason IN ('member_suspended', 'assignment_ended', 'admin'));
  END IF;
END $$;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS masked_kinds text[];

-- Suspension freezes every thread of the member; reactivation lifts the freezes it caused.
CREATE OR REPLACE FUNCTION private.freeze_on_suspension()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.status = 'suspended' AND OLD.status IS DISTINCT FROM 'suspended' THEN
    UPDATE public.conversations SET frozen_at = now(), frozen_reason = 'member_suspended'
     WHERE (business_id = NEW.id OR counterparty_id = NEW.id) AND frozen_at IS NULL;
  ELSIF OLD.status = 'suspended' AND NEW.status IS DISTINCT FROM 'suspended' THEN
    UPDATE public.conversations c SET frozen_at = NULL, frozen_reason = NULL
     WHERE (c.business_id = NEW.id OR c.counterparty_id = NEW.id) AND c.frozen_reason = 'member_suspended'
       AND NOT EXISTS (SELECT 1 FROM public.profiles o
                        WHERE o.id = CASE WHEN c.business_id = NEW.id THEN c.counterparty_id ELSE c.business_id END
                          AND o.status = 'suspended');
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION private.freeze_on_suspension() FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE TRIGGER trg_freeze_on_suspension AFTER UPDATE OF status ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION private.freeze_on_suspension();

-- ── G7: consents ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.member_consents (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES public.profiles(id),
  kind       text NOT NULL,
  version    text NOT NULL,
  context_id uuid,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT member_consents_kind CHECK (kind IN ('cgu_non_circumvention', 'contact_request')),
  CONSTRAINT member_consents_version CHECK (version ~ '^[A-Za-z0-9._-]{1,20}$')
);
CREATE INDEX IF NOT EXISTS member_consents_user_idx ON public.member_consents (user_id, kind, created_at DESC);
ALTER TABLE public.member_consents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.member_consents FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.member_consents TO authenticated;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='member_consents' AND policyname='own or admin reads consents') THEN
    CREATE POLICY "own or admin reads consents" ON public.member_consents FOR SELECT TO authenticated
      USING (user_id = (SELECT auth.uid()) OR private.is_admin((SELECT auth.uid())));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.record_consent(p_kind text, p_version text, p_context_id uuid DEFAULT NULL)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id bigint;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_kind IS DISTINCT FROM 'cgu_non_circumvention' THEN RAISE EXCEPTION 'invalid_kind'; END IF;   -- others recorded by their RPC
  IF p_version IS NULL OR p_version !~ '^[A-Za-z0-9._-]{1,20}$' THEN RAISE EXCEPTION 'invalid_version'; END IF;
  INSERT INTO public.member_consents (user_id, kind, version, context_id) VALUES (auth.uid(), p_kind, p_version, p_context_id)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.my_consents()
RETURNS TABLE (kind text, version text, context_id uuid, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT DISTINCT ON (c.kind) c.kind, c.version, c.context_id, c.created_at
    FROM public.member_consents c WHERE c.user_id = auth.uid()
   ORDER BY c.kind, c.created_at DESC, c.id DESC;
$$;

CREATE OR REPLACE FUNCTION private.require_consent(p_kind text, p_version text, p_context uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_version IS NULL OR p_version !~ '^[A-Za-z0-9._-]{1,20}$' THEN RAISE EXCEPTION 'consent_required'; END IF;
  INSERT INTO public.member_consents (user_id, kind, version, context_id) VALUES (auth.uid(), p_kind, p_version, p_context);
END;
$$;
REVOKE ALL ON FUNCTION private.require_consent(text, text, uuid) FROM PUBLIC, anon, authenticated;

-- ── G5: masking ──────────────────────────────────────────────────────────────
-- Markers shown to users: « [numéro masqué] », « [e-mail masqué] », « [lien masqué] », « [compte masqué] ».
-- kinds: phone | email | messaging_link | social_handle. Pure function (no I/O). When nothing is masked the
-- input is returned unchanged; otherwise the text is NFKC-normalised (full-width digits / ＠), Unicode spaces
-- become spaces and zero-width characters are removed.
-- QA corpora (t38: corpus 105 + corpus2 40 + bypass 20): 0 leaks; 1 accepted false positive (bare 10-digit
-- reference « Réf 2026101409 »: indistinguishable from an unformatted CI/NG/KE/ZA number).
CREATE OR REPLACE FUNCTION private.mask_contacts(p_text text, OUT body text, OUT kinds text[], OUT hits integer)
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE
  v text := coalesce(p_text, '');
  sh text; m text; d text; pre text; post text; c integer; p integer; pos0 integer; skip boolean;
  t text; part text; est integer; words integer; maxgrp integer; tens boolean; units integer;
  -- building blocks
  soc  constant text := '(?:instagram|insta|ig|tiktok|tik tok|snapchat|snap|facebook|fb|twitter|telegram|linkedin|threads)';
  hnd  constant text := '@?[A-Za-z0-9_][A-Za-z0-9_.]{0,28}[A-Za-z0-9_]';                                    -- any handle
  hlk  constant text := '@?(?=[A-Za-z0-9_.]*[A-Za-z])[A-Za-z0-9_.]*[_.0-9][A-Za-z0-9_.]*[A-Za-z0-9_]';       -- handle-like (has _ . or digit, and a letter)
  cue  constant text := '(?:c''est|c’est|c est|:|=|->|→)';
  loc  constant text := '[A-Za-z0-9._%+-]+(?:(?:\s+(?:dot|point)\s+|\s*[\[\(\{]\s*(?:dot|point)\s*[\]\)\}]\s*)[A-Za-z0-9_%+-]+)*';
  ats  constant text := '(?:\s*@\s*|\s*[\[\(\{]\s*(?:at|arobase)\s*[\]\)\}]\s*|\s+(?:at|arobase)\s+)';
  dts  constant text := '(?:\s*\.\s*|\s*[\[\(\{]\s*(?:dot|point)\s*[\]\)\}]\s*|\s+(?:dot|point)\s+)';
  prov constant text := '(?:gmail|googlemail|yahoo|ymail|outlook|hotmail|live|icloud|aol|protonmail|proton)';
  numw constant text := '(?:zéro|zero|une|un|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|treize|quatorze|quinze|seize|vingts|vingt|trente|quarante|cinquante|soixante|septante|huitante|octante|nonante|cents|cent|one|two|three|four|five|seven|eight|nine)';
  re   text;
  -- currency markers (QA PG-9): multi-letter words exempt amount-shaped runs; one-character markers only < 9 digits
  cur_post constant text := '(?i)^\s*(f\s?cfa|fcfa|cfa|xaf|xof|francs?|naira|ngn|ksh|kes|shillings?|rands?|zar|usd|eur|euros?|f|r|€|\$|₦|%)(?![A-Za-z0-9])';
  cur_pre  constant text := '(?i)(?:^|[^A-Za-z0-9])(fcfa|cfa|xaf|xof|ngn|ksh|kes|zar|usd|eur|r|₦|€|\$)\s*$';
  phone_words     constant text[] := ARRAY['TEL','TELE','WA','WAPP','WHATS','WHATSAPP','NUM','NUMERO','NO','PHONE','MOB','MOBILE','CELL','GSM','CALL','APPEL','SMS','CONTACT','MTN','ORANGE','MOMO','OM'];
  mob9 boolean; intl boolean; amount_shape boolean; multi_cur boolean; single_cur boolean; tok text; tokname text;
  plain boolean; grouped boolean; grp text[]; g text; shp text; mk text; mkp text; rng boolean; gg text[]; gd text; rparts text[]; dsp text;
  -- (few distinct regexes on purpose: PostgreSQL caches 32 compiled regexes per backend; the per-match checks
  --  below use translate()/string functions so the cache is not thrashed)
BEGIN
  kinds := '{}'; hits := 0;
  -- 0. NFKC (full-width digits and ＠ → ASCII, QA PG-11), then Unicode spaces → space, zero-width characters removed
  v := normalize(v, NFKC);
  v := translate(v, '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789');   -- Arabic-Indic / Persian digits
  v := translate(v, chr(160) || chr(8199) || chr(8239) || chr(8192) || chr(8193) || chr(8194) || chr(8195) || chr(8196) || chr(8197)
                    || chr(8198) || chr(8200) || chr(8201) || chr(8202) || chr(8287) || chr(12288) || chr(9)
                    || chr(8203) || chr(8204) || chr(8205) || chr(8288) || chr(65279) || chr(65039) || chr(8419),   -- + emoji keycap marks U+FE0F / U+20E3 (PG-13)
                 '                ');

  -- 1. messaging links (the trailing , ; : . ! ? ) » " ' stays outside the marker)
  re := '(?<![A-Za-z0-9])(?:https?://)?(?:www\.)?(?:wa\s*(?:\.|\s(?:dot|point)\s)\s*(?:me|link)|walink\.co|api\.whatsapp\.com|chat\.whatsapp\.com|whatsapp\.com/(?:send|channel|catalog|message|dl)|whatsapp\.(?:me|link|to)|t\.me|telegram\.me)'
        || '(?:\s*(?:/|\sslash\s)\s*(?:[^\s,;)»"]*[^\s,;:.!?)»"''])?)?';
  c := 0;
  IF v ~* '(wa|walink|whatsapp|t|telegram)\s*(\.|\s(dot|point)\s)\s*(me|com|link|co|to)' THEN SELECT count(*) INTO c FROM regexp_matches(v, re, 'gi'); END IF;   -- cheap pre-check
  IF c > 0 THEN v := regexp_replace(v, re, '[lien masqué]', 'gi'); kinds := kinds || 'messaging_link'::text; hits := hits + c; END IF;

  -- 2. social profile URLs
  re := '(?<![A-Za-z0-9.])(?:https?://)?(?:www\.)?(?:instagram\.com|tiktok\.com|facebook\.com|fb\.me|fb\.com|snapchat\.com|twitter\.com|x\.com|linkedin\.com/in)/(?:[^\s,;)»"]*[^\s,;:.!?)»"''])?';
  c := 0;
  IF v ~* '\.(com|me)/' THEN SELECT count(*) INTO c FROM regexp_matches(v, re, 'gi'); END IF;
  IF c > 0 THEN v := regexp_replace(v, re, '[compte masqué]', 'gi'); kinds := kinds || 'social_handle'::text; hits := hits + c; END IF;

  -- 3. e-mails: standard and spelled (@, (at), [at], arobase, AT … ., (dot), [dot], point, DOT)
  FOR re, t IN VALUES
      (loc || ats || '[A-Za-z0-9-]+(?:' || dts || '[A-Za-z]{2,})+', 'gi'),
      ('[A-Za-z0-9._-]*[a-z0-9_][A-Za-z0-9._-]*AT[A-Za-z0-9-]+DOT[A-Za-z]{2,}', 'g'),          -- jeanATgmailDOTcom (case-sensitive)
      (loc || ats || prov || '(?![A-Za-z0-9])', 'gi'),                                          -- jean@gmail (no TLD)
      ('(?<![A-Za-z0-9._%+-])(?!(?:je|j|tu|il|elle|on|nous|vous|ils|elles|suis|es|est|sommes|sont|mail|mails|compte|moi|toi|lui|leur|tout|message|messages|ecris|écris|envoie|envoyez|contacte|contactez)\s)'
         || '[A-Za-z0-9._%+-]*[A-Za-z0-9_][A-Za-z0-9._%+-]*\s+(?:sur|chez|on)\s+' || prov || '(?![A-Za-z0-9])', 'gi')   -- « jean_d sur gmail »
  LOOP
    EXIT WHEN v !~* ('@|\mat\M|arobase|AT|' || prov);   -- cheap pre-check
    SELECT count(*) INTO c FROM regexp_matches(v, re, t);
    IF c > 0 THEN v := regexp_replace(v, re, '[e-mail masqué]', t); kinds := kinds || 'email'::text; hits := hits + c; END IF;
  END LOOP;

  -- 4. social handles: « insta : x », « mon insta c'est x », « mon @ sur insta : x », « sur tiktok jean.promo »,
  --    « jean_promo sur insta », « @x »
  FOR re IN VALUES
      ('(?<![A-Za-z0-9])' || soc || '\s*[:=]\s*' || hnd),
      ('(?<![A-Za-z0-9])(?:mon|ma|my|notre)\s+(?:compte\s+)?(?:@\s+(?:sur|on)\s+)?' || soc || '\s*' || cue || '\s*' || hnd),
      ('(?<![A-Za-z0-9])(?:mon|ma|my|notre)\s+(?:compte\s+)?(?:@\s+(?:sur|on)\s+)?' || soc || '\s+' || hlk),
      ('(?<![A-Za-z0-9])(?:sur|on|via)\s+' || soc || '\s*' || cue || '?\s*' || hlk),
      ('(?<![A-Za-z0-9_.@])' || hlk || '\s+(?:sur|on)\s+' || soc || '(?![A-Za-z0-9])')
  LOOP
    EXIT WHEN v !~* soc;   -- cheap pre-check
    SELECT count(*) INTO c FROM regexp_matches(v, re, 'gi');
    IF c > 0 THEN v := regexp_replace(v, re, '[compte masqué]', 'gi'); kinds := kinds || 'social_handle'::text; hits := hits + c; END IF;
  END LOOP;
  re := '(^|[^A-Za-z0-9_@])@[A-Za-z0-9_][A-Za-z0-9_.]{0,28}[A-Za-z0-9_]';
  c := 0;
  IF position('@' IN v) > 0 THEN SELECT count(*) INTO c FROM regexp_matches(v, re, 'g'); END IF;
  IF c > 0 THEN v := regexp_replace(v, re, '\1[compte masqué]', 'g'); kinds := kinds || 'social_handle'::text; hits := hits + c; END IF;

  -- 5. spelled-out numbers: a run of ≥ 4 number words / short digit groups worth ≥ 8 digits (« zéro six
  --    soixante-dix-sept douze… », « six sept sept un deux… », « 06 sept 7 12 34 56 »)
  re := '(?<![A-Za-zÀ-ÿ0-9])(?:' || numw || '(?:-(?:et-)?' || numw || ')*|\d{1,4})(?:[ .,/\-]+(?:' || numw || '(?:-(?:et-)?' || numw || ')*|\d{1,4})){3,}(?![A-Za-zÀ-ÿ0-9])';
  pos0 := CASE WHEN v ~* ('(?<![A-Za-zÀ-ÿ])' || numw || '[ .,/\-]+(?:' || numw || '|\d)') THEN 1 ELSE length(v) + 1 END;   -- cheap pre-check
  LOOP
    m := substring(substr(v, pos0) FROM re);
    EXIT WHEN m IS NULL OR m = '';
    p := pos0 - 1 + position(m IN substr(v, pos0));
    est := 0; words := 0; maxgrp := 0;
    FOREACH t IN ARRAY string_to_array(translate(lower(m), '.,/', '   '), ' ') LOOP
      CONTINUE WHEN t = '' OR t = '-';
      IF translate(t, '0123456789', '') = '' THEN est := est + length(t); maxgrp := greatest(maxgrp, length(t));
      ELSIF translate(t, '0123456789-', '') = '' THEN est := est + length(replace(t, '-', '')); maxgrp := greatest(maxgrp, 4);
      ELSE
        tens := false; units := 0;
        FOREACH part IN ARRAY string_to_array(t, '-') LOOP
          CONTINUE WHEN part IN ('', 'et');
          IF translate(part, '0123456789', '') = '' THEN est := est + length(part); maxgrp := greatest(maxgrp, length(part));
          ELSIF part = ANY (ARRAY['dix','onze','douze','treize','quatorze','quinze','seize','vingt','vingts','trente','quarante','cinquante',
                                  'soixante','septante','huitante','octante','nonante']) THEN tens := true;
          ELSIF part IN ('cent', 'cents') THEN units := units + 3;
          ELSE units := units + 1; END IF;
        END LOOP;
        IF tens THEN est := est + 2; words := words + 1; ELSE est := est + units; words := words + greatest(units, 1); END IF;
      END IF;
    END LOOP;
    post := substr(v, p + length(m), 12);
    IF est >= 8 AND words >= 1 AND (words >= 2 OR maxgrp <= 2) THEN   -- no currency exemption for spelled runs (PG-9)
      v := overlay(v PLACING '[numéro masqué]' FROM p FOR length(m));
      hits := hits + 1; kinds := kinds || 'phone'::text;
      pos0 := p + length('[numéro masqué]');
    ELSE
      pos0 := p + greatest(position(' ' IN m), 1);   -- retry from the next token
    END IF;
  END LOOP;

  -- 6. phones: 8–15 digits, optional + / 00, separators space . - / ( ) (up to 3 between digits). Detection runs on a
  --    length-preserving shadow where l/I/| and o/O touching a digit read as 1 / 0 (« 677 l2 34 56 »).
  --    Mobile-shaped 9-digit runs (6/2/7/1 + 8 digits, plain or 3-3-3 with space/dot: CM/GA/KE) are phones even
  --    next to a currency; only a grouped « … 000 000 » (plain only with a currency) is an amount (QA PG-9/10/13).
  --    Other runs are amounts when thousands-grouped, or amount-shaped (plain / 3-digit groups, no + / 00 / country
  --    code, no leading 0, no - / ( ) and no 2-digit groups) next to a currency word (one-character markers F R € $ ₦ % only below
  --    9 digits). Also not phones: UPPERCASE « REF-2026-… » references (never TEL-/WA-…), « CMD 2026 1014 »
  --    year-led order references, year pairs (2025 2026, 2026-2027) and real dates.
  IF length(translate(v, '0123456789', '')) = length(v) THEN   -- no digit at all: nothing left to find
    IF hits = 0 THEN body := coalesce(p_text, ''); kinds := '{}'; RETURN; END IF;
    SELECT array_agg(DISTINCT k ORDER BY k) INTO kinds FROM unnest(kinds) k; body := v; RETURN;
  END IF;
  sh := v;
  -- one cheap scan decides whether the shadow needs rewriting (confusables or unusual separators next to a digit)
  IF v ~ '\d[lIoO|]|[lIoO|]\d|\d ?[^0-9A-Za-zÀ-ɏ .,:/+()€$₦%–—-]|[^0-9A-Za-zÀ-ɏ .,:/+()€$₦%–—-] ?\d' THEN
    sh := regexp_replace(sh, '(\d)[lI|]', '\11', 'g');
    sh := regexp_replace(sh, '[lI|](\d)', '1\1', 'g');
    sh := regexp_replace(sh, '(\d)[oO]', '\10', 'g');
    sh := regexp_replace(sh, '[oO](\d)', '0\1', 'g');
    -- PG-13: every other non-alphanumeric character (• _ * # emoji…) reads as a space (length-preserving)
    sh := regexp_replace(sh, '[^0-9A-Za-zÀ-ɏ .,:/+()€$₦%–—-]', ' ', 'g');
  END IF;
  -- PG-13: up to 3 separators between digits: space . , : / - – — ( ) (every other non-alphanumeric character is
  --        already a space in the shadow)
  re := '\(?(?:\+|(?<![0-9])00)?\(?\d(?:[ .,:/()–—-]{0,3}\d){7,14}(?!\d)';
  pos0 := 1;
  LOOP
    m := substring(substr(sh, pos0) FROM re);
    EXIT WHEN m IS NULL OR m = '';
    p := pos0 - 1 + position(m IN substr(sh, pos0));
    -- m holds digits and the separators of the class above only (the shadow turned anything else into spaces)
    d := translate(m, ' .,:/()+–—-', '');
    shp := translate(translate(m, './-', '///'), '0123456789', '9999999999');
    skip := length(d) < 8;
    -- dates, year pairs, times first (cheap, string functions only)
    IF NOT skip AND shp IN ('99/99/9999', '9/99/9999', '99/9/9999', '9/9/9999', '9999/99/99', '9999/9/99', '9999/99/9', '9999/9/9',
                            '9999/9999', '9999 9999', '9999 / 9999', '9999 /9999', '9999/ 9999') THEN
      gd := translate(m, './- ', '////');
      IF shp LIKE '9999/9999' OR shp LIKE '9999 %' OR shp LIKE '9999 /%' OR shp LIKE '9999/ %' THEN
        skip := left(d, 2) IN ('19', '20') AND substr(d, 5, 2) IN ('19', '20');                          -- 2025 2026, 2026-2027
      ELSIF length(split_part(gd, '/', 1)) = 4 THEN
        skip := left(d, 2) IN ('19', '20') AND split_part(gd, '/', 2)::int BETWEEN 1 AND 12 AND split_part(gd, '/', 3)::int BETWEEN 1 AND 31;
      ELSE
        skip := left(split_part(gd, '/', 3), 2) IN ('19', '20') AND split_part(gd, '/', 1)::int BETWEEN 1 AND 31 AND split_part(gd, '/', 2)::int BETWEEN 1 AND 12;
      END IF;
    END IF;
    IF NOT skip AND position(':' IN m) > 0 AND length(d) <= 8 AND position('999' IN shp) = 0 AND left(m, 1) NOT IN ('+', '(') THEN
      skip := true;                                                                                           -- 08:00-17:00
    END IF;
    IF NOT skip THEN
      pre := substr(sh, greatest(1, p - 12), p - greatest(1, p - 12));
      post := substr(sh, p + length(m), 12);
      plain := (m = d);
      intl := left(ltrim(m, '('), 1) = '+' OR left(ltrim(m, '('), 2) = '00'
              OR (length(d) >= 11 AND (left(d, 3) IN ('237', '225', '241', '234', '254') OR left(d, 2) = '27'));
      -- grouped = 1–3 digits then groups of exactly 3, one separator kind (space, dot or comma)
      grouped := false;
      IF NOT plain AND translate(m, '0123456789 .,', '') = ''
         AND (position(' ' IN m) > 0)::int + (position('.' IN m) > 0)::int + (position(',' IN m) > 0)::int = 1 THEN
        grp := string_to_array(translate(m, '.,', '  '), ' ');
        grouped := length(grp[1]) BETWEEN 1 AND 3;
        FOR c IN 2 .. cardinality(grp) LOOP grouped := grouped AND length(grp[c]) = 3; END LOOP;
      END IF;
      mob9 := length(d) = 9 AND left(d, 1) IN ('6', '2', '7', '1') AND (plain OR (grouped AND cardinality(grp) = 3 AND length(grp[1]) = 3));
      IF mob9 THEN
        IF right(d, 6) = '000000' THEN                                                                        -- 150 000 000 de vues
          mk := lower(substring(post FROM cur_post)); mkp := lower(substring(pre FROM cur_pre));
          skip := NOT plain OR mk IS NOT NULL OR mkp IS NOT NULL;                                             -- plain « 690000000 » stays a phone
        END IF;
      ELSIF NOT intl AND left(d, 1) <> '0' THEN
        IF grouped THEN
          skip := true;                                                                                       -- thousands-grouped amount (PG-14: never 0-led)
        ELSE
          IF plain THEN
            mk := lower(substring(post FROM cur_post)); mkp := lower(substring(pre FROM cur_pre));
            skip := (mk IS NOT NULL AND (length(mk) > 1 AND mk NOT IN ('€', '$', '₦', '%') OR length(d) < 9))
                 OR (mkp IS NOT NULL AND (length(mkp) > 1 OR length(d) < 9));                                 -- 150000000 FCFA, 45000000 F
          END IF;
          IF NOT skip AND (position('-' IN m) > 0 OR position('–' IN m) > 0 OR position('—' IN m) > 0 OR position('/' IN m) > 0) THEN
            -- amount ranges « 200 000 – 300 000 FCFA »: every part a thousands-grouped amount (no leading 0, not mobile-shaped)
            rparts := string_to_array(translate(m, '–—/', '---'), '-');
            rng := cardinality(rparts) >= 2;
            FOREACH g IN ARRAY rparts LOOP
              EXIT WHEN NOT rng;
              g := btrim(g); gd := translate(g, ' .,', '');
              gg := string_to_array(translate(g, '.,', '  '), ' ');
              rng := translate(g, '0123456789 .,', '') = '' AND cardinality(gg) >= 2 AND left(gd, 1) <> '0'
                     AND length(gg[1]) BETWEEN 1 AND 3
                     AND NOT (length(gd) = 9 AND left(gd, 1) IN ('6', '2', '7', '1') AND right(gd, 6) <> '000000');
              FOR c IN 2 .. coalesce(cardinality(gg), 1) LOOP rng := rng AND length(gg[c]) = 3; END LOOP;
            END LOOP;
            skip := rng;
          END IF;
          IF NOT skip AND right(pre, 1) IN ('-', ' ') THEN
            tok := substring(pre FROM '(?:^|[^A-Za-z])([A-Z]{2,}(?:-|\s+))$');
            tokname := btrim(tok, ' -');
            IF tok IS NOT NULL AND NOT (tokname = ANY (phone_words)) THEN
              skip := right(tok, 1) = '-'                                                                     -- SOKO-2026-000123
                   OR (left(shp, 5) = '9999 ' AND length(shp) BETWEEN 7 AND 11 AND translate(substr(shp, 6), '9', '') = ''
                       AND left(d, 2) IN ('19', '20'));                                                         -- CMD 2026 1014
            END IF;
          END IF;
        END IF;
      END IF;
    END IF;
    -- a run that starts with a real date (« 12/11/2026 – 13/11/2026 »): step over the date and look again
    IF NOT skip AND length(shp) > 10 AND position('/' IN left(shp, 5)) > 0 THEN
      FOREACH g IN ARRAY ARRAY['99/99/9999', '9/99/9999', '99/9/9999', '9/9/9999', '9999/99/99', '9999/9/99', '9999/99/9', '9999/9/9'] LOOP
        CONTINUE WHEN left(shp, length(g)) <> g OR substr(shp, length(g) + 1, 1) = '9';
        gd := translate(left(m, length(g)), './-', '///');
        IF (length(split_part(gd, '/', 1)) = 4 AND left(gd, 2) IN ('19', '20')
            AND split_part(gd, '/', 2)::int BETWEEN 1 AND 12 AND split_part(gd, '/', 3)::int BETWEEN 1 AND 31)
           OR (length(split_part(gd, '/', 3)) = 4 AND left(split_part(gd, '/', 3), 2) IN ('19', '20')
            AND split_part(gd, '/', 1)::int BETWEEN 1 AND 31 AND split_part(gd, '/', 2)::int BETWEEN 1 AND 12) THEN
          skip := true; m := left(m, length(g));   -- resume right after the date
        END IF;
        EXIT;
      END LOOP;
    END IF;
    IF skip THEN
      pos0 := p + length(m);
    ELSE
      v  := overlay(v  PLACING '[numéro masqué]' FROM p FOR length(m));
      sh := overlay(sh PLACING '[numéro masqué]' FROM p FOR length(m));
      hits := hits + 1; kinds := kinds || 'phone'::text;
      pos0 := p + length('[numéro masqué]');
    END IF;
  END LOOP;

  IF hits = 0 THEN body := coalesce(p_text, ''); kinds := '{}'; RETURN; END IF;
  SELECT array_agg(DISTINCT k ORDER BY k) INTO kinds FROM unnest(kinds) k;
  body := v;
END;
$$;
REVOKE ALL ON FUNCTION private.mask_contacts(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.pair_has_funded_retainer(p_brand uuid, p_partner uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.agency_retainers r
                  WHERE r.business_id = p_brand AND r.consultant_id = p_partner AND r.status IN ('funded', 'active', 'completed'));
$$;
REVOKE ALL ON FUNCTION private.pair_has_funded_retainer(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- G5 scope: brand↔partner threads (assignment or retainer) without a funded retainer for that pair.
CREATE OR REPLACE FUNCTION private.masking_applies(p_conversation_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT c.context_type IN ('partner_assignment', 'retainer') AND NOT private.pair_has_funded_retainer(c.business_id, c.counterparty_id)
    FROM public.conversations c WHERE c.id = p_conversation_id;
$$;
REVOKE ALL ON FUNCTION private.masking_applies(uuid) FROM PUBLIC, anon, authenticated;

-- ── G3 / G4 tables ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.partner_contact_requests (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id              uuid NOT NULL REFERENCES public.profiles(id),
  partner_id            uuid NOT NULL REFERENCES public.profiles(id),
  goal                  text NOT NULL,
  budget_range          text,
  deadline              date,
  masked_kinds          text[],
  status                text NOT NULL DEFAULT 'pending',
  decision_reason_code  text,
  decision_message      text,
  decided_by            uuid REFERENCES public.profiles(id),
  decided_at            timestamptz,
  assignment_id         uuid,
  created_at            timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT pcr_status CHECK (status IN ('pending', 'approved', 'declined', 'withdrawn', 'closed', 'expired')),
  CONSTRAINT pcr_reason CHECK (decision_reason_code IS NULL OR decision_reason_code IN
    ('incomplete', 'brand_unverified', 'poor_fit', 'suspected_offplatform', 'other')),
  CONSTRAINT pcr_lengths CHECK (char_length(goal) BETWEEN 1 AND 400 AND coalesce(char_length(budget_range), 0) <= 60
                                AND coalesce(char_length(decision_message), 0) <= 500),
  CONSTRAINT pcr_not_self CHECK (brand_id <> partner_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS pcr_one_open_per_pair ON public.partner_contact_requests (brand_id, partner_id) WHERE status IN ('pending', 'approved');
CREATE INDEX IF NOT EXISTS pcr_partner_idx ON public.partner_contact_requests (partner_id);
CREATE INDEX IF NOT EXISTS pcr_decided_by_idx ON public.partner_contact_requests (decided_by);
CREATE INDEX IF NOT EXISTS pcr_pending_idx ON public.partner_contact_requests (created_at) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS public.partner_assignments (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id         uuid NOT NULL REFERENCES public.profiles(id),
  brand_id           uuid NOT NULL REFERENCES public.profiles(id),
  campaign_id        uuid REFERENCES public.campaigns(id),
  origin             text NOT NULL,
  contact_request_id uuid REFERENCES public.partner_contact_requests(id),
  status             text NOT NULL DEFAULT 'active',
  note               text,
  created_by         uuid REFERENCES public.profiles(id),
  created_at         timestamptz NOT NULL DEFAULT timezone('utc', now()),
  ended_at           timestamptz,
  ended_by           uuid REFERENCES public.profiles(id),
  end_reason         text,
  conversation_id    uuid REFERENCES public.conversations(id),
  CONSTRAINT pa_origin CHECK (origin IN ('admin', 'contact_request', 'legacy_retainer')),
  CONSTRAINT pa_status CHECK (status IN ('active', 'ended')),
  CONSTRAINT pa_lengths CHECK (coalesce(char_length(note), 0) <= 280 AND coalesce(char_length(end_reason), 0) <= 500),
  CONSTRAINT pa_not_self CHECK (brand_id <> partner_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS pa_one_open_per_scope ON public.partner_assignments
  (partner_id, brand_id, coalesce(campaign_id, '00000000-0000-0000-0000-000000000000'::uuid)) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS pa_brand_idx ON public.partner_assignments (brand_id, status);
CREATE INDEX IF NOT EXISTS pa_campaign_idx ON public.partner_assignments (campaign_id);
CREATE INDEX IF NOT EXISTS pa_request_idx ON public.partner_assignments (contact_request_id);
CREATE INDEX IF NOT EXISTS pa_created_by_idx ON public.partner_assignments (created_by);
CREATE INDEX IF NOT EXISTS pa_ended_by_idx ON public.partner_assignments (ended_by);
CREATE INDEX IF NOT EXISTS pa_conversation_idx ON public.partner_assignments (conversation_id);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pcr_assignment_fkey') THEN
    ALTER TABLE public.partner_contact_requests ADD CONSTRAINT pcr_assignment_fkey
      FOREIGN KEY (assignment_id) REFERENCES public.partner_assignments(id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS pcr_assignment_idx ON public.partner_contact_requests (assignment_id);

-- P3 « Demander la fin »: the partner asks the admin to end an assignment (the row is the log).
CREATE TABLE IF NOT EXISTS public.assignment_end_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.partner_assignments(id),
  requested_by  uuid NOT NULL REFERENCES public.profiles(id),
  reason        text NOT NULL,
  status        text NOT NULL DEFAULT 'open',
  decided_by    uuid REFERENCES public.profiles(id),
  decided_at    timestamptz,
  decision_note text,
  created_at    timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT aer_status CHECK (status IN ('open', 'accepted', 'dismissed')),
  CONSTRAINT aer_lengths CHECK (char_length(reason) BETWEEN 1 AND 300 AND coalesce(char_length(decision_note), 0) <= 500)
);
CREATE UNIQUE INDEX IF NOT EXISTS aer_one_open_per_assignment ON public.assignment_end_requests (assignment_id) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS aer_open_idx ON public.assignment_end_requests (created_at) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS aer_requested_by_idx ON public.assignment_end_requests (requested_by);
CREATE INDEX IF NOT EXISTS aer_decided_by_idx ON public.assignment_end_requests (decided_by);
ALTER TABLE public.assignment_end_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.assignment_end_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.assignment_end_requests TO authenticated;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='assignment_end_requests' AND policyname='end requests visible to requester and admin') THEN
    CREATE POLICY "end requests visible to requester and admin" ON public.assignment_end_requests FOR SELECT TO authenticated
      USING (requested_by = (SELECT auth.uid()) OR private.is_admin((SELECT auth.uid())));
  END IF;
END $$;

-- ── G5 / G6 flags ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.message_flags (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source             text NOT NULL,
  conversation_id    uuid REFERENCES public.conversations(id),
  message_id         uuid REFERENCES public.messages(id),
  contact_request_id uuid REFERENCES public.partner_contact_requests(id),
  sender_id          uuid REFERENCES public.profiles(id),
  partner_id         uuid REFERENCES public.profiles(id),
  brand_id           uuid REFERENCES public.profiles(id),
  kinds              text[] NOT NULL DEFAULT '{}',
  mask_count         integer NOT NULL DEFAULT 0,
  reported_by        uuid REFERENCES public.profiles(id),
  report_reason      text,
  status             text NOT NULL DEFAULT 'open',
  resolved_by        uuid REFERENCES public.profiles(id),
  resolved_at        timestamptz,
  resolution_note    text,
  created_at         timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT mf_source CHECK (source IN ('auto_mask', 'report')),
  CONSTRAINT mf_status CHECK (status IN ('open', 'resolved')),
  CONSTRAINT mf_kinds CHECK (kinds <@ ARRAY['phone','email','messaging_link','social_handle']::text[]),
  CONSTRAINT mf_lengths CHECK (coalesce(char_length(report_reason), 0) <= 300 AND coalesce(char_length(resolution_note), 0) <= 500)
);
COMMENT ON TABLE public.message_flags IS 'G5/G6: masked-contact and « Signaler » flags. Never stores the original text or the masked values.';
CREATE INDEX IF NOT EXISTS mf_open_idx ON public.message_flags (created_at DESC) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS mf_partner_idx ON public.message_flags (partner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS mf_sender_idx ON public.message_flags (sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS mf_conversation_idx ON public.message_flags (conversation_id);
CREATE INDEX IF NOT EXISTS mf_message_idx ON public.message_flags (message_id);
CREATE INDEX IF NOT EXISTS mf_request_idx ON public.message_flags (contact_request_id);
CREATE INDEX IF NOT EXISTS mf_brand_idx ON public.message_flags (brand_id);
CREATE INDEX IF NOT EXISTS mf_reported_by_idx ON public.message_flags (reported_by);
CREATE INDEX IF NOT EXISTS mf_resolved_by_idx ON public.message_flags (resolved_by);

-- P5: raw original of MASKED messages only. Admin-only store: RLS on with NO policy (deny-all for API roles),
-- no client grant, not added to the supabase_realtime publication, never copied into notifications.
-- message_id has no FK on purpose: the defence-in-depth trigger stores the original BEFORE the message row
-- exists (same transaction, so a failed insert leaves nothing behind).
CREATE TABLE IF NOT EXISTS public.message_originals (
  message_id      uuid PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id),
  sender_id       uuid NOT NULL REFERENCES public.profiles(id),
  original_body   text,
  kinds           text[] NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT timezone('utc', now()),
  purged_at       timestamptz,
  CONSTRAINT mo_kinds CHECK (kinds <@ ARRAY['phone','email','messaging_link','social_handle']::text[] AND cardinality(kinds) > 0),
  CONSTRAINT mo_body_len CHECK (original_body IS NULL OR char_length(original_body) <= 4000),
  CONSTRAINT mo_purge CHECK ((original_body IS NULL) = (purged_at IS NOT NULL))
);
COMMENT ON TABLE public.message_originals IS 'P5: original text of masked messages, admin-only via admin_read_masked_original (logged); text nulled after 90 days.';
CREATE INDEX IF NOT EXISTS mo_purge_idx ON public.message_originals (created_at) WHERE original_body IS NOT NULL;
CREATE INDEX IF NOT EXISTS mo_conversation_idx ON public.message_originals (conversation_id);
CREATE INDEX IF NOT EXISTS mo_sender_idx ON public.message_originals (sender_id);
ALTER TABLE public.message_originals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_originals FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.message_originals FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.store_masked_original(p_message uuid, p_conversation uuid, p_sender uuid, p_original text, p_kinds text[])
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  INSERT INTO public.message_originals (message_id, conversation_id, sender_id, original_body, kinds)
  VALUES (p_message, p_conversation, p_sender, left(p_original, 4000), p_kinds)
  ON CONFLICT (message_id) DO NOTHING;
$$;
REVOKE ALL ON FUNCTION private.store_masked_original(uuid, uuid, uuid, text, text[]) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.purge_masked_originals()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_n integer;
BEGIN
  UPDATE public.message_originals SET original_body = NULL, purged_at = now()
   WHERE original_body IS NOT NULL AND created_at < now() - interval '90 days';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;
REVOKE ALL ON FUNCTION private.purge_masked_originals() FROM PUBLIC, anon, authenticated;

-- daily purge with pg_cron when the extension is installed (Supabase: created in 0001); skipped otherwise.
DO $$
DECLARE v_cron boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') INTO v_cron;
  IF coalesce(v_cron, false) THEN
    EXECUTE $c$SELECT cron.schedule('bayele_purge_masked_originals', '17 3 * * *', 'SELECT private.purge_masked_originals()')$c$;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.self_dealing_flags (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.profiles(id),
  brand_id   uuid NOT NULL REFERENCES public.profiles(id),
  kinds      text[] NOT NULL,
  source     text NOT NULL,
  status     text NOT NULL DEFAULT 'open',
  decided_by uuid REFERENCES public.profiles(id),
  decided_at timestamptz,
  note       text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT sdf_kinds CHECK (kinds <@ ARRAY['phone','payout_number','email']::text[] AND cardinality(kinds) > 0),
  CONSTRAINT sdf_source CHECK (source IN ('assignment', 'contact_request', 'campaign_application', 'retainer')),
  CONSTRAINT sdf_status CHECK (status IN ('open', 'cleared', 'confirmed')),
  CONSTRAINT sdf_note_len CHECK (note IS NULL OR char_length(note) <= 500)
);
CREATE UNIQUE INDEX IF NOT EXISTS sdf_one_open_per_pair ON public.self_dealing_flags (partner_id, brand_id) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS sdf_brand_idx ON public.self_dealing_flags (brand_id);
CREATE INDEX IF NOT EXISTS sdf_decided_by_idx ON public.self_dealing_flags (decided_by);

ALTER TABLE public.partner_contact_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.self_dealing_flags ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.partner_contact_requests, public.partner_assignments, public.message_flags, public.self_dealing_flags FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.partner_contact_requests, public.partner_assignments, public.message_flags, public.self_dealing_flags TO authenticated;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='partner_contact_requests' AND policyname='requests visible to brand partner admin') THEN
    -- the partner sees a request only once it was approved (it becomes an assignment proposal)
    CREATE POLICY "requests visible to brand partner admin" ON public.partner_contact_requests FOR SELECT TO authenticated
      USING (brand_id = (SELECT auth.uid()) OR private.is_admin((SELECT auth.uid()))
             OR (partner_id = (SELECT auth.uid()) AND status IN ('approved', 'closed', 'expired')));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='partner_assignments' AND policyname='assignments visible to parties and admin') THEN
    CREATE POLICY "assignments visible to parties and admin" ON public.partner_assignments FOR SELECT TO authenticated
      USING (brand_id = (SELECT auth.uid()) OR partner_id = (SELECT auth.uid()) OR private.is_admin((SELECT auth.uid())));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='message_flags' AND policyname='admins read message flags') THEN
    CREATE POLICY "admins read message flags" ON public.message_flags FOR SELECT TO authenticated USING (private.is_admin((SELECT auth.uid())));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='self_dealing_flags' AND policyname='admins read self dealing flags') THEN
    CREATE POLICY "admins read self dealing flags" ON public.self_dealing_flags FOR SELECT TO authenticated USING (private.is_admin((SELECT auth.uid())));
  END IF;
END $$;

-- ── G6: self-dealing detection + payout hold ─────────────────────────────────
CREATE OR REPLACE FUNCTION private.self_dealing_kinds(p_partner uuid, p_brand uuid)
RETURNS text[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_kinds text[] := '{}';
  v_brand_phone text := nullif(regexp_replace(coalesce((SELECT phone_e164 FROM public.profiles WHERE id = p_brand), ''), '\D', '', 'g'), '');
  v_partner_phone text := nullif(regexp_replace(coalesce((SELECT phone_e164 FROM public.profiles WHERE id = p_partner), ''), '\D', '', 'g'), '');
  v_payouts text[] := array_remove(ARRAY[
    nullif(regexp_replace(coalesce((SELECT momo_payout_phone_e164 FROM public.consultant_profiles WHERE user_id = p_partner), ''), '\D', '', 'g'), ''),
    nullif(regexp_replace(coalesce((SELECT momo_payout_phone_e164 FROM public.creator_profiles WHERE user_id = p_partner), ''), '\D', '', 'g'), '')], NULL);
  v_partner_emails text[] := array_remove(ARRAY[lower(btrim((SELECT to_jsonb(u) ->> 'email' FROM auth.users u WHERE u.id = p_partner)))], NULL);
  v_brand_emails text[] := array_remove(ARRAY[lower(btrim((SELECT to_jsonb(u) ->> 'email' FROM auth.users u WHERE u.id = p_brand))),
                                              lower(btrim((SELECT billing_email FROM public.business_profiles WHERE user_id = p_brand)))], NULL);
BEGIN
  IF v_brand_phone IS NOT NULL AND v_brand_phone = v_partner_phone THEN v_kinds := v_kinds || 'phone'::text; END IF;
  IF v_brand_phone IS NOT NULL AND v_brand_phone = ANY (v_payouts) THEN v_kinds := v_kinds || 'payout_number'::text; END IF;
  IF v_partner_emails && v_brand_emails THEN v_kinds := v_kinds || 'email'::text; END IF;
  RETURN v_kinds;
END;
$$;
REVOKE ALL ON FUNCTION private.self_dealing_kinds(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.check_self_dealing(p_partner uuid, p_brand uuid, p_source text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_kinds text[]; v_id uuid;
BEGIN
  IF p_partner IS NULL OR p_brand IS NULL OR p_partner = p_brand THEN RETURN NULL; END IF;
  v_kinds := private.self_dealing_kinds(p_partner, p_brand);
  IF cardinality(v_kinds) = 0 THEN RETURN NULL; END IF;
  INSERT INTO public.self_dealing_flags (partner_id, brand_id, kinds, source)
  VALUES (p_partner, p_brand, v_kinds, p_source)
  ON CONFLICT (partner_id, brand_id) WHERE status = 'open' DO NOTHING
  RETURNING id INTO v_id;
  IF v_id IS NOT NULL THEN
    PERFORM private.notify_admins('self_dealing_flagged', 'Lien partenaire–marque à vérifier',
      'Un partenaire et une marque partagent des coordonnées (' || array_to_string(v_kinds, ', ') ||
      '). Les paiements du partenaire sont suspendus jusqu''à votre décision.', '/admin/partners/flags');
  END IF;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION private.check_self_dealing(uuid, uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.partner_payouts_on_hold(p_partner uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.self_dealing_flags WHERE partner_id = p_partner AND status IN ('open', 'confirmed'));
$$;
REVOKE ALL ON FUNCTION private.partner_payouts_on_hold(uuid) FROM PUBLIC, anon, authenticated;

-- commission payout (0027 body) + G6 hold.
CREATE OR REPLACE FUNCTION public.admin_confirm_partner_commission(
  p_commission_id uuid, p_provider public.payment_provider DEFAULT 'mtn_momo', p_disbursement_ref text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_partner uuid; v_status text; v_amount bigint;
BEGIN
  IF NOT private.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF nullif(btrim(coalesce(p_disbursement_ref, '')), '') IS NULL THEN RAISE EXCEPTION 'ref_required'; END IF;
  SELECT partner_id, status, commission_fcfa INTO v_partner, v_status, v_amount
    FROM public.partner_commissions WHERE id = p_commission_id FOR UPDATE;
  IF v_partner IS NULL THEN RAISE EXCEPTION 'commission_not_found'; END IF;
  IF v_status = 'paid' THEN RETURN; END IF;
  IF private.partner_payouts_on_hold(v_partner) THEN RAISE EXCEPTION 'payout_on_hold'; END IF;   -- G6
  UPDATE public.partner_commissions
     SET status = 'paid', provider = p_provider, disbursement_ref = btrim(p_disbursement_ref), paid_at = now()
   WHERE id = p_commission_id;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (v_partner, 'commission_paid', 'Commission versée 💸',
          'Votre commission de ' || v_amount::text || ' FCFA a été envoyée.', '/partner/creators');
END;
$function$;

-- retainer settlement payout (0035 body) + G6 hold on partner payouts.
CREATE OR REPLACE FUNCTION public.admin_confirm_retainer_settlement(
  p_settlement_id uuid, p_provider public.payment_provider DEFAULT 'mtn_momo', p_disbursement_ref text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_recipient uuid; v_status text; v_amount bigint; v_kind text; v_ref text := nullif(btrim(coalesce(p_disbursement_ref, '')), '');
BEGIN
  IF NOT private.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF v_ref IS NULL THEN RAISE EXCEPTION 'ref_required'; END IF;
  SELECT recipient_id, status, amount_fcfa, kind INTO v_recipient, v_status, v_amount, v_kind
    FROM public.retainer_settlements WHERE id = p_settlement_id FOR UPDATE;
  IF v_recipient IS NULL THEN RAISE EXCEPTION 'settlement_not_found'; END IF;
  IF v_status = 'paid' THEN RETURN; END IF;
  IF v_kind = 'partner_payout' AND private.partner_payouts_on_hold(v_recipient) THEN RAISE EXCEPTION 'payout_on_hold'; END IF;   -- G6
  UPDATE public.retainer_settlements
     SET status = 'paid', provider = p_provider, disbursement_ref = v_ref, confirmed_by = auth.uid(), confirmed_at = now()
   WHERE id = p_settlement_id;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (v_recipient, 'retainer_settlement_paid',
          CASE WHEN v_kind = 'partner_payout' THEN 'Paiement envoyé 💸' ELSE 'Remboursement effectué' END,
          CASE WHEN v_kind = 'partner_payout' THEN 'Votre paiement de ' ELSE 'Votre remboursement de ' END ||
            v_amount::text || ' FCFA pour le contrat agence a été envoyé.',
          CASE WHEN v_kind = 'partner_payout' THEN '/partner/retainers' ELSE '/business/retainers' END);
END;
$$;

-- partner applies for a creator (0035 body) + G6 self-dealing check against the campaign's brand.
CREATE OR REPLACE FUNCTION public.partner_apply_for_creator(p_campaign_id uuid, p_creator_id uuid)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_owner uuid; v_status public.campaign_status; v_payout bigint; v_title text; v_owner_role public.user_role;
  v_cc uuid; v_cstatus public.account_status; v_cname text; v_pname text; v_pstatus public.account_status;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT status, display_name INTO v_pstatus, v_pname FROM public.profiles WHERE id = v_actor;
  IF v_pstatus IS DISTINCT FROM 'active' THEN RAISE EXCEPTION 'partner_not_active'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.partner_creator_links
                  WHERE partner_id = v_actor AND creator_id = p_creator_id AND status = 'active') THEN
    RAISE EXCEPTION 'not_representing';
  END IF;
  SELECT status, display_name INTO v_cstatus, v_cname FROM public.profiles WHERE id = p_creator_id;
  IF v_cstatus IS NULL OR v_cstatus IN ('suspended', 'rejected') THEN RAISE EXCEPTION 'profile_not_eligible'; END IF;

  SELECT owner_id, status, payout_per_creator_fcfa, title, owner_role
    INTO v_owner, v_status, v_payout, v_title, v_owner_role
    FROM public.campaigns WHERE id = p_campaign_id FOR UPDATE;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'campaign_not_found'; END IF;
  IF v_owner IN (v_actor, p_creator_id) THEN RAISE EXCEPTION 'cannot_apply_own_campaign'; END IF;
  IF v_status NOT IN ('published', 'in_progress') THEN RAISE EXCEPTION 'campaign_not_open'; END IF;
  IF EXISTS (SELECT 1 FROM public.campaign_creators cc
              WHERE cc.campaign_id = p_campaign_id AND cc.creator_id = p_creator_id) THEN
    RAISE EXCEPTION 'already_applied';
  END IF;

  INSERT INTO public.campaign_creators (campaign_id, creator_id, status, agreed_payout_fcfa, applied_by)
  VALUES (p_campaign_id, p_creator_id, 'applied', v_payout, v_actor)
  RETURNING id INTO v_cc;

  IF v_owner_role <> 'super_admin' THEN PERFORM private.check_self_dealing(v_actor, v_owner, 'campaign_application'); END IF;   -- G6

  INSERT INTO public.notifications (user_id, type, title, body, link) VALUES
    (v_owner, 'campaign_application', 'Nouvelle candidature',
     coalesce(v_pname, 'Un partenaire') || ' a proposé ' || coalesce(v_cname, 'un créateur') || ' pour « ' || v_title || ' ».',
     '/business/campaigns/' || p_campaign_id::text),
    (p_creator_id, 'partner_applied', 'Candidature envoyée pour vous',
     coalesce(v_pname, 'Votre partenaire') || ' a postulé pour vous à « ' || v_title || ' ».',
     '/creator/dashboard');
  RETURN v_cc;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_self_dealing_flags(p_status text DEFAULT 'open')
RETURNS TABLE (id uuid, partner_id uuid, partner_handle text, brand_id uuid, brand_handle text, brand_company text,
               kinds text[], source text, status text, note text, created_at timestamptz, decided_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT private.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  RETURN QUERY
  SELECT f.id, f.partner_id, pp.handle, f.brand_id, bp.handle, b.company_name, f.kinds, f.source, f.status, f.note, f.created_at, f.decided_at
    FROM public.self_dealing_flags f
    JOIN public.profiles pp ON pp.id = f.partner_id JOIN public.profiles bp ON bp.id = f.brand_id
    LEFT JOIN public.business_profiles b ON b.user_id = f.brand_id
   WHERE p_status IS NULL OR f.status = p_status
   ORDER BY f.created_at DESC LIMIT 200;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_decide_self_dealing_flag(p_flag_id uuid, p_decision text, p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_partner uuid; v_status text; v_note text := nullif(btrim(coalesce(p_note, '')), '');
BEGIN
  IF NOT private.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF p_decision IS NULL OR p_decision NOT IN ('cleared', 'confirmed') THEN RAISE EXCEPTION 'invalid_decision'; END IF;
  IF p_decision = 'confirmed' AND v_note IS NULL THEN RAISE EXCEPTION 'note_required'; END IF;
  IF char_length(v_note) > 500 THEN RAISE EXCEPTION 'note_too_long'; END IF;
  SELECT partner_id, status INTO v_partner, v_status FROM public.self_dealing_flags WHERE id = p_flag_id FOR UPDATE;
  IF v_partner IS NULL THEN RAISE EXCEPTION 'flag_not_found'; END IF;
  IF v_status = p_decision THEN RETURN; END IF;
  IF v_status <> 'open' THEN RAISE EXCEPTION 'flag_already_decided'; END IF;
  UPDATE public.self_dealing_flags SET status = p_decision, decided_by = auth.uid(), decided_at = now(), note = v_note WHERE id = p_flag_id;
  PERFORM private.log_admin_access(v_partner, 'decision', 'self_dealing_' || p_decision, v_note);
END;
$$;

-- G6 rate lock: partner_creator_links has no client write path (0027 REVOKE ALL + SELECT only). Only an
-- admin changes an ACTIVE representation's rate, logged; approved deals keep their snapshot.
CREATE OR REPLACE FUNCTION public.admin_set_commission_rate(p_link_id uuid, p_rate numeric, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_partner uuid; v_creator uuid; v_status public.representation_status; v_old numeric; v_rate numeric(4,3);
        v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
BEGIN
  IF NOT private.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF v_reason IS NULL THEN RAISE EXCEPTION 'reason_required'; END IF;
  IF char_length(v_reason) > 500 THEN RAISE EXCEPTION 'reason_too_long'; END IF;
  IF p_rate IS NULL OR p_rate < 0.01 OR p_rate > 0.30 THEN RAISE EXCEPTION 'invalid_commission_rate'; END IF;
  v_rate := round(p_rate, 3);
  SELECT partner_id, creator_id, status, commission_rate INTO v_partner, v_creator, v_status, v_old
    FROM public.partner_creator_links WHERE id = p_link_id FOR UPDATE;
  IF v_partner IS NULL THEN RAISE EXCEPTION 'link_not_found'; END IF;
  IF v_status NOT IN ('pending', 'active') THEN RAISE EXCEPTION 'link_not_open'; END IF;
  IF v_old = v_rate THEN RETURN; END IF;
  UPDATE public.partner_creator_links SET commission_rate = v_rate WHERE id = p_link_id;
  PERFORM private.log_admin_access(v_partner, 'decision', 'commission_rate', format('%s → %s : %s', v_old, v_rate, v_reason));
  INSERT INTO public.notifications (user_id, type, title, body, link) VALUES
    (v_partner, 'commission_rate_changed', 'Commission modifiée par Bayele',
     'Votre commission sur ce créateur passe de ' || to_char(v_old * 100, 'FM990.#') || ' % à ' || to_char(v_rate * 100, 'FM990.#') ||
     ' % pour les prochaines missions.', '/partner/creators'),
    (v_creator, 'commission_rate_changed', 'Commission modifiée par Bayele',
     'La commission de votre partenaire passe de ' || to_char(v_old * 100, 'FM990.#') || ' % à ' || to_char(v_rate * 100, 'FM990.#') ||
     ' % pour les prochaines missions.', '/creator/partner');
END;
$$;

-- ── G2: admin partner actions ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.is_available_partner(p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.is_active_partner(p_user_id)
     AND EXISTS (SELECT 1 FROM public.consultant_profiles WHERE user_id = p_user_id AND directory_listed);
$$;
REVOKE ALL ON FUNCTION private.is_available_partner(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_partner_listing(p_partner_id uuid, p_listed boolean, p_reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_cur boolean; v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
BEGIN
  IF NOT private.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF p_listed IS NULL THEN RAISE EXCEPTION 'invalid_listing'; END IF;
  IF NOT p_listed AND v_reason IS NULL THEN RAISE EXCEPTION 'reason_required'; END IF;
  IF char_length(v_reason) > 500 THEN RAISE EXCEPTION 'reason_too_long'; END IF;
  SELECT directory_listed INTO v_cur FROM public.consultant_profiles WHERE user_id = p_partner_id FOR UPDATE;
  IF v_cur IS NULL THEN RAISE EXCEPTION 'partner_not_found'; END IF;
  IF v_cur = p_listed THEN RETURN; END IF;
  UPDATE public.consultant_profiles
     SET directory_listed = p_listed, listing_reason = v_reason, listing_changed_at = now(), listing_changed_by = auth.uid()
   WHERE user_id = p_partner_id;
  PERFORM private.log_admin_access(p_partner_id, 'decision', CASE WHEN p_listed THEN 'relist' ELSE 'delist' END, v_reason);
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (p_partner_id, CASE WHEN p_listed THEN 'partner_relisted' ELSE 'partner_delisted' END,
          CASE WHEN p_listed THEN 'Profil de nouveau visible' ELSE 'Profil retiré de l''annuaire' END,
          CASE WHEN p_listed THEN 'Votre profil partenaire est de nouveau visible dans l''annuaire Bayele.'
               ELSE 'Votre profil partenaire n''apparaît plus dans l''annuaire. Vos missions en cours continuent. Motif : ' || v_reason END,
          '/partner/dashboard');
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_end_representation(p_link_id uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_partner uuid; v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
BEGIN
  IF NOT private.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF v_reason IS NULL THEN RAISE EXCEPTION 'reason_required'; END IF;
  IF char_length(v_reason) > 500 THEN RAISE EXCEPTION 'reason_too_long'; END IF;
  SELECT partner_id INTO v_partner FROM public.partner_creator_links WHERE id = p_link_id;
  IF v_partner IS NULL THEN RAISE EXCEPTION 'link_not_found'; END IF;
  PERFORM public.end_representation(p_link_id);   -- 0027: admins may end; notifies the other side
  PERFORM private.log_admin_access(v_partner, 'decision', 'end_representation', v_reason);
END;
$$;

-- conversation for an accepted assignment (30-day window, G4)
CREATE OR REPLACE FUNCTION private.open_assignment_conversation(p_assignment_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_brand uuid; v_partner uuid; v_id uuid;
BEGIN
  SELECT brand_id, partner_id INTO v_brand, v_partner FROM public.partner_assignments WHERE id = p_assignment_id;
  -- the 30-day window starts when the thread is first created; re-opening never extends it
  INSERT INTO public.conversations AS cv (context_type, context_id, business_id, counterparty_id, expires_at)
  VALUES ('partner_assignment', p_assignment_id, v_brand, v_partner, now() + interval '30 days')
  ON CONFLICT (context_type, context_id) DO UPDATE SET context_id = cv.context_id
  RETURNING id INTO v_id;
  UPDATE public.partner_assignments SET conversation_id = v_id WHERE id = p_assignment_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION private.open_assignment_conversation(uuid) FROM PUBLIC, anon, authenticated;

-- G4 window: a thread whose 30-day window passed without a funded retainer ends its assignment
-- (status 'ended', end_reason 'window_expired'), freezes the thread and expires the approved request.
-- Run lazily from the RPCs that read or create assignments / requests (a transaction that raises cannot persist it).
CREATE OR REPLACE FUNCTION private.expire_assignment_windows(p_brand uuid DEFAULT NULL, p_partner uuid DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_ids uuid[]; v_n integer;
BEGIN
  SELECT coalesce(array_agg(a.id), '{}') INTO v_ids
    FROM public.partner_assignments a JOIN public.conversations c ON c.id = a.conversation_id
   WHERE a.status = 'active' AND c.expires_at < now()
     AND (p_brand IS NULL OR a.brand_id = p_brand) AND (p_partner IS NULL OR a.partner_id = p_partner)
     AND NOT private.pair_has_funded_retainer(a.brand_id, a.partner_id);
  v_n := cardinality(v_ids);
  IF v_n = 0 THEN RETURN 0; END IF;
  UPDATE public.partner_assignments SET status = 'ended', ended_at = now(), end_reason = 'window_expired' WHERE id = ANY (v_ids);
  UPDATE public.conversations SET frozen_at = coalesce(frozen_at, now()), frozen_reason = coalesce(frozen_reason, 'assignment_ended')
   WHERE context_type = 'partner_assignment' AND context_id = ANY (v_ids);
  UPDATE public.partner_contact_requests SET status = 'expired' WHERE assignment_id = ANY (v_ids) AND status = 'approved';
  RETURN v_n;
END;
$$;
REVOKE ALL ON FUNCTION private.expire_assignment_windows(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.create_assignment(p_partner uuid, p_brand uuid, p_campaign uuid, p_origin text,
                                                     p_request uuid, p_note text, p_actor uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid; v_conv uuid; v_brand_name text;
BEGIN
  IF NOT private.is_available_partner(p_partner) THEN RAISE EXCEPTION 'partner_not_available'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.profiles p ON p.id = ur.user_id
                  WHERE ur.user_id = p_brand AND ur.role = 'business' AND p.status = 'active') THEN
    RAISE EXCEPTION 'brand_not_active';
  END IF;
  IF p_campaign IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.campaigns WHERE id = p_campaign AND owner_id = p_brand) THEN
    RAISE EXCEPTION 'campaign_not_found';
  END IF;
  PERFORM private.expire_assignment_windows(p_brand, p_partner);
  IF EXISTS (SELECT 1 FROM public.partner_assignments
              WHERE partner_id = p_partner AND brand_id = p_brand AND campaign_id IS NOT DISTINCT FROM p_campaign AND status = 'active') THEN
    RAISE EXCEPTION 'assignment_exists';
  END IF;
  -- P3: effective immediately (no partner acceptance); the conversation opens at once.
  INSERT INTO public.partner_assignments (partner_id, brand_id, campaign_id, origin, contact_request_id, note, created_by)
  VALUES (p_partner, p_brand, p_campaign, p_origin, p_request, p_note, p_actor)
  RETURNING id INTO v_id;
  v_conv := private.open_assignment_conversation(v_id);
  PERFORM private.check_self_dealing(p_partner, p_brand, CASE WHEN p_origin = 'contact_request' THEN 'contact_request' ELSE 'assignment' END);
  SELECT coalesce(bp.company_name, p.display_name) INTO v_brand_name
    FROM public.profiles p LEFT JOIN public.business_profiles bp ON bp.user_id = p.id WHERE p.id = p_brand;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (p_partner, 'partner_assignment_started', 'Nouvelle mise en relation',
          'Bayele vous met en relation avec ' || coalesce(v_brand_name, 'une marque') || '. La conversation est ouverte.',
          '/messages/' || v_conv::text);
  IF p_origin = 'admin' THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (p_brand, 'partner_assignment_started', 'Nouvelle mise en relation',
            'Bayele vous met en relation avec un partenaire. La conversation est ouverte.', '/messages/' || v_conv::text);
  END IF;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION private.create_assignment(uuid, uuid, uuid, text, uuid, text, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_assign_partner(p_partner_id uuid, p_brand_id uuid, p_campaign_id uuid DEFAULT NULL, p_note text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid; v_note text := nullif(btrim(coalesce(p_note, '')), '');
BEGIN
  IF NOT private.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF char_length(v_note) > 280 THEN RAISE EXCEPTION 'note_too_long'; END IF;
  v_id := private.create_assignment(p_partner_id, p_brand_id, p_campaign_id, 'admin', NULL, v_note, auth.uid());
  PERFORM private.log_admin_access(p_partner_id, 'decision', 'assign', v_note);
  RETURN v_id;
END;
$$;

-- P3 « Demander la fin »: the partner asks; the admin ends the assignment (admin_end_assignment) or dismisses.
CREATE OR REPLACE FUNCTION public.request_assignment_end(p_assignment_id uuid, p_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_actor uuid := auth.uid(); v_partner uuid; v_status text; v_id uuid;
        v_reason text := nullif(regexp_replace(btrim(coalesce(p_reason, '')), '\s+', ' ', 'g'), '');
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF v_reason IS NULL THEN RAISE EXCEPTION 'reason_required'; END IF;
  IF char_length(v_reason) > 300 THEN RAISE EXCEPTION 'reason_too_long'; END IF;
  SELECT partner_id, status INTO v_partner, v_status FROM public.partner_assignments WHERE id = p_assignment_id FOR UPDATE;
  IF v_partner IS NULL THEN RAISE EXCEPTION 'assignment_not_found'; END IF;
  IF v_actor <> v_partner THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF v_status <> 'active' THEN RAISE EXCEPTION 'assignment_not_active'; END IF;
  IF EXISTS (SELECT 1 FROM public.assignment_end_requests WHERE assignment_id = p_assignment_id AND status = 'open') THEN
    RAISE EXCEPTION 'end_already_requested';
  END IF;
  INSERT INTO public.assignment_end_requests (assignment_id, requested_by, reason)
  VALUES (p_assignment_id, v_actor, (SELECT m.body FROM private.mask_contacts(v_reason) m))
  RETURNING id INTO v_id;
  PERFORM private.notify_admins('assignment_end_requested', 'Fin de mise en relation demandée',
    'Un partenaire demande la fin d''une mise en relation.', '/admin/partners/assignments');
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_assignment_end_requests(p_status text DEFAULT 'open')
RETURNS TABLE (id uuid, assignment_id uuid, partner_id uuid, partner_handle text, brand_id uuid, brand_handle text,
               brand_company text, campaign_id uuid, assignment_status text, reason text, status text,
               decision_note text, created_at timestamptz, decided_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT private.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  RETURN QUERY
  SELECT r.id, r.assignment_id, a.partner_id, pp.handle, a.brand_id, bp.handle, b.company_name, a.campaign_id, a.status,
         r.reason, r.status, r.decision_note, r.created_at, r.decided_at
    FROM public.assignment_end_requests r JOIN public.partner_assignments a ON a.id = r.assignment_id
    JOIN public.profiles pp ON pp.id = a.partner_id JOIN public.profiles bp ON bp.id = a.brand_id
    LEFT JOIN public.business_profiles b ON b.user_id = a.brand_id
   WHERE p_status IS NULL OR r.status = p_status
   ORDER BY r.created_at LIMIT 200;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_dismiss_assignment_end_request(p_request_id uuid, p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_status text; v_partner uuid; v_note text := nullif(btrim(coalesce(p_note, '')), '');
BEGIN
  IF NOT private.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF v_note IS NULL THEN RAISE EXCEPTION 'note_required'; END IF;
  IF char_length(v_note) > 500 THEN RAISE EXCEPTION 'note_too_long'; END IF;
  SELECT r.status, r.requested_by INTO v_status, v_partner FROM public.assignment_end_requests r WHERE r.id = p_request_id FOR UPDATE;
  IF v_status IS NULL THEN RAISE EXCEPTION 'request_not_found'; END IF;
  IF v_status <> 'open' THEN RAISE EXCEPTION 'request_already_decided'; END IF;
  UPDATE public.assignment_end_requests SET status = 'dismissed', decided_by = auth.uid(), decided_at = now(), decision_note = v_note
   WHERE id = p_request_id;
  PERFORM private.log_admin_access(v_partner, 'decision', 'end_request_dismiss', v_note);
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (v_partner, 'assignment_end_request_dismissed', 'Mise en relation maintenue', 'Bayele maintient la mise en relation : ' || v_note,
          '/partner/assignments');
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_end_assignment(p_assignment_id uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_partner uuid; v_brand uuid; v_status text; v_req uuid; v_conv uuid; v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
BEGIN
  IF NOT private.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF v_reason IS NULL THEN RAISE EXCEPTION 'reason_required'; END IF;
  IF char_length(v_reason) > 500 THEN RAISE EXCEPTION 'reason_too_long'; END IF;
  SELECT partner_id, brand_id, status, contact_request_id, conversation_id INTO v_partner, v_brand, v_status, v_req, v_conv
    FROM public.partner_assignments WHERE id = p_assignment_id FOR UPDATE;
  IF v_partner IS NULL THEN RAISE EXCEPTION 'assignment_not_found'; END IF;
  IF v_status = 'ended' THEN RETURN; END IF;
  UPDATE public.partner_assignments SET status = 'ended', ended_at = now(), ended_by = auth.uid(), end_reason = v_reason WHERE id = p_assignment_id;
  UPDATE public.conversations SET frozen_at = now(), frozen_reason = 'assignment_ended' WHERE id = v_conv AND frozen_at IS NULL;
  UPDATE public.partner_contact_requests SET status = 'closed' WHERE id = v_req AND status = 'approved';
  UPDATE public.assignment_end_requests SET status = 'accepted', decided_by = auth.uid(), decided_at = now(), decision_note = v_reason
   WHERE assignment_id = p_assignment_id AND status = 'open';
  PERFORM private.log_admin_access(v_partner, 'decision', 'unassign', v_reason);
  INSERT INTO public.notifications (user_id, type, title, body, link) VALUES
    (v_partner, 'partner_assignment_ended', 'Mise en relation terminée', 'Bayele a mis fin à cette mise en relation.', '/partner/assignments'),
    (v_brand, 'partner_assignment_ended', 'Mise en relation terminée', 'Bayele a mis fin à cette mise en relation.', '/business/partners');
END;
$$;

-- retainer activity keeps the assignment conversation open (G4: « extended when a retainer is proposed or signed »)
CREATE OR REPLACE FUNCTION private.extend_assignment_window()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' OR (NEW.status = 'funded' AND OLD.status IS DISTINCT FROM 'funded') THEN   -- proposed or signed
    UPDATE public.conversations c SET expires_at = greatest(coalesce(c.expires_at, now()), now() + interval '30 days')
      FROM public.partner_assignments a
     WHERE a.conversation_id = c.id AND a.status = 'active' AND a.brand_id = NEW.business_id AND a.partner_id = NEW.consultant_id;
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION private.extend_assignment_window() FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE TRIGGER trg_extend_assignment_window AFTER INSERT OR UPDATE OF status ON public.agency_retainers
  FOR EACH ROW EXECUTE FUNCTION private.extend_assignment_window();

-- admin proposes a retainer on the brand's behalf (O7 rules; the partner still accepts).
CREATE OR REPLACE FUNCTION public.admin_propose_retainer(
  p_brand_id uuid, p_partner_id uuid, p_contract_value bigint, p_consultant_fee bigint, p_media_budget bigint, p_kpi_bonus bigint DEFAULT 0
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_retainer uuid; v_cut bigint; v_fee bigint; v_media bigint; v_brand text;
BEGIN
  IF NOT private.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  SELECT coalesce(bp.company_name, p.display_name) INTO v_brand
    FROM public.profiles p JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'business'
    LEFT JOIN public.business_profiles bp ON bp.user_id = p.id
   WHERE p.id = p_brand_id AND p.status = 'active';
  IF v_brand IS NULL THEN RAISE EXCEPTION 'brand_not_active'; END IF;
  IF p_partner_id = p_brand_id OR NOT private.is_active_partner(p_partner_id) THEN RAISE EXCEPTION 'consultant_not_found'; END IF;
  IF p_contract_value IS NULL OR p_contract_value <= 0 OR coalesce(p_consultant_fee, -1) < 0
     OR coalesce(p_media_budget, -1) < 0 OR coalesce(p_kpi_bonus, 0) < 0 THEN
    RAISE EXCEPTION 'invalid_amounts';
  END IF;
  v_cut := (p_contract_value * 25) / 100;
  v_fee := p_consultant_fee; v_media := p_media_budget;
  IF v_fee + v_media <> p_contract_value - v_cut THEN
    v_media := p_contract_value - v_cut - v_fee;
    IF v_media < 0 THEN v_fee := p_contract_value - v_cut; v_media := 0; END IF;
  END IF;
  INSERT INTO public.agency_retainers
    (business_id, consultant_id, contract_value_fcfa, bayele_cut_fcfa, consultant_fee_fcfa, media_budget_fcfa, kpi_bonus_fcfa, status)
  VALUES (p_brand_id, p_partner_id, p_contract_value, v_cut, v_fee, v_media, coalesce(p_kpi_bonus, 0), 'draft')
  RETURNING id INTO v_retainer;
  PERFORM private.check_self_dealing(p_partner_id, p_brand_id, 'retainer');
  PERFORM private.log_admin_access(p_partner_id, 'decision', 'propose_retainer', v_retainer::text);
  INSERT INTO public.notifications (user_id, type, title, body, link) VALUES
    (p_partner_id, 'retainer_proposed', 'Nouveau contrat agence 📄',
     v_brand || ' vous propose (via Bayele) un contrat agence de ' || p_contract_value::text || ' FCFA (honoraires ' ||
     v_fee::text || ' FCFA). Acceptez ou refusez dans l''application.', '/partner/retainers'),
    (p_brand_id, 'retainer_proposed_by_bayele', 'Contrat agence préparé par Bayele',
     'Bayele a préparé un contrat agence de ' || p_contract_value::text || ' FCFA pour vous. Il démarre dès que le partenaire l''accepte et que vous réglez la facture.',
     '/business/retainers');
  RETURN v_retainer;
END;
$$;

-- ── G4: contact requests ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.request_partner_contact(
  p_partner_id uuid, p_goal text, p_budget_range text DEFAULT NULL, p_deadline date DEFAULT NULL, p_consent_version text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_actor uuid := auth.uid(); v_id uuid; m record; b record;
        v_goal text := regexp_replace(btrim(coalesce(p_goal, '')), '\s+', ' ', 'g');
        v_budget text := nullif(btrim(coalesce(p_budget_range, '')), '');
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_actor AND role = 'business') THEN RAISE EXCEPTION 'not_a_business'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_actor AND status = 'active') THEN RAISE EXCEPTION 'owner_not_active'; END IF;   -- O8
  IF p_partner_id = v_actor THEN RAISE EXCEPTION 'cannot_contact_self'; END IF;
  IF NOT private.is_available_partner(p_partner_id) THEN RAISE EXCEPTION 'partner_not_available'; END IF;
  IF v_goal = '' OR char_length(v_goal) > 280 THEN RAISE EXCEPTION 'invalid_goal'; END IF;
  IF char_length(v_budget) > 60 THEN RAISE EXCEPTION 'budget_too_long'; END IF;
  IF p_deadline IS NOT NULL AND p_deadline < current_date THEN RAISE EXCEPTION 'deadline_in_past'; END IF;
  PERFORM private.expire_assignment_windows(v_actor, p_partner_id);
  IF EXISTS (SELECT 1 FROM public.partner_contact_requests WHERE brand_id = v_actor AND partner_id = p_partner_id AND status IN ('pending', 'approved')) THEN
    RAISE EXCEPTION 'request_already_open';
  END IF;
  IF (SELECT count(*) FROM public.partner_contact_requests WHERE brand_id = v_actor AND status = 'pending') >= 5 THEN
    RAISE EXCEPTION 'too_many_requests';
  END IF;
  SELECT * INTO m FROM private.mask_contacts(v_goal);
  SELECT * INTO b FROM private.mask_contacts(v_budget);
  INSERT INTO public.partner_contact_requests (brand_id, partner_id, goal, budget_range, deadline, masked_kinds)
  VALUES (v_actor, p_partner_id, left(m.body, 400), nullif(left(b.body, 60), ''), p_deadline,
          nullif(ARRAY(SELECT DISTINCT unnest(m.kinds || b.kinds) ORDER BY 1), '{}'))
  RETURNING id INTO v_id;
  PERFORM private.require_consent('contact_request', p_consent_version, v_id);   -- G7 (raises consent_required → whole call rolls back)
  IF m.hits + coalesce(b.hits, 0) > 0 THEN
    INSERT INTO public.message_flags (source, contact_request_id, sender_id, partner_id, brand_id, kinds, mask_count)
    VALUES ('auto_mask', v_id, v_actor, p_partner_id, v_actor, ARRAY(SELECT DISTINCT unnest(m.kinds || b.kinds) ORDER BY 1), m.hits + coalesce(b.hits, 0));
  END IF;
  PERFORM private.notify_admins('partner_contact_requested', 'Demande de mise en relation',
    'Une marque demande à contacter un partenaire. À traiter sous 24 h.', '/admin/partners/requests');
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.withdraw_contact_request(p_request_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_brand uuid; v_status text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT brand_id, status INTO v_brand, v_status FROM public.partner_contact_requests WHERE id = p_request_id FOR UPDATE;
  IF v_brand IS NULL THEN RAISE EXCEPTION 'request_not_found'; END IF;
  IF v_brand <> auth.uid() THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF v_status = 'withdrawn' THEN RETURN; END IF;
  IF v_status <> 'pending' THEN RAISE EXCEPTION 'not_pending'; END IF;
  UPDATE public.partner_contact_requests SET status = 'withdrawn' WHERE id = p_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_decide_contact_request(
  p_request_id uuid, p_approve boolean, p_reason_code text DEFAULT NULL, p_message text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_brand uuid; v_partner uuid; v_status text; v_assignment uuid;
        v_msg text := nullif(btrim(coalesce(p_message, '')), ''); v_code text := nullif(btrim(coalesce(p_reason_code, '')), ''); v_label text;
BEGIN
  IF NOT private.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  SELECT brand_id, partner_id, status INTO v_brand, v_partner, v_status FROM public.partner_contact_requests WHERE id = p_request_id FOR UPDATE;
  IF v_brand IS NULL THEN RAISE EXCEPTION 'request_not_found'; END IF;
  IF v_status <> 'pending' THEN RAISE EXCEPTION 'not_pending'; END IF;
  IF char_length(v_msg) > 500 THEN RAISE EXCEPTION 'message_too_long'; END IF;
  IF p_approve THEN
    v_assignment := private.create_assignment(v_partner, v_brand, NULL, 'contact_request', p_request_id, NULL, auth.uid());
    UPDATE public.partner_contact_requests
       SET status = 'approved', decided_by = auth.uid(), decided_at = now(), decision_message = v_msg, assignment_id = v_assignment
     WHERE id = p_request_id;
    INSERT INTO public.notifications (user_id, type, title, body, link)
    SELECT v_brand, 'contact_request_approved', 'Demande acceptée par Bayele',
           'Votre demande est validée : la conversation avec le partenaire est ouverte.' || coalesce(' ' || v_msg, ''),
           '/messages/' || a.conversation_id::text
      FROM public.partner_assignments a WHERE a.id = v_assignment;
  ELSE
    IF v_code IS NULL THEN RAISE EXCEPTION 'reason_required'; END IF;
    IF v_code NOT IN ('incomplete', 'brand_unverified', 'poor_fit', 'suspected_offplatform', 'other') THEN RAISE EXCEPTION 'invalid_reason_code'; END IF;
    IF v_code = 'other' AND v_msg IS NULL THEN RAISE EXCEPTION 'message_required'; END IF;
    v_label := CASE v_code WHEN 'incomplete' THEN 'Demande incomplète' WHEN 'brand_unverified' THEN 'Compte marque à compléter'
                           WHEN 'poor_fit' THEN 'Partenaire peu adapté à ce besoin' WHEN 'suspected_offplatform' THEN 'Échanges hors plateforme suspectés'
                           ELSE 'Autre motif' END;
    UPDATE public.partner_contact_requests
       SET status = 'declined', decided_by = auth.uid(), decided_at = now(), decision_reason_code = v_code, decision_message = v_msg
     WHERE id = p_request_id;
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (v_brand, 'contact_request_declined', 'Demande non retenue',
            'Motif : ' || v_label || '.' || coalesce(' ' || v_msg, ''), '/business/partners');
  END IF;
  PERFORM private.log_admin_access(v_partner, 'decision', CASE WHEN p_approve THEN 'contact_approve' ELSE 'contact_decline' END, v_code);
  RETURN v_assignment;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_contact_requests(p_status text DEFAULT 'pending')
RETURNS TABLE (id uuid, brand_id uuid, brand_handle text, brand_company text, brand_status public.account_status,
               partner_id uuid, partner_handle text, partner_name text, goal text, budget_range text, deadline date,
               masked_kinds text[], status text, decision_reason_code text, assignment_id uuid, assignment_status text,
               self_dealing boolean, created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT private.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  PERFORM private.expire_assignment_windows();
  RETURN QUERY
  SELECT r.id, r.brand_id, bp.handle, b.company_name, bp.status, r.partner_id, pp.handle, pp.display_name, r.goal, r.budget_range, r.deadline,
         r.masked_kinds, r.status, r.decision_reason_code, r.assignment_id, a.status,
         cardinality(private.self_dealing_kinds(r.partner_id, r.brand_id)) > 0, r.created_at
    FROM public.partner_contact_requests r
    JOIN public.profiles bp ON bp.id = r.brand_id JOIN public.profiles pp ON pp.id = r.partner_id
    LEFT JOIN public.business_profiles b ON b.user_id = r.brand_id
    LEFT JOIN public.partner_assignments a ON a.id = r.assignment_id
   WHERE p_status IS NULL OR r.status = p_status
   ORDER BY r.created_at LIMIT 200;
END;
$$;

-- ── G5 / G2: messaging (same signatures) ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.open_conversation(p_context_type public.conversation_context, p_context_id uuid)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_business uuid; v_counterparty uuid; v_id uuid; v_astatus text;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  IF p_context_type = 'campaign_creator' THEN
    SELECT c.owner_id, cc.creator_id INTO v_business, v_counterparty
      FROM public.campaign_creators cc JOIN public.campaigns c ON c.id = cc.campaign_id
      WHERE cc.id = p_context_id;
  ELSIF p_context_type = 'retainer' THEN
    SELECT r.business_id, r.consultant_id INTO v_business, v_counterparty
      FROM public.agency_retainers r WHERE r.id = p_context_id;
  ELSIF p_context_type = 'partner_assignment' THEN
    SELECT a.brand_id, a.partner_id, a.status INTO v_business, v_counterparty, v_astatus
      FROM public.partner_assignments a WHERE a.id = p_context_id;
    IF v_business IS NOT NULL AND v_astatus <> 'active' THEN RAISE EXCEPTION 'assignment_not_active'; END IF;
  END IF;

  IF v_business IS NULL THEN RAISE EXCEPTION 'deal_not_found'; END IF;
  IF v_actor <> v_business AND v_actor <> v_counterparty THEN RAISE EXCEPTION 'not_a_participant'; END IF;

  IF p_context_type = 'partner_assignment' THEN
    SELECT conversation_id INTO v_id FROM public.partner_assignments WHERE id = p_context_id;
    RETURN coalesce(v_id, private.open_assignment_conversation(p_context_id));
  END IF;
  INSERT INTO public.conversations (context_type, context_id, business_id, counterparty_id)
  VALUES (p_context_type, p_context_id, v_business, v_counterparty)
  ON CONFLICT (context_type, context_id) DO UPDATE SET context_id = EXCLUDED.context_id
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$;

-- send_message (0025 body) + freeze, assignment window, G5 masking before insert / notification / realtime.
CREATE OR REPLACE FUNCTION public.send_message(p_conversation_id uuid, p_body text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_business uuid; v_counterparty uuid; v_prev_last timestamptz; v_ctx public.conversation_context; v_ctx_id uuid;
  v_frozen timestamptz; v_expires timestamptz;
  v_recipient uuid; v_recip_last_read timestamptz; v_recipient_muted boolean := false;
  v_already_unread boolean;
  v_body text := btrim(coalesce(p_body, '')); v_recent int; v_msg uuid; v_sender text;
  v_kinds text[]; v_hits int := 0; v_flags24 int; m record;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF char_length(v_body) < 1 OR char_length(v_body) > 4000 THEN RAISE EXCEPTION 'invalid_body'; END IF;

  SELECT business_id, counterparty_id, last_message_at, context_type, context_id, frozen_at, expires_at
    INTO v_business, v_counterparty, v_prev_last, v_ctx, v_ctx_id, v_frozen, v_expires
    FROM public.conversations WHERE id = p_conversation_id FOR UPDATE;
  IF v_business IS NULL THEN RAISE EXCEPTION 'conversation_not_found'; END IF;
  IF v_actor <> v_business AND v_actor <> v_counterparty THEN RAISE EXCEPTION 'not_a_participant'; END IF;
  IF v_frozen IS NOT NULL THEN RAISE EXCEPTION 'conversation_frozen'; END IF;
  IF v_ctx = 'partner_assignment' THEN
    IF NOT EXISTS (SELECT 1 FROM public.partner_assignments WHERE id = v_ctx_id AND status = 'active') THEN
      RAISE EXCEPTION 'conversation_closed';
    END IF;
    IF v_expires IS NOT NULL AND v_expires < now() AND NOT private.pair_has_funded_retainer(v_business, v_counterparty) THEN
      RAISE EXCEPTION 'conversation_expired';  -- the assignment/request are closed by private.expire_assignment_windows
    END IF;
  END IF;

  -- G5: mask before anything is stored, previewed or broadcast (P5: the original goes to message_originals only).
  IF private.masking_applies(p_conversation_id) THEN
    SELECT * INTO m FROM private.mask_contacts(v_body);
    v_body := left(m.body, 4000); v_kinds := nullif(m.kinds, '{}'); v_hits := m.hits;
  END IF;

  IF v_actor = v_business THEN
    v_recipient := v_counterparty;
    SELECT counterparty_last_read_at, counterparty_muted INTO v_recip_last_read, v_recipient_muted
      FROM public.conversations WHERE id = p_conversation_id;
  ELSE
    v_recipient := v_business;
    SELECT business_last_read_at, business_muted INTO v_recip_last_read, v_recipient_muted
      FROM public.conversations WHERE id = p_conversation_id;
  END IF;

  SELECT count(*) INTO v_recent FROM public.messages
    WHERE conversation_id = p_conversation_id AND sender_id = v_actor AND created_at > now() - interval '10 seconds';
  IF v_recent >= 8 THEN RAISE EXCEPTION 'rate_limited'; END IF;

  INSERT INTO public.messages (conversation_id, sender_id, body, masked_kinds)
  VALUES (p_conversation_id, v_actor, v_body, v_kinds) RETURNING id INTO v_msg;

  IF v_hits > 0 THEN
    PERFORM private.store_masked_original(v_msg, p_conversation_id, v_actor, btrim(coalesce(p_body, '')), v_kinds);   -- P5
    INSERT INTO public.message_flags (source, conversation_id, message_id, sender_id, partner_id, brand_id, kinds, mask_count)
    VALUES ('auto_mask', p_conversation_id, v_msg, v_actor, v_counterparty, v_business, v_kinds, v_hits);
    SELECT count(*) INTO v_flags24 FROM public.message_flags
     WHERE sender_id = v_actor AND source = 'auto_mask' AND created_at > now() - interval '24 hours';
    IF v_flags24 = 3 THEN
      PERFORM private.notify_admins('messages_flagged', 'Coordonnées partagées à répétition',
        'Un membre a tenté plusieurs fois de partager des coordonnées avant contrat.', '/admin/partners/flags');
    END IF;
  END IF;

  IF v_actor = v_business THEN
    UPDATE public.conversations SET last_message_at = now(), business_last_read_at = now() WHERE id = p_conversation_id;
  ELSE
    UPDATE public.conversations SET last_message_at = now(), counterparty_last_read_at = now() WHERE id = p_conversation_id;
  END IF;

  v_already_unread := (v_prev_last IS NOT NULL) AND (v_recip_last_read IS NULL OR v_recip_last_read < v_prev_last);
  IF NOT v_already_unread AND NOT v_recipient_muted THEN
    SELECT display_name INTO v_sender FROM public.profiles WHERE id = v_actor;
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (v_recipient, 'message_received', 'Nouveau message',
            coalesce(v_sender, 'Quelqu''un') || ' : ' || left(v_body, 80),
            '/messages/' || p_conversation_id::text);
  END IF;

  RETURN v_msg;
END;
$function$;

-- Defence in depth: a message row inserted by any other path in a masked thread is masked too.
CREATE OR REPLACE FUNCTION private.mask_message_row()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE m record;
BEGIN
  IF private.masking_applies(NEW.conversation_id) THEN
    SELECT * INTO m FROM private.mask_contacts(NEW.body);
    IF m.hits > 0 THEN
      PERFORM private.store_masked_original(NEW.id, NEW.conversation_id, NEW.sender_id, NEW.body, m.kinds);   -- P5
      NEW.body := left(m.body, 4000);
      NEW.masked_kinds := ARRAY(SELECT DISTINCT unnest(coalesce(NEW.masked_kinds, '{}') || m.kinds) ORDER BY 1);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.mask_message_row() FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE TRIGGER trg_mask_message_row BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION private.mask_message_row();

-- « Signaler » (G6): a participant reports off-platform contact → flags queue.
CREATE OR REPLACE FUNCTION public.report_offplatform_contact(p_conversation_id uuid, p_reason text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_actor uuid := auth.uid(); v_business uuid; v_counterparty uuid; v_id uuid; m record;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT business_id, counterparty_id INTO v_business, v_counterparty FROM public.conversations WHERE id = p_conversation_id;
  IF v_business IS NULL THEN RAISE EXCEPTION 'conversation_not_found'; END IF;
  IF v_actor <> v_business AND v_actor <> v_counterparty THEN RAISE EXCEPTION 'not_a_participant'; END IF;
  IF (SELECT count(*) FROM public.message_flags WHERE reported_by = v_actor AND created_at > now() - interval '24 hours') >= 5 THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;
  SELECT * INTO m FROM private.mask_contacts(left(btrim(coalesce(p_reason, '')), 300));
  INSERT INTO public.message_flags (source, conversation_id, sender_id, partner_id, brand_id, reported_by, report_reason)
  VALUES ('report', p_conversation_id, CASE WHEN v_actor = v_business THEN v_counterparty ELSE v_business END,
          v_counterparty, v_business, v_actor, nullif(m.body, ''))
  RETURNING id INTO v_id;
  PERFORM private.notify_admins('offplatform_reported', 'Signalement : contact hors plateforme',
    'Un membre signale une tentative d''échange hors plateforme.', '/admin/partners/flags');
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_message_flags(p_status text DEFAULT 'open', p_limit integer DEFAULT 100)
RETURNS TABLE (id uuid, source text, conversation_id uuid, contact_request_id uuid, sender_id uuid, sender_handle text,
               partner_id uuid, partner_handle text, brand_id uuid, brand_handle text, kinds text[], mask_count integer,
               report_reason text, reported_by_handle text, partner_flags_30d bigint, status text, created_at timestamptz,
               message_id uuid, original_available boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT private.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  PERFORM private.purge_masked_originals();   -- P5: opportunistic, in addition to the scheduled cron job
  RETURN QUERY
  SELECT f.id, f.source, f.conversation_id, f.contact_request_id, f.sender_id, sp.handle, f.partner_id, pp.handle, f.brand_id, bp.handle,
         f.kinds, f.mask_count, f.report_reason, rp.handle,
         (SELECT count(*) FROM public.message_flags x WHERE x.partner_id = f.partner_id AND x.created_at > now() - interval '30 days'),
         f.status, f.created_at,
         f.message_id, EXISTS (SELECT 1 FROM public.message_originals mo WHERE mo.message_id = f.message_id AND mo.original_body IS NOT NULL)
    FROM public.message_flags f
    LEFT JOIN public.profiles sp ON sp.id = f.sender_id LEFT JOIN public.profiles pp ON pp.id = f.partner_id
    LEFT JOIN public.profiles bp ON bp.id = f.brand_id LEFT JOIN public.profiles rp ON rp.id = f.reported_by
   WHERE p_status IS NULL OR f.status = p_status
   ORDER BY f.created_at DESC
   LIMIT least(greatest(coalesce(p_limit, 100), 1), 500);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_resolve_flag(p_flag_id uuid, p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_status text; v_partner uuid; v_note text := nullif(btrim(coalesce(p_note, '')), '');
BEGIN
  IF NOT private.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF char_length(v_note) > 500 THEN RAISE EXCEPTION 'note_too_long'; END IF;
  SELECT status, partner_id INTO v_status, v_partner FROM public.message_flags WHERE id = p_flag_id FOR UPDATE;
  IF v_status IS NULL THEN RAISE EXCEPTION 'flag_not_found'; END IF;
  IF v_status = 'resolved' THEN RETURN; END IF;
  UPDATE public.message_flags SET status = 'resolved', resolved_by = auth.uid(), resolved_at = now(), resolution_note = v_note WHERE id = p_flag_id;
  IF v_partner IS NOT NULL THEN PERFORM private.log_admin_access(v_partner, 'decision', 'resolve_flag', v_note); END IF;
END;
$$;

-- ── G2: partner overview (read-only) ─────────────────────────────────────────
-- P5: read the original of a masked message. Reason required; every read is logged (admin_access_log 'reveal').
CREATE OR REPLACE FUNCTION public.admin_read_masked_original(p_message_id uuid, p_reason text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_sender uuid; v_body text; v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
BEGIN
  IF NOT private.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF v_reason IS NULL THEN RAISE EXCEPTION 'reason_required'; END IF;
  IF char_length(v_reason) > 500 THEN RAISE EXCEPTION 'reason_too_long'; END IF;
  PERFORM private.purge_masked_originals();
  SELECT sender_id, original_body INTO v_sender, v_body FROM public.message_originals WHERE message_id = p_message_id;
  IF v_sender IS NULL THEN RAISE EXCEPTION 'original_not_found'; END IF;
  IF v_body IS NULL THEN RAISE EXCEPTION 'original_purged'; END IF;
  PERFORM private.log_admin_access(v_sender, 'reveal', 'masked_original', v_reason);
  RETURN v_body;
END;
$$;

-- admin « Mettre en relation »: brand search, approved (active) brands only.
CREATE OR REPLACE FUNCTION public.admin_search_brands(p_query text, p_limit integer DEFAULT 20)
RETURNS TABLE (id uuid, handle text, display_name text, company_name text, industry text, city text,
               country public.country_code, avatar_url text, active_assignments bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_key text := private.text_key(p_query);
BEGIN
  IF NOT private.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF char_length(v_key) < 2 THEN RAISE EXCEPTION 'query_too_short'; END IF;
  RETURN QUERY
  SELECT p.id, p.handle, p.display_name, b.company_name, b.industry, p.city, p.country, p.avatar_url,
         (SELECT count(*) FROM public.partner_assignments a WHERE a.brand_id = p.id AND a.status = 'active')
    FROM public.profiles p JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'business'
    LEFT JOIN public.business_profiles b ON b.user_id = p.id
   WHERE p.status = 'active'
     AND (private.text_key(p.handle) LIKE '%' || v_key || '%' OR private.text_key(p.display_name) LIKE '%' || v_key || '%'
          OR private.text_key(b.company_name) LIKE '%' || v_key || '%')
   ORDER BY (private.text_key(coalesce(b.company_name, p.display_name)) LIKE v_key || '%') DESC, coalesce(b.company_name, p.display_name)
   LIMIT least(greatest(coalesce(p_limit, 20), 1), 50);
END;
$$;

-- admin partner list, paginated, with counts.
CREATE OR REPLACE FUNCTION public.admin_partner_list(
  p_search text DEFAULT NULL, p_status public.account_status DEFAULT NULL, p_listed boolean DEFAULT NULL,
  p_specialty text DEFAULT NULL, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
RETURNS TABLE (id uuid, handle text, display_name text, avatar_url text, city text, country public.country_code,
               status public.account_status, directory_listed boolean, specialties text[], creators_active bigint,
               assignments_active bigint, open_end_requests bigint, open_flags bigint, open_self_dealing bigint,
               payouts_on_hold boolean, created_at timestamptz, total_count bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_key text := nullif(private.text_key(p_search), '');
BEGIN
  IF NOT private.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  RETURN QUERY
  SELECT p.id, p.handle, p.display_name, p.avatar_url, p.city, p.country, p.status, kp.directory_listed, kp.specialties,
         (SELECT count(*) FROM public.partner_creator_links l WHERE l.partner_id = p.id AND l.status = 'active'),
         (SELECT count(*) FROM public.partner_assignments a WHERE a.partner_id = p.id AND a.status = 'active'),
         (SELECT count(*) FROM public.assignment_end_requests r JOIN public.partner_assignments a ON a.id = r.assignment_id
           WHERE a.partner_id = p.id AND r.status = 'open'),
         (SELECT count(*) FROM public.message_flags f WHERE f.partner_id = p.id AND f.status = 'open'),
         (SELECT count(*) FROM public.self_dealing_flags s WHERE s.partner_id = p.id AND s.status = 'open'),
         private.partner_payouts_on_hold(p.id), p.created_at, count(*) OVER ()
    FROM public.consultant_profiles kp JOIN public.profiles p ON p.id = kp.user_id
   WHERE (p_status IS NULL OR p.status = p_status)
     AND (p_listed IS NULL OR kp.directory_listed = p_listed)
     AND (p_specialty IS NULL OR p_specialty = ANY (kp.specialties))
     AND (v_key IS NULL OR private.text_key(p.handle) LIKE '%' || v_key || '%' OR private.text_key(p.display_name) LIKE '%' || v_key || '%')
   ORDER BY p.created_at DESC, p.id
   LIMIT least(greatest(coalesce(p_limit, 50), 1), 100) OFFSET greatest(coalesce(p_offset, 0), 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_partner_overview(p_partner_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE p public.profiles; kp public.consultant_profiles;
BEGIN
  IF NOT private.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  SELECT * INTO p FROM public.profiles WHERE id = p_partner_id;
  SELECT * INTO kp FROM public.consultant_profiles WHERE user_id = p_partner_id;
  IF p.id IS NULL OR kp.user_id IS NULL THEN RAISE EXCEPTION 'partner_not_found'; END IF;
  PERFORM private.log_admin_access(p_partner_id, 'view');
  PERFORM private.expire_assignment_windows(NULL, p_partner_id);
  RETURN jsonb_build_object(
    'partner', jsonb_build_object('id', p.id, 'handle', p.handle, 'display_name', p.display_name, 'status', p.status,
                                  'directory_listed', kp.directory_listed, 'listing_reason', kp.listing_reason, 'listing_changed_at', kp.listing_changed_at,
                                  'specialties', to_jsonb(kp.specialties), 'specialties_legacy', to_jsonb(kp.specialties_legacy),
                                  'payouts_on_hold', private.partner_payouts_on_hold(p_partner_id),
                                  'cgu_version', (SELECT c.version FROM public.member_consents c WHERE c.user_id = p_partner_id
                                                   AND c.kind = 'cgu_non_circumvention' ORDER BY c.created_at DESC, c.id DESC LIMIT 1)),
    'links', coalesce((SELECT jsonb_agg(jsonb_build_object('id', l.id, 'creator_id', l.creator_id, 'creator_handle', c.handle,
                                         'commission_rate', l.commission_rate, 'status', l.status, 'invited_at', l.invited_at,
                                         'responded_at', l.responded_at, 'ended_at', l.ended_at) ORDER BY l.invited_at DESC)
                         FROM public.partner_creator_links l JOIN public.profiles c ON c.id = l.creator_id WHERE l.partner_id = p_partner_id), '[]'::jsonb),
    'deals', coalesce((SELECT jsonb_agg(jsonb_build_object('id', cc.id, 'campaign_id', cc.campaign_id, 'campaign_title', ca.title,
                                         'creator_handle', c.handle, 'status', cc.status, 'agreed_payout_fcfa', cc.agreed_payout_fcfa,
                                         'commission_rate', cc.partner_commission_rate, 'applied_by_partner', cc.applied_by = p_partner_id,
                                         'updated_at', cc.updated_at) ORDER BY cc.updated_at DESC)
                         FROM (SELECT * FROM public.campaign_creators WHERE partner_id = p_partner_id OR applied_by = p_partner_id
                                ORDER BY updated_at DESC LIMIT 100) cc
                         JOIN public.campaigns ca ON ca.id = cc.campaign_id JOIN public.profiles c ON c.id = cc.creator_id), '[]'::jsonb),
    'commissions', jsonb_build_object(
       'owed_fcfa', (SELECT coalesce(sum(commission_fcfa), 0) FROM public.partner_commissions WHERE partner_id = p_partner_id AND status = 'owed'),
       'paid_fcfa', (SELECT coalesce(sum(commission_fcfa), 0) FROM public.partner_commissions WHERE partner_id = p_partner_id AND status = 'paid'),
       'count', (SELECT count(*) FROM public.partner_commissions WHERE partner_id = p_partner_id)),
    'retainers', coalesce((SELECT jsonb_agg(jsonb_build_object('id', r.id, 'brand_id', r.business_id, 'brand_handle', b.handle, 'status', r.status,
                                             'contract_value_fcfa', r.contract_value_fcfa, 'partner_accepted_at', r.partner_accepted_at,
                                             'settlements', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'kind', s.kind, 'amount_fcfa', s.amount_fcfa, 'status', s.status)), '[]'::jsonb)
                                                              FROM public.retainer_settlements s WHERE s.retainer_id = r.id),
                                             'created_at', r.created_at) ORDER BY r.created_at DESC)
                             FROM public.agency_retainers r JOIN public.profiles b ON b.id = r.business_id WHERE r.consultant_id = p_partner_id), '[]'::jsonb),
    'assignments', coalesce((SELECT jsonb_agg(jsonb_build_object('id', a.id, 'brand_id', a.brand_id, 'brand_handle', b.handle, 'campaign_id', a.campaign_id,
                                               'origin', a.origin, 'status', a.status, 'conversation_id', a.conversation_id,
                                               'created_at', a.created_at, 'ended_at', a.ended_at, 'end_reason', a.end_reason) ORDER BY a.created_at DESC)
                               FROM public.partner_assignments a JOIN public.profiles b ON b.id = a.brand_id WHERE a.partner_id = p_partner_id), '[]'::jsonb),
    'contact_requests', coalesce((SELECT jsonb_agg(jsonb_build_object('id', r.id, 'brand_handle', b.handle, 'status', r.status,
                                                    'decision_reason_code', r.decision_reason_code, 'created_at', r.created_at) ORDER BY r.created_at DESC)
                                    FROM public.partner_contact_requests r JOIN public.profiles b ON b.id = r.brand_id WHERE r.partner_id = p_partner_id), '[]'::jsonb),
    'flags', jsonb_build_object(
       'open', (SELECT count(*) FROM public.message_flags WHERE partner_id = p_partner_id AND status = 'open'),
       'last_30_days', (SELECT count(*) FROM public.message_flags WHERE partner_id = p_partner_id AND created_at > now() - interval '30 days'),
       'recent', coalesce((SELECT jsonb_agg(jsonb_build_object('id', f.id, 'source', f.source, 'kinds', f.kinds, 'mask_count', f.mask_count,
                                                               'status', f.status, 'created_at', f.created_at) ORDER BY f.created_at DESC)
                             FROM (SELECT * FROM public.message_flags WHERE partner_id = p_partner_id ORDER BY created_at DESC LIMIT 20) f), '[]'::jsonb)),
    'end_requests', coalesce((SELECT jsonb_agg(jsonb_build_object('id', r.id, 'assignment_id', r.assignment_id, 'reason', r.reason,
                                                'status', r.status, 'decision_note', r.decision_note, 'created_at', r.created_at,
                                                'decided_at', r.decided_at) ORDER BY r.created_at DESC)
                                FROM public.assignment_end_requests r JOIN public.partner_assignments a ON a.id = r.assignment_id
                               WHERE a.partner_id = p_partner_id), '[]'::jsonb),
    'self_dealing', coalesce((SELECT jsonb_agg(jsonb_build_object('id', f.id, 'brand_id', f.brand_id, 'kinds', f.kinds, 'source', f.source,
                                                'status', f.status, 'created_at', f.created_at) ORDER BY f.created_at DESC)
                                FROM public.self_dealing_flags f WHERE f.partner_id = p_partner_id), '[]'::jsonb)
  );
END;
$$;

-- ── G8: WhatsApp proof screenshots ───────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('proofs', 'proofs', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

ALTER TABLE public.proof_of_post
  ADD COLUMN IF NOT EXISTS recapture_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS recapture_reason text,
  ADD COLUMN IF NOT EXISTS recapture_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS resubmitted_at timestamptz;

-- Path convention: {creator_id}/{campaign_creator_id}/{uuid}.{jpg|png|webp}
CREATE OR REPLACE FUNCTION private.can_upload_proof(p_user uuid, p_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p_user IS NOT NULL
     AND split_part(p_name, '/', 1) = p_user::text
     AND split_part(p_name, '/', 2) ~ '^[0-9a-f-]{36}$'
     AND p_name ~* '^[0-9a-f-]{36}/[0-9a-f-]{36}/[A-Za-z0-9_-]{1,64}\.(jpe?g|png|webp)$'
     AND EXISTS (SELECT 1 FROM public.campaign_creators cc
                  LEFT JOIN public.proof_of_post pp ON pp.campaign_creator_id = cc.id
                  WHERE cc.id::text = split_part(p_name, '/', 2) AND cc.creator_id = p_user
                    AND (cc.status = 'approved' OR (cc.status = 'content_submitted' AND pp.recapture_requested_at IS NOT NULL)));
$$;
CREATE OR REPLACE FUNCTION private.can_read_proof(p_user uuid, p_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p_user IS NOT NULL AND (
         split_part(p_name, '/', 1) = p_user::text
      OR private.is_admin(p_user)
      OR EXISTS (SELECT 1 FROM public.campaign_creators cc JOIN public.campaigns c ON c.id = cc.campaign_id
                  WHERE cc.id::text = split_part(p_name, '/', 2) AND c.owner_id = p_user));
$$;
REVOKE ALL ON FUNCTION private.can_upload_proof(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.can_read_proof(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.can_upload_proof(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_read_proof(uuid, text) TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.proof_of_post'::regclass AND conname='proof_recapture_reason_len') THEN
    ALTER TABLE public.proof_of_post ADD CONSTRAINT proof_recapture_reason_len CHECK (recapture_reason IS NULL OR char_length(recapture_reason) <= 300);
  END IF;
  -- storage policies (CREATE POLICY only; no UPDATE / removal policy: screenshots are immutable, purge is an owner job)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='proofs creator upload') THEN
    CREATE POLICY "proofs creator upload" ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'proofs' AND private.can_upload_proof((SELECT auth.uid()), name));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='proofs parties read') THEN
    CREATE POLICY "proofs parties read" ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'proofs' AND private.can_read_proof((SELECT auth.uid()), name));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.proof_media (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proof_id            uuid NOT NULL REFERENCES public.proof_of_post(id),
  campaign_creator_id uuid NOT NULL REFERENCES public.campaign_creators(id),
  storage_path        text NOT NULL UNIQUE,
  sha256              text NOT NULL,
  kind                text NOT NULL,
  round               integer NOT NULL DEFAULT 1,
  created_at          timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT proof_media_kind CHECK (kind IN ('posted', 'views', 'extra')),
  CONSTRAINT proof_media_sha CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT proof_media_one_kind_per_round UNIQUE (proof_id, round, kind)
);
CREATE INDEX IF NOT EXISTS proof_media_sha_idx ON public.proof_media (sha256);
CREATE INDEX IF NOT EXISTS proof_media_cc_idx ON public.proof_media (campaign_creator_id);
ALTER TABLE public.proof_media ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.proof_media FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.proof_media TO authenticated;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='proof_media' AND policyname='proof media visible to parties') THEN
    CREATE POLICY "proof media visible to parties" ON public.proof_media FOR SELECT TO authenticated
      USING (private.is_admin((SELECT auth.uid())) OR EXISTS (
        SELECT 1 FROM public.campaign_creators cc JOIN public.campaigns c ON c.id = cc.campaign_id
         WHERE cc.id = proof_media.campaign_creator_id AND (cc.creator_id = (SELECT auth.uid()) OR c.owner_id = (SELECT auth.uid()))));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.creator_submit_whatsapp_proof(
  p_campaign_creator_id uuid,
  p_posted_path text, p_posted_sha256 text,
  p_views_path  text, p_views_sha256  text,
  p_extra_path  text DEFAULT NULL, p_extra_sha256 text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_creator uuid; v_status public.creator_campaign_status; v_campaign uuid; v_owner uuid; v_title text;
  v_proof uuid; v_recap timestamptz; v_round int; v_prefix text; v_paths text[]; v_shas text[]; i int;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  v_paths := ARRAY[p_posted_path, p_views_path, p_extra_path];
  v_shas  := ARRAY[lower(p_posted_sha256), lower(p_views_sha256), lower(p_extra_sha256)];
  IF p_posted_path IS NULL OR p_views_path IS NULL THEN RAISE EXCEPTION 'screenshots_required'; END IF;
  IF (p_extra_path IS NULL) <> (p_extra_sha256 IS NULL) THEN RAISE EXCEPTION 'invalid_screenshot'; END IF;

  SELECT cc.creator_id, cc.status, cc.campaign_id, c.owner_id, c.title
    INTO v_creator, v_status, v_campaign, v_owner, v_title
    FROM public.campaign_creators cc JOIN public.campaigns c ON c.id = cc.campaign_id
   WHERE cc.id = p_campaign_creator_id FOR UPDATE OF cc;
  IF v_creator IS NULL THEN RAISE EXCEPTION 'application_not_found'; END IF;
  IF v_creator <> v_actor THEN RAISE EXCEPTION 'not_authorized'; END IF;
  SELECT id, recapture_requested_at INTO v_proof, v_recap FROM public.proof_of_post WHERE campaign_creator_id = p_campaign_creator_id;
  IF v_status = 'content_submitted' AND v_recap IS NULL THEN RAISE EXCEPTION 'already_submitted'; END IF;
  IF v_status NOT IN ('approved', 'content_submitted') THEN RAISE EXCEPTION 'not_approved'; END IF;

  v_prefix := v_actor::text || '/' || p_campaign_creator_id::text || '/';
  FOR i IN 1..3 LOOP
    CONTINUE WHEN v_paths[i] IS NULL;
    IF left(v_paths[i], length(v_prefix)) <> v_prefix OR NOT private.can_upload_proof(v_actor, v_paths[i]) THEN
      RAISE EXCEPTION 'invalid_screenshot_path' USING DETAIL = v_paths[i];
    END IF;
    IF v_shas[i] IS NULL OR v_shas[i] !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'invalid_screenshot' USING DETAIL = 'sha256'; END IF;
    IF NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'proofs' AND o.name = v_paths[i]) THEN
      RAISE EXCEPTION 'screenshot_not_uploaded' USING DETAIL = v_paths[i];
    END IF;
    -- a new round needs new uploads (each storage object backs one proof_media row)
    IF EXISTS (SELECT 1 FROM public.proof_media pm WHERE pm.storage_path = v_paths[i]) THEN
      RAISE EXCEPTION 'screenshot_already_used' USING DETAIL = v_paths[i];
    END IF;
    IF EXISTS (SELECT 1 FROM public.proof_media pm WHERE pm.sha256 = v_shas[i] AND pm.campaign_creator_id <> p_campaign_creator_id) THEN
      RAISE EXCEPTION 'proof_duplicate_image';
    END IF;
  END LOOP;
  IF v_shas[1] = v_shas[2] OR v_shas[1] = v_shas[3] OR v_shas[2] = v_shas[3] THEN RAISE EXCEPTION 'screenshots_identical'; END IF;

  IF v_status = 'approved' THEN
    -- first submission: the existing money path (earmark + escrow held → proof_pending)
    v_proof := public.submit_proof_of_post(p_campaign_creator_id, v_actor, p_posted_path, v_shas[1], 'whatsapp_screenshots', NULL, NULL, 'mtn_momo');
    v_round := 1;
  ELSE
    -- « nouvelle capture »: same proof, same earmark (still proof_pending), new round of images
    SELECT coalesce(max(round), 0) + 1 INTO v_round FROM public.proof_media WHERE proof_id = v_proof;
    UPDATE public.proof_of_post
       SET media_storage_path = p_posted_path, media_sha256 = v_shas[1], is_valid = NULL,
           recapture_requested_at = NULL, resubmitted_at = now()
     WHERE id = v_proof;
  END IF;

  INSERT INTO public.proof_media (proof_id, campaign_creator_id, storage_path, sha256, kind, round)
  SELECT v_proof, p_campaign_creator_id, v_paths[g.n], v_shas[g.n], (ARRAY['posted','views','extra'])[g.n], v_round
    FROM generate_series(1, 3) AS g(n) WHERE v_paths[g.n] IS NOT NULL;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (v_owner, CASE WHEN v_round = 1 THEN 'proof_submitted' ELSE 'proof_resubmitted' END,
          CASE WHEN v_round = 1 THEN 'Preuve reçue' ELSE 'Nouvelle capture reçue' END,
          'Un créateur a envoyé ' || CASE WHEN v_round = 1 THEN 'ses captures' ELSE 'de nouvelles captures' END ||
          ' pour « ' || v_title || ' ». À vérifier.',
          '/business/campaigns/' || v_campaign::text);
  RETURN v_proof;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_proof_recapture(p_proof_id uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_actor uuid := auth.uid(); v_cc uuid; v_creator uuid; v_owner uuid; v_title text; v_type text; v_valid boolean;
        v_count int; v_recap timestamptz; v_ccstatus public.creator_campaign_status; v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF v_reason IS NULL THEN RAISE EXCEPTION 'reason_required'; END IF;
  IF char_length(v_reason) > 300 THEN RAISE EXCEPTION 'reason_too_long'; END IF;
  SELECT pp.campaign_creator_id, cc.creator_id, c.owner_id, c.title, pp.media_type, pp.is_valid, pp.recapture_count, pp.recapture_requested_at, cc.status
    INTO v_cc, v_creator, v_owner, v_title, v_type, v_valid, v_count, v_recap, v_ccstatus
    FROM public.proof_of_post pp JOIN public.campaign_creators cc ON cc.id = pp.campaign_creator_id JOIN public.campaigns c ON c.id = cc.campaign_id
   WHERE pp.id = p_proof_id FOR UPDATE OF pp;
  IF v_cc IS NULL THEN RAISE EXCEPTION 'proof_not_found'; END IF;
  IF NOT (v_actor = v_owner OR private.is_admin(v_actor)) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF v_type IS DISTINCT FROM 'whatsapp_screenshots' THEN RAISE EXCEPTION 'not_a_screenshot_proof'; END IF;
  IF v_recap IS NOT NULL THEN RETURN; END IF;   -- already requested
  IF v_valid IS NOT NULL OR v_ccstatus <> 'content_submitted' THEN RAISE EXCEPTION 'proof_already_reviewed'; END IF;
  IF v_count >= 3 THEN RAISE EXCEPTION 'too_many_recaptures'; END IF;
  UPDATE public.proof_of_post
     SET recapture_requested_at = now(), recapture_reason = v_reason, recapture_count = recapture_count + 1
   WHERE id = p_proof_id;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (v_creator, 'proof_recapture_requested', 'Nouvelle capture demandée',
          'La marque demande une nouvelle capture pour « ' || v_title || ' » : ' || v_reason, '/creator/dashboard');
END;
$$;

-- review (0013 body) + no decision while a new capture is awaited.
CREATE OR REPLACE FUNCTION public.review_proof(
  p_proof_id uuid, p_approve boolean, p_reason text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_creator uuid; v_title text;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF EXISTS (SELECT 1 FROM public.proof_of_post WHERE id = p_proof_id AND recapture_requested_at IS NOT NULL) THEN
    RAISE EXCEPTION 'recapture_pending';
  END IF;

  PERFORM public.verify_proof_of_post(p_proof_id, p_approve, v_actor, p_reason);

  SELECT cc.creator_id, c.title INTO v_creator, v_title
    FROM public.proof_of_post pp
    JOIN public.campaign_creators cc ON cc.id = pp.campaign_creator_id
    JOIN public.campaigns c ON c.id = cc.campaign_id
    WHERE pp.id = p_proof_id;

  IF p_approve THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (v_creator, 'proof_approved', 'Preuve validée ✅',
            'Votre preuve pour « ' || v_title || ' » est validée. Le paiement est en préparation.',
            '/creator/dashboard');
  ELSE
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (v_creator, 'proof_rejected', 'Preuve refusée',
            'Votre preuve pour « ' || v_title || ' » a été refusée' ||
            COALESCE(' : ' || p_reason, '') || '.',
            '/creator/dashboard');
  END IF;
END;
$$;

-- ── G9: cities ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cities (
  country public.country_code NOT NULL,
  name    text NOT NULL,
  sort    smallint NOT NULL DEFAULT 100,
  active  boolean NOT NULL DEFAULT true,
  PRIMARY KEY (country, name),
  CONSTRAINT cities_name_len CHECK (char_length(name) BETWEEN 1 AND 60 AND name = btrim(name))
);
CREATE UNIQUE INDEX IF NOT EXISTS cities_key_idx ON public.cities (country, private.text_key(name));
INSERT INTO public.cities (country, name, sort) VALUES
  ('CM','Douala',10),('CM','Yaoundé',20),('CM','Bafoussam',30),('CM','Bamenda',40),('CM','Garoua',50),('CM','Maroua',60),
  ('CM','Ngaoundéré',70),('CM','Bertoua',80),('CM','Ebolowa',90),('CM','Kribi',100),('CM','Limbé',110),('CM','Buea',120),
  ('CM','Kumba',130),('CM','Dschang',140),('CM','Nkongsamba',150),
  ('CI','Abidjan',10),('CI','Yamoussoukro',20),('CI','Bouaké',30),('CI','Daloa',40),('CI','San-Pédro',50),('CI','Korhogo',60),
  ('CI','Man',70),('CI','Gagnoa',80),('CI','Divo',90),('CI','Abengourou',100),('CI','Grand-Bassam',110),('CI','Soubré',120),
  ('CI','Séguéla',130),('CI','Odienné',140),
  ('GA','Libreville',10),('GA','Port-Gentil',20),('GA','Franceville',30),('GA','Oyem',40),('GA','Moanda',50),('GA','Mouila',60),
  ('GA','Lambaréné',70),('GA','Tchibanga',80),('GA','Koulamoutou',90),('GA','Makokou',100),('GA','Bitam',110),('GA','Owendo',120),
  ('GA','Akanda',130),('GA','Ntoum',140),
  ('NG','Lagos',10),('NG','Abuja',20),('NG','Kano',30),('NG','Ibadan',40),('NG','Port Harcourt',50),('NG','Benin City',60),
  ('NG','Kaduna',70),('NG','Enugu',80),('NG','Onitsha',90),('NG','Aba',100),('NG','Jos',110),('NG','Ilorin',120),
  ('NG','Abeokuta',130),('NG','Owerri',140),('NG','Calabar',150),
  ('KE','Nairobi',10),('KE','Mombasa',20),('KE','Kisumu',30),('KE','Nakuru',40),('KE','Eldoret',50),('KE','Thika',60),
  ('KE','Malindi',70),('KE','Kitale',80),('KE','Machakos',90),('KE','Nyeri',100),('KE','Meru',110),('KE','Kakamega',120),
  ('KE','Kericho',130),('KE','Naivasha',140),('KE','Garissa',150),
  ('ZA','Johannesburg',10),('ZA','Cape Town',20),('ZA','Durban',30),('ZA','Pretoria',40),('ZA','Gqeberha',50),('ZA','Bloemfontein',60),
  ('ZA','East London',70),('ZA','Pietermaritzburg',80),('ZA','Polokwane',90),('ZA','Mbombela',100),('ZA','Kimberley',110),
  ('ZA','Rustenburg',120),('ZA','Soweto',130),('ZA','George',140),('ZA','Stellenbosch',150)
ON CONFLICT (country, name) DO NOTHING;
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cities FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.cities TO anon, authenticated;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='cities' AND policyname='cities are public') THEN
    CREATE POLICY "cities are public" ON public.cities FOR SELECT USING (true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION private.listed_city(p_country public.country_code, p_city text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT c.name FROM public.cities c
   WHERE c.country = p_country AND c.active AND private.text_key(c.name) = private.text_key(p_city) LIMIT 1;
$$;
REVOKE ALL ON FUNCTION private.listed_city(public.country_code, text) FROM PUBLIC, anon, authenticated;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city_in_list boolean;
COMMENT ON COLUMN public.profiles.city_in_list IS 'G9: set on every insert / city change: the city matches the list for the country (spelling normalised). NULL = not computed (rows unchanged since 0039).';

-- Normalises a city to the listed spelling and records city_in_list (new rows and city/country changes only).
CREATE OR REPLACE FUNCTION private.normalize_profile_city()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_listed text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.city IS NOT DISTINCT FROM OLD.city AND NEW.country IS NOT DISTINCT FROM OLD.country THEN
    NEW.city_in_list := OLD.city_in_list;
    RETURN NEW;
  END IF;
  v_listed := private.listed_city(NEW.country, NEW.city);
  IF v_listed IS NOT NULL THEN NEW.city := v_listed; END IF;
  NEW.city_in_list := v_listed IS NOT NULL;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.normalize_profile_city() FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE TRIGGER trg_city_normalize BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION private.normalize_profile_city();

CREATE OR REPLACE FUNCTION public.admin_add_city(p_country public.country_code, p_name text, p_sort smallint DEFAULT 100)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_name text := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
BEGIN
  IF NOT private.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF p_country IS NULL OR v_name = '' OR char_length(v_name) > 60 THEN RAISE EXCEPTION 'invalid_city'; END IF;
  IF private.listed_city(p_country, v_name) IS NOT NULL THEN RAISE EXCEPTION 'city_exists'; END IF;
  INSERT INTO public.cities (country, name, sort) VALUES (p_country, v_name, coalesce(p_sort, 100));
END;
$$;

-- ── admin read model (0036 body) + listing, legacy specialties, consents, G9/G5/G6 checklist items ──
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
      'directory_listed', kp.directory_listed, 'listing_reason', kp.listing_reason, 'listing_changed_at', kp.listing_changed_at,
      'specialties_legacy', to_jsonb(kp.specialties_legacy), 'payouts_on_hold', private.partner_payouts_on_hold(p_user_id),
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
    IF cardinality(kp.specialties_legacy) > 0
       OR EXISTS (SELECT 1 FROM unnest(kp.specialties) s WHERE NOT EXISTS (SELECT 1 FROM public.partner_specialties ps WHERE ps.code = s AND ps.active)) THEN
      v_checklist := v_checklist || 'specialties_unmapped'::text;
    END IF;
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
  -- G9 / G5 / G6 (0039)
  IF NOT coalesce(p.city_in_list, private.listed_city(p.country, p.city) IS NOT NULL) THEN v_checklist := v_checklist || 'city_not_in_list'::text; END IF;
  IF (SELECT hits FROM private.mask_contacts(p.bio)) > 0 THEN v_checklist := v_checklist || 'contact_in_bio'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.self_dealing_flags f WHERE (f.partner_id = p_user_id OR f.brand_id = p_user_id) AND f.status = 'open') THEN
    v_checklist := v_checklist || 'self_dealing_flag'::text;
  END IF;

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
    'consents', coalesce((SELECT jsonb_agg(jsonb_build_object('kind', c.kind, 'version', c.version, 'at', c.created_at) ORDER BY c.kind)
                           FROM (SELECT DISTINCT ON (kind) kind, version, created_at FROM public.member_consents
                                  WHERE user_id = p_user_id ORDER BY kind, created_at DESC, id DESC) c), '[]'::jsonb),
    'checklist', to_jsonb(v_checklist)
  );
END;
$$;

-- ── Grants ──────────────────────────────────────────────────────────────────
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.record_consent(text, text, uuid)', 'public.my_consents()',
    'public.admin_self_dealing_flags(text)', 'public.admin_decide_self_dealing_flag(uuid, text, text)',
    'public.admin_set_commission_rate(uuid, numeric, text)', 'public.admin_set_partner_listing(uuid, boolean, text)',
    'public.admin_end_representation(uuid, text)', 'public.admin_assign_partner(uuid, uuid, uuid, text)',
    'public.request_assignment_end(uuid, text)', 'public.admin_assignment_end_requests(text)',
    'public.admin_dismiss_assignment_end_request(uuid, text)', 'public.admin_end_assignment(uuid, text)',
    'public.admin_read_masked_original(uuid, text)', 'public.admin_search_brands(text, integer)',
    'public.admin_partner_list(text, public.account_status, boolean, text, integer, integer)',
    'public.admin_propose_retainer(uuid, uuid, bigint, bigint, bigint, bigint)',
    'public.request_partner_contact(uuid, text, text, date, text)', 'public.withdraw_contact_request(uuid)',
    'public.admin_decide_contact_request(uuid, boolean, text, text)', 'public.admin_contact_requests(text)',
    'public.report_offplatform_contact(uuid, text)', 'public.admin_message_flags(text, integer)', 'public.admin_resolve_flag(uuid, text)',
    'public.admin_partner_overview(uuid)', 'public.creator_submit_whatsapp_proof(uuid, text, text, text, text, text, text)',
    'public.request_proof_recapture(uuid, text)', 'public.admin_add_city(public.country_code, text, smallint)']
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP;
END $$;
