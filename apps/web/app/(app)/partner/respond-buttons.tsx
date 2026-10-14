'use client';

import { useActionState } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { respondRetainerAction, type RetainerActionState } from './actions';

/** Accept / Decline a proposed retainer (O7). Two forms so each button posts its own answer. */
export function RespondButtons({ retainerId, acceptLabel, declineLabel }: { retainerId: string; acceptLabel: string; declineLabel: string }) {
  const [state, action, pending] = useActionState<RetainerActionState, FormData>(respondRetainerAction, { error: null });
  const btn = 'inline-flex min-h-tap items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition active:scale-95 disabled:opacity-50';
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <form action={action}>
          <input type="hidden" name="retainer" value={retainerId} />
          <input type="hidden" name="accept" value="false" />
          <button type="submit" disabled={pending} className={`${btn} border border-line text-ink hover:border-rose-200 hover:text-rose-700`}>
            <X className="h-3.5 w-3.5" aria-hidden /> {declineLabel}
          </button>
        </form>
        <form action={action}>
          <input type="hidden" name="retainer" value={retainerId} />
          <input type="hidden" name="accept" value="true" />
          <button type="submit" disabled={pending} className={`${btn} bg-brand text-white hover:bg-brand-600`}>
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Check className="h-3.5 w-3.5" aria-hidden />} {acceptLabel}
          </button>
        </form>
      </div>
      {state.error && <p role="alert" className="mt-1 text-[11px] text-rose-700">{state.error}</p>}
    </div>
  );
}
