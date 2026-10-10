'use client';

import Link from 'next/link';
import { useState } from 'react';
import { CheckCircle2, CircleDashed, Copy, TriangleAlert } from 'lucide-react';
import type { Locale } from '@/i18n/config';
import { formatFcfa } from '@/i18n/format';
import { fill } from '@/lib/campaign-board';
import { deliverableCount, type DeliverableType, type FloorState } from '@/lib/managed-listing';

export interface FloorLabels {
  undefinedTitle: string;
  undefinedBody: string;
  okTitle: string;
  okBody: string;
  belowTitle: string;
  belowBody: string;
  optionBudget: string;
  optionScope: string;
  copyCounter: string;
  copied: string;
  unknown: string;
}

/**
 * Pay-floor verdict (design §2.6, K1): always one of three states. The counter-offer options are pure
 * arithmetic from the stored floor; the server re-checks on publish (`below_pay_floor`).
 */
export function PayFloorVerdict({
  state,
  type,
  units,
  available,
  labels,
  floorsLink,
  locale,
  counterOfferText,
}: {
  state: FloorState;
  type: DeliverableType | '';
  units: number;
  available: boolean;
  labels: FloorLabels;
  floorsLink: string;
  locale: Locale;
  counterOfferText: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const f = (n: number) => formatFcfa(n, locale);

  if (state.kind === 'pass') {
    return (
      <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-emerald-700">
        <p className="flex items-center gap-1.5 text-sm font-bold"><CheckCircle2 className="h-4 w-4" aria-hidden /> {labels.okTitle}</p>
        <p className="mt-0.5 text-[12px]">{fill(labels.okBody, { perUnit: f(state.perUnitFcfa), floor: f(state.floorFcfa) })}</p>
      </div>
    );
  }
  if (state.kind === 'below') {
    const copy = async () => {
      if (!counterOfferText) return;
      try {
        await navigator.clipboard.writeText(counterOfferText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        /* clipboard blocked: the text stays visible below */
      }
    };
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-700">
        <p className="flex items-center gap-1.5 text-sm font-bold"><TriangleAlert className="h-4 w-4" aria-hidden /> {labels.belowTitle}</p>
        <p className="mt-0.5 text-[12px]">{fill(labels.belowBody, { gap: f(state.gapPerPlaceFcfa) })}</p>
        <ul className="mt-2 grid gap-1 text-[12px] text-ink">
          <li>• {fill(labels.optionBudget, { total: f(state.totalForSameWorkFcfa) })}</li>
          {state.unitsForSameBudget > 0 && type && (
            <li>• {fill(labels.optionScope, { qty: deliverableCount(type, state.unitsForSameBudget, locale), current: units })}</li>
          )}
        </ul>
        {counterOfferText && (
          <button type="button" onClick={copy} className="mt-2 inline-flex min-h-tap items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 text-xs font-bold text-rose-700 hover:border-rose-400">
            <Copy className="h-3.5 w-3.5" aria-hidden /> {copied ? labels.copied : labels.copyCounter}
          </button>
        )}
        <span role="status" className="sr-only">{copied ? labels.copied : ''}</span>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <p className="flex items-center gap-1.5 text-sm font-bold text-ink"><CircleDashed className="h-4 w-4 text-muted" aria-hidden /> {labels.undefinedTitle}</p>
      <p className="mt-0.5 text-[12px] text-muted">{available ? labels.undefinedBody : labels.unknown}</p>
      <Link href="/admin/pay-floors" className="mt-1 inline-flex min-h-[44px] items-center text-[12px] font-semibold text-brand-700 hover:text-brand">{floorsLink}</Link>
    </div>
  );
}
