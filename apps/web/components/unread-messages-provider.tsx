'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { createClient } from '@bayele/database/client';

const UnreadCtx = createContext(0);

/** Live count of the viewer's threads with unread messages. Read anywhere under the provider. */
export function useUnreadCount(): number {
  return useContext(UnreadCtx);
}

/**
 * Runs ONE authoritative source for the unread-messages badge and shares it via context, so the
 * header badge and the bottom-nav tab both stay live without duplicate subscriptions.
 *
 * The count refreshes from `my_unread_conversation_count()` on the events that can change it:
 *   - a `message_received` notification arrives (a thread just went unread) — same Realtime stream
 *     the bell uses;
 *   - the viewer reads a thread (MessageThread dispatches `bayele:messages-read`);
 *   - the tab regains focus, or the route changes.
 * Re-fetching the authoritative value (rather than incrementing) keeps it correct across tabs.
 */
export function UnreadMessagesProvider({
  userId,
  initial,
  children,
}: {
  userId: string | null;
  initial: number;
  children: React.ReactNode;
}) {
  const [count, setCount] = useState(initial);
  const pathname = usePathname();

  const refetch = useCallback(async () => {
    if (!userId) return;
    const supabase = createClient();
    const { data } = await supabase.rpc('my_unread_conversation_count');
    if (typeof data === 'number') setCount(data);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`msgbadge:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          if ((payload.new as { type?: string }).type === 'message_received') void refetch();
        },
      )
      .subscribe();
    const onRead = () => void refetch();
    window.addEventListener('bayele:messages-read', onRead);
    window.addEventListener('focus', onRead);
    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('bayele:messages-read', onRead);
      window.removeEventListener('focus', onRead);
    };
  }, [userId, refetch]);

  // Refresh on navigation (covers reading a thread then moving on).
  useEffect(() => {
    void refetch();
  }, [pathname, refetch]);

  return <UnreadCtx.Provider value={count}>{children}</UnreadCtx.Provider>;
}
