'use client';

import { useState, useTransition } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { addCityAction } from '@/app/(app)/admin/partners/actions';

/** G9 / §6: « Ajouter « {city} » à la liste ({country}) » on a city_not_in_list member. */
export function AddCityButton({ label, doneLabel, country, city, memberId }: { label: string; doneLabel: string; country: string; city: string; memberId: string }) {
  const [state, setState] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  if (state?.ok) return <p role="status" className="mt-1 text-xs font-semibold text-emerald-700">{state.text}</p>;
  return (
    <div className="mt-1">
      <button type="button" disabled={pending} onClick={() => start(async () => {
        const r = await addCityAction(country, city, memberId);
        setState(r.ok ? { ok: true, text: doneLabel } : { ok: false, text: r.error });
      })} className="inline-flex min-h-tap max-w-full items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 text-left text-xs font-bold text-rose-800">
        {pending ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden /> : <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden />}
        <span className="[overflow-wrap:anywhere]">{label}</span>
      </button>
      {state && !state.ok && <p role="alert" className="mt-1 text-xs font-semibold text-rose-700">{state.text}</p>}
    </div>
  );
}
