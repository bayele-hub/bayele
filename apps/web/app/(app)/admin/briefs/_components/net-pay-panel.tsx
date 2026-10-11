import type { ReactNode } from 'react';
import type { Locale } from '@/i18n/config';
import { formatFcfa } from '@/i18n/format';
import { fill } from '@/lib/campaign-board';
import { deliverableCount, type DeliverableType, type NetPreview } from '@/lib/managed-listing';

export interface NetPayLabels {
  total: string;
  fee: string;
  pool: string;
  divide: string;
  divideOne: string;
  netLabel: string;
  perUnit: string;
  shownOnListing: string;
  remainder: string;
  remainderHint: string;
  incomplete: string;
}

/**
 * The signature admin object (design §2.5): total → 25 % fee → creator pay ÷ places → NET PAR PLACE,
 * the number the listing will show (K7). Same math as managed_net_preview (E3), remainder shown
 * honestly (« Reste d'arrondi », it stays in escrow). Incomplete inputs show « — », never zeros.
 */
export function NetPayPanel({ preview, type, labels, locale, tip }: { preview: NetPreview | null; type: DeliverableType | ''; labels: NetPayLabels; locale: Locale; tip?: ReactNode }) {
  const f = (n: number) => formatFcfa(n, locale);
  const row = (label: string, value: string, strong = false) => (
    <div className="flex items-baseline justify-between gap-3 py-0.5 text-[13px]">
      <span className="text-white/70">{label}</span>
      <span className={`tabular-nums ${strong ? 'font-bold text-white' : 'text-white/90'}`}>{value}</span>
    </div>
  );
  return (
    <div className="rounded-2xl bg-ink p-5 text-white">
      {row(labels.total, preview ? f(preview.totalFcfa) : '—')}
      {row(labels.fee, preview ? `− ${f(preview.feeFcfa)}` : '—')}
      {row(labels.pool, preview ? f(preview.poolFcfa) : '—', true)}
      <p className="text-[12px] text-white/60">{preview ? (preview.places === 1 ? labels.divideOne : fill(labels.divide, { n: preview.places })) : ''}</p>
      <div className="mt-3 border-t border-white/15 pt-3">
        <p className="flex items-center text-[12px] font-bold uppercase tracking-wide text-accent [&_button]:text-white/70">{labels.netLabel}{tip}</p>
        <p aria-live="polite" className="mt-1 whitespace-nowrap font-display text-[2.25rem] font-extrabold leading-none tabular-nums">
          {preview ? f(preview.netPerPlaceFcfa).replace(/ FCFA$/, '') : '—'}
          {preview && <span className="ml-1 text-[0.45em] font-bold text-white/70">FCFA</span>}
        </p>
        {preview && type && preview.units > 0 && (
          <p className="mt-1.5 text-[13px] text-white/85">
            {fill(labels.perUnit, { amount: f(preview.netPerUnitFcfa), qty: deliverableCount(type, preview.units, locale) })}
          </p>
        )}
        <p className="mt-1 text-[12px] text-white/70">{preview ? labels.shownOnListing : labels.incomplete}</p>
        {preview && preview.remainderFcfa > 0 && (
          <p className="mt-1 text-[12px] text-white/60">
            {fill(labels.remainder, { amount: f(preview.remainderFcfa) })} · {labels.remainderHint}
          </p>
        )}
      </div>
    </div>
  );
}
