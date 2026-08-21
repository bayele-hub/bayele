'use server';

import { createClient } from '@/lib/supabase/server';

export type SendState = { error: string | null; ok?: boolean };

/**
 * Send a message. All authorization (participant check), length, rate limiting and the recipient
 * notification live in the send_message RPC; this action only relays the session and maps errors.
 * Delivery to the UI comes over Realtime (the sender is subscribed to the same thread), so there's
 * nothing to revalidate here.
 */
export async function sendMessageAction(_prev: SendState, formData: FormData): Promise<SendState> {
  const conversationId = String(formData.get('conversation') ?? '');
  const body = String(formData.get('body') ?? '').trim();
  if (!conversationId) return { error: 'Conversation manquante.' };
  if (!body) return { error: 'Écrivez un message.' };
  if (body.length > 4000) return { error: 'Message trop long (4000 caractères maximum).' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('send_message', { p_conversation_id: conversationId, p_body: body });

  if (error) {
    const msg = (error.message ?? '').trim();
    if (msg === 'rate_limited') return { error: 'Vous envoyez trop de messages — patientez un instant.' };
    if (msg === 'not_a_participant') return { error: "Vous ne faites pas partie de cette conversation." };
    if (msg === 'invalid_body') return { error: 'Message vide ou trop long.' };
    return { error: "L'envoi a échoué. Réessayez." };
  }
  return { error: null, ok: true };
}

/** Mark the caller's side of a thread read. Called when the thread is opened. */
export async function markConversationRead(conversationId: string): Promise<void> {
  if (!conversationId) return;
  const supabase = await createClient();
  await supabase.rpc('mark_conversation_read', { p_conversation_id: conversationId });
}
