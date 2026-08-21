-- 0025 — Messaging safety: per-participant mute + report-to-admin. send_message becomes mute-aware.

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS business_muted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS counterparty_muted boolean NOT NULL DEFAULT false;

-- Mute/unmute the caller's own side of a thread (stops message_received notifications for them).
CREATE OR REPLACE FUNCTION public.set_conversation_muted(p_conversation_id uuid, p_muted boolean)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_actor uuid := auth.uid(); v_business uuid; v_counterparty uuid;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT business_id, counterparty_id INTO v_business, v_counterparty
    FROM public.conversations WHERE id = p_conversation_id;
  IF v_business IS NULL THEN RAISE EXCEPTION 'conversation_not_found'; END IF;
  IF v_actor = v_business THEN
    UPDATE public.conversations SET business_muted = p_muted WHERE id = p_conversation_id;
  ELSIF v_actor = v_counterparty THEN
    UPDATE public.conversations SET counterparty_muted = p_muted WHERE id = p_conversation_id;
  ELSE
    RAISE EXCEPTION 'not_a_participant';
  END IF;
END;
$function$;

-- Report a thread to the admins (routes into their notification bell for dispute review).
CREATE OR REPLACE FUNCTION public.report_conversation(p_conversation_id uuid, p_reason text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid := auth.uid(); v_business uuid; v_counterparty uuid;
  v_reporter text; v_reason text := btrim(coalesce(p_reason, ''));
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT business_id, counterparty_id INTO v_business, v_counterparty
    FROM public.conversations WHERE id = p_conversation_id;
  IF v_business IS NULL THEN RAISE EXCEPTION 'conversation_not_found'; END IF;
  IF v_actor <> v_business AND v_actor <> v_counterparty THEN RAISE EXCEPTION 'not_a_participant'; END IF;

  SELECT display_name INTO v_reporter FROM public.profiles WHERE id = v_actor;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  SELECT ur.user_id, 'conversation_reported', 'Conversation signalée',
         coalesce(v_reporter, 'Un utilisateur') || ' a signalé une conversation' ||
           CASE WHEN v_reason <> '' THEN ' : ' || left(v_reason, 120) ELSE '.' END,
         '/messages/' || p_conversation_id::text
  FROM public.user_roles ur WHERE ur.role = 'super_admin';
END;
$function$;

-- send_message, now mute-aware: skip the recipient notification when they've muted the thread.
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

GRANT EXECUTE ON FUNCTION public.set_conversation_muted(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_conversation(uuid, text) TO authenticated;
