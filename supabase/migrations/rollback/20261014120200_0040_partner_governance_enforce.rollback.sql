-- ============================================================================
-- Rollback of:        20261014120200_0040_partner_governance_enforce.sql
-- Inverse type:       PARTIAL INVERSE — restores onboard_profile (0036), propose_retainer (0035),
--                     open_conversation (0039) and request_partner_contact (0039) and removes the specialty validation + legacy assignments.
--                     The specialty mapping is NOT reverted (codes stay; originals remain in specialties_legacy)
--                     and correction requests already sent stay. Roll back 0040 before 0039 (and 0037 if needed).
-- Run in the SQL editor (contains DROP/DELETE — not the connector).
-- ============================================================================

DROP TRIGGER IF EXISTS trg_validate_specialties ON public.consultant_profiles;
DROP FUNCTION IF EXISTS private.validate_specialties();
DELETE FROM public.partner_assignments WHERE origin = 'legacy_retainer' AND conversation_id IS NULL;

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

-- G7 consent version check (0040 §6): restore the 0039 request_partner_contact, then the helpers go
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
DROP FUNCTION IF EXISTS private.has_current_consent(uuid);
DROP FUNCTION IF EXISTS private.current_consent_version(text);

DELETE FROM supabase_migrations.schema_migrations WHERE version = '20261014120200';
