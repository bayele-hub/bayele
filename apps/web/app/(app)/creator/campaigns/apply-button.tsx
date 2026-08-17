'use client';

import { useActionState } from 'react';
import { Loader2, Send, Check } from 'lucide-react';
import { applyAction, type ApplyState } from '../actions';

export function ApplyButton({ campaignId }: { campaignId: string }) {
  const [state, action, pending] = useActionState<ApplyState, FormData>(applyAction, { error: null });

  if (state.ok) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
        <Check className="h-3.5 w-3.5" /> Candidature envoyée
      </span>
    );
  }

  return (
    <form action={action} className="shrink-0">
      <input type="hidden" name="campaign" value={campaignId} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-tap items-center gap-1.5 rounded-xl bg-brand px-4 text-xs font-bold text-white transition hover:bg-brand-600 active:scale-95 disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Postuler
      </button>
      {state.error && <p className="mt-1 max-w-[10rem] text-[11px] text-rose-600">{state.error}</p>}
    </form>
  );
}
