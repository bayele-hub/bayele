'use client';

import { useActionState } from 'react';
import { ExternalLink, FileText, Loader2 } from 'lucide-react';
import { invoiceRetainerAction, type InvoiceState } from './actions';

/** O7 step 2 — shown only once the partner accepted (canInvoice). */
export function InvoiceButton({ retainerId, label, payLabel, invoicedText }: { retainerId: string; label: string; payLabel: string; invoicedText: string }) {
  const [state, action, pending] = useActionState<InvoiceState, FormData>(invoiceRetainerAction, { error: null });
  if (state.ok) {
    return (
      <div className="mt-2 space-y-2">
        <p className="rounded-lg bg-accent-soft px-3 py-2 text-[11px] text-ink">{invoicedText}</p>
        {state.mode === 'sokoclick' && state.paymentUrl && (
          <a href={state.paymentUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-tap items-center gap-1.5 rounded-xl bg-brand px-4 text-sm font-bold text-white hover:bg-brand-600">
            {payLabel} <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        )}
      </div>
    );
  }
  return (
    <form action={action} className="mt-2">
      <input type="hidden" name="retainer" value={retainerId} />
      <button type="submit" disabled={pending} className="inline-flex min-h-tap items-center gap-1.5 rounded-xl bg-brand px-4 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <FileText className="h-4 w-4" aria-hidden />} {label}
      </button>
      {state.error && <p role="alert" className="mt-1 text-[11px] text-rose-700">{state.error}</p>}
    </form>
  );
}
