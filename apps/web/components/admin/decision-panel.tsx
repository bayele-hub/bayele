'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { Ban, Check, Loader2, PencilLine, RotateCcw, X } from 'lucide-react';
import type { Dictionary } from '@/i18n/dictionaries';
import { moderateMemberAction } from '@/app/(app)/admin/member-actions';
import {
  FIX_FIELDS, MESSAGE_MAX, REASON_CODES, allowedDecisions, needsReason, validateDecision, type DecisionAction, type ReasonCode,
} from '@/lib/admin-members';

type L = Dictionary['admin']['members'];

const ICON: Record<DecisionAction, typeof Check> = { approve: Check, reject: X, request_changes: PencilLine, suspend: Ban, reactivate: RotateCcw };

/**
 * Decision controls (design §A.4.6, D4). Card mode offers the one-tap set per status (pending:
 * Rejeter · Approuver; active: Suspendre; suspended/rejected: Réactiver); bar mode adds « Demander une
 * correction ». Reject / suspend / correction open an in-flow panel with a REQUIRED reason; nothing is
 * a one-tap reject. Approve asks for confirmation first when the profile has warnings.
 */
export function DecisionPanel({ userId, name, status, warnings, L, mode }: { userId: string; name: string; status: string; warnings: number; L: L; mode: 'card' | 'bar' }) {
  const router = useRouter();
  const [open, setOpen] = useState<DecisionAction | null>(null);
  const [confirmApprove, setConfirmApprove] = useState(false);
  const [reason, setReason] = useState<ReasonCode | ''>('');
  const [message, setMessage] = useState('');
  const [note, setNote] = useState('');
  const [fields, setFields] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const firstRef = useRef<HTMLSelectElement>(null);

  const all = allowedDecisions(status);
  const actions: DecisionAction[] =
    mode === 'card' ? all.filter((a) => (status === 'pending_review' ? a === 'reject' || a === 'approve' : a !== 'request_changes')) : all.filter((a) => !(status === 'pending_review' && a === 'suspend'));

  useEffect(() => {
    if (open) firstRef.current?.focus();
  }, [open]);
  useEffect(() => {
    if (!open && !confirmApprove) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(null);
        setConfirmApprove(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, confirmApprove]);

  const submit = (action: DecisionAction) => {
    const input = { userId, action, reasonCode: needsReason(action) ? reason || null : null, message, note, fields: action === 'request_changes' ? fields : null };
    const bad = validateDecision(input);
    if (bad) return setError(L.errors[bad]);
    setError(null);
    start(async () => {
      const r = await moderateMemberAction(input);
      if (!r.ok) return setError(r.error);
      setOpen(null);
      setConfirmApprove(false);
      setDone(L.done[r.action].replace('{name}', name));
      router.refresh();
    });
  };

  const click = (a: DecisionAction) => {
    setError(null);
    if (a === 'approve') return warnings > 0 ? setConfirmApprove(true) : submit('approve');
    if (a === 'reactivate') return submit('reactivate');
    setOpen(a);
    setReason('');
    setMessage('');
    setFields([]);
  };

  const pickReason = (code: ReasonCode | '') => {
    setReason(code);
    if (code) setMessage(L.reasons[code].message);
  };

  const btn = 'inline-flex min-h-tap items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-bold transition active:scale-95 disabled:opacity-50';
  const cls = (a: DecisionAction) =>
    a === 'approve' || a === 'reactivate' ? `${btn} bg-brand text-white hover:bg-brand-600` : `${btn} border border-line bg-white text-ink hover:border-rose-200 hover:text-rose-700`;

  return (
    <div className="min-w-0">
      {open && (
        <div role="region" aria-label={L.confirm[open]} className="mb-3 space-y-2 rounded-xl border border-line bg-surface p-3">
          <label className="block text-xs font-semibold text-ink">
            {L.reasonLabel}
            <select ref={firstRef} value={reason} onChange={(e) => pickReason(e.target.value as ReasonCode | '')}
              className="mt-1 min-h-tap w-full rounded-xl border border-line bg-white px-3 text-[16px] text-ink focus:border-brand focus:outline-none sm:text-sm">
              <option value="">{L.reasonChoose}</option>
              {REASON_CODES.map((c) => (
                <option key={c} value={c}>{L.reasons[c].label}</option>
              ))}
            </select>
          </label>
          {open === 'request_changes' && (
            <fieldset>
              <legend className="text-xs font-semibold text-ink">{L.fixLabel}</legend>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {FIX_FIELDS.map((f) => {
                  const on = fields.includes(f);
                  return (
                    <label key={f} className={`inline-flex min-h-tap cursor-pointer items-center gap-2 rounded-full border px-3 text-xs font-semibold ${on ? 'border-brand bg-brand-50 text-brand-700' : 'border-line bg-white text-ink'}`}>
                      <input type="checkbox" className="h-4 w-4 accent-brand" checked={on} onChange={() => setFields((p) => (on ? p.filter((x) => x !== f) : [...p, f]))} />
                      {L.fix[f]}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}
          <label className="block text-xs font-semibold text-ink">
            {L.messageLabel}
            <textarea value={message} onChange={(e) => setMessage(e.target.value.slice(0, MESSAGE_MAX))} rows={3}
              className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-[16px] text-ink focus:border-brand focus:outline-none sm:text-sm" />
            <span className="mt-0.5 flex justify-between text-[11px] font-normal text-muted">
              <span>{L.messageHint}</span>
              <span className="tabular-nums">{message.length}/{MESSAGE_MAX}</span>
            </span>
          </label>
          <label className="block text-xs font-semibold text-ink">
            {L.noteLabel}
            <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 1000))} rows={2}
              className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-[16px] text-ink focus:border-brand focus:outline-none sm:text-sm" />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={pending} onClick={() => submit(open)}
              className={`${btn} ${open === 'request_changes' ? 'bg-brand text-white' : 'bg-rose-700 text-white hover:bg-rose-800'}`}>
              {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />} {L.confirm[open]}
            </button>
            <button type="button" onClick={() => setOpen(null)} className={`${btn} border border-line bg-white text-ink`}>{L.cancel}</button>
          </div>
        </div>
      )}
      {confirmApprove && (
        <div role="region" aria-label={L.approveWarn} className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-accent/30 bg-accent-soft p-3 text-xs text-ink">
          <span className="min-w-0 flex-1">{L.approveWarn}</span>
          <button type="button" autoFocus disabled={pending} onClick={() => submit('approve')} className={`${btn} bg-brand text-white`}>
            {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />} {L.approveAnyway}
          </button>
          <button type="button" onClick={() => setConfirmApprove(false)} className={`${btn} border border-line bg-white text-ink`}>{L.cancel}</button>
        </div>
      )}
      <div className={mode === 'card' ? 'grid grid-cols-2 gap-2 sm:flex sm:justify-end' : 'flex flex-wrap justify-end gap-2'}>
        {actions.map((a) => {
          const Icon = ICON[a];
          const label = a === 'request_changes' ? L.requestFix : L[a];
          return (
            <button key={a} type="button" disabled={pending} onClick={() => click(a)} aria-expanded={needsReason(a) ? open === a : undefined}
              className={`${cls(a)} ${actions.length === 1 && mode === 'card' ? 'col-span-2' : ''}`}>
              {pending && !open && !confirmApprove ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Icon className="h-3.5 w-3.5" aria-hidden />} {label}
            </button>
          );
        })}
      </div>
      {error && <p role="alert" className="mt-2 text-xs text-rose-700">{error}</p>}
      <p role="status" className="mt-1 text-xs text-emerald-700">{done ?? ''}</p>
    </div>
  );
}
