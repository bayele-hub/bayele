'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import type { Dictionary } from '@/i18n/dictionaries';
import { decideContactRequestAction } from '../actions';

type A = Dictionary['adminPartners'];
const CODES = ['incomplete', 'brand_unverified', 'poor_fit', 'suspected_offplatform', 'other'] as const;

/** §1.9 approve (P3: effective at once) / decline (reason radio, message prefilled, preview line). */
export function RequestDecision({ A, requestId }: { A: A; requestId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState<null | 'approve' | 'decline'>(null);
  const [code, setCode] = useState<(typeof CODES)[number] | ''>('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ text: string; href?: string } | null>(null);
  const [pending, start] = useTransition();
  const R = A.requests.reasons as Record<string, { label: string; message: string }>;

  function submit(approve: boolean) {
    setError(null);
    if (!approve && !code) { setError(A.errors.reason_required); return; }
    if (!approve && code === 'other' && !msg.trim()) { setError(A.errors.message_required); return; }
    start(async () => {
      const r = await decideContactRequestAction(requestId, approve, approve ? null : code, msg);
      if (!r.ok) { setError(r.error); if (r.error === A.errors.not_pending) router.refresh(); return; }
      setOpen(null);
      setDone(approve ? { text: A.requests.approved, href: r.data.conversationId ? `/messages/${r.data.conversationId}` : undefined } : { text: A.requestStatus.declined });
      router.refresh();
    });
  }

  if (done) {
    return (
      <p role="status" className="text-sm text-emerald-800">
        {done.text} {done.href && <Link href={done.href} className="font-bold underline">{A.assign.openThread}</Link>}
      </p>
    );
  }

  return (
    <div className="min-w-0">
      {!open && (
        <div className="flex flex-wrap justify-between gap-2">
          <button type="button" onClick={() => setOpen('decline')} className="inline-flex min-h-tap items-center rounded-xl border border-line bg-white px-4 text-sm font-bold text-ink">{A.requests.decline}</button>
          <button type="button" onClick={() => setOpen('approve')} className="inline-flex min-h-tap items-center rounded-xl bg-brand px-4 text-sm font-bold text-white">{A.requests.approve}</button>
        </div>
      )}
      {open && (
        <section role="region" aria-labelledby={`rq-${requestId}`} onKeyDown={(e) => { if (e.key === 'Escape') setOpen(null); }} className="space-y-2 rounded-xl border border-line bg-surface p-3">
          <h4 id={`rq-${requestId}`} className="text-sm font-bold text-ink">{open === 'approve' ? A.requests.approveSubmit : A.requests.submitDecline}</h4>
          {open === 'approve' ? (
            <p className="text-[12px] text-muted">{A.requests.approveNote}</p>
          ) : (
            <fieldset>
              <legend className="text-xs font-semibold text-ink">{A.reason}</legend>
              <div className="mt-1 grid gap-1">
                {CODES.map((c) => (
                  <label key={c} className="flex min-h-tap cursor-pointer items-center gap-2 rounded-lg px-2 text-sm text-ink hover:bg-white">
                    <input type="radio" name={`reason-${requestId}`} value={c} checked={code === c} onChange={() => { setCode(c); setMsg(R[c]?.message ?? ''); }} className="h-4 w-4 accent-brand" />
                    {R[c]?.label}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <label htmlFor={`rqm-${requestId}`} className="block text-xs font-semibold text-ink">{open === 'approve' ? A.requests.approveMessage : A.requests.messageLabel}</label>
          <textarea id={`rqm-${requestId}`} value={msg} onChange={(e) => setMsg(e.target.value)} rows={3} aria-required={open === 'decline' && code === 'other'}
            className="w-full rounded-xl border border-line bg-white px-3 py-2 text-[16px] text-ink focus:border-brand focus:outline-none sm:text-sm" />
          <p className={`text-right text-[11px] tabular-nums ${msg.trim().length > 500 ? 'font-bold text-rose-700' : 'text-muted'}`}>{msg.trim().length}/500</p>
          {open === 'decline' && code && (
            <p className="text-[12px] text-muted [overflow-wrap:anywhere]">{A.requests.preview.replace('{label}', R[code]?.label ?? '').replace('{message}', msg.trim())}</p>
          )}
          {error && <p role="alert" className="text-xs font-semibold text-rose-700">{error}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => setOpen(null)} className="inline-flex min-h-tap items-center rounded-xl border border-line bg-white px-4 text-sm font-bold text-ink">{A.cancel}</button>
            <button type="button" disabled={pending || msg.trim().length > 500} onClick={() => submit(open === 'approve')}
              className={`inline-flex min-h-tap items-center gap-1.5 rounded-xl px-4 text-sm font-bold text-white disabled:opacity-50 ${open === 'approve' ? 'bg-brand' : 'bg-rose-700'}`}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} {open === 'approve' ? A.requests.approveSubmit : A.requests.submitDecline}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
