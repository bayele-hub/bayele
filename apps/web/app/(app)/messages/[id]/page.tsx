import { redirect, notFound } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { getConversationView, getThreadMessages } from '@/lib/data/conversations';
import { MessageThread } from '@/components/message-thread';
import { getDictionary } from '@/i18n/dictionaries';
import { threadMode } from '@/lib/gov/rules';

export const dynamic = 'force-dynamic';

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session.userId) redirect('/auth?mode=signin');

  // RLS returns nothing for a non-participant → 404.
  const view = await getConversationView(id);
  if (!view) notFound();

  const [messages, { locale, t }] = await Promise.all([getThreadMessages(id), getDictionary()]);
  // §3.2: masked before a funded retainer; read-only when expired, suspended or closed.
  const mode = threadMode({ context: view.context, frozenReason: view.frozenReason, expiresAt: view.expiresAt, fundedRetainer: view.fundedRetainer, assignmentEnded: view.assignmentEnded });
  const pairThread = view.context === 'partner_assignment' || view.context === 'retainer';

  return (
    <MessageThread
      conversationId={view.id}
      viewerId={view.viewerId}
      counterpartyName={view.counterpartyName}
      counterpartyAvatarUrl={view.counterpartyAvatarUrl}
      initialMessages={messages}
      initialMuted={view.muted}
      gov={{ mode, pairThread, expiresAt: view.expiresAt, M: t.messaging, locale: locale === 'en' ? 'en' : 'fr', aria: t.admin.briefs.tips.aria }}
    />
  );
}
