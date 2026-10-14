-- ============================================================================
-- Migration:          Partner governance — post-deploy validations (G1 codes, G3 assignment-only retainers,
--                     retainer-thread gating) + specialty mapping + legacy assignments
-- Version:            20261014120200_0040
-- Date:               2026-10-14
-- Team:               Bayele Core Platform Engineering
-- Dependencies:       0039
-- Rollback Script:    supabase/migrations/rollback/20261014120200_0040_partner_governance_enforce.rollback.sql
-- Decisions:          briefs/CONTEXT-PARTNER-GOV.md G1, G3, G4, G11
-- ============================================================================
-- RELEASE ORDER: apply 0038 + 0039 → deploy the partner-governance web → apply 0037 + THIS migration.
-- Applied before the new web, the old web breaks: free-text specialties (onboarding / profile) are
-- refused, retainers can only go to assigned partners, and a retainer thread needs consent or assignment.
-- K8: no destructive keyword. Same signatures for replaced functions.
--
--  1. Specialty mapping (G1): free text → codes via partner_specialty_aliases (max 3, list order);
--     anything unmapped, or mapped beyond the first 3, is kept in specialties_legacy (admin-only) and the
--     partner gets a correction request (D4 flow, field 'other') + an in-app notification.
--  2. Specialty validation: member writes (trigger) and onboard_profile accept active codes only, ≤ 3.
--  3. Legacy assignments: every brand↔partner pair with a funded or partner-accepted retainer gets an
--     'active' assignment (origin 'legacy_retainer') so existing relationships keep working.
--  4. propose_retainer → 'partner_not_assigned' without an active assignment.
--  5. open_conversation(retainer) → 'not_assigned' unless the retainer was accepted or the pair is assigned.
--  6. G7 current consent version enforced server-side: request_partner_contact (brand) and propose_retainer
--     (brand and partner) → 'consent_required' unless the CGU non-circumvention acknowledgement on record is
--     the current version (private.current_consent_version). Admin paths are exempt.
-- ============================================================================

-- 1. specialty mapping (system UPDATE; guards and member triggers do not fire for the migration role)
DO $$
DECLARE r record; v_codes text[]; v_unmapped text[]; v_nmapped integer; v_event bigint;
BEGIN
  FOR r IN SELECT kp.user_id, kp.specialties, p.status FROM public.consultant_profiles kp JOIN public.profiles p ON p.id = kp.user_id
            WHERE cardinality(kp.specialties) > 0 AND kp.specialties_legacy IS NULL LOOP
    v_codes := ARRAY(SELECT ps.code FROM public.partner_specialties ps
                      WHERE ps.code IN (SELECT private.specialty_code_for(s) FROM unnest(r.specialties) s)
                      ORDER BY ps.sort LIMIT 3);
    v_unmapped := ARRAY(SELECT s FROM unnest(r.specialties) s WHERE private.specialty_code_for(s) IS NULL);
    v_nmapped := (SELECT count(DISTINCT private.specialty_code_for(s)) FROM unnest(r.specialties) s);   -- > 3 → extras dropped (QA PG-4)
    -- rows already on valid codes (≤ 3) are left exactly as they are
    CONTINUE WHEN cardinality(r.specialties) <= 3
              AND NOT EXISTS (SELECT 1 FROM unnest(r.specialties) s
                               WHERE NOT EXISTS (SELECT 1 FROM public.partner_specialties ps WHERE ps.code = s AND ps.active));
    UPDATE public.consultant_profiles
       SET specialties = v_codes,
           specialties_legacy = CASE WHEN cardinality(v_unmapped) > 0 OR v_nmapped > 3 OR cardinality(r.specialties) > cardinality(v_codes) THEN r.specialties END
     WHERE user_id = r.user_id;
    IF (cardinality(v_unmapped) > 0 OR v_nmapped > 3) AND r.status IN ('pending_review', 'active')
       AND NOT EXISTS (SELECT 1 FROM public.member_correction_requests WHERE member_id = r.user_id AND status = 'open') THEN
      INSERT INTO public.member_moderation_events (member_id, action, from_status, to_status, reason_code, message, correction_fields)
      VALUES (r.user_id, 'request_changes', r.status, r.status, 'incomplete',
              'Choisissez vos spécialités dans la nouvelle liste Bayele (3 au maximum).', ARRAY['other'])
      RETURNING id INTO v_event;
      INSERT INTO public.member_correction_requests (member_id, event_id, fields, reason_code, message)
      VALUES (r.user_id, v_event, ARRAY['other'], 'incomplete', 'Choisissez vos spécialités dans la nouvelle liste Bayele (3 au maximum).');
      INSERT INTO public.notifications (user_id, type, title, body, link)
      VALUES (r.user_id, 'profile_changes_requested', 'Correction demandée',
              'Motif : Profil incomplet. Choisissez vos spécialités dans la nouvelle liste Bayele (3 au maximum). Modifiez votre profil : il repassera automatiquement en revue.',
              '/profile');
    END IF;
  END LOOP;
