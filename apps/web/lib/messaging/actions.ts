'use server';

import { createClient } from '@/lib/supabase/server';
import { getDictionary } from '@/i18n/dictionaries';
import type { ContactKind } from '@/lib/gov/contact-detect';

export type SendState = { error: string | null; ok?: boolean; code?: string | null; maskedKinds?: ContactKind[] | null; sentAt?: number };

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
  const { data: messageId, error } = await supabase.rpc('send_message', { p_conversation_id: conversationId, p_body: body });

  if (error) {
    const msg = (error.message ?? '').trim();
    if (msg === 'rate_limited') return { error: 'Vous envoyez trop de messages — patientez un instant.', code: msg };
    if (msg === 'not_a_participant') return { error: "Vous ne faites pas partie de cette conversation.", code: msg };
    if (msg === 'invalid_body') return { error: 'Message vide ou trop long.', code: msg };
    // Partner governance (0039): expired window, frozen or closed thread → the composer turns read-only.
    if (msg === 'conversation_expired' || msg === 'conversation_frozen' || msg === 'conversation_closed') {
      const { t } = await getDictionary();
      return { error: t.messaging.errors[msg], code: msg };
    }
    return { error: "L'envoi a échoué. Réessayez.", code: msg || null };
  }
  // G5 §4.3: read back what the server masked (the body is already masked) for the sender feedback.
  let maskedKinds: ContactKind[] | null = null;
  if (messageId) {
    const { data } = await supabase.from('messages').select('masked_kinds').eq('id', messageId as string).maybeSingle();
    maskedKinds = (data?.masked_kinds as ContactKind[] | null) ?? null;
  }
  return { error: null, ok: true, maskedKinds, sentAt: Date.now() };
}

/** G6 « Signaler une demande hors plateforme » → flags queue (rate-limited server-side). */
export async function reportOffplatformAction(conversationId: string, reason: string): Promise<{ ok: boolean; error?: string }> {
  const { t } = await getDictionary();
  const R = t.messaging.report;
  if (!conversationId) return { ok: false, error: R.error };
  const supabase = await createClient();
  const { error } = await supabase.rpc('report_offplatform_contact', { p_conversation_id: conversationId, p_reason: reason.trim().slice(0, 300) || undefined });
  if (error) return { ok: false, error: error.message === 'rate_limited' ? R.rate_limited : R.error };
  return { ok: true };
}

/** Mark the caller's side of a thread read. Called when the thread is opened. */
export async function markConversationRead(conversationId: string): Promise<void> {
  if (!conversationId) return;
  const supabase = await createClient();
  await supabase.rpc('mark_conversation_read', { p_conversation_id: conversationId });
}

/** Mute/unmute the caller's side of a thread (silences message_received notifications). */
export async function setMutedAction(conversationId: string, muted: boolean): Promise<{ error: string | null }> {
  if (!conversationId) return { error: 'Conversation manquante.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_conversation_muted', {
    p_conversation_id: conversationId,
    p_muted: muted,
  });
  return { error: error ? 'Action impossible. Réessayez.' : null };
}

/** Report a thread to the moderators for dispute review. */
export async function reportConversationAction(conversationId: string, reason: string): Promise<{ error: string | null }> {
  if (!conversationId) return { error: 'Conversation manquante.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('report_conversation', {
    p_conversation_id: conversationId,
    p_reason: reason.trim().slice(0, 500),
  });
  return { error: error ? "Le signalement a échoué. Réessayez." : null };
}
