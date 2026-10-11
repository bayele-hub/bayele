'use client';

import Link from 'next/link';
import { useActionState, useEffect, useRef, useState } from 'react';
import { Loader2, Lock } from 'lucide-react';
import { fundCampaignAction, type FundState } from './funding-actions';
import { fmtFcfa } from '@/lib/data/campaigns';
import { SectionTip } from '@/components/admin/section-tip';

export interface FundingRow {
  id: string;
  title: string;
  company: string;
  budget: number;
  country: string;
  /** Managed campaign (« Géré par Bayele »): company = public label · city. */
  managed?: boolean;
  briefId?: string | null;
}

export interface FundingLabels {
  managedChip: string;
  briefLink: string;
  viewPublic: string;
  backToBrief: string;
  highlight: string;
  refLabel: string;
  refPlaceholder: string;
  providerLabel: string;
  submit: string;
  success: string;
  empty: string;
  tips: { aria: string; fundingCard: string; fundingRef: string; fundingProvider: string };
}

/** Funding queue for ALL campaigns (self-serve and managed). The page always passes `labels`. */
export function FundingQueue({ rows, highlight = null, labels }: { rows: FundingRow[]; highlight?: string | null; labels: FundingLabels }) {
  if (rows.length === 0) {
    return <div className="rounded-2xl border border-line bg-white p-6 text-center text-sm text-muted">{labels.empty}</div>;
  }
  return (
    <ul className="grid gap-3">
      {rows.map((r) => (
        <FundingCard key={r.id} row={r} highlighted={r.id === highlight} labels={labels} />
      ))}
    </ul>
  );
}

function FundingCard({ row, highlighted, labels }: { row: FundingRow; highlighted: boolean; labels: FundingLabels }) {
  const [state, action, pending] = useActionState<FundState, FormData>(fundCampaignAction, { error: null });
  // Controlled so the typed reference survives a failed submit (the admin corrects it, F2).
  const [invoice, setInvoice] = useState('');
  const ref = useRef<HTMLLIElement>(null);
  const invoiceRef = useRef<HTMLInputElement>(null);
  const tips = labels.tips;
  const refId = `fund-ref-${row.id}`;
  const providerId = `fund-provider-${row.id}`;
  const errId = `fund-err-${row.id}`;
  const invalid = !!state.error && state.field === 'invoice';
  useEffect(() => {
    if (highlighted) ref.current?.scrollIntoView({ block: 'center' });
  }, [highlighted]);
  useEffect(() => {
    if (invalid) invoiceRef.current?.focus();
  }, [invalid, state]);

  return (
    <li ref={ref} className={`rounded-2xl border border-line bg-white p-4 shadow-card ${highlighted ? 'ring-2 ring-brand' : ''}`}>
      {highlighted && <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-brand-700">{labels.highlight}</p>}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center font-bold text-ink">
            {row.title}
            <SectionTip id={`fundingCard-${row.id}`} label={row.title} text={tips.fundingCard} ariaTemplate={tips.aria} placement="top" />
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
            {row.company} · {row.country}
            {row.managed && (
              <>
                <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700">{labels.managedChip}</span>
                {row.briefId && (
                  <Link href={`/admin/briefs/${row.briefId}`} className="inline-flex min-h-[32px] items-center font-semibold text-brand-700 hover:text-brand">{labels.briefLink}</Link>
                )}
              </>
            )}
          </p>
        </div>
        <span className="font-display font-extrabold text-ink">{fmtFcfa(row.budget)}</span>
      </div>

      <form action={action} className="mt-3 flex flex-wrap items-end gap-2">
        <input type="hidden" name="campaign" value={row.id} />
        <div className="min-w-0 flex-1">
          <span className="flex items-center">
            <label htmlFor={refId} className="text-[11px] font-semibold text-muted">{labels.refLabel}</label>
            <SectionTip id={`fundingRef-${row.id}`} label={labels.refLabel} text={tips.fundingRef} ariaTemplate={tips.aria} placement="top" />
          </span>
          <input
            ref={invoiceRef}
            id={refId}
            name="invoice"
            required
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            value={invoice}
            onChange={(e) => setInvoice(e.target.value)}
            placeholder={labels.refPlaceholder}
            aria-invalid={invalid || undefined}
            aria-describedby={state.error ? errId : undefined}
            className="mt-0.5 min-h-tap w-full rounded-lg border border-line bg-white px-2.5 py-2 text-xs text-ink placeholder:text-muted focus:border-brand focus:outline-none aria-[invalid=true]:border-rose-400"
          />
        </div>
        <div>
          <span className="flex items-center">
            <label htmlFor={providerId} className="text-[11px] font-semibold text-muted">{labels.providerLabel}</label>
            <SectionTip id={`fundingProvider-${row.id}`} label={labels.providerLabel} text={tips.fundingProvider} ariaTemplate={tips.aria} placement="top" />
          </span>
          <select id={providerId} name="provider" className="mt-0.5 min-h-tap rounded-lg border border-line bg-white px-2 py-2 text-xs text-ink focus:border-brand focus:outline-none">
            <option value="mtn_momo">MTN MoMo</option>
            <option value="orange_money">Orange Money</option>
            <option value="wave">Wave</option>
            <option value="bank_wire">Virement</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-tap items-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-bold text-white transition hover:bg-brand-600 active:scale-95 disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Lock className="h-3.5 w-3.5" aria-hidden />} {labels.submit}
        </button>
      </form>
      {state.error && <p id={errId} role="alert" className="mt-2 text-xs text-rose-600">{state.error}</p>}
      {/* F3: only when the action re-read a published / in_progress status. */}
      {state.ok && <p className="mt-2 text-xs text-emerald-600">{labels.success}</p>}
      {state.ok && row.managed && (
        <p className="mt-1 flex flex-wrap gap-3 text-xs">
          <Link href={`/campaigns/${row.id}`} className="inline-flex min-h-[44px] items-center font-semibold text-brand-700 hover:text-brand">{labels.viewPublic}</Link>
          {row.briefId && (
            <Link href={`/admin/briefs/${row.briefId}`} className="inline-flex min-h-[44px] items-center font-semibold text-brand-700 hover:text-brand">{labels.backToBrief}</Link>
          )}
        </p>
      )}
    </li>
  );
}
