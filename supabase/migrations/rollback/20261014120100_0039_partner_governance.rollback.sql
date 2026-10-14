-- ============================================================================
-- Rollback of:        20261014120100_0039_partner_governance.sql
-- Inverse type:       TRUE INVERSE when no governance data exists — aborts otherwise (consents, assignments,
--                     contact requests, flags, screenshots are legal / money records; export first).
--                     Restores send_message (0025), open_conversation (0023), partner_apply_for_creator (0035),
--                     admin_confirm_partner_commission (0027), admin_confirm_retainer_settlement (0035),
--                     review_proof (0013), admin_member_detail (0036), guard_consultant_profiles (0016) and the
--                     two directory policies. Roll back 0040 first. SQL editor only (DROP/DELETE).
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_validate_specialties') THEN RAISE EXCEPTION 'rollback_0039_blocked: roll back 0040 first'; END IF;
  IF EXISTS (SELECT 1 FROM public.partner_assignments) OR EXISTS (SELECT 1 FROM public.partner_contact_requests)
     OR EXISTS (SELECT 1 FROM public.message_flags) OR EXISTS (SELECT 1 FROM public.self_dealing_flags)
     OR EXISTS (SELECT 1 FROM public.member_consents) OR EXISTS (SELECT 1 FROM public.proof_media)
     OR EXISTS (SELECT 1 FROM public.message_originals) OR EXISTS (SELECT 1 FROM public.assignment_end_requests)
     OR EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'proofs') THEN
    RAISE EXCEPTION 'rollback_0039_blocked: partner-governance data exists';
  END IF;
END $$;

-- P5 purge job (only when the cron extension is installed)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    EXECUTE $c$SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'bayele_purge_masked_originals'$c$;
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_freeze_on_suspension ON public.profiles;
DROP TRIGGER IF EXISTS trg_city_normalize ON public.profiles;
DROP TRIGGER IF EXISTS trg_mask_message_row ON public.messages;
DROP TRIGGER IF EXISTS trg_extend_assignment_window ON public.agency_retainers;
DROP POLICY IF EXISTS "proofs creator upload" ON storage.objects;
DROP POLICY IF EXISTS "proofs parties read" ON storage.objects;
DELETE FROM storage.buckets WHERE id = 'proofs';

ALTER POLICY "public profiles are readable" ON public.profiles USING (
  status = 'active'
  AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = profiles.id AND ur.role IN ('creator', 'consultant'))
);
ALTER POLICY "public read active consultant profiles" ON public.consultant_profiles USING (
  EXISTS (SELECT 1 FROM public.profiles p JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'consultant'
           WHERE p.id = consultant_profiles.user_id AND p.status = 'active')
);

