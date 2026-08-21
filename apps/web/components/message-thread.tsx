'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Send, Loader2, Lock } from 'lucide-react';
import { createClient } from '@bayele/database/client';
import { SmartAvatar } from '@/components/smart-avatar';
import { sendMessageAction, markConversationRead, type SendState } from '@/lib/messaging/actions';
import { appendMessage, seedThread, type MessageLike } from '@/lib/messaging/thread-state';

interface Msg extends MessageLike {
  body: string;
  sender_id: string;
}

function timeLabel(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * A deal-anchored message thread. Server-renders the recent page, streams new messages over the same
 * Realtime channel the notification bell uses (deduped), sends via the send_message RPC, and marks
 * the thread read on open and on each incoming message.
 */
export function MessageThread({
  conversationId,
  viewerId,
  counterpartyName,
  counterpartyAvatarUrl,
  initialMessages,
}: {
  conversationId: string;
  viewerId: string;
  counterpartyName: string;
  counterpartyAvatarUrl: string | null;
  initialMessages: Msg[];
}) {
  const [thread, setThread] = useState(() => seedThread<Msg>(initialMessages));
  const [state, action, pending] = useActionState<SendState, FormData>(sendMessageAction, { error: null });
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const messages = thread.messages;

  // Live messages + keep the thread marked read while it's open.
  useEffect(() => {
    void markConversationRead(conversationId);
    const supabase = createClient();
    const channel = supabase
      .channel(`msg:${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const m = payload.new as Msg;
          setThread((s) => appendMessage(s, m));
          if (m.sender_id !== viewerId) void markConversationRead(conversationId);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, viewerId]);

  // Clear + refocus the composer after a successful send (delivery arrives over Realtime).
  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      inputRef.current?.focus();
    }
  }, [state]);

  // Autoscroll to the newest message.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  }

  return (
    <section className="mx-auto flex max-w-2xl flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-line pb-3">
        <Link href="/dashboard" aria-label="Retour" className="grid min-h-tap min-w-tap place-items-center text-muted hover:text-ink">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <SmartAvatar src={counterpartyAvatarUrl} name={counterpartyName} className="h-9 w-9 text-xs" />
        <div className="min-w-0">
          <p className="truncate font-bold text-ink">{counterpartyName}</p>
          <p className="flex items-center gap-1 text-[11px] text-muted"><Lock className="h-3 w-3" /> Conversation sécurisée · liée à votre collaboration</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex max-h-[60vh] min-h-[40vh] flex-col gap-2 overflow-y-auto py-4">
        {messages.length === 0 ? (
          <p className="my-auto text-center text-sm text-muted">Aucun message. Écrivez le premier.</p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === viewerId;
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${mine ? 'bg-brand text-white' : 'border border-line bg-white text-ink'}`}>
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p className={`mt-0.5 text-[10px] ${mine ? 'text-white/70' : 'text-muted'}`}>{timeLabel(m.created_at)}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      {/* Composer */}
      <form ref={formRef} action={action} className="border-t border-line pt-3">
        <input type="hidden" name="conversation" value={conversationId} />
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            name="body"
            rows={1}
            required
            maxLength={4000}
            onKeyDown={onKeyDown}
            placeholder="Écrivez un message…"
            className="max-h-32 min-h-tap flex-1 resize-none rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink placeholder-muted/60 focus:border-brand focus:outline-none"
          />
          <button
            type="submit"
            disabled={pending}
            aria-label="Envoyer"
            className="grid min-h-tap min-w-tap place-items-center rounded-xl bg-brand text-white transition hover:bg-brand-600 active:scale-95 disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
        {state.error && <p className="mt-1.5 text-xs text-rose-600">{state.error}</p>}
      </form>
    </section>
  );
}
