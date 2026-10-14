'use client';

import { useActionState, useState } from 'react';
import { Loader2, Lock, Play, CheckCircle2, X } from 'lucide-react';
import { fundRetainerAction, retainerTransitionAction, terminateRetainerAction, type AdminRetainerState } from './retainer-actions';
import type { Dictionary } from '@/i18n/dictionaries';
import { earlyEndSettlement, retainerSplit, retainerStage } from '@/lib/retainers';
import { fmtFcfa } from '@/lib/data/campaigns';

export interface AdminRetainer {
  id: string;
  business: string;
  consultant: string;
  contract: number;
  consultantFee: number;
  mediaBudget: number;
  kpiBonus: number;
  status: string;
  partnerAcceptedAt: string | null;
  partnerDeclinedAt: string | null;
}

export function RetainerAdminRow({ r, R, Q }: { r: AdminRetainer; R: Dictionary['retainers']; Q: Dictionary['admin']['queues'] }) {
  const [fundState, fundAction, funding] = useActionState<AdminRetainerState, FormData>(fundRetainerAction, { error: null });
  const [transState, transAction, transitioning] = useActionState<AdminRetainerState, FormData>(retainerTransitionAction, { error: null });
  const [termState, termAction, terminating] = useActionState<AdminRetainerState, FormData>(terminateRetainerAction, { error: null });
  const [ending, setEnding] = useState(false);
  const [payout, setPayout] = useState('');
  const err = fundState.error || transState.error || termState.error;
  const stage = retainerStage({ status: r.status, partner_accepted_at: r.partnerAcceptedAt, partner_declined_at: r.partnerDeclinedAt });
  const split = retainerSplit(r.contract);
  const preview = split ? earlyEndSettlement(r.contract, Number(payout) || 0) : null;

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
          <div className={`mt-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${stage === 'awaiting_partner' ? 'bg-accent-soft text-ink' : 'bg-surface text-muted'}`}>
            {R.stage[stage]}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        {/* O7: funding only once the partner accepted (the RPC refuses otherwise). */}
        {stage === 'invoiced' && (
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

        {(r.status === 'funded' || r.status === 'active') && !ending && (
          <button type="button" onClick={() => setEnding(true)} className="inline-flex min-h-tap items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-bold text-ink transition hover:border-rose-200 hover:text-rose-700">
            <X className="h-3.5 w-3.5" aria-hidden /> {Q.terminate.label}
          </button>
        )}

        {['draft', 'invoiced'].includes(r.status) && stage !== 'declined' && (
          <form action={transAction}>
            <input type="hidden" name="retainer" value={r.id} />
            <input type="hidden" name="to" value="terminated" />
            <button type="submit" disabled={transitioning} className="inline-flex min-h-tap items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-bold text-muted transition hover:border-rose-200 hover:text-rose-600 disabled:opacity-50">
              <X className="h-3.5 w-3.5" /> Annuler
            </button>
          </form>
        )}
      </div>
      {ending && split && (
        <form action={termAction} className="mt-3 space-y-2 rounded-xl border border-rose-200 bg-rose-50 p-3">
          <input type="hidden" name="retainer" value={r.id} />
          <input type="hidden" name="net" value={split.net} />
          <label className="block text-[11px] font-semibold text-ink">
            {Q.terminate.payout}
            <input name="payout" inputMode="numeric" required value={payout} onChange={(e) => setPayout(e.target.value.replace(/\D/g, ''))}
              className="mt-0.5 min-h-tap w-full rounded-lg border border-line bg-white px-2.5 text-[16px] text-ink focus:border-brand focus:outline-none sm:text-xs" />
          </label>
          {preview && (
            <p className="text-[11px] text-ink">
              {Q.terminate.payoutHint.replace('{net}', fmtFcfa(split.net)).replace('{kept}', fmtFcfa(preview.kept)).replace('{refund}', fmtFcfa(preview.refund))}
            </p>
          )}
          <label className="block text-[11px] font-semibold text-ink">
            {Q.terminate.reason}
            <input name="reason" required maxLength={500}
              className="mt-0.5 min-h-tap w-full rounded-lg border border-line bg-white px-2.5 text-[16px] text-ink focus:border-brand focus:outline-none sm:text-xs" />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={terminating} className="inline-flex min-h-tap items-center gap-1.5 rounded-lg bg-rose-700 px-3 text-xs font-bold text-white disabled:opacity-50">
              {terminating && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />} {Q.terminate.confirm}
            </button>
            <button type="button" onClick={() => setEnding(false)} className="inline-flex min-h-tap items-center rounded-lg border border-line bg-white px-3 text-xs font-bold text-ink">{Q.terminate.cancel}</button>
          </div>
        </form>
      )}
      {err && <p role="alert" className="mt-2 text-xs text-rose-700">{err}</p>}
    </li>
  );
}
