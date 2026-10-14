'use client';

import { useState, useTransition } from 'react';
import { Copy, Eye, EyeOff, Loader2 } from 'lucide-react';
import type { Dictionary } from '@/i18n/dictionaries';
import { revealMemberFieldAction } from '@/app/(app)/admin/member-actions';
import type { RevealField, Sensitive } from '@/lib/admin-members';

type L = Dictionary['admin']['members'];

/**
 * A sensitive value (design §A.4.5, D2/D3): the HTML only ever holds the server's masked form. « Afficher »
 * asks for a reason, then calls admin_reveal_member_field (logged every time). The revealed value
 * lives in this component's state only: navigating away re-masks it (no cache).
 */
export function MaskedValue({ userId, field, value, L, emptyLabel }: { userId: string; field: RevealField; value: Sensitive; L: L; emptyLabel?: string }) {
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState('');
  const [shown, setShown] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  if (!value.present) return <span className="text-muted">{emptyLabel ?? L.notSet}</span>;

  const reveal = () => {
    if (!reason.trim()) return setError(L.revealReason);
    setError(null);
    start(async () => {
      const r = await revealMemberFieldAction(userId, field, reason);
      if (!r.ok) return setError(r.error);
      setShown(r.value);
      setRevealed(true);
      setAsking(false);
      setReason('');
    });
  };
  const copy = async () => {
    if (!shown) return;
    try {
      await navigator.clipboard.writeText(shown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };
  const small = 'inline-flex min-h-tap items-center gap-1 rounded-lg border border-line bg-white px-2.5 text-[11px] font-bold text-ink hover:border-brand';

  return (
    <span className="block min-w-0">
      <span className="flex min-w-0 flex-wrap items-center gap-2">
        <span aria-live="polite" className="min-w-0 font-mono text-sm tabular-nums text-ink [overflow-wrap:anywhere]">
          {revealed ? (shown ?? L.revealEmpty) : value.masked ?? '••••'}
        </span>
        {revealed ? (
          <>
            {shown && (
              <button type="button" onClick={copy} className={small}>
                <Copy className="h-3 w-3" aria-hidden /> {copied ? L.copied : L.copy}
              </button>
            )}
            <button type="button" onClick={() => { setRevealed(false); setShown(null); }} className={small}>
              <EyeOff className="h-3 w-3" aria-hidden /> {L.hide}
            </button>
          </>
        ) : (
          !asking && (
            <button type="button" onClick={() => setAsking(true)} className={small} aria-expanded={asking}>
              <Eye className="h-3 w-3" aria-hidden /> {L.reveal}
            </button>
          )
        )}
      </span>
      {asking && (
        <span className="mt-2 block space-y-1.5 rounded-xl border border-line bg-surface p-2.5">
          <label className="block text-[11px] font-semibold text-ink">
            {L.revealReason}
            <input value={reason} onChange={(e) => setReason(e.target.value.slice(0, 500))} placeholder={L.revealReasonPlaceholder} autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); reveal(); } if (e.key === 'Escape') setAsking(false); }}
              className="mt-1 min-h-tap w-full rounded-lg border border-line bg-white px-2.5 text-[16px] text-ink focus:border-brand focus:outline-none sm:text-sm" />
          </label>
          <span className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={reveal} disabled={pending} className="inline-flex min-h-tap items-center gap-1 rounded-lg bg-brand px-3 text-[11px] font-bold text-white disabled:opacity-50">
              {pending && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />} {L.revealConfirm}
            </button>
            <button type="button" onClick={() => setAsking(false)} className={small}>{L.revealCancel}</button>
            <span className="text-[11px] text-muted">{L.revealLogged}</span>
          </span>
        </span>
      )}
      {error && <span role="alert" className="mt-1 block text-[11px] text-rose-700">{error}</span>}
    </span>
  );
}
