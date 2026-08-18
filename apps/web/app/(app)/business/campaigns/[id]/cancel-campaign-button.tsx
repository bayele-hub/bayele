'use client';

import { useActionState, useState } from 'react';
import { Loader2, XCircle, AlertTriangle } from 'lucide-react';
import { cancelCampaignAction, type CancelState } from '../cancel-action';

/** Self-serve cancel for an UNFUNDED campaign (draft / pending_funding). Two-step confirm. */
export function CancelCampaignButton({ campaignId }: { campaignId: string }) {
  const [state, action, pending] = useActionState<CancelState, FormData>(cancelCampaignAction, { error: null });
  const [armed, setArmed] = useState(false);

  return (
    <form action={action} className="mt-3 border-t border-line pt-3">
      <input type="hidden" name="campaign" value={campaignId} />
      {!armed ? (
        <button
          type="button"
          onClick={() => setArmed(true)}
          className="inline-flex min-h-tap items-center gap-1.5 text-xs font-semibold text-rose-600 transition hover:text-rose-700"
        >
          <XCircle className="h-3.5 w-3.5" /> Annuler cette campagne
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-700">
            <AlertTriangle className="h-3.5 w-3.5" /> Confirmer l&apos;annulation ?
          </span>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex min-h-tap items-center gap-1.5 rounded-lg bg-rose-600 px-3 text-xs font-bold text-white transition hover:bg-rose-700 active:scale-95 disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />} Oui, annuler
          </button>
          <button
            type="button"
            onClick={() => setArmed(false)}
            className="inline-flex min-h-tap items-center rounded-lg border border-line bg-white px-3 text-xs font-semibold text-ink transition hover:border-brand"
          >
            Non
          </button>
        </div>
      )}
      {state.error && <p className="mt-2 text-xs text-rose-600">{state.error}</p>}
    </form>
  );
}
