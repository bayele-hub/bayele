-- 0023 — Deal-anchored messaging (Phase 1). A conversation is tied to exactly one deal
-- (a campaign_creators row or an agency_retainers row). Only its two participants (and admins,
-- for disputes) can read; writes go ONLY through SECURITY DEFINER RPCs so participant checks,
-- the recipient notification, and rate limiting can't be bypassed.

CREATE TYPE public.conversation_context AS ENUM ('campaign_creator', 'retainer');

CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  context_type public.conversation_context NOT NULL,
  context_id uuid NOT NULL,
  business_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  counterparty_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  business_last_read_at timestamptz,
  counterparty_last_read_at timestamptz,
  last_message_at timestamptz,               -- NULL until the first message (drives notify debounce)
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (context_type, context_id)          -- one thread per deal
);

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX messages_conversation_created_idx ON public.messages (conversation_id, created_at);
CREATE INDEX conversations_counterparty_idx ON public.conversations (counterparty_id, last_message_at DESC);
CREATE INDEX conversations_business_idx ON public.conversations (business_id, last_message_at DESC);

-- Reads: participants + admins. Writes: none direct — only the definer RPCs below.
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.conversations TO authenticated;
GRANT SELECT ON public.messages TO authenticated;

CREATE POLICY "participants read conversations" ON public.conversations FOR SELECT USING (
  business_id = (SELECT auth.uid()) OR counterparty_id = (SELECT auth.uid()) OR private.is_admin(auth.uid())
);
CREATE POLICY "participants read messages" ON public.messages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = messages.conversation_id
      AND (c.business_id = (SELECT auth.uid()) OR c.counterparty_id = (SELECT auth.uid()) OR private.is_admin(auth.uid()))
  )
);

-- Live delivery reuses the notifications realtime setup.
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- ── RPCs ─────────────────────────────────────────────────────────────────────
-- Resolve (or lazily create) the thread for a deal. Caller must be a participant of that deal.
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

-- Send a message. Validates participant + length, rate-limits, and notifies the other party
-- only when they had no unread message already (so a burst doesn't spam the bell).
CREATE OR REPLACE FUNCTION public.send_message(p_conversation_id uuid, p_body text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_business uuid; v_counterparty uuid; v_prev_last timestamptz;
  v_recipient uuid; v_recip_last_read timestamptz; v_already_unread boolean;
  v_body text := btrim(coalesce(p_body, '')); v_recent int; v_msg uuid; v_sender text;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF char_length(v_body) < 1 OR char_length(v_body) > 4000 THEN RAISE EXCEPTION 'invalid_body'; END IF;

  SELECT business_id, counterparty_id, last_message_at
    INTO v_business, v_counterparty, v_prev_last
    FROM public.conversations WHERE id = p_conversation_id FOR UPDATE;
  IF v_business IS NULL THEN RAISE EXCEPTION 'conversation_not_found'; END IF;
  IF v_actor <> v_business AND v_actor <> v_counterparty THEN RAISE EXCEPTION 'not_a_participant'; END IF;

  -- recipient + their read cursor
  IF v_actor = v_business THEN
    v_recipient := v_counterparty;
    SELECT counterparty_last_read_at INTO v_recip_last_read FROM public.conversations WHERE id = p_conversation_id;
  ELSE
    v_recipient := v_business;
    SELECT business_last_read_at INTO v_recip_last_read FROM public.conversations WHERE id = p_conversation_id;
  END IF;

  -- lightweight rate limit: at most 8 messages from this sender in this thread per 10 seconds
  SELECT count(*) INTO v_recent FROM public.messages
    WHERE conversation_id = p_conversation_id AND sender_id = v_actor AND created_at > now() - interval '10 seconds';
  IF v_recent >= 8 THEN RAISE EXCEPTION 'rate_limited'; END IF;

  INSERT INTO public.messages (conversation_id, sender_id, body)
  VALUES (p_conversation_id, v_actor, v_body) RETURNING id INTO v_msg;

  -- bump activity; sender has implicitly read their own message
  IF v_actor = v_business THEN
    UPDATE public.conversations SET last_message_at = now(), business_last_read_at = now() WHERE id = p_conversation_id;
  ELSE
    UPDATE public.conversations SET last_message_at = now(), counterparty_last_read_at = now() WHERE id = p_conversation_id;
  END IF;

  -- notify the recipient only if this is their first unread (debounce)
  v_already_unread := (v_prev_last IS NOT NULL) AND (v_recip_last_read IS NULL OR v_recip_last_read < v_prev_last);
  IF NOT v_already_unread THEN
    SELECT display_name INTO v_sender FROM public.profiles WHERE id = v_actor;
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (v_recipient, 'message_received', 'Nouveau message',
            coalesce(v_sender, 'Quelqu''un') || ' : ' || left(v_body, 80),
            '/messages/' || p_conversation_id::text);
  END IF;

  RETURN v_msg;
END;
$function$;

-- Mark the thread read for the caller (their side only).
CREATE OR REPLACE FUNCTION public.mark_conversation_read(p_conversation_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_actor uuid := auth.uid(); v_business uuid; v_counterparty uuid;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT business_id, counterparty_id INTO v_business, v_counterparty
    FROM public.conversations WHERE id = p_conversation_id;
  IF v_business IS NULL THEN RAISE EXCEPTION 'conversation_not_found'; END IF;
  IF v_actor = v_business THEN
    UPDATE public.conversations SET business_last_read_at = now() WHERE id = p_conversation_id;
  ELSIF v_actor = v_counterparty THEN
    UPDATE public.conversations SET counterparty_last_read_at = now() WHERE id = p_conversation_id;
  ELSE
    RAISE EXCEPTION 'not_a_participant';
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.open_conversation(public.conversation_context, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_message(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_conversation_read(uuid) TO authenticated;
