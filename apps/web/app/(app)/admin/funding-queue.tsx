'use client';

import { useActionState } from 'react';
import { Loader2, Lock } from 'lucide-react';
import { fundCampaignAction, type FundState } from './funding-actions';
import { fmtFcfa } from '@/lib/data/campaigns';

export interface FundingRow {
  id: string;
  title: string;
  company: string;
  budget: number;
  country: string;
}

export function FundingQueue({ rows }: { rows: FundingRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-white p-6 text-center text-sm text-muted">
        Aucune campagne en attente de financement.
      </div>
    );
  }
  return (
    <ul className="grid gap-3">
      {rows.map((r) => (
        <FundingCard key={r.id} row={r} />
      ))}
    </ul>
  );
}

function FundingCard({ row }: { row: FundingRow }) {
  const [state, action, pending] = useActionState<FundState, FormData>(fundCampaignAction, { error: null });

  return (
    <li className="rounded-2xl border border-line bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-ink">{row.title}</p>
          <p className="mt-0.5 text-xs text-muted">{row.company} · {row.country}</p>
        </div>
        <span className="font-display font-extrabold text-ink">{fmtFcfa(row.budget)}</span>
      </div>

      <form action={action} className="mt-3 flex flex-wrap items-end gap-2">
        <input type="hidden" name="campaign" value={row.id} />
        <div className="min-w-0 flex-1">
          <label className="text-[11px] font-semibold text-muted">Réf. facture SokoClick / MoMo</label>
          <input
            name="invoice"
            required
            placeholder="SOKO-2026-000123"
            className="mt-0.5 min-h-tap w-full rounded-lg border border-line bg-white px-2.5 py-2 text-xs text-ink focus:border-brand focus:outline-none"
          />
        </div>
        <select name="provider" className="min-h-tap rounded-lg border border-line bg-white px-2 py-2 text-xs text-ink focus:border-brand focus:outline-none">
          <option value="mtn_momo">MTN MoMo</option>
          <option value="orange_money">Orange Money</option>
          <option value="wave">Wave</option>
          <option value="bank_wire">Virement</option>
        </select>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-tap items-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-bold text-white transition hover:bg-brand-600 active:scale-95 disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />} Confirmer le séquestre
        </button>
      </form>
      {state.error && <p className="mt-2 text-xs text-rose-600">{state.error}</p>}
      {state.ok && <p className="mt-2 text-xs text-emerald-600">Séquestre activé — la campagne est publiée.</p>}
    </li>
  );
}
