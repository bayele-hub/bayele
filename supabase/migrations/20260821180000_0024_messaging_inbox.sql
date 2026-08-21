-- 0024 — Inbox helpers for the messages list + nav badge. Both SECURITY DEFINER + scoped to the
-- caller via auth.uid(), so no cross-user leakage despite bypassing RLS.

-- One row per active thread the caller is in: the other party, the latest message, and whether the
-- caller has it unread. Newest thread first.
CREATE OR REPLACE FUNCTION public.list_my_conversations()
 RETURNS TABLE (
   conversation_id uuid,
   counterparty_id uuid,
   counterparty_name text,
   counterparty_avatar text,
   counterparty_handle text,
   last_body text,
   last_at timestamptz,
   unread boolean
 )
 LANGUAGE sql SECURITY DEFINER SET search_path TO '' STABLE
AS $function$
  SELECT
    c.id,
    CASE WHEN c.business_id = auth.uid() THEN c.counterparty_id ELSE c.business_id END,
    p.display_name,
    p.avatar_url,
    p.handle,
    m.body,
    c.last_message_at,
    (CASE WHEN c.business_id = auth.uid() THEN c.business_last_read_at ELSE c.counterparty_last_read_at END IS NULL
      OR (CASE WHEN c.business_id = auth.uid() THEN c.business_last_read_at ELSE c.counterparty_last_read_at END) < c.last_message_at)
  FROM public.conversations c
  LEFT JOIN LATERAL (
    SELECT mm.body FROM public.messages mm WHERE mm.conversation_id = c.id ORDER BY mm.created_at DESC LIMIT 1
  ) m ON true
  LEFT JOIN public.profiles p
    ON p.id = (CASE WHEN c.business_id = auth.uid() THEN c.counterparty_id ELSE c.business_id END)
  WHERE (c.business_id = auth.uid() OR c.counterparty_id = auth.uid())
    AND c.last_message_at IS NOT NULL
  ORDER BY c.last_message_at DESC;
$function$;

-- Count of the caller's threads with an unread message (for the nav badge).
CREATE OR REPLACE FUNCTION public.my_unread_conversation_count()
 RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path TO '' STABLE
AS $function$
  SELECT count(*)::int FROM public.conversations c
  WHERE (c.business_id = auth.uid() OR c.counterparty_id = auth.uid())
    AND c.last_message_at IS NOT NULL
    AND (CASE WHEN c.business_id = auth.uid() THEN c.business_last_read_at ELSE c.counterparty_last_read_at END IS NULL
      OR (CASE WHEN c.business_id = auth.uid() THEN c.business_last_read_at ELSE c.counterparty_last_read_at END) < c.last_message_at);
$function$;

GRANT EXECUTE ON FUNCTION public.list_my_conversations() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_unread_conversation_count() TO authenticated;
