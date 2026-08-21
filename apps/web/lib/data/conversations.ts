import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';

export type ConversationContext = 'campaign_creator' | 'retainer';

export interface ThreadMessage {
  id: string;
  body: string;
  sender_id: string;
  created_at: string;
}

export interface ConversationView {
  id: string;
  viewerId: string;
  counterpartyName: string;
  counterpartyAvatarUrl: string | null;
  counterpartyHandle: string | null;
  /** Whether the viewer has muted their own side of this thread. */
  muted: boolean;
}

/**
 * Load a conversation for the current viewer, or null if they can't see it (RLS returns no row for a
 * non-participant/non-admin). Resolves the "other party" for the header.
 */
export async function getConversationView(conversationId: string): Promise<ConversationView | null> {
  const session = await getSession();
  if (!session.userId) return null;

  const supabase = await createClient();
  const { data: conv } = await supabase
    .from('conversations')
    .select('id, business_id, counterparty_id, business_muted, counterparty_muted')
    .eq('id', conversationId)
    .maybeSingle();
  if (!conv) return null;

  const isBusiness = conv.business_id === session.userId;
  const otherId = isBusiness ? conv.counterparty_id : conv.business_id;
  const { data: other } = await supabase
    .from('profiles')
    .select('display_name, avatar_url, handle')
    .eq('id', otherId)
    .maybeSingle();

  return {
    id: conv.id,
    viewerId: session.userId,
    counterpartyName: other?.display_name ?? 'Interlocuteur',
    counterpartyAvatarUrl: other?.avatar_url ?? null,
    counterpartyHandle: other?.handle ?? null,
    muted: isBusiness ? conv.business_muted : conv.counterparty_muted,
  };
}

/** The most recent messages of a thread, oldest-first for display. RLS scopes to participants. */
export async function getThreadMessages(conversationId: string, limit = 100): Promise<ThreadMessage[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('messages')
    .select('id, body, sender_id, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? []).reverse();
}

export interface InboxItem {
  conversationId: string;
  counterpartyName: string;
  counterpartyAvatar: string | null;
  counterpartyHandle: string | null;
  lastBody: string;
  lastAt: string;
  unread: boolean;
}

/** The current user's active threads (newest first) for the inbox. Empty on any error. */
export async function listConversations(): Promise<InboxItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('list_my_conversations');
  if (error || !data) return [];
  return data.map((r) => ({
    conversationId: r.conversation_id,
    counterpartyName: r.counterparty_name ?? 'Interlocuteur',
    counterpartyAvatar: r.counterparty_avatar ?? null,
    counterpartyHandle: r.counterparty_handle ?? null,
    lastBody: r.last_body ?? '',
    lastAt: r.last_at,
    unread: r.unread ?? false,
  }));
}

/** Number of the current user's threads with an unread message (nav badge). */
export async function getUnreadMessageCount(): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase.rpc('my_unread_conversation_count');
  return typeof data === 'number' ? data : 0;
}

/**
 * Resolve (creating on first use) the conversation id for a deal, via the open_conversation RPC
 * which enforces that the caller is a participant. Returns null when the deal is missing or the
 * caller isn't a participant.
 */
export async function resolveConversationId(contextType: ConversationContext, contextId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('open_conversation', {
    p_context_type: contextType,
    p_context_id: contextId,
  });
  if (error || !data) return null;
  return data as string;
}
