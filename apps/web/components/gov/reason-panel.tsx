'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Inline decision panel (admin-review §A.4.6 pattern): in-flow region, heading, focus on the first
 * field, Esc cancels, reason required where the RPC requires it, counter, quick-pick chips.
 */
export function ReasonPanel({
  id, title, effect, label, required, max, initial = '', quick, submitLabel, cancelLabel, destructive, onSubmit, onCancel, extra, rows = 3, preview,
}: {
  id: string; title: string; effect?: string; label: string; required: boolean; max: number; initial?: string; quick?: string[];
  submitLabel: string; cancelLabel: string; destructive?: boolean; rows?: number;
  onSubmit: (text: string) => Promise<string | null>; onCancel: () => void; extra?: React.ReactNode; preview?: (text: string) => string;
}) {
  const [text, setText] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  const over = text.trim().length > max;

  function submit() {
    if (required && !text.trim()) { setError(label); ref.current?.focus(); return; }
    start(async () => {
      const err = await onSubmit(text);
      if (err) { setError(err); ref.current?.focus(); }
    });
  }

  return (
    <section
      role="region"
      aria-labelledby={`${id}-title`}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onCancel(); } }}
      className="mt-3 min-w-0 rounded-xl border border-line bg-surface p-3"
    >
      <h3 id={`${id}-title`} className="text-sm font-bold text-ink [overflow-wrap:anywhere]">{title}</h3>
      {effect && <p className="mt-1 text-[12px] text-muted">{effect}</p>}
      {extra}
      {quick && quick.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {quick.map((q) => (
            <button key={q} type="button" onClick={() => { setText(q); ref.current?.focus(); }}
              className="inline-flex min-h-tap items-center rounded-full border border-line bg-white px-3 text-[12px] font-semibold text-ink hover:border-brand hover:text-brand">
              {q}
            </button>
          ))}
        </div>
      )}
      <label htmlFor={`${id}-text`} className="mt-2 block text-xs font-semibold text-ink">{label}</label>
      <textarea
        ref={ref}
        id={`${id}-text`}
        value={text}
        onChange={(e) => { setText(e.target.value); setError(null); }}
        rows={rows}
        aria-required={required}
        aria-invalid={!!error || over}
        aria-describedby={`${id}-count${error ? ` ${id}-err` : ''}`}
        className="mt-1 w-full resize-y rounded-xl border border-line bg-white px-3 py-2 text-[16px] text-ink focus:border-brand focus:outline-none sm:text-sm"
      />
      <p id={`${id}-count`} className={`mt-0.5 text-right text-[11px] tabular-nums ${over ? 'font-bold text-rose-700' : 'text-muted'}`}>{text.trim().length}/{max}</p>
      {preview && <p className="mt-1 text-[12px] text-muted [overflow-wrap:anywhere]">{preview(text)}</p>}
      {error && <p id={`${id}-err`} role="alert" className="mt-1 text-xs font-semibold text-rose-700">{error}</p>}
      <div className="mt-2 flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onCancel} className="inline-flex min-h-tap items-center rounded-xl border border-line bg-white px-4 text-sm font-bold text-ink">{cancelLabel}</button>
        <button type="button" onClick={submit} disabled={pending || over}
          className={`inline-flex min-h-tap items-center gap-1.5 rounded-xl px-4 text-sm font-bold text-white disabled:opacity-50 ${destructive ? 'bg-rose-700 hover:bg-rose-800' : 'bg-brand hover:bg-brand-600'}`}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} {submitLabel}
        </button>
      </div>
    </section>
  );
}
