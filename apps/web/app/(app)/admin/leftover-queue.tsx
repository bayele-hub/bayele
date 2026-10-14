'use client';

import { useActionState } from 'react';
import { CheckCircle2, Loader2, Undo2 } from 'lucide-react';
import type { Dictionary } from '@/i18n/dictionaries';
import { fmtFcfa } from '@/lib/data/campaigns';
import { refundCampaignAction, type RefundState } from './refund-actions';

export interface LeftoverRow {
  campaignId: string;
  title: string;
  owner: string;
  managed: boolean;
  used: number;
  unused: number;
  feeBack: number;
  refund: number;
}

type Q = Dictionary['admin']['queues']['leftover'];

/**
 * D9 leftover escrow (admin_pending_leftover_refunds): completed campaigns with unused net. Confirming
 * reuses refundCampaignAction → admin_refund_campaign, which settles the pending `refund` row
 * (idempotent) and keeps the campaign completed. No new money flow.
 */
export function LeftoverQueue({ rows, Q }: { rows: LeftoverRow[]; Q: Q }) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-bold text-ink">{Q.title}</h3>
        <p className="mt-0.5 text-xs text-muted">{Q.body}</p>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-2xl border border-line bg-white p-6 text-center text-sm text-muted">{Q.empty}</p>
      ) : (
        <ul className="grid gap-3">{rows.map((r) => <LeftoverCard key={r.campaignId} r={r} Q={Q} />)}</ul>
      )}
    </section>
  );
}

function LeftoverCard({ r, Q }: { r: LeftoverRow; Q: Q }) {
  const [state, action, pending] = useActionState<RefundState, FormData>(refundCampaignAction, { error: null });
  if (state.ok) {
    return (
      <li className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
        <CheckCircle2 className="mr-1 inline h-4 w-4" aria-hidden /> {r.title} — {Q.done}
      </li>
    );
  }
  return (
    <li className="min-w-0 rounded-2xl border border-line bg-white p-4 shadow-card">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-bold text-ink">{r.title}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
            {r.owner}
            {r.managed && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700">{Q.managed}</span>}
          </p>
          <p className="mt-1 text-[11px] text-muted">
            {Q.used.replace('{amount}', fmtFcfa(r.used))} · {Q.unused.replace('{amount}', fmtFcfa(r.unused))} · {Q.feeBack.replace('{amount}', fmtFcfa(r.feeBack))}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[11px] text-muted">{Q.refund}</p>
          <p className="font-display font-extrabold text-ink">{fmtFcfa(r.refund)}</p>
        </div>
      </div>
      <form action={action} className="mt-3 flex flex-wrap items-end gap-2">
        <input type="hidden" name="campaign" value={r.campaignId} />
        <input type="hidden" name="reason" value={Q.reasonDefault} />
        <label className="min-w-0 flex-1 text-[11px] font-semibold text-muted">
          {Q.receipt}
          <input name="receipt" required autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false}
            className="mt-0.5 min-h-tap w-full rounded-lg border border-line bg-white px-2.5 text-[16px] text-ink focus:border-brand focus:outline-none sm:text-xs" />
        </label>
        <button type="submit" disabled={pending} className="inline-flex min-h-tap items-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-bold text-white disabled:opacity-50">
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Undo2 className="h-3.5 w-3.5" aria-hidden />} {Q.confirm}
        </button>
      </form>
      {state.error && <p role="alert" className="mt-2 text-xs text-rose-700">{state.error}</p>}
    </li>
  );
}
