'use client';

import { useActionState, useState } from 'react';
import { Loader2, Undo2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { refundCampaignAction, type RefundState } from './refund-actions';
import { fmtFcfa, ESCROW_STATUS_FR } from '@/lib/data/campaigns';

export interface RefundRow {
  id: string;
  title: string;
  company: string;
  budget: number;
  country: string;
  escrowStatus: string;
}

export function RefundQueue({ rows }: { rows: RefundRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-white p-6 text-center text-sm text-muted">
        Aucune campagne financée en attente de remboursement.
      </div>
    );
  }
  return (
    <ul className="grid gap-3">
      {rows.map((r) => (
        <RefundCard key={r.id} row={r} />
      ))}
    </ul>
  );
}

function RefundCard({ row }: { row: RefundRow }) {
  const [state, action, pending] = useActionState<RefundState, FormData>(refundCampaignAction, { error: null });
  const [armed, setArmed] = useState(false);

  if (state.ok) {
    return (
      <li className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
        <p className="flex items-center gap-2 text-sm font-bold text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> {row.title} — remboursé & annulé
        </p>
        <p className="mt-1 text-xs text-emerald-700/80">Le séquestre a été retourné à {row.company}.</p>
      </li>
    );
  }

  return (
    <li className="rounded-2xl border border-line bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-ink">{row.title}</p>
          <p className="mt-0.5 text-xs text-muted">{row.company} · {row.country}</p>
        </div>
        <div className="text-right">
          <span className="font-display font-extrabold text-ink">{fmtFcfa(row.budget)}</span>
          <div className="mt-1 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700">
            {ESCROW_STATUS_FR[row.escrowStatus] ?? row.escrowStatus}
          </div>
        </div>
      </div>

      <form action={action} className="mt-3 space-y-2">
        <input type="hidden" name="campaign" value={row.id} />
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1">
            <label className="text-[11px] font-semibold text-muted">Motif du remboursement (requis)</label>
            <input
              name="reason"
              required
              placeholder="Non-livraison, annulation marque…"
              className="mt-0.5 min-h-tap w-full rounded-lg border border-line bg-white px-2.5 py-2 text-xs text-ink focus:border-brand focus:outline-none"
            />
          </div>
          <div className="min-w-0 flex-1">
            <label className="text-[11px] font-semibold text-muted">Réf. reçu MoMo (optionnel)</label>
            <input
              name="receipt"
              placeholder="RB-2026-000045"
              className="mt-0.5 min-h-tap w-full rounded-lg border border-line bg-white px-2.5 py-2 text-xs text-ink focus:border-brand focus:outline-none"
            />
          </div>
        </div>

        {!armed ? (
          <button
            type="button"
            onClick={() => setArmed(true)}
            className="inline-flex min-h-tap items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 text-xs font-bold text-rose-700 transition hover:bg-rose-100 active:scale-95"
          >
            <Undo2 className="h-3.5 w-3.5" /> Rembourser & annuler
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-2.5">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-700">
              <AlertTriangle className="h-3.5 w-3.5" /> Action irréversible — confirmer ?
            </span>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex min-h-tap items-center gap-1.5 rounded-lg bg-rose-600 px-3 text-xs font-bold text-white transition hover:bg-rose-700 active:scale-95 disabled:opacity-50"
            >
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />} Oui, rembourser
            </button>
            <button
              type="button"
              onClick={() => setArmed(false)}
              className="inline-flex min-h-tap items-center rounded-lg border border-line bg-white px-3 text-xs font-semibold text-ink transition hover:border-brand"
            >
              Annuler
            </button>
          </div>
        )}
      </form>
      {state.error && <p className="mt-2 text-xs text-rose-600">{state.error}</p>}
    </li>
  );
}
