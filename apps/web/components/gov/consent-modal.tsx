'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { recordNonCircumventionAction } from '@/lib/gov/consent-actions';
import { signOutAction } from '@/lib/auth/actions';

export interface ConsentModalLabels { title: string; body: string; points: string[]; tick: string; continue: string; signOut: string; tickError: string; saveError: string; readClause: string }

/**
 * G7 §7: the one-time non-circumvention acknowledgement for existing partners and brands. A native
 * <dialog> opened with showModal(); Esc/backdrop can't dismiss it (required step) — the exit is
 * « Se déconnecter ». Focus starts on the heading. /legal never shows it (checked by the layout).
 */
export function ConsentModal({ L }: { L: ConsentModalLabels }) {
  const ref = useRef<HTMLDialogElement>(null);
  const headRef = useRef<HTMLHeadingElement>(null);
  const boxRef = useRef<HTMLInputElement>(null);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closed, setClosed] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    const d = ref.current;
    if (!d || closed) return;
    if (!d.open) d.showModal?.();
    headRef.current?.focus();
    const block = (e: Event) => e.preventDefault();
    d.addEventListener('cancel', block);
    return () => d.removeEventListener('cancel', block);
  }, [closed]);

  if (closed) return null;

  return (
    <dialog ref={ref} aria-labelledby="consent-title" aria-describedby="consent-body"
      className="consent-dialog w-[calc(100vw-2rem)] max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl bg-white p-5 text-ink shadow-xl backdrop:bg-ink/50">
      <ShieldCheck className="h-7 w-7 text-brand-700" aria-hidden />
      <h2 id="consent-title" ref={headRef} tabIndex={-1} className="mt-2 font-display text-lg font-extrabold outline-none">{L.title}</h2>
      <p id="consent-body" className="mt-2 text-sm text-ink">{L.body}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink">{L.points.map((p) => <li key={p}>{p}</li>)}</ul>
      <a href="/legal#non-contournement" target="_blank" rel="noopener" className="mt-2 inline-flex min-h-[44px] items-center text-sm font-bold text-brand-700 underline">{L.readClause} ↗</a>
      <label className="mt-2 flex min-h-tap items-start gap-2 text-sm">
        <input ref={boxRef} type="checkbox" checked={checked} onChange={(e) => { setChecked(e.target.checked); setError(null); }}
          aria-invalid={!!error || undefined} aria-describedby={error ? 'consent-err' : undefined} className="mt-0.5 h-5 w-5 shrink-0 accent-brand" />
        <span>{L.tick}</span>
      </label>
      {error && <p id="consent-err" role="alert" className="mt-1 text-xs font-semibold text-rose-700">{error}</p>}
      <button type="button" disabled={pending}
        onClick={() => {
          if (!checked) { setError(L.tickError); boxRef.current?.focus(); return; }
          start(async () => {
            const r = await recordNonCircumventionAction();
            if (!r.ok) { setError(L.saveError); return; }
            ref.current?.close();
            setClosed(true);
          });
        }}
        className="mt-3 inline-flex min-h-tap w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-bold text-white disabled:opacity-60">
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} {L.continue}
      </button>
      <form action={signOutAction} className="mt-1 text-center">
        <button type="submit" className="inline-flex min-h-tap items-center px-3 text-sm font-semibold text-muted hover:text-ink">{L.signOut}</button>
      </form>
    </dialog>
  );
}
