'use client';

import { useActionState } from 'react';
import { Loader2, X } from 'lucide-react';
import { declineRetainerAction, type RetainerActionState } from './actions';

export function DeclineButton({ retainerId }: { retainerId: string }) {
  const [state, action, pending] = useActionState<RetainerActionState, FormData>(declineRetainerAction, { error: null });

  return (
    <form action={action}>
      <input type="hidden" name="retainer" value={retainerId} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-tap items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-bold text-muted transition hover:border-rose-200 hover:text-rose-600 disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />} Décliner
      </button>
      {state.error && <p className="mt-1 text-[11px] text-rose-600">{state.error}</p>}
    </form>
  );
}