-- pre-0039 bodies
CREATE OR REPLACE FUNCTION public.send_message(p_conversation_id uuid, p_body text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_business uuid; v_counterparty uuid; v_prev_last timestamptz;
  v_recipient uuid; v_recip_last_read timestamptz; v_recipient_muted boolean := false;
  v_already_unread boolean;
  v_body text := btrim(coalesce(p_body, '')); v_recent int; v_msg uuid; v_sender text;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF char_length(v_body) < 1 OR char_length(v_body) > 4000 THEN RAISE EXCEPTION 'invalid_body'; END IF;

  SELECT business_id, counterparty_id, last_message_at
    INTO v_business, v_counterparty, v_prev_last
    FROM public.conversations WHERE id = p_conversation_id FOR UPDATE;
  IF v_business IS NULL THEN RAISE EXCEPTION 'conversation_not_found'; END IF;
  IF v_actor <> v_business AND v_actor <> v_counterparty THEN RAISE EXCEPTION 'not_a_participant'; END IF;

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

  INSERT INTO public.messages (conversation_id, sender_id, body)
  VALUES (p_conversation_id, v_actor, v_body) RETURNING id INTO v_msg;

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

CREATE OR REPLACE FUNCTION public.open_conversation(p_context_type public.conversation_context, p_context_id uuid)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_business uuid; v_counterparty uuid; v_id uuid;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  IF p_context_type = 'campaign_creator' THEN
    SELECT c.owner_id, cc.creator_id INTO v_business, v_counterparty
      FROM public.campaign_creators cc JOIN public.campaigns c ON c.id = cc.campaign_id
      WHERE cc.id = p_context_id;
  ELSIF p_context_type = 'retainer' THEN
    SELECT r.business_id, r.consultant_id INTO v_business, v_counterparty
      FROM public.agency_retainers r WHERE r.id = p_context_id;
  END IF;

  IF v_business IS NULL THEN RAISE EXCEPTION 'deal_not_found'; END IF;
  IF v_actor <> v_business AND v_actor <> v_counterparty THEN RAISE EXCEPTION 'not_a_participant'; END IF;

  INSERT INTO public.conversations (context_type, context_id, business_id, counterparty_id)
  VALUES (p_context_type, p_context_id, v_business, v_counterparty)
  ON CONFLICT (context_type, context_id) DO UPDATE SET context_id = EXCLUDED.context_id
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.partner_apply_for_creator(p_campaign_id uuid, p_creator_id uuid)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_owner uuid; v_status public.campaign_status; v_payout bigint; v_title text;
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

  SELECT owner_id, status, payout_per_creator_fcfa, title
    INTO v_owner, v_status, v_payout, v_title
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
  UPDATE public.partner_commissions
     SET status = 'paid', provider = p_provider, disbursement_ref = btrim(p_disbursement_ref), paid_at = now()
   WHERE id = p_commission_id;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (v_partner, 'commission_paid', 'Commission versée 💸',
          'Votre commission de ' || v_amount::text || ' FCFA a été envoyée.', '/partner/creators');
END;
$function$;

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

CREATE OR REPLACE FUNCTION public.review_proof(
  p_proof_id uuid, p_approve boolean, p_reason text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_creator uuid; v_title text;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  -- verify_proof_of_post raises if the actor is neither the campaign owner nor an admin.
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

DROP FUNCTION IF EXISTS public.record_consent(text, text, uuid);
DROP FUNCTION IF EXISTS public.my_consents();
DROP FUNCTION IF EXISTS public.admin_self_dealing_flags(text);
DROP FUNCTION IF EXISTS public.admin_decide_self_dealing_flag(uuid, text, text);
DROP FUNCTION IF EXISTS public.admin_set_commission_rate(uuid, numeric, text);
DROP FUNCTION IF EXISTS public.admin_set_partner_listing(uuid, boolean, text);
DROP FUNCTION IF EXISTS public.admin_end_representation(uuid, text);
DROP FUNCTION IF EXISTS public.admin_assign_partner(uuid, uuid, uuid, text);
DROP FUNCTION IF EXISTS public.respond_assignment(uuid, boolean, text);   -- pre-P3 builds only
DROP FUNCTION IF EXISTS public.request_assignment_end(uuid, text);
DROP FUNCTION IF EXISTS public.admin_assignment_end_requests(text);
DROP FUNCTION IF EXISTS public.admin_dismiss_assignment_end_request(uuid, text);
DROP FUNCTION IF EXISTS public.admin_read_masked_original(uuid, text);
DROP FUNCTION IF EXISTS public.admin_search_brands(text, integer);
DROP FUNCTION IF EXISTS public.admin_partner_list(text, public.account_status, boolean, text, integer, integer);
DROP FUNCTION IF EXISTS private.store_masked_original(uuid, uuid, uuid, text, text[]);
DROP FUNCTION IF EXISTS private.purge_masked_originals();
DROP FUNCTION IF EXISTS public.admin_end_assignment(uuid, text);
DROP FUNCTION IF EXISTS public.admin_propose_retainer(uuid, uuid, bigint, bigint, bigint, bigint);
DROP FUNCTION IF EXISTS public.request_partner_contact(uuid, text, text, date, text);
DROP FUNCTION IF EXISTS public.withdraw_contact_request(uuid);
DROP FUNCTION IF EXISTS public.admin_decide_contact_request(uuid, boolean, text, text);
DROP FUNCTION IF EXISTS public.admin_contact_requests(text);
DROP FUNCTION IF EXISTS public.report_offplatform_contact(uuid, text);
DROP FUNCTION IF EXISTS public.admin_message_flags(text, integer);
DROP FUNCTION IF EXISTS public.admin_resolve_flag(uuid, text);
DROP FUNCTION IF EXISTS public.admin_partner_overview(uuid);
DROP FUNCTION IF EXISTS public.creator_submit_whatsapp_proof(uuid, text, text, text, text, text, text);
DROP FUNCTION IF EXISTS public.request_proof_recapture(uuid, text);
DROP FUNCTION IF EXISTS public.admin_add_city(public.country_code, text, smallint);
DROP FUNCTION IF EXISTS private.freeze_on_suspension();
DROP FUNCTION IF EXISTS private.normalize_profile_city();
DROP FUNCTION IF EXISTS private.mask_message_row();
DROP FUNCTION IF EXISTS private.extend_assignment_window();
DROP FUNCTION IF EXISTS private.open_assignment_conversation(uuid);
DROP FUNCTION IF EXISTS private.create_assignment(uuid, uuid, uuid, text, uuid, text, uuid);
DROP FUNCTION IF EXISTS private.expire_assignment_windows(uuid, uuid);
DROP FUNCTION IF EXISTS private.is_available_partner(uuid);
DROP FUNCTION IF EXISTS private.partner_payouts_on_hold(uuid);
DROP FUNCTION IF EXISTS private.check_self_dealing(uuid, uuid, text);
DROP FUNCTION IF EXISTS private.self_dealing_kinds(uuid, uuid);
DROP FUNCTION IF EXISTS private.masking_applies(uuid);
DROP FUNCTION IF EXISTS private.pair_has_funded_retainer(uuid, uuid);
DROP FUNCTION IF EXISTS private.mask_contacts(text);
DROP FUNCTION IF EXISTS private.require_consent(text, text, uuid);
DROP FUNCTION IF EXISTS private.can_upload_proof(uuid, text);
DROP FUNCTION IF EXISTS private.can_read_proof(uuid, text);
DROP FUNCTION IF EXISTS private.is_hidden_partner(uuid);
DROP FUNCTION IF EXISTS private.specialty_code_for(text);
DROP FUNCTION IF EXISTS private.listed_city(public.country_code, text);
DROP FUNCTION IF EXISTS private.notify_admins(text, text, text, text);

ALTER TABLE IF EXISTS public.partner_contact_requests DROP CONSTRAINT IF EXISTS pcr_assignment_fkey;
DROP TABLE IF EXISTS public.proof_media;
DROP TABLE IF EXISTS public.message_originals;
DROP TABLE IF EXISTS public.assignment_end_requests;
DROP TABLE IF EXISTS public.message_flags;
DROP TABLE IF EXISTS public.self_dealing_flags;
DROP TABLE IF EXISTS public.partner_assignments;
DROP TABLE IF EXISTS public.partner_contact_requests;
DROP TABLE IF EXISTS public.member_consents;
DROP TABLE IF EXISTS public.partner_specialty_aliases;
DROP TABLE IF EXISTS public.partner_specialties;
DROP TABLE IF EXISTS public.cities;
DROP FUNCTION IF EXISTS private.text_key(text);

ALTER TABLE public.consultant_profiles DROP CONSTRAINT IF EXISTS consultant_listing_reason_len,
  DROP COLUMN IF EXISTS specialties_legacy, DROP COLUMN IF EXISTS directory_listed, DROP COLUMN IF EXISTS listing_reason,
  DROP COLUMN IF EXISTS listing_changed_at, DROP COLUMN IF EXISTS listing_changed_by;
ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_frozen_reason,
  DROP COLUMN IF EXISTS frozen_at, DROP COLUMN IF EXISTS frozen_reason, DROP COLUMN IF EXISTS expires_at;
ALTER TABLE public.messages DROP COLUMN IF EXISTS masked_kinds;
ALTER TABLE public.proof_of_post DROP CONSTRAINT IF EXISTS proof_recapture_reason_len,
  DROP COLUMN IF EXISTS recapture_requested_at, DROP COLUMN IF EXISTS recapture_reason,
  DROP COLUMN IF EXISTS recapture_count, DROP COLUMN IF EXISTS resubmitted_at;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS city_in_list;

DELETE FROM supabase_migrations.schema_migrations WHERE version = '20261014120100';
