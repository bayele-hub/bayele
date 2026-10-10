'use client';

import { useState, useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import type { Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { formatFcfa } from '@/i18n/format';
import { fill } from '@/lib/campaign-board';
import { clearPayFloorAction, setPayFloorAction } from './actions';

type P = Dictionary['payFloors'];

/** One deliverable type (design §3). Input empty by default — no placeholder number (K1). */
export function FloorRow({ type, label, unit, value, updatedAt, P, locale }: { type: string; label: string; unit: string; value: number | null; updatedAt: string | null; P: P; locale: Locale }) {
  const [editing, setEditing] = useState(value === null);
  const [draft, setDraft] = useState('');
  const [confirm, setConfirm] = useState<'set' | 'clear' | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const amount = Number(draft.replace(/\D/g, ''));

  const run = (kind: 'set' | 'clear') =>
    start(async () => {
      const r = kind === 'set' ? await setPayFloorAction(type, amount) : await clearPayFloorAction(type);
      setConfirm(null);
      if (!r.ok) return setMsg({ ok: false, text: r.error });
      setMsg({ ok: true, text: kind === 'set' ? P.saved : P.removed });
      setDraft('');
      setEditing(kind === 'clear');
    });

  return (
    <li className="rounded-2xl border border-line bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-ink">{label}</p>
          <p className="text-[11px] text-muted">{unit}</p>
        </div>
        {value === null ? (
          <span className="shrink-0 whitespace-nowrap rounded-full bg-surface px-2.5 py-0.5 text-[11px] font-bold text-muted">{P.notSet}</span>
        ) : (
          <span className="text-right">
            <span className="block font-display text-lg font-extrabold tabular-nums text-ink">{formatFcfa(value, locale)}</span>
            {updatedAt && <span className="block text-[11px] text-muted">{fill(P.updated, { date: new Date(updatedAt).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB') })}</span>}
          </span>
        )}
      </div>

      {editing ? (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="min-w-0 flex-1">
            <span className="text-[11px] font-semibold text-muted">{P.inputLabel}</span>
            <input inputMode="numeric" value={draft} placeholder="—" onChange={(e) => setDraft(e.target.value.replace(/\D/g, '').slice(0, 9))}
              className="mt-0.5 min-h-tap w-full rounded-xl border border-line bg-white px-3 text-[16px] text-ink focus:border-brand focus:outline-none sm:text-sm" />
          </label>
          <button type="button" disabled={!amount || pending} onClick={() => setConfirm('set')}
            className="min-h-tap rounded-xl bg-brand px-4 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{P.save}</button>
          {value !== null && (
            <button type="button" onClick={() => setEditing(false)} className="min-h-tap rounded-xl border border-line bg-white px-3 text-xs font-bold text-ink">{P.cancel}</button>
          )}
        </div>
      ) : (
        <div className="mt-2 flex gap-3">
          <button type="button" onClick={() => setEditing(true)} className="inline-flex min-h-tap items-center text-xs font-bold text-brand-700 hover:underline">{P.edit}</button>
          <button type="button" onClick={() => setConfirm('clear')} className="inline-flex min-h-tap items-center text-xs font-bold text-rose-700 hover:underline">{P.remove}</button>
        </div>
      )}

      {confirm && (
        <div role="region" aria-label={confirm === 'set' ? P.save : P.remove} className="mt-3 rounded-xl border border-line bg-surface p-3 text-[12px] text-ink">
          <p>{confirm === 'set' ? fill(P.confirmSet, { value: formatFcfa(amount, locale) }) : P.confirmRemove}</p>
          <div className="mt-2 flex gap-2">
            <button type="button" autoFocus disabled={pending} onClick={() => run(confirm)} className="inline-flex min-h-tap items-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-bold text-white disabled:opacity-50">
              {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />} {P.confirm}
            </button>
            <button type="button" onClick={() => setConfirm(null)} className="min-h-tap rounded-lg border border-line bg-white px-3 text-xs font-bold text-ink">{P.cancel}</button>
          </div>
        </div>
      )}
      <p role="status" className={`mt-1 text-[11px] ${msg?.ok ? 'text-emerald-700' : 'text-rose-600'}`}>{msg?.text ?? ''}</p>
    </li>
  );
}
