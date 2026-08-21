'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, Check } from 'lucide-react';
import { createClient } from '@bayele/database/client';
import type { Database } from '@bayele/database';
import { addIncoming, markOneRead, markAllRead, type NotifState } from '@/lib/notifications/state';

type Notif = Database['public']['Tables']['notifications']['Row'];

export function NotificationBell({
  userId,
  initial,
  initialUnread,
}: {
  userId: string | null;
  initial: Notif[];
  initialUnread: number;
}) {
  const [state, setState] = useState<NotifState<Notif>>({ items: initial, unread: initialUnread });
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { items, unread } = state;

  // Live subscription: new notifications for THIS user push straight into the bell (< 1s), deduped.
  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`notif:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => setState((s) => addIncoming(s, payload.new as Notif)),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Close on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  async function markAllReadHandler() {
    if (!userId || unread === 0) return;
    const now = new Date().toISOString();
    const prev = state;
    setState((s) => markAllRead(s, now)); // optimistic
    const supabase = createClient();
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: now })
      .eq('user_id', userId) // defense in depth alongside RLS
      .is('read_at', null);
    if (error) setState(prev); // revert on failure so the badge doesn't lie
  }

  // Mark a single notification read when the user opens it. Fire-and-forget: navigation proceeds
  // via <Link> regardless, and RLS scopes the update to the owner.
  function openOne(n: Notif) {
    setOpen(false);
    if (n.read_at) return;
    const now = new Date().toISOString();
    setState((s) => markOneRead(s, n.id, now));
    const supabase = createClient();
    void supabase.from('notifications').update({ read_at: now }).eq('id', n.id).is('read_at', null);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        aria-label="Notifications"
        onClick={() => setOpen((o) => !o)}
        className="relative grid min-h-tap min-w-tap place-items-center text-muted hover:text-ink"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-40 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-line bg-white shadow-cardHover">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="text-sm font-bold text-ink">Notifications</span>
            {unread > 0 && (
              <button onClick={markAllReadHandler} className="inline-flex min-h-tap items-center gap-1 text-xs font-semibold text-brand hover:underline">
                <Check className="h-3 w-3" /> Tout marquer lu
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-muted">Aucune notification pour le moment.</p>
            ) : (
              <ul className="divide-y divide-line">
                {items.map((n) => {
                  const body = (
                    <div className="flex items-start gap-2">
                      {!n.read_at && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink">{n.title}</p>
                        {n.body && <p className="mt-0.5 text-xs text-muted">{n.body}</p>}
                      </div>
                    </div>
                  );
                  return (
                    <li key={n.id} className={`px-4 py-3 ${n.read_at ? '' : 'bg-brand-50/40'}`}>
                      {n.link ? (
                        <Link href={n.link} onClick={() => openOne(n)} className="block transition hover:opacity-80">
                          {body}
                        </Link>
                      ) : !n.read_at ? (
                        <button type="button" onClick={() => openOne(n)} className="block w-full text-left transition hover:opacity-80">
                          {body}
                        </button>
                      ) : (
                        body
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
