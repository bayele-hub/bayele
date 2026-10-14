'use client';

import { useActionState, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X, Loader2, ExternalLink, Camera } from 'lucide-react';
import type { Dictionary } from '@/i18n/dictionaries';
import { SectionTip } from '@/components/admin/section-tip';
import { ReasonPanel } from '@/components/gov/reason-panel';
import { requestRecaptureAction, reviewProofAction, type ReviewState } from './review-actions';

export interface ProofItem {
  proofId: string;
  creatorName: string;
  url: string;
  score: number | null;
  isValid: boolean | null;
  /** G8: WhatsApp screenshots (latest round) with short-lived signed links. */
  shots?: { kind: 'posted' | 'views' | 'extra'; url: string | null }[];
  recapturePending?: boolean;
  recapturesLeft?: number;
}

/** §5.5: 2–3 thumbnails, each opens the full image in a new tab (no custom viewer — P6). */
function Shots({ p, P, aria }: { p: ProofItem; P: Dictionary['proofShots']; aria: string }) {
  const [broken, setBroken] = useState<Record<number, boolean>>({});
  const idx = { posted: 0, views: 1, extra: 2 } as const;
  return (
    <div className="mt-2">
      <p className="flex items-center text-[11px] font-semibold text-muted">{P.title}<SectionTip id={`review-tip-${p.proofId}`} label={P.title} text={P.reviewTip} ariaTemplate={aria} /></p>
      <ul className="mt-1 flex flex-wrap gap-2">
        {(p.shots ?? []).map((s, i) => {
          const label = P.review.labels[idx[s.kind]];
          return (
            <li key={`${s.kind}-${i}`} className="w-20 text-center">
              {s.url && !broken[i] ? (
                <a href={s.url} target="_blank" rel="noopener noreferrer" aria-label={P.review.open.replace('{label}', label ?? '')}>
                  <img src={s.url} alt="" onError={() => setBroken((b) => ({ ...b, [i]: true }))} className="aspect-[9/16] w-20 rounded-lg border border-line object-cover" />
                </a>
              ) : (
                <span className="grid aspect-[9/16] w-20 place-items-center rounded-lg border border-line bg-surface p-1 text-[10px] text-muted">{P.review.expired}</span>
              )}
              <span className="mt-0.5 block text-[10px] font-semibold text-ink">{label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function ProofRow({ p, P, aria }: { p: ProofItem; P: Dictionary['proofShots']; aria: string }) {
  const router = useRouter();
  const [recapture, setRecapture] = useState(false);
  const [recaptureDone, setRecaptureDone] = useState(false);
  const shots = !!p.shots;
  const [state, action, pending] = useActionState<ReviewState, FormData>(reviewProofAction, { error: null });
  const [rejecting, setRejecting] = useState(false);
  const decided = p.isValid !== null;

  return (
    <li className="rounded-2xl border border-line bg-white p-4 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-ink">{p.creatorName}</p>
          {shots ? <Shots p={p} P={P} aria={aria} /> : (
            <a href={p.url} target="_blank" rel="noopener noreferrer" className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline">
              Voir la publication <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {p.recapturePending && <span className="mt-1 inline-flex rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-bold text-ink">{P.review.pending}</span>}
          {p.score !== null && (
            <p className="mt-1 text-[11px] text-muted">Score IA indicatif : {Math.round(p.score * 100)}%</p>
          )}
        </div>

        {decided ? (
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${p.isValid ? 'bg-emerald-50 text-emerald-700' : 'bg-surface text-muted'}`}>
            {p.isValid ? 'Validée' : 'Refusée'}
          </span>
        ) : p.recapturePending ? (
          <p className="max-w-xs text-[11px] text-muted">{P.review.errors.recapture_pending}</p>
        ) : rejecting ? (
          <form action={action} className="w-full space-y-2">
            <input type="hidden" name="proof" value={p.proofId} />
            <input type="hidden" name="decision" value="reject" />
            <input
              name="reason"
              required
              placeholder="Motif du refus (visible par le créateur)"
              className="min-h-tap w-full rounded-lg border border-line bg-white px-2.5 py-2 text-xs text-ink focus:border-brand focus:outline-none"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setRejecting(false)} className="inline-flex min-h-tap items-center rounded-lg border border-line px-3 py-2 text-xs font-bold text-muted">
                Annuler
              </button>
              <button type="submit" disabled={pending} className="inline-flex min-h-tap items-center gap-1.5 rounded-lg bg-rose-600 px-3 text-xs font-bold text-white transition hover:bg-rose-700 disabled:opacity-50">
                {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />} Confirmer le refus
              </button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {shots && !recaptureDone && (
              <button type="button" onClick={() => setRecapture(true)} className="inline-flex min-h-tap items-center gap-1.5 rounded-xl border border-line bg-white px-3 text-xs font-bold text-ink">
                <Camera className="h-3.5 w-3.5" aria-hidden /> {P.review.recapture}
              </button>
            )}
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
      {recapture && (
        <ReasonPanel id={`recap-${p.proofId}`} title={P.review.recapture} effect={P.review.left.replace('{left}', String(p.recapturesLeft ?? 3))} label={P.review.reason} required max={300}
          quick={P.review.quick} submitLabel={P.review.send} cancelLabel={P.review.cancel} onCancel={() => setRecapture(false)}
          onSubmit={async (text) => {
            const r = await requestRecaptureAction(p.proofId, text);
            if (!r.ok) return r.error ?? P.review.errors.generic;
            setRecapture(false); setRecaptureDone(true); router.refresh();
            return null;
          }} />
      )}
      {recaptureDone && <p role="status" className="mt-2 text-xs font-semibold text-emerald-700">{P.review.sent}</p>}
      {state.error && <p className="mt-2 text-xs text-rose-600">{state.error}</p>}
    </li>
  );
}
