'use client';

import { useActionState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { payoutAction, type PayoutState } from './payout-actions';
import { fmtFcfa, PROVIDERS } from '@/lib/data/campaigns';

export interface PayoutRow {
  id: string; // campaign_creator_id
  creatorName: string;
  campaignTitle: string;
  amount: number;
}

export function PayoutQueue({ rows }: { rows: PayoutRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-white p-6 text-center text-sm text-muted">
        Aucun paiement prêt à décaisser.
      </div>
    );
  }
  return (
    <ul className="grid gap-3">
      {rows.map((r) => (
        <PayoutCard key={r.id} row={r} />
      ))}
    </ul>
  );
}

function PayoutCard({ row }: { row: PayoutRow }) {
  const [state, action, pending] = useActionState<PayoutState, FormData>(payoutAction, { error: null });

  return (
    <li className="rounded-2xl border border-line bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-ink">{row.creatorName}</p>
          <p className="mt-0.5 text-xs text-muted">{row.campaignTitle}</p>
        </div>
        <span className="font-display font-extrabold text-ink">{fmtFcfa(row.amount)}</span>
      </div>

      <form action={action} className="mt-3 flex flex-wrap items-end gap-2">
        <input type="hidden" name="cc" value={row.id} />
        <div className="min-w-0 flex-1">
          <label className="text-[11px] font-semibold text-muted">Réf. décaissement MoMo</label>
          <input
            name="ref"
            required
            placeholder="MOMO-OUT-000123"
            className="mt-0.5 w-full rounded-lg border border-line bg-white px-2.5 py-2 text-xs text-ink focus:border-brand focus:outline-none"
          />
        </div>
        <select name="provider" className="rounded-lg border border-line bg-white px-2 py-2 text-xs text-ink focus:border-brand focus:outline-none">
          {PROVIDERS.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-tap items-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-bold text-white transition hover:bg-brand-600 active:scale-95 disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Confirmer le paiement
        </button>
      </form>
      {state.error && <p className="mt-2 text-xs text-rose-600">{state.error}</p>}
      {state.ok && <p className="mt-2 text-xs text-emerald-600">Paiement confirmé — le créateur est notifié.</p>}
    </li>
  );
}
