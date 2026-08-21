-- 0021 — Let pending (not-yet-approved) creators APPLY to campaigns, so a shared campaign link
-- (LinkedIn-job style) converts immediately. Payment stays fully gated: a brand can only APPROVE a
-- creator whose profile is 'active' (admin-verified), and approval is the gateway to proof submission,
-- escrow earmarking and payout. Suspended/rejected creators cannot apply at all.

-- 1) apply_to_campaign: allow 'active' AND 'pending_review'; block 'suspended'/'rejected'.
CREATE OR REPLACE FUNCTION public.apply_to_campaign(p_campaign_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_owner uuid; v_status public.campaign_status; v_payout bigint; v_title text;
  v_cc uuid; v_pstatus public.account_status;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = v_actor AND ur.role = 'creator') THEN
    RAISE EXCEPTION 'not_a_creator';
  END IF;
  SELECT p.status INTO v_pstatus FROM public.profiles p WHERE p.id = v_actor;
  -- Pending creators may apply (they enter the pipeline); only suspended/rejected are blocked.
  IF v_pstatus IS NULL OR v_pstatus IN ('suspended','rejected') THEN
    RAISE EXCEPTION 'profile_not_eligible';
  END IF;
  SELECT owner_id, status, payout_per_creator_fcfa, title
    INTO v_owner, v_status, v_payout, v_title
    FROM public.campaigns WHERE id = p_campaign_id FOR UPDATE;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'campaign_not_found'; END IF;
  IF v_owner = v_actor THEN RAISE EXCEPTION 'cannot_apply_own_campaign'; END IF;
  IF v_status NOT IN ('published','in_progress') THEN RAISE EXCEPTION 'campaign_not_open'; END IF;
  IF EXISTS (SELECT 1 FROM public.campaign_creators cc
             WHERE cc.campaign_id = p_campaign_id AND cc.creator_id = v_actor) THEN
    RAISE EXCEPTION 'already_applied';
  END IF;
  INSERT INTO public.campaign_creators (campaign_id, creator_id, status, agreed_payout_fcfa)
  VALUES (p_campaign_id, v_actor, 'applied', v_payout)
  RETURNING id INTO v_cc;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (v_owner, 'campaign_application', 'Nouvelle candidature',
          'Un créateur a postulé à « ' || v_title || ' ».',
          '/business/campaigns/' || p_campaign_id::text);
  RETURN v_cc;
END;
$function$;

-- 2) decide_application: a brand may only APPROVE a verified (active) creator. This is the payment
-- gate — approval unlocks proof submission, escrow earmarking and payout, so unverified creators can
-- never pull money from the pool. Rejection is always allowed.
CREATE OR REPLACE FUNCTION public.decide_application(p_campaign_creator_id uuid, p_approve boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_campaign uuid; v_creator uuid; v_cc_status public.creator_campaign_status;
  v_owner uuid; v_camp_status public.campaign_status; v_target int; v_title text; v_approved int;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT cc.campaign_id, cc.creator_id, cc.status, c.owner_id, c.status, c.creator_count_target, c.title
    INTO v_campaign, v_creator, v_cc_status, v_owner, v_camp_status, v_target, v_title
    FROM public.campaign_creators cc
    JOIN public.campaigns c ON c.id = cc.campaign_id
    WHERE cc.id = p_campaign_creator_id
    FOR UPDATE OF cc;
  IF v_campaign IS NULL THEN RAISE EXCEPTION 'application_not_found'; END IF;
  IF NOT (v_owner = v_actor OR private.is_admin(v_actor)) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF (p_approve AND v_cc_status = 'approved') OR (NOT p_approve AND v_cc_status = 'rejected') THEN RETURN; END IF;
  IF v_cc_status <> 'applied' THEN RAISE EXCEPTION 'not_pending'; END IF;

  IF p_approve THEN
    -- Payment gate: only an admin-verified (active) creator can enter the paid pipeline.
    IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v_creator AND p.status = 'active') THEN
      RAISE EXCEPTION 'creator_not_verified';
    END IF;
    PERFORM 1 FROM public.campaigns WHERE id = v_campaign FOR UPDATE;
    SELECT count(*) INTO v_approved FROM public.campaign_creators
      WHERE campaign_id = v_campaign AND status IN ('approved','content_submitted','verified','paid');
    IF v_approved >= v_target THEN RAISE EXCEPTION 'campaign_full'; END IF;
    UPDATE public.campaign_creators SET status = 'approved', updated_at = now() WHERE id = p_campaign_creator_id;
    IF v_camp_status = 'published' THEN
      UPDATE public.campaigns SET status = 'in_progress', updated_at = now() WHERE id = v_campaign;
    END IF;
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (v_creator, 'application_approved', 'Candidature acceptée 🎉',
            'Vous êtes retenu pour « ' || v_title || ' ». Publiez puis soumettez votre preuve.',
            '/creator/dashboard');
  ELSE
    UPDATE public.campaign_creators SET status = 'rejected', updated_at = now() WHERE id = p_campaign_creator_id;
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (v_creator, 'application_rejected', 'Candidature non retenue',
            'Votre candidature à « ' || v_title || ' » n''a pas été retenue cette fois.',
            '/creator/dashboard');
  END IF;
END;
$function$;
