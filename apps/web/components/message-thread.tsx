'use client';

import { useActionState, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Send, Loader2, Lock, MoreVertical, BellOff, Bell, Flag, ShieldAlert } from 'lucide-react';
import { createClient } from '@bayele/database/client';
import { SmartAvatar } from '@/components/smart-avatar';
import {
  sendMessageAction,
  markConversationRead,
  setMutedAction,
  reportConversationAction,
  type SendState,
} from '@/lib/messaging/actions';
import { appendMessage, seedThread, type MessageLike } from '@/lib/messaging/thread-state';

interface Msg extends MessageLike {
  body: string;
  sender_id: string;
}

// Phone numbers or emails in the draft — a gentle "keep it on-platform" nudge, not a hard block.
const CONTACT_RE = /(\+?\d[\d\s().-]{7,}\d)|([\w.+-]+@[\w-]+\.[\w.-]{2,})/;

function timeLabel(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * A deal-anchored message thread. Server-renders the recent page, streams new messages over the same
 * Realtime channel the notification bell uses (deduped), sends via the send_message RPC, and marks
 * the thread read on open and on each incoming message. A lightweight typing indicator rides the same
 * channel over Broadcast. The header menu lets a participant mute or report the thread.
 */
export function MessageThread({
  conversationId,
  viewerId,
  counterpartyName,
  counterpartyAvatarUrl,
  initialMessages,
  initialMuted,
}: {
  conversationId: string;
  viewerId: string;
  counterpartyName: string;
  counterpartyAvatarUrl: string | null;
  initialMessages: Msg[];
  initialMuted: boolean;
}) {
  const [thread, setThread] = useState(() => seedThread<Msg>(initialMessages));
  const [state, action, pending] = useActionState<SendState, FormData>(sendMessageAction, { error: null });
  const [draft, setDraft] = useState('');
  const [peerTyping, setPeerTyping] = useState(false);
  const [muted, setMuted] = useState(initialMuted);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDone, setReportDone] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null);
  const lastTypingSent = useRef(0);
  const peerTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const messages = thread.messages;
  const showContactNudge = useMemo(() => CONTACT_RE.test(draft), [draft]);

  // Live messages + typing, and keep the thread marked read while it's open.
  useEffect(() => {
    // Reading the thread clears its unread state; tell the badge provider to refresh.
    void markConversationRead(conversationId).then(() => {
      window.dispatchEvent(new Event('bayele:messages-read'));
    });

    const supabase = createClient();
    const channel = supabase.channel(`msg:${conversationId}`, { config: { broadcast: { self: false } } });
    channelRef.current = channel;

    channel
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const m = payload.new as Msg;
          setThread((s) => appendMessage(s, m));
          if (m.sender_id !== viewerId) {
            setPeerTyping(false);
            void markConversationRead(conversationId).then(() => {
              window.dispatchEvent(new Event('bayele:messages-read'));
            });
          }
        },
      )
      .on('broadcast', { event: 'typing' }, (payload) => {
        if ((payload.payload as { from?: string })?.from === viewerId) return;
        setPeerTyping(true);
        if (peerTypingTimer.current) clearTimeout(peerTypingTimer.current);
        peerTypingTimer.current = setTimeout(() => setPeerTyping(false), 3500);
      })
      .subscribe();

    return () => {
      if (peerTypingTimer.current) clearTimeout(peerTypingTimer.current);
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [conversationId, viewerId]);

  // Clear + refocus the composer after a successful send (delivery arrives over Realtime).
  useEffect(() => {
    if (state.ok) {
      setDraft('');
      formRef.current?.reset();
      inputRef.current?.focus();
    }
  }, [state]);

  // Autoscroll to the newest message (and when the peer starts/stops typing).
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, peerTyping]);

  function onDraftChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setDraft(e.target.value);
    // Throttle typing broadcasts to at most one every ~1.5s.
    const now = Date.now();
    if (now - lastTypingSent.current > 1500 && channelRef.current) {
      lastTypingSent.current = now;
      void channelRef.current.send({ type: 'broadcast', event: 'typing', payload: { from: viewerId } });
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  }

  async function toggleMute() {
    const next = !muted;
    setMuted(next);
    setMenuOpen(false);
    const { error } = await setMutedAction(conversationId, next);
    if (error) setMuted(!next); // revert on failure
  }

  async function submitReport() {
    const { error } = await reportConversationAction(conversationId, reportReason);
    if (!error) {
      setReportDone(true);
      setReportReason('');
      setReporting(false);
    }
  }

  return (
    <section className="mx-auto flex max-w-2xl flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-line pb-3">
        <Link href="/messages" aria-label="Retour" className="grid min-h-tap min-w-tap place-items-center text-muted hover:text-ink">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <SmartAvatar src={counterpartyAvatarUrl} name={counterpartyName} className="h-9 w-9 text-xs" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-ink">{counterpartyName}</p>
          <p className="flex items-center gap-1 text-[11px] text-muted">
            {muted ? <BellOff className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
            {muted ? 'Notifications coupées · conversation liée à votre collaboration' : 'Conversation sécurisée · liée à votre collaboration'}
          </p>
        </div>

        {/* Thread menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Options de la conversation"
            aria-expanded={menuOpen}
            className="grid min-h-tap min-w-tap place-items-center rounded-lg text-muted hover:bg-surface hover:text-ink"
          >
            <MoreVertical className="h-5 w-5" />
          </button>
          {menuOpen && (
            <>
              <button type="button" aria-hidden tabIndex={-1} className="fixed inset-0 z-10 cursor-default" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 z-20 mt-1 w-52 overflow-hidden rounded-xl border border-line bg-white py-1 shadow-lg">
                <button
                  type="button"
                  onClick={toggleMute}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-ink hover:bg-surface"
                >
                  {muted ? <Bell className="h-4 w-4 text-muted" /> : <BellOff className="h-4 w-4 text-muted" />}
                  {muted ? 'Réactiver les notifications' : 'Couper les notifications'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setReportDone(false);
                    setReporting(true);
                  }}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-rose-600 hover:bg-rose-50"
                >
                  <Flag className="h-4 w-4" />
                  Signaler la conversation
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Report panel */}
      {reporting && (
        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3.5">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-rose-700">
            <ShieldAlert className="h-4 w-4" /> Signaler à la modération
          </p>
          <p className="mt-1 text-xs text-rose-600/90">Décrivez le problème (facultatif). Notre équipe examinera cette conversation.</p>
          <textarea
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Motif du signalement…"
            className="mt-2 w-full resize-none rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm text-ink placeholder-muted/60 focus:border-rose-400 focus:outline-none"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={() => setReporting(false)} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-muted hover:text-ink">
              Annuler
            </button>
            <button type="button" onClick={submitReport} className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-rose-700">
              Envoyer le signalement
            </button>
          </div>
        </div>
      )}
      {reportDone && (
        <p className="mt-3 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-muted">
          Merci — votre signalement a été transmis à la modération.
        </p>
      )}

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
                  {/* Rendered in the viewer's local zone — suppress the SSR/client TZ hydration diff on this trivial label. */}
                  <p suppressHydrationWarning className={`mt-0.5 text-[10px] ${mine ? 'text-white/70' : 'text-muted'}`}>{timeLabel(m.created_at)}</p>
                </div>
              </div>
            );
          })
        )}
        {peerTyping && (
          <div className="flex justify-start">
            <div className="rounded-2xl border border-line bg-white px-3.5 py-2 text-sm text-muted">
              <span className="italic">{counterpartyName.split(' ')[0]} écrit…</span>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Composer */}
      <form ref={formRef} action={action} className="border-t border-line pt-3">
        <input type="hidden" name="conversation" value={conversationId} />
        {showContactNudge && (
          <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
            Gardez vos échanges et vos paiements sur Bayele : partager des coordonnées personnelles vous prive de la protection de l’escrow.
          </p>
        )}
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            name="body"
            rows={1}
            required
            maxLength={4000}
            value={draft}
            onChange={onDraftChange}
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
