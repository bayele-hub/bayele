'use client';

import { useActionState } from 'react';
import { Check, X, Loader2, MapPin, ShieldQuestion } from 'lucide-react';
import { decideAction, type DecideState } from './review-actions';
import { fmtFcfa, CREATOR_STATUS_FR } from '@/lib/data/campaigns';

export interface Applicant {
  id: string;
  displayName: string;
  handle: string;
  city: string;
  country: string;
  payout: number;
  status: string;
  verified: boolean;
}

export function ApplicantRow({ a }: { a: Applicant }) {
  const [state, action, pending] = useActionState<DecideState, FormData>(decideAction, { error: null });
  const pendingDecision = a.status === 'applied';

  return (
    <li className="rounded-2xl border border-line bg-white p-4 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-bold text-ink">{a.displayName}</p>
          <div className="mt-0.5 flex min-w-0 items-center gap-2 text-xs text-muted">
            <span className="truncate">@{a.handle}</span>
            <span className="inline-flex shrink-0 items-center gap-1"><MapPin className="h-3 w-3" /> {a.city} · {a.country}</span>
          </div>
        </div>

        {pendingDecision ? (
          <div className="flex items-center gap-2">
            <span className="mr-1 font-display text-sm font-extrabold text-ink">{fmtFcfa(a.payout)}</span>
            <form action={action}>
              <input type="hidden" name="cc" value={a.id} />
              <input type="hidden" name="decision" value="reject" />
              <button type="submit" disabled={pending} className="inline-flex min-h-tap items-center gap-1.5 rounded-xl border border-line px-3 text-xs font-bold text-muted transition hover:border-rose-200 hover:text-rose-600 disabled:opacity-50">
                {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />} Refuser
              </button>
            </form>
            {a.verified ? (
              <form action={action}>
                <input type="hidden" name="cc" value={a.id} />
                <input type="hidden" name="decision" value="approve" />
                <button type="submit" disabled={pending} className="inline-flex min-h-tap items-center gap-1.5 rounded-xl bg-brand px-3 text-xs font-bold text-white transition hover:bg-brand-600 active:scale-95 disabled:opacity-50">
                  {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Accepter
                </button>
              </form>
            ) : (
              // Payment gate: a creator can only be accepted once Bayele has verified their profile.
              <span title="Ce créateur doit d'abord être validé par Bayele." className="inline-flex min-h-tap cursor-not-allowed items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-xs font-bold text-muted">
                <ShieldQuestion className="h-3.5 w-3.5" /> Validation Bayele en attente
              </span>
            )}
          </div>
        ) : (
          <span className="rounded-full bg-surface px-2.5 py-1 text-[11px] font-bold text-muted">
            {CREATOR_STATUS_FR[a.status] ?? a.status}
          </span>
        )}
      </div>
      {state.error && <p className="mt-2 text-xs text-rose-600">{state.error}</p>}
    </li>
  );
}
