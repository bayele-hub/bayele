import { redirect } from 'next/navigation';
import Link from 'next/link';
import { MessagesSquare } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { listConversations } from '@/lib/data/conversations';
import { SmartAvatar } from '@/components/smart-avatar';

export const dynamic = 'force-dynamic';

// Compact timestamp: time for today, day+month otherwise.
function when(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export default async function MessagesInbox() {
  const session = await getSession();
  if (!session.userId) redirect('/auth?mode=signin');

  const items = await listConversations();

  return (
    <section className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center gap-2">
        <MessagesSquare className="h-5 w-5 text-brand" />
        <h1 className="font-display text-xl font-extrabold text-ink">Messages</h1>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white p-10 text-center text-sm text-muted">
          Aucune conversation pour le moment. Écrivez à une marque ou un créateur depuis une collaboration.
        </div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white shadow-card">
          {items.map((c) => (
            <li key={c.conversationId}>
              <Link href={`/messages/${c.conversationId}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-surface">
                <SmartAvatar src={c.counterpartyAvatar} name={c.counterpartyName} className="h-11 w-11 text-sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`truncate ${c.unread ? 'font-extrabold text-ink' : 'font-bold text-ink'}`}>{c.counterpartyName}</p>
                    <span className="shrink-0 text-[11px] text-muted">{when(c.lastAt)}</span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <p className={`truncate text-xs ${c.unread ? 'font-semibold text-ink' : 'text-muted'}`}>{c.lastBody}</p>
                    {c.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-accent" aria-label="Non lu" />}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
