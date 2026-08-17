'use client';

import { useActionState, useState } from 'react';
import { Check, X, Loader2, ExternalLink } from 'lucide-react';
import { reviewProofAction, type ReviewState } from './review-actions';

export interface ProofItem {
  proofId: string;
  creatorName: string;
  url: string;
  score: number | null;
  isValid: boolean | null;
}

export function ProofRow({ p }: { p: ProofItem }) {
  const [state, action, pending] = useActionState<ReviewState, FormData>(reviewProofAction, { error: null });
  const [rejecting, setRejecting] = useState(false);
  const decided = p.isValid !== null;

  return (
    <li className="rounded-2xl border border-line bg-white p-4 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-ink">{p.creatorName}</p>
          <a href={p.url} target="_blank" rel="noopener noreferrer" className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline">
            Voir la publication <ExternalLink className="h-3 w-3" />
          </a>
          {p.score !== null && (
            <p className="mt-1 text-[11px] text-muted">Score IA indicatif : {Math.round(p.score * 100)}%</p>
          )}
        </div>

        {decided ? (
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${p.isValid ? 'bg-emerald-50 text-emerald-700' : 'bg-surface text-muted'}`}>
            {p.isValid ? 'Validée' : 'Refusée'}
          </span>
        ) : rejecting ? (
          <form action={action} className="w-full space-y-2">
            <input type="hidden" name="proof" value={p.proofId} />
            <input type="hidden" name="decision" value="reject" />
            <input
              name="reason"
              required
              placeholder="Motif du refus (visible par le créateur)"
              className="w-full rounded-lg border border-line bg-white px-2.5 py-2 text-xs text-ink focus:border-brand focus:outline-none"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setRejecting(false)} className="rounded-lg border border-line px-3 py-2 text-xs font-bold text-muted">
                Annuler
              </button>
              <button type="submit" disabled={pending} className="inline-flex min-h-tap items-center gap-1.5 rounded-lg bg-rose-600 px-3 text-xs font-bold text-white transition hover:bg-rose-700 disabled:opacity-50">
                {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />} Confirmer le refus
              </button>
            </div>
          </form>
        ) : (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setRejecting(true)} className="inline-flex min-h-tap items-center gap-1.5 rounded-xl border border-line px-3 text-xs font-bold text-muted transition hover:border-rose-200 hover:text-rose-600">
              <X className="h-3.5 w-3.5" /> Refuser
            </button>
            <form action={action}>
              <input type="hidden" name="proof" value={p.proofId} />
              <input type="hidden" name="decision" value="approve" />
              <button type="submit" disabled={pending} className="inline-flex min-h-tap items-center gap-1.5 rounded-xl bg-brand px-3 text-xs font-bold text-white transition hover:bg-brand-600 active:scale-95 disabled:opacity-50">
                {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Valider
              </button>
            </form>
          </div>
        )}
      </div>
      {state.error && <p className="mt-2 text-xs text-rose-600">{state.error}</p>}
    </li>
  );
}
