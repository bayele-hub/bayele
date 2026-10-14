'use client';

import { useActionState } from 'react';
import { Loader2, Upload, Check } from 'lucide-react';
import { submitProofAction, type ProofState } from '../actions';
import { SectionTip } from '@/components/admin/section-tip';

export function ProofForm({ cc, help, tip, tipAria }: { cc: string; help?: string; tip?: string; tipAria?: string }) {
  const [state, action, pending] = useActionState<ProofState, FormData>(submitProofAction, { error: null });

  if (state.ok) {
    return (
      <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
        <Check className="h-3.5 w-3.5" /> Preuve soumise — en attente de vérification.
      </p>
    );
  }

  return (
    <form action={action} className="mt-3 flex flex-wrap items-end gap-2">
      <input type="hidden" name="cc" value={cc} />
      <div className="min-w-0 flex-1">
        <label htmlFor={`proof-${cc}`} className="flex items-center text-[11px] font-semibold text-muted">
          Lien de votre publication
          {tip && tipAria && <SectionTip id={`creator-proof-${cc}`} label="Lien de votre publication" text={tip} ariaTemplate={tipAria} />}
        </label>
        <input
          id={`proof-${cc}`}
          name="url"
          type="url"
          required
          placeholder="https://instagram.com/p/…"
          className="mt-0.5 min-h-tap w-full rounded-lg border border-line bg-white px-2.5 py-2 text-[16px] text-ink focus:border-brand focus:outline-none sm:text-xs"
        />
        {help && <p className="mt-0.5 text-[11px] text-muted">{help}</p>}
      </div>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-tap items-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-bold text-white transition hover:bg-brand-600 active:scale-95 disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Soumettre la preuve
      </button>
      {state.error && <p className="w-full text-[11px] text-rose-600">{state.error}</p>}
    </form>
  );
}
