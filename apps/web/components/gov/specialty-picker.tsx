'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { SectionTip } from '@/components/admin/section-tip';
import { MAX_SPECIALTIES, toggleSpecialty } from '@/lib/gov/specialties';

export interface SpecialtyPickerLabels { legend: string; counter: string; help: string; max: string; legacy: string; tip: string; aria: string }

/**
 * G1 / §3.3 specialty picker: chips with aria-pressed, max 3 (extra taps refused with a status hint),
 * a live « n/3 » counter, and a hidden `specialties` input carrying the comma-joined CODES.
 */
export function SpecialtyPicker({ options, initial, legacy, L, error }: {
  options: { code: string; label: string }[]; initial: string[]; legacy: string[]; L: SpecialtyPickerLabels; error?: string | null;
}) {
  const known = new Set(options.map((o) => o.code));
  const [selected, setSelected] = useState<string[]>(initial.filter((c) => known.has(c)).slice(0, MAX_SPECIALTIES));
  const [limit, setLimit] = useState(false);
  const full = selected.length >= MAX_SPECIALTIES;

  return (
    <fieldset className="min-w-0" aria-describedby={`spec-help${error ? ' spec-err' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <legend className="flex items-center text-xs font-semibold text-ink">
          {L.legend}
          <SectionTip id="specialties-tip" label={L.legend} text={L.tip} ariaTemplate={L.aria} />
        </legend>
        <span aria-live="polite" className="text-xs font-bold tabular-nums text-muted">{L.counter.replace('{n}', String(selected.length))}</span>
      </div>
      {legacy.length > 0 && <p className="mt-1 text-[12px] text-muted [overflow-wrap:anywhere]">{L.legacy.replace('{legacy}', legacy.join(', '))}</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((o) => {
          const on = selected.includes(o.code);
          const blocked = !on && full;
          return (
            <button key={o.code} type="button" aria-pressed={on} aria-disabled={blocked || undefined}
              onClick={() => {
                const r = toggleSpecialty(selected, o.code);
                setLimit(r.limitHit);
                setSelected(r.next);
              }}
              className={`inline-flex min-h-tap items-center gap-1 rounded-full border px-3.5 text-[13px] font-bold transition ${on ? 'border-brand bg-brand-50 text-brand-700' : 'border-line bg-white text-muted hover:border-brand-100'} ${blocked ? 'opacity-50' : ''}`}>
              {on && <Check className="h-3.5 w-3.5" aria-hidden />} {o.label}
            </button>
          );
        })}
      </div>
      <input type="hidden" name="specialties" value={selected.join(',')} />
      <p id="spec-help" className="mt-1 text-[11px] text-muted">{L.help}</p>
      {limit && <p role="status" className="mt-1 text-[12px] font-semibold text-ink">{L.max}</p>}
      {error && <p id="spec-err" role="alert" className="mt-1 text-xs font-semibold text-rose-700">{error}</p>}
    </fieldset>
  );
}
