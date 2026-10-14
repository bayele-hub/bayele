'use client';

import { useActionState } from 'react';
import { CheckCircle2, Loader2, Send } from 'lucide-react';
import type { Dictionary } from '@/i18n/dictionaries';
import { fmtFcfa, PROVIDERS } from '@/lib/data/campaigns';
import { confirmSettlementAction, type AdminRetainerState } from './retainer-actions';

export interface SettlementRow {
  id: string;
  kind: 'partner_payout' | 'brand_refund';
  amount: number;
  kept: number;
  recipientName: string;
  recipientHandle: string;
  phone: string | null;
  provider: string | null;
  providerId: string | null;
  contract: number;
  reason: string | null;
}

type S = Dictionary['admin']['queues']['settlements'];

/** O7 settlements (admin_retainer_settlements): partner payouts + brand refunds to confirm with a reference. */
export function SettlementQueue({ rows, S }: { rows: SettlementRow[]; S: S }) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-bold text-ink">{S.title}</h3>
        <p className="mt-0.5 text-xs text-muted">{S.body}</p>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-2xl border border-line bg-white p-6 text-center text-sm text-muted">{S.empty}</p>
      ) : (
        <ul className="grid gap-3">{rows.map((r) => <SettlementCard key={r.id} r={r} S={S} />)}</ul>
      )}
    </section>
  );
}

function SettlementCard({ r, S }: { r: SettlementRow; S: S }) {
  const [state, action, pending] = useActionState<AdminRetainerState, FormData>(confirmSettlementAction, { error: null });
  if (state.ok) {
    return (
      <li className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
        <CheckCircle2 className="mr-1 inline h-4 w-4" aria-hidden /> {S.done}
      </li>
    );
  }
  return (
    <li className="min-w-0 rounded-2xl border border-line bg-white p-4 shadow-card">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-ink">{S[r.kind]}</p>
          <p className="mt-0.5 truncate text-xs text-muted">{S.to.replace('{name}', r.recipientName).replace('{handle}', r.recipientHandle)}</p>
          <p className="text-xs text-muted">{r.phone ?? S.noPhone}{r.provider ? ` · ${r.provider}` : ''}</p>
          <p className="text-[11px] text-muted">{S.contract.replace('{amount}', fmtFcfa(r.contract))} · {S.kept.replace('{amount}', fmtFcfa(r.kept))}</p>
          {r.reason && <p className="mt-0.5 text-[11px] text-ink [overflow-wrap:anywhere]">{r.reason}</p>}
        </div>
        <span className="shrink-0 font-display font-extrabold text-ink">{fmtFcfa(r.amount)}</span>
      </div>
      <form action={action} className="mt-3 flex flex-wrap items-end gap-2">
        <input type="hidden" name="settlement" value={r.id} />
        <label className="min-w-0 flex-1 text-[11px] font-semibold text-muted">
          {S.ref}
          <input name="ref" required autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false}
            className="mt-0.5 min-h-tap w-full rounded-lg border border-line bg-white px-2.5 text-[16px] text-ink focus:border-brand focus:outline-none sm:text-xs" />
        </label>
        <label className="text-[11px] font-semibold text-muted">
          {S.provider}
          <select name="provider" defaultValue={r.providerId ?? 'mtn_momo'} className="mt-0.5 block min-h-tap rounded-lg border border-line bg-white px-2 text-[16px] text-ink sm:text-xs">
            {PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </label>
        <button type="submit" disabled={pending} className="inline-flex min-h-tap items-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-bold text-white disabled:opacity-50">
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Send className="h-3.5 w-3.5" aria-hidden />} {S.confirm}
        </button>
      </form>
      {state.error && <p role="alert" className="mt-2 text-xs text-rose-700">{state.error}</p>}
    </li>
  );
}
