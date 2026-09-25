'use client';

import { useActionState, useState } from 'react';
import { Check, Loader2, Send, X, UserPlus } from 'lucide-react';
import {
  inviteCreatorAction,
  respondRepresentationAction,
  endRepresentationAction,
  applyForCreatorAction,
  type RepState,
} from '@/app/(app)/representation-actions';

const INITIAL: RepState = { error: null };
const input =
  'mt-1 min-h-tap w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-muted/70 focus:border-brand focus:outline-none';

/** Creator: accept / decline a representation offer. */
export function RespondButtons({ linkId }: { linkId: string }) {
  const [state, action, pending] = useActionState(respondRepresentationAction, INITIAL);
  return (
    <form action={action} className="mt-3">
      <input type="hidden" name="link" value={linkId} />
      <div className="flex flex-wrap gap-2">
        <button
          type="submit" name="accept" value="true" disabled={pending}
          className="inline-flex min-h-tap items-center gap-1.5 rounded-xl bg-brand px-4 text-sm font-bold text-white transition hover:bg-brand-600 active:scale-95 disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Accepter
        </button>
        <button
          type="submit" name="accept" value="false" disabled={pending}
          className="inline-flex min-h-tap items-center gap-1.5 rounded-xl border border-line bg-white px-4 text-sm font-bold text-muted transition hover:border-rose-200 hover:text-rose-600 disabled:opacity-50"
        >
          <X className="h-4 w-4" /> Refuser
        </button>
      </div>
      {state.error && <p className="mt-2 text-xs text-rose-600">{state.error}</p>}
    </form>
  );
}

/** Either side: end a representation (two-step, no browser dialog). */
export function EndRepresentationButton({ linkId, label = 'Mettre fin', confirmLabel = 'Confirmer la fin' }: { linkId: string; label?: string; confirmLabel?: string }) {
  const [state, action, pending] = useActionState(endRepresentationAction, INITIAL);
  const [armed, setArmed] = useState(false);
  return (
    <form action={action}>
      <input type="hidden" name="link" value={linkId} />
      {armed ? (
        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" disabled={pending}
            className="inline-flex min-h-tap items-center gap-1.5 rounded-lg bg-rose-600 px-3 text-xs font-bold text-white transition hover:bg-rose-700 disabled:opacity-50">
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />} {confirmLabel}
          </button>
          <button type="button" onClick={() => setArmed(false)} className="min-h-tap px-2 text-xs font-semibold text-muted hover:text-ink">
            Annuler
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setArmed(true)}
          className="inline-flex min-h-tap items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-bold text-muted transition hover:border-rose-200 hover:text-rose-600">
          <X className="h-3.5 w-3.5" /> {label}
        </button>
      )}
      {state.error && <p className="mt-1 text-[11px] text-rose-600">{state.error}</p>}
    </form>
  );
}

/** Partner: propose to represent a creator. */
export function InviteCreatorForm() {
  const [state, action, pending] = useActionState(inviteCreatorAction, INITIAL);
  return (
    <form action={action} className="rounded-2xl border border-line bg-white p-4 shadow-card">
      <p className="flex items-center gap-2 font-bold text-ink">
        <UserPlus className="h-4 w-4 text-brand" /> Proposer une représentation
      </p>
      <p className="mt-0.5 text-[11px] text-muted">
        Le créateur reçoit votre proposition et l'accepte ou la refuse. Rien ne change sans son accord.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_9rem]">
        <label className="text-[11px] font-semibold text-muted">
          Nom d'utilisateur du créateur
          <input name="handle" required autoComplete="off" placeholder="@nom_du_createur" className={input} />
        </label>
        <label className="text-[11px] font-semibold text-muted">
          Commission (%)
          <input name="rate" required inputMode="decimal" defaultValue="15" className={input} aria-describedby="rate-help" />
        </label>
      </div>
      <p id="rate-help" className="mt-1 text-[11px] text-muted">
        Entre 1 et 30 % de ce que le créateur perçoit. Le prix payé par la marque ne change pas.
      </p>
      <label className="mt-3 block text-[11px] font-semibold text-muted">
        Message (facultatif)
        <textarea name="message" maxLength={500} rows={2} placeholder="Présentez-vous en une phrase." className={`${input} min-h-[4.5rem]`} />
      </label>
      <button type="submit" disabled={pending}
        className="mt-3 inline-flex min-h-tap items-center gap-1.5 rounded-xl bg-brand px-4 text-sm font-bold text-white transition hover:bg-brand-600 active:scale-95 disabled:opacity-50">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Envoyer la proposition
      </button>
      {state.error && <p className="mt-2 text-xs text-rose-600">{state.error}</p>}
      {state.ok && <p className="mt-2 text-xs text-emerald-600">Proposition envoyée. Le créateur est notifié.</p>}
    </form>
  );
}

/** Partner: apply to a campaign for one of the creators they represent. */
export function ApplyForCreatorForm({ campaignId, creators }: { campaignId: string; creators: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(applyForCreatorAction, INITIAL);
  if (creators.length === 0) return null;
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="campaign" value={campaignId} />
      <label className="min-w-0 flex-1 text-[11px] font-semibold text-muted">
        Pour
        <select name="creator" required className="mt-0.5 min-h-tap w-full rounded-lg border border-line bg-white px-2 py-2 text-xs text-ink focus:border-brand focus:outline-none">
          {creators.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={pending}
        className="inline-flex min-h-tap items-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-bold text-white transition hover:bg-brand-600 active:scale-95 disabled:opacity-50">
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Postuler
      </button>
      {state.error && <p className="w-full text-[11px] text-rose-600">{state.error}</p>}
      {state.ok && <p className="w-full text-[11px] text-emerald-600">Candidature envoyée. La marque et le créateur sont notifiés.</p>}
    </form>
  );
}