END $$;

-- 2. specialty validation on member writes
CREATE OR REPLACE FUNCTION private.validate_specialties()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    NEW.specialties := ARRAY(SELECT DISTINCT s FROM unnest(coalesce(NEW.specialties, '{}')) s ORDER BY 1);
    IF cardinality(NEW.specialties) > 3 THEN RAISE EXCEPTION 'too_many_specialties'; END IF;
    IF EXISTS (SELECT 1 FROM unnest(NEW.specialties) s
                WHERE NOT EXISTS (SELECT 1 FROM public.partner_specialties ps WHERE ps.code = s AND ps.active)) THEN
      RAISE EXCEPTION 'invalid_specialty';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.validate_specialties() FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE TRIGGER trg_validate_specialties BEFORE INSERT OR UPDATE OF specialties ON public.consultant_profiles
  FOR EACH ROW EXECUTE FUNCTION private.validate_specialties();

-- onboarding (0036 body) + G1 codes
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
  -- G1: partner specialties come from the fixed list (codes), at most 3.
  IF p_role = 'consultant' THEN
    IF cardinality(coalesce(p_specialties, '{}')) > 3 THEN RAISE EXCEPTION 'too_many_specialties'; END IF;
    IF EXISTS (SELECT 1 FROM unnest(coalesce(p_specialties, '{}')) s
                WHERE NOT EXISTS (SELECT 1 FROM public.partner_specialties ps WHERE ps.code = s AND ps.active)) THEN
      RAISE EXCEPTION 'invalid_specialty';
    END IF;
  END IF;
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
    VALUES (p_actor, ARRAY(SELECT DISTINCT s FROM unnest(COALESCE(p_specialties,'{}')) s ORDER BY 1), GREATEST(COALESCE(p_years_experience,0),0));
  ELSE
    IF p_company_name IS NULL OR length(trim(p_company_name)) = 0 THEN RAISE EXCEPTION 'company_name_required'; END IF;
    IF p_industry     IS NULL OR length(trim(p_industry))     = 0 THEN RAISE EXCEPTION 'industry_required';     END IF;
    INSERT INTO public.business_profiles (user_id, company_name, industry, billing_email)
    VALUES (p_actor, p_company_name, p_industry, p_billing_email);
  END IF;

  RETURN v_row;
END;
$$;

-- 3. legacy assignments for existing brand↔partner relationships
INSERT INTO public.partner_assignments (partner_id, brand_id, origin, status, note)
SELECT DISTINCT r.consultant_id, r.business_id, 'legacy_retainer', 'active', 'Relation existante (contrat agence)'
  FROM public.agency_retainers r
 WHERE (r.status IN ('funded', 'active', 'completed') OR r.partner_accepted_at IS NOT NULL)
   AND r.business_id <> r.consultant_id
   AND NOT EXISTS (SELECT 1 FROM public.partner_assignments a
                    WHERE a.partner_id = r.consultant_id AND a.brand_id = r.business_id AND a.campaign_id IS NULL
                      AND a.status = 'active');

