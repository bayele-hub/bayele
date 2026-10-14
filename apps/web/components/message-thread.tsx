'use client';

import { useActionState, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Send, Loader2, Lock, MoreVertical, BellOff, Bell, Flag, ShieldAlert, ShieldCheck } from 'lucide-react';
import { createClient } from '@bayele/database/client';
import { SmartAvatar } from '@/components/smart-avatar';
import {
  sendMessageAction,
  markConversationRead,
  setMutedAction,
  reportConversationAction,
  reportOffplatformAction,
  type SendState,
} from '@/lib/messaging/actions';
import { appendMessage, seedThread, type MessageLike } from '@/lib/messaging/thread-state';
import type { Dictionary } from '@/i18n/dictionaries';
import { READ_ONLY_MODES, modeFromSendError, type ThreadMode } from '@/lib/gov/rules';
import { detectContacts, type ContactKind } from '@/lib/gov/contact-detect';
import { joinKinds } from '@/lib/gov/masked';
import { MaskedText } from '@/components/gov/masked-text';
import { SectionTip } from '@/components/admin/section-tip';

interface Msg extends MessageLike {
  body: string;
  sender_id: string;
  masked_kinds?: ContactKind[] | null;
}

export interface ThreadGov {
  mode: ThreadMode;
  /** Brand↔partner thread (partner_assignment or retainer): « Signaler une demande hors plateforme ». */
  pairThread: boolean;
  expiresAt: string | null;
  M: Dictionary['messaging'];
  locale: 'fr' | 'en';
  aria: string;
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
  gov,
}: {
  conversationId: string;
  viewerId: string;
  counterpartyName: string;
  counterpartyAvatarUrl: string | null;
  initialMessages: Msg[];
  initialMuted: boolean;
  gov?: ThreadGov;
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
  // Partner governance (§3.2 / §4): thread state, pre-send notice, sender feedback, off-platform report.
  const M = gov?.M;
  const [mode, setMode] = useState<ThreadMode>(gov?.mode ?? 'normal');
  const masked = mode === 'masked';
  const readOnly = READ_ONLY_MODES.includes(mode);
  const [debounced, setDebounced] = useState('');
  useEffect(() => { const t = setTimeout(() => setDebounced(draft), 300); return () => clearTimeout(t); }, [draft]);
  const willMask = useMemo(() => masked && detectContacts(debounced).length > 0, [masked, debounced]);
  const [feedback, setFeedback] = useState<{ kinds: ContactKind[]; visible: boolean } | null>(null);
  const [offOpen, setOffOpen] = useState(false);
  const [offReason, setOffReason] = useState('');
  const [offMsg, setOffMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [offPending, setOffPending] = useState(false);
  const dateLabel = (iso: string) => new Intl.DateTimeFormat(gov?.locale === 'en' ? 'en-GB' : 'fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));

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
      // §4.3: tell the sender what was masked (visible 8 s, kept as role=status until the next send).
      if (state.maskedKinds && state.maskedKinds.length) {
        setFeedback({ kinds: state.maskedKinds, visible: true });
        const t = setTimeout(() => setFeedback((f) => (f ? { ...f, visible: false } : f)), 8000);
        return () => clearTimeout(t);
      }
      setFeedback(null);
    } else if (state.code) {
      const next = modeFromSendError(state.code);
      if (next) setMode(next);
    }
  }, [state]);

  async function submitOffplatform() {
    setOffPending(true);
    const r = await reportOffplatformAction(conversationId, offReason);
    setOffPending(false);
    if (r.ok && M) { setOffMsg({ ok: true, text: M.report.done }); setOffOpen(false); setOffReason(''); }
    else setOffMsg({ ok: false, text: r.error ?? '' });
  }

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
    <section className="mx-auto flex h-full max-w-2xl flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-line pb-3 pt-1">
        <Link href="/messages" aria-label="Retour" className="grid min-h-tap min-w-tap place-items-center text-muted hover:text-ink">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <SmartAvatar src={counterpartyAvatarUrl} name={counterpartyName} className="h-9 w-9 text-xs" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-ink">{counterpartyName}</p>
          {gov && M && mode !== 'normal' ? (
            <p className="flex min-w-0 flex-wrap items-center gap-x-1 text-[11px] text-muted">
              <Lock className="h-3 w-3 shrink-0" aria-hidden />
              <span className="min-w-0">
                {mode === 'masked' ? M.header.masked : mode === 'signed' ? M.header.signed : mode === 'expired' ? M.header.expired : mode === 'suspended' ? M.header.suspended : M.header.closed}
                {mode === 'masked' && gov.expiresAt && <> · <time dateTime={gov.expiresAt}>{M.header.until.replace('{date}', dateLabel(gov.expiresAt))}</time></>}
              </span>
              {mode === 'masked' && <SectionTip id="thread-masked" label={M.header.masked} text={M.tips.masked} ariaTemplate={gov.aria} />}
            </p>
          ) : (
            <p className="flex items-center gap-1 text-[11px] text-muted">
              {muted ? <BellOff className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
              {muted ? 'Notifications coupées · conversation liée à votre collaboration' : 'Conversation sécurisée · liée à votre collaboration'}
            </p>
          )}
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
              <div className="absolute right-0 z-20 mt-1 w-64 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-line bg-white py-1 shadow-lg">
                <button
                  type="button"
                  onClick={toggleMute}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-ink hover:bg-surface"
                >
                  {muted ? <Bell className="h-4 w-4 text-muted" /> : <BellOff className="h-4 w-4 text-muted" />}
                  {muted ? 'Réactiver les notifications' : 'Couper les notifications'}
                </button>
                {gov?.pairThread && M && (
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); setOffMsg(null); setOffOpen(true); }}
                    className="flex min-h-tap w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-ink hover:bg-surface"
                  >
                    <Flag className="h-4 w-4 shrink-0 text-brand-700" aria-hidden />
                    {M.report.menu}
                  </button>
                )}
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

      {/* §4.4 off-platform report (blue protection styling, not rose) */}
      {offOpen && M && (
        <div role="region" aria-labelledby="offp-title" onKeyDown={(e) => { if (e.key === 'Escape') setOffOpen(false); }} className="mt-3 rounded-xl border border-brand-100 bg-brand-50 p-3.5">
          <p id="offp-title" className="flex items-center gap-1.5 text-sm font-semibold text-ink"><ShieldCheck className="h-4 w-4 text-brand-700" aria-hidden /> {M.report.title}</p>
          <p className="mt-1 text-xs text-ink">{M.report.body}</p>
          <label htmlFor="offp-reason" className="mt-2 block text-xs font-semibold text-ink">{M.report.reason}</label>
          <textarea id="offp-reason" value={offReason} onChange={(e) => setOffReason(e.target.value)} rows={2} maxLength={300} autoFocus
            className="mt-1 w-full resize-none rounded-lg border border-line bg-white px-3 py-2 text-[16px] text-ink focus:border-brand focus:outline-none sm:text-sm" />
          {offMsg && !offMsg.ok && <p role="alert" className="mt-1 text-xs font-semibold text-rose-700">{offMsg.text}</p>}
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={() => setOffOpen(false)} className="inline-flex min-h-tap items-center rounded-lg px-3 text-sm font-semibold text-muted hover:text-ink">{M.report.cancel}</button>
            <button type="button" disabled={offPending} onClick={submitOffplatform} className="inline-flex min-h-tap items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-semibold text-white disabled:opacity-60">
              {offPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} {M.report.submit}
            </button>
          </div>
        </div>
      )}
      {offMsg?.ok && <p role="status" className="mt-3 rounded-xl border border-brand-100 bg-brand-50 px-3.5 py-2.5 text-sm text-ink">{offMsg.text}</p>}

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

      {/* Messages — the only scrolling region; grows to fill the frame so the composer stays pinned
          and visible on every phone size (no more clipping under the bottom nav). */}
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain py-4">
        {messages.length === 0 ? (
          <p className="my-auto text-center text-sm text-muted">Aucun message. Écrivez le premier.</p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === viewerId;
            return (
              <div key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${mine ? 'bg-brand text-white' : 'border border-line bg-white text-ink'}`}>
                  <p className="whitespace-pre-wrap break-words">{m.masked_kinds?.length ? <MaskedText text={m.body} onBrand={mine} /> : m.body}</p>
                  {/* Rendered in the viewer's local zone — suppress the SSR/client TZ hydration diff on this trivial label. */}
                  <p suppressHydrationWarning className={`mt-0.5 text-[10px] ${mine ? 'text-white/70' : 'text-muted'}`}>{timeLabel(m.created_at)}</p>
                </div>
                {/* §4.2: under any masked bubble, to both sides (outside my blue bubble, so it stays legible). */}
                {m.masked_kinds?.length && M ? (
                  <p className="mt-0.5 flex max-w-[80%] items-start gap-1 text-[11px] text-muted"><ShieldCheck className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />{M.mask.bubbleNote}</p>
                ) : null}
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

      {/* Composer — pinned below the message list, always visible. Read-only states replace it (§3.2). */}
      {readOnly && M ? (
        <div className="shrink-0 border-t border-line pb-1 pt-3">
          <p role="status" className="rounded-xl bg-surface p-3 text-[13px] text-muted">
            {mode === 'expired' ? M.closed.expired : mode === 'suspended' ? M.closed.suspended : M.closed.ended}
          </p>
        </div>
      ) : (
      <form ref={formRef} action={action} className="shrink-0 border-t border-line pb-1 pt-3">
        <input type="hidden" name="conversation" value={conversationId} />
        {masked && willMask && M && (
          <p aria-live="polite" className="mb-2 flex items-start gap-1.5 rounded-xl border border-brand-100 bg-brand-50 p-3 text-[12px] text-ink">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" aria-hidden /> {M.mask.preSend}
          </p>
        )}
        {!masked && showContactNudge && (
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
        {feedback && M && (
          <div role="status" className={feedback.visible ? 'mt-2 flex items-start gap-1.5 rounded-xl border border-brand-100 bg-brand-50 p-3 text-[12px] text-ink' : 'sr-only'}>
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" aria-hidden />
            <span>
              {M.mask.sent.replace('{kinds}', joinKinds(feedback.kinds, M.mask.kinds, M.mask.and))}
              <SectionTip id="mask-why" label={M.mask.why} text={M.tips.why} ariaTemplate={gov!.aria} placement="top" />
            </span>
          </div>
        )}
      </form>
      )}
    </section>
  );
}
