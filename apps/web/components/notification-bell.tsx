'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell, Check } from 'lucide-react';
import { createClient } from '@bayele/database/client';
import type { Database } from '@bayele/database';

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
  const [items, setItems] = useState<Notif[]>(initial);
  const [unread, setUnread] = useState(initialUnread);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Live subscription: new notifications for THIS user push straight into the bell (< 1s).
  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`notif:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          const n = payload.new as Notif;
          setItems((prev) => [n, ...prev].slice(0, 20));
          if (!n.read_at) setUnread((u) => u + 1);
        },
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

  async function markAllRead() {
    if (unread === 0) return;
    const now = new Date().toISOString();
    setUnread(0);
    setItems((prev) => prev.map((i) => ({ ...i, read_at: i.read_at ?? now })));
    const supabase = createClient();
    await supabase.from('notifications').update({ read_at: now }).is('read_at', null);
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
              <button onClick={markAllRead} className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline">
                <Check className="h-3 w-3" /> Tout marquer lu
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-muted">Aucune notification pour le moment.</p>
            ) : (
              <ul className="divide-y divide-line">
                {items.map((n) => (
                  <li key={n.id} className={`px-4 py-3 ${n.read_at ? '' : 'bg-brand-50/40'}`}>
                    <a href={n.link ?? '#'} className="block">
                      <div className="flex items-start gap-2">
                        {!n.read_at && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />}
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-ink">{n.title}</p>
                          {n.body && <p className="mt-0.5 text-xs text-muted">{n.body}</p>}
                        </div>
                      </div>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
