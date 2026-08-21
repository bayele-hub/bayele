import { redirect, notFound } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { getConversationView, getThreadMessages } from '@/lib/data/conversations';
import { MessageThread } from '@/components/message-thread';

export const dynamic = 'force-dynamic';

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session.userId) redirect('/auth?mode=signin');

  // RLS returns nothing for a non-participant → 404.
  const view = await getConversationView(id);
  if (!view) notFound();

  const messages = await getThreadMessages(id);

  return (
    <MessageThread
      conversationId={view.id}
      viewerId={view.viewerId}
      counterpartyName={view.counterpartyName}
      counterpartyAvatarUrl={view.counterpartyAvatarUrl}
      initialMessages={messages}
    />
  );
}
