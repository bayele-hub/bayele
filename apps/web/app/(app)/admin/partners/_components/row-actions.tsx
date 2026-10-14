'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import type { Dictionary } from '@/i18n/dictionaries';
import { ReasonPanel } from '@/components/gov/reason-panel';
import { dismissEndRequestAction, endAssignmentAction, endRepresentationAction, setCommissionRateAction } from '../actions';

type A = Dictionary['adminPartners'];
const textBtn = 'inline-flex min-h-tap items-center rounded-xl px-2 text-xs font-bold';

function Done({ text }: { text: string | null }) {
  return text ? <p role="status" className="mt-2 text-xs font-semibold text-emerald-700">{text}</p> : null;
}

/** « Mettre fin » on an active assignment (§1.4 unassign, §1.4b prefilled from an end request). */
export function EndAssignment({ A, assignmentId, brand, partnerId, prefill, primary }: { A: A; assignmentId: string; brand: string; partnerId?: string; prefill?: string; primary?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  return (
    <div className="min-w-0">
      {!open && !done && (
        <button type="button" onClick={() => setOpen(true)}
          className={primary ? 'inline-flex min-h-tap items-center rounded-xl bg-rose-700 px-4 text-sm font-bold text-white' : `${textBtn} text-rose-700 hover:bg-rose-50`}>
          {A.unassign.submit}
        </button>
      )}
      {open && (
        <ReasonPanel id={`end-${assignmentId}`} title={A.unassign.title.replace('{brand}', brand)} effect={A.unassign.effect} label={A.reason} required max={500}
          initial={prefill} submitLabel={A.unassign.submit} cancelLabel={A.cancel} destructive onCancel={() => setOpen(false)}
          onSubmit={async (text) => {
            const r = await endAssignmentAction(assignmentId, text, partnerId);
            if (!r.ok) return r.error;
            setOpen(false); setDone(A.unassign.done); router.refresh();
            return null;
          }} />
      )}
      <Done text={done} />
    </div>
  );
}

/** « Refuser la demande » (§1.4b): note for the partner, required ≤ 500. */
export function DismissEndRequest({ A, requestId }: { A: A; requestId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  return (
    <div className="min-w-0">
      {!open && !done && (
        <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-tap items-center rounded-xl border border-line bg-white px-4 text-sm font-bold text-ink">
          {A.endRequests.dismiss}
        </button>
      )}
      {open && (
        <ReasonPanel id={`dismiss-${requestId}`} title={A.endRequests.dismiss} label={A.endRequests.noteLabel} required max={500}
          submitLabel={A.endRequests.dismiss} cancelLabel={A.cancel} onCancel={() => setOpen(false)}
          onSubmit={async (text) => {
            const r = await dismissEndRequestAction(requestId, text);
            if (!r.ok) { if (r.error === A.errors.request_already_decided) router.refresh(); return r.error; }
            setOpen(false); setDone(A.dismiss.done); router.refresh();
            return null;
          }} />
      )}
      <Done text={done} />
    </div>
  );
}

/** §1.5 / §1.6 on an open representation link: change the commission (rate lock) or end it. */
export function LinkActions({ A, linkId, creator, ratePct, partnerId }: { A: A; linkId: string; creator: string; ratePct: string; partnerId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState<null | 'rate' | 'end'>(null);
  const [rate, setRate] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="min-w-0">
      {!open && (
        <div className="flex flex-wrap gap-1">
          <button type="button" onClick={() => { setOpen('rate'); setDone(null); }} className={`${textBtn} text-brand-700 hover:bg-brand-50`}>{A.rate.open}</button>
          <button type="button" onClick={() => { setOpen('end'); setDone(null); }} className={`${textBtn} text-rose-700 hover:bg-rose-50`}>{A.unassign.submit}</button>
        </div>
      )}
      {open === 'rate' && (
        <section role="region" aria-labelledby={`rate-${linkId}`} onKeyDown={(e) => { if (e.key === 'Escape') setOpen(null); }} className="mt-2 space-y-2 rounded-xl border border-line bg-surface p-3">
          <h4 id={`rate-${linkId}`} className="text-sm font-bold text-ink">{A.rate.title.replace('{creator}', creator)}</h4>
          <p className="text-[12px] text-muted">{A.rate.current.replace('{rate}', ratePct)}</p>
          <label htmlFor={`rate-in-${linkId}`} className="block text-xs font-semibold text-ink">{A.rate.new}</label>
          <input id={`rate-in-${linkId}`} inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} autoFocus
            className="min-h-tap w-32 rounded-xl border border-line bg-white px-3 text-[16px] text-ink sm:text-sm" />
          <label htmlFor={`rate-why-${linkId}`} className="block text-xs font-semibold text-ink">{A.reason}</label>
          <textarea id={`rate-why-${linkId}`} value={reason} onChange={(e) => setReason(e.target.value)} rows={2} aria-required
            className="w-full rounded-xl border border-line bg-white px-3 py-2 text-[16px] text-ink sm:text-sm" />
          <p className="text-[12px] text-muted">{A.rate.help}</p>
          {error && <p role="alert" className="text-xs font-semibold text-rose-700">{error}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => setOpen(null)} className="inline-flex min-h-tap items-center rounded-xl border border-line bg-white px-4 text-sm font-bold text-ink">{A.cancel}</button>
            <button type="button" disabled={pending} onClick={() => start(async () => {
              const r = await setCommissionRateAction(linkId, rate, reason, partnerId);
              if (!r.ok) setError(r.error); else { setOpen(null); setDone(A.rate.done); router.refresh(); }
            })} className="inline-flex min-h-tap items-center gap-1.5 rounded-xl bg-brand px-4 text-sm font-bold text-white disabled:opacity-50">
              {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} {A.rate.submit}
            </button>
          </div>
        </section>
      )}
      {open === 'end' && (
        <ReasonPanel id={`endlink-${linkId}`} title={A.endLink.title.replace('{creator}', creator)} effect={A.endLink.effect} label={A.reason} required max={500}
          submitLabel={A.endLink.submit} cancelLabel={A.cancel} destructive onCancel={() => setOpen(null)}
          onSubmit={async (text) => {
            const r = await endRepresentationAction(linkId, text, partnerId);
            if (!r.ok) return r.error;
            setOpen(null); setDone(A.endLink.done); router.refresh();
            return null;
          }} />
      )}
      <Done text={done} />
    </div>
  );
}
