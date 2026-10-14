import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { getDictionary } from '@/i18n/dictionaries';
import { openConversation, type ConversationContext } from '@/lib/data/conversations';

export const dynamic = 'force-dynamic';

const VALID: ConversationContext[] = ['campaign_creator', 'retainer', 'partner_assignment'];

/**
 * Entry resolver: turns a deal reference into the conversation and redirects to the thread. Links
 * point here (e.g. /messages/open?ctx=campaign_creator&id=<campaign_creator_id>) so the thread is
 * created lazily on first open. Participation is enforced inside open_conversation. A retainer thread
 * before the pair is introduced (0040 `not_assigned`) or an ended introduction explains itself.
 */
export default async function OpenConversationPage({
  searchParams,
}: {
  searchParams: Promise<{ ctx?: string; id?: string }>;
}) {
  const session = await getSession();
  if (!session.userId) redirect('/auth?mode=signin');

  const { ctx, id } = await searchParams;
  const context = VALID.includes(ctx as ConversationContext) ? (ctx as ConversationContext) : null;
  if (!context || !id) redirect('/dashboard');

  const res = await openConversation(context, id);
  if (!res.id) {
    if (res.error === 'not_assigned' || res.error === 'assignment_not_active') {
      const { t } = await getDictionary();
      const text = res.error === 'not_assigned' ? t.messaging.errors.not_assigned : t.messaging.closed.ended;
      return (
        <section className="mx-auto max-w-lg space-y-3 rounded-2xl border border-line bg-white p-5 shadow-card">
          <p className="text-sm text-ink">{text}</p>
          <Link href="/messages" className="inline-flex min-h-tap items-center text-sm font-bold text-brand-700">← Messages</Link>
        </section>
      );
    }
    redirect('/dashboard');
  }

  redirect(`/messages/${res.id}`);
}
