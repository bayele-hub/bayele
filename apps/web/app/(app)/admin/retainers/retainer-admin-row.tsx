'use client';

import { useActionState } from 'react';
import { Loader2, Lock, Play, CheckCircle2, X } from 'lucide-react';
import { fundRetainerAction, retainerTransitionAction, type AdminRetainerState } from './retainer-actions';
import { fmtFcfa, RETAINER_STATUS_FR } from '@/lib/data/campaigns';

export interface AdminRetainer {
  id: string;
  business: string;
  consultant: string;
  contract: number;
  consultantFee: number;
  mediaBudget: number;
  kpiBonus: number;
  status: string;
}

export function RetainerAdminRow({ r }: { r: AdminRetainer }) {
  const [fundState, fundAction, funding] = useActionState<AdminRetainerState, FormData>(fundRetainerAction, { error: null });
  const [transState, transAction, transitioning] = useActionState<AdminRetainerState, FormData>(retainerTransitionAction, { error: null });
  const err = fundState.error || transState.error;

  return (
    <li className="rounded-2xl border border-line bg-white p-4 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-ink">{r.business} → {r.consultant}</p>
          <p className="mt-0.5 text-xs text-muted">
            honoraires {fmtFcfa(r.consultantFee)} · média {fmtFcfa(r.mediaBudget)} · bonus {fmtFcfa(r.kpiBonus)}
          </p>
        </div>
        <div className="text-right">
          <span className="font-display font-extrabold text-ink">{fmtFcfa(r.contract)}</span>
          <div className="mt-1 rounded-full bg-surface px-2.5 py-1 text-[11px] font-bold text-muted">
            {RETAINER_STATUS_FR[r.status] ?? r.status}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        {r.status === 'invoiced' && (
          <form action={fundAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="retainer" value={r.id} />
            <div>
              <label className="text-[11px] font-semibold text-muted">Réf. reçu MoMo</label>
              <input
                name="receipt"
                placeholder="RCPT-000123"
                className="mt-0.5 w-40 rounded-lg border border-line bg-white px-2.5 py-2 text-xs text-ink focus:border-brand focus:outline-none"
              />
            </div>
            <button type="submit" disabled={funding} className="inline-flex min-h-tap items-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-bold text-white transition hover:bg-brand-600 active:scale-95 disabled:opacity-50">
              {funding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />} Confirmer le paiement
            </button>
          </form>
        )}

        {r.status === 'funded' && (
          <form action={transAction}>
            <input type="hidden" name="retainer" value={r.id} />
            <input type="hidden" name="to" value="active" />
            <button type="submit" disabled={transitioning} className="inline-flex min-h-tap items-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-bold text-white transition hover:bg-brand-600 active:scale-95 disabled:opacity-50">
              {transitioning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} Activer
            </button>
          </form>
        )}

        {r.status === 'active' && (
          <form action={transAction}>
            <input type="hidden" name="retainer" value={r.id} />
            <input type="hidden" name="to" value="completed" />
            <button type="submit" disabled={transitioning} className="inline-flex min-h-tap items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white transition hover:bg-emerald-700 active:scale-95 disabled:opacity-50">
              {transitioning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Clôturer
            </button>
          </form>
        )}

        {['draft', 'invoiced', 'funded', 'active'].includes(r.status) && (
          <form action={transAction}>
            <input type="hidden" name="retainer" value={r.id} />
            <input type="hidden" name="to" value="terminated" />
            <button type="submit" disabled={transitioning} className="inline-flex min-h-tap items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-bold text-muted transition hover:border-rose-200 hover:text-rose-600 disabled:opacity-50">
              <X className="h-3.5 w-3.5" /> Annuler
            </button>
          </form>
        )}
      </div>
      {err && <p className="mt-2 text-xs text-rose-600">{err}</p>}
    </li>
  );
}
