import type { ReactNode } from 'react';

/**
 * AR-1: the creator types their total audience. The per-network sum is only a hint (« Total de vos
 * réseaux : X »), shown when counts exist; it is never written in place of the typed figure.
 */
export function AudienceField({ label, tip, defaultValue, networksTotal, networksTemplate, locale }: {
  label: string; tip?: ReactNode; defaultValue?: number; networksTotal?: number; networksTemplate: string; locale?: 'fr' | 'en';
}) {
  return (
    <div>
      <label htmlFor="field-audience" className="flex items-center text-xs font-semibold text-ink">{label}{tip}</label>
      <input
        id="field-audience"
        name="audience_size"
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        defaultValue={defaultValue || undefined}
        aria-describedby={networksTotal ? 'field-audience-hint' : undefined}
        className="mt-1 min-h-tap w-full rounded-xl border border-line bg-white px-3 py-3 text-[16px] text-ink focus:border-brand focus:outline-none sm:text-sm"
      />
      {networksTotal ? (
        <p id="field-audience-hint" className="mt-1 text-[11px] text-muted">
          {networksTemplate.replace('{n}', new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-US').format(networksTotal))}
        </p>
      ) : null}
    </div>
  );
}
