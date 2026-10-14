'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, Loader2, ShieldCheck } from 'lucide-react';
import type { Dictionary } from '@/i18n/dictionaries';
import { ReasonPanel } from '@/components/gov/reason-panel';
import { decideSelfDealingAction, readMaskedOriginalAction, resolveFlagAction } from '../actions';

type A = Dictionary['adminPartners'];

/**
 * P5 « Voir l'original »: reason required (quick-pick chips), logged server-side on every read.
 * The original is never cached: « Masquer » drops it and a new read needs a new reason.
 */
export function OriginalReveal({ A, messageId, available, locale }: { A: A; messageId: string | null; available: boolean; locale: 'fr' | 'en' }) {
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState<{ text: string; at: Date } | null>(null);
  const live = useRef<HTMLDivElement>(null);
  if (!messageId) return null;
  if (!available) return <p className="text-xs text-muted">{A.original.purged}</p>;
  if (shown) {
    return (
      <div ref={live} aria-live="polite" className="min-w-0">
        <p className="text-[11px] font-semibold text-muted">{A.original.label.replace('{date}', new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(shown.at))}</p>
        <div className="mt-1 whitespace-pre-wrap rounded-xl border border-line bg-surface p-3 text-sm text-ink [overflow-wrap:anywhere]">{shown.text}</div>
        <button type="button" onClick={() => setShown(null)} className="mt-1 inline-flex min-h-tap items-center rounded-xl px-2 text-xs font-bold text-brand-700">{A.original.hide}</button>
      </div>
    );
  }
  return (
    <div className="min-w-0">
      {!open && (
        <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-tap items-center gap-1.5 rounded-xl border border-line bg-white px-3 text-xs font-bold text-ink">
          <Eye className="h-4 w-4" aria-hidden /> {A.original.show}
        </button>
      )}
      {open && (
        <ReasonPanel id={`orig-${messageId}`} title={A.original.title} label={A.reason} required max={500} quick={A.original.quick}
          extra={<p className="mt-2 flex items-start gap-1.5 rounded-xl border border-brand-100 bg-brand-50 p-2 text-[12px] text-ink"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" aria-hidden />{A.original.notice}</p>}
          submitLabel={A.original.submit} cancelLabel={A.cancel} onCancel={() => setOpen(false)}
          onSubmit={async (text) => {
            const r = await readMaskedOriginalAction(messageId, text);
            if (!r.ok) return r.error;
            setOpen(false);
            setShown({ text: r.data, at: new Date() });
            return null;
          }} />
      )}
    </div>
  );
}

/** « Marquer comme traité » (note optional ≤ 500). */
export function ResolveFlag({ A, flagId }: { A: A; flagId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  if (done) return <p role="status" className="text-xs font-semibold text-emerald-700">{A.flags.done}</p>;
  return (
    <div className="min-w-0">
      {!open && <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-tap items-center rounded-xl bg-brand px-3 text-xs font-bold text-white">{A.flags.resolve}</button>}
      {open && (
        <ReasonPanel id={`res-${flagId}`} title={A.flags.resolve} label={A.flags.noteOptional} required={false} max={500} rows={2}
          submitLabel={A.flags.resolve} cancelLabel={A.cancel} onCancel={() => setOpen(false)}
          onSubmit={async (text) => {
            const r = await resolveFlagAction(flagId, text);
            if (!r.ok) { if (r.error === A.errors.flag_already_decided) router.refresh(); return r.error; }
            setDone(true); router.refresh();
            return null;
          }} />
      )}
    </div>
  );
}

/** Self-dealing: « Lever le signalement » (note optional) · « Confirmer » (note required). */
export function SelfDealingDecide({ A, flagId }: { A: A; flagId: string }) {
  const router = useRouter();
  const [decision, setDecision] = useState<null | 'cleared' | 'confirmed'>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  if (done) return <p role="status" className="text-xs font-semibold text-emerald-700">{A.flags.done}</p>;
  return (
    <div className="min-w-0 space-y-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" aria-pressed={decision === 'cleared'} onClick={() => setDecision('cleared')} className={`inline-flex min-h-tap items-center rounded-xl border px-3 text-xs font-bold ${decision === 'cleared' ? 'border-brand bg-brand-50 text-brand-700' : 'border-line bg-white text-ink'}`}>{A.flags.clear}</button>
        <button type="button" aria-pressed={decision === 'confirmed'} onClick={() => setDecision('confirmed')} className={`inline-flex min-h-tap items-center rounded-xl border px-3 text-xs font-bold ${decision === 'confirmed' ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-line bg-white text-ink'}`}>{A.flags.confirm}</button>
      </div>
      {decision && (
        <div onKeyDown={(e) => { if (e.key === 'Escape') setDecision(null); }}>
          <label htmlFor={`sd-${flagId}`} className="block text-xs font-semibold text-ink">{decision === 'confirmed' ? A.flags.noteRequired : A.flags.noteOptional}</label>
          <textarea id={`sd-${flagId}`} value={note} onChange={(e) => setNote(e.target.value)} rows={2} aria-required={decision === 'confirmed'} autoFocus
            className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-[16px] text-ink sm:text-sm" />
          {error && <p role="alert" className="text-xs font-semibold text-rose-700">{error}</p>}
          <div className="mt-1 flex justify-end gap-2">
            <button type="button" onClick={() => setDecision(null)} className="inline-flex min-h-tap items-center rounded-xl border border-line bg-white px-3 text-xs font-bold text-ink">{A.cancel}</button>
            <button type="button" disabled={pending} onClick={() => start(async () => {
              if (decision === 'confirmed' && !note.trim()) { setError(A.errors.note_required); return; }
              const r = await decideSelfDealingAction(flagId, decision, note);
              if (!r.ok) { setError(r.error); return; }
              setDone(true); router.refresh();
            })} className={`inline-flex min-h-tap items-center gap-1.5 rounded-xl px-3 text-xs font-bold text-white ${decision === 'confirmed' ? 'bg-rose-700' : 'bg-brand'}`}>
              {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />} {decision === 'confirmed' ? A.flags.confirm : A.flags.clear}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
