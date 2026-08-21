import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { resolveConversationId, type ConversationContext } from '@/lib/data/conversations';

export const dynamic = 'force-dynamic';

const VALID: ConversationContext[] = ['campaign_creator', 'retainer'];

/**
 * Entry resolver: turns a deal reference into the conversation and redirects to the thread. Links
 * point here (e.g. /messages/open?ctx=campaign_creator&id=<campaign_creator_id>) so the thread is
 * created lazily on first open. Participation is enforced inside open_conversation.
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

  const conversationId = await resolveConversationId(context, id);
  if (!conversationId) redirect('/dashboard');

  redirect(`/messages/${conversationId}`);
}
