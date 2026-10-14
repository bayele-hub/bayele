'use client';

import { useState, type ReactNode } from 'react';

/**
 * A text field with a visible limit (D5): counter « n/max », an optional helper that stays visible,
 * an optional tip next to the label, and a field error (aria-invalid + role=alert) that replaces the
 * helper. An old value already over the limit shows `overLimitError` immediately, before any save.
 */
export function LimitedField({
  id,
  name,
  label,
  max,
  defaultValue = '',
  required,
  multiline = false,
  rows = 3,
  placeholder,
  helper,
  tip,
  error,
  overLimitError,
  counterTemplate = '{n}/{max}',
  autoComplete,
}: {
  id: string;
  name: string;
  label: string;
  max: number;
  defaultValue?: string;
  required?: boolean;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  helper?: string;
  tip?: ReactNode;
  error?: string | null;
  overLimitError?: string;
  counterTemplate?: string;
  autoComplete?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const len = multiline ? value.length : value.replace(/\s+/g, ' ').trim().length;
  const over = len > max;
  const shownError = error ?? (over ? overLimitError ?? null : null);
  const helpId = `${id}-help`;
  const cls = `mt-1 w-full rounded-xl border bg-white px-3 text-[16px] text-ink placeholder:text-muted focus:border-brand focus:outline-none sm:text-sm ${shownError ? 'border-rose-400' : 'border-line'}`;
  const common = {
    id,
    name,
    value,
    required,
    placeholder,
    autoComplete,
    'aria-invalid': shownError ? true : undefined,
    'aria-describedby': helpId,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValue(e.target.value),
  };
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="flex items-center text-xs font-semibold text-ink">
        {label}
        {tip}
      </label>
      {multiline ? <textarea {...common} rows={rows} className={`${cls} resize-none py-2.5`} /> : <input {...common} type="text" className={`${cls} min-h-tap py-3`} />}
      <div id={helpId} className="mt-1 flex items-start justify-between gap-2 text-[11px]">
        {shownError ? (
          <span role="alert" className="text-rose-700">{shownError}</span>
        ) : (
          <span className="text-muted">{helper ?? ''}</span>
        )}
        <span className={`shrink-0 tabular-nums ${over ? 'font-bold text-rose-700' : 'text-muted'}`}>
          {counterTemplate.replace('{n}', String(len)).replace('{max}', String(max))}
        </span>
      </div>
    </div>
  );
}