-- 6a. G7: current consent version (single source of truth; must equal the web's NON_CIRCUMVENTION_VERSION).
--      A new clause = CREATE OR REPLACE this function in a new migration + bump the web constant together.
CREATE OR REPLACE FUNCTION private.current_consent_version(p_kind text DEFAULT 'cgu_non_circumvention')
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE WHEN p_kind IN ('cgu_non_circumvention', 'contact_request') THEN '2026-10-14' END;
$$;
REVOKE ALL ON FUNCTION private.current_consent_version(text) FROM PUBLIC, anon, authenticated;

-- true when the member's latest CGU non-circumvention acknowledgement is the current version
CREATE OR REPLACE FUNCTION private.has_current_consent(p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce((SELECT c.version = private.current_consent_version('cgu_non_circumvention')
                     FROM public.member_consents c WHERE c.user_id = p_user AND c.kind = 'cgu_non_circumvention'
                    ORDER BY c.created_at DESC, c.id DESC LIMIT 1), false);
$$;
REVOKE ALL ON FUNCTION private.has_current_consent(uuid) FROM PUBLIC, anon, authenticated;

-- 4. retainer proposals only to assigned partners (0035 body + guard)
CREATE OR REPLACE FUNCTION public.propose_retainer(
  p_consultant_id  uuid,
  p_contract_value bigint,
  p_bayele_cut     bigint,
  p_consultant_fee bigint,
  p_media_budget   bigint,
  p_kpi_bonus      bigint DEFAULT 0
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_retainer uuid; v_cut bigint; v_brand text; v_fee bigint; v_media bigint;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = v_actor AND ur.role = 'business') THEN
    RAISE EXCEPTION 'not_a_business';
  END IF;
  SELECT p.display_name INTO v_brand FROM public.profiles p WHERE p.id = v_actor AND p.status = 'active';
  IF v_brand IS NULL THEN RAISE EXCEPTION 'profile_not_active'; END IF;
  SELECT coalesce(bp.company_name, v_brand) INTO v_brand FROM public.business_profiles bp WHERE bp.user_id = v_actor;
  v_brand := coalesce(v_brand, 'Une marque');

  IF p_consultant_id = v_actor THEN RAISE EXCEPTION 'cannot_retain_self'; END IF;
  IF NOT private.is_active_partner(p_consultant_id) THEN RAISE EXCEPTION 'consultant_not_found'; END IF;
  -- G3: a brand proposes a retainer only to a partner Bayele assigned to it (the admin can propose on its behalf).
  PERFORM private.expire_assignment_windows(v_actor, p_consultant_id);
  IF NOT EXISTS (SELECT 1 FROM public.partner_assignments
                  WHERE brand_id = v_actor AND partner_id = p_consultant_id AND status = 'active') THEN
    RAISE EXCEPTION 'partner_not_assigned';
  END IF;
  -- G7: both parties acknowledged the current non-circumvention clause (DETAIL says whose is missing)
  IF NOT private.has_current_consent(v_actor) THEN RAISE EXCEPTION 'consent_required' USING DETAIL = 'brand'; END IF;
  IF NOT private.has_current_consent(p_consultant_id) THEN RAISE EXCEPTION 'consent_required' USING DETAIL = 'partner'; END IF;

  IF p_contract_value IS NULL OR p_contract_value <= 0 OR coalesce(p_consultant_fee, -1) < 0
     OR coalesce(p_media_budget, -1) < 0 OR coalesce(p_kpi_bonus, 0) < 0 THEN
    RAISE EXCEPTION 'invalid_amounts';
  END IF;
  v_cut := (p_contract_value * 25) / 100;                      -- O7: fixed, floor
  -- The client's cut is ignored. When fee + media do not add up to contract − cut (e.g. the pre-O7
  -- form, which let the brand type its own cut), the media budget absorbs the difference, then the
  -- fee if media would go negative. The stored row + the partner's notification show the final split.
  v_fee := p_consultant_fee; v_media := p_media_budget;
  IF v_fee + v_media <> p_contract_value - v_cut THEN
    v_media := p_contract_value - v_cut - v_fee;
    IF v_media < 0 THEN v_fee := p_contract_value - v_cut; v_media := 0; END IF;
  END IF;

  INSERT INTO public.agency_retainers
    (business_id, consultant_id, contract_value_fcfa, bayele_cut_fcfa, consultant_fee_fcfa, media_budget_fcfa, kpi_bonus_fcfa, status)
  VALUES (v_actor, p_consultant_id, p_contract_value, v_cut, v_fee, v_media, coalesce(p_kpi_bonus, 0), 'draft')
  RETURNING id INTO v_retainer;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (p_consultant_id, 'retainer_proposed', 'Nouveau contrat agence 📄',
          v_brand || ' vous propose un contrat agence de ' || p_contract_value::text || ' FCFA (honoraires ' ||
          v_fee::text || ' FCFA). Acceptez ou refusez dans l''application.',
          '/partner/retainers');
  RETURN v_retainer;
END;
$$;

-- 5. retainer-thread gating (0039 body + check)
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
    -- G3/G4 contact gating: a brand↔partner retainer thread needs the partner's consent (accepted retainer)
    -- or a Bayele assignment; no cold contact through a bare retainer proposal.
    IF v_business IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.agency_retainers r WHERE r.id = p_context_id AND r.partner_accepted_at IS NOT NULL)
       AND NOT EXISTS (SELECT 1 FROM public.partner_assignments a
                        WHERE a.brand_id = v_business AND a.partner_id = v_counterparty AND a.status = 'active') THEN
      RAISE EXCEPTION 'not_assigned';
    END IF;
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

-- 6b. contact requests: current consent version (0039 body + check; same signature)
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
  -- G7 (0040): the per-request consent and the brand's CGU acknowledgement must be the current version
  IF p_consent_version IS DISTINCT FROM private.current_consent_version('contact_request') OR NOT private.has_current_consent(v_actor) THEN
    RAISE EXCEPTION 'consent_required';
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
