'use client';

import { useActionState, useState } from 'react';
import { Loader2, AlertCircle, Check, ArrowRight, Lock } from 'lucide-react';
import { createRetainerAction, type RetainerState } from './actions';
import { fmtFcfa } from '@/lib/data/campaigns';
import type { Dictionary } from '@/i18n/dictionaries';
import { retainerSplit } from '@/lib/retainers';

export interface AssignedPartner { handle: string; name: string }

/**
 * G3: the partner is picked among the brand's ACTIVE assignments (no free identifier field);
 * ?partner={handle} preselects it when assigned.
 */
export function RetainerForm({ partners, selected, R, B }: { partners: AssignedPartner[]; selected: string; R: Dictionary['retainers']; B: Dictionary['businessPartners'] }) {
  const [state, action, pending] = useActionState<RetainerState, FormData>(createRetainerAction, { error: null });
  const [handle, setHandle] = useState(partners.some((p) => p.handle === selected) ? selected : partners[0]?.handle ?? '');

  // O7: Bayele's cut is fixed server-side at 25 % — shown read-only, never editable.
  const [contract, setContract] = useState(1_000_000);
  const [fee, setFee] = useState(450_000);
  const [media, setMedia] = useState(300_000);
  const [kpi, setKpi] = useState(0);

  const split = retainerSplit(contract);
  const sum = fee + media;
  const balanced = !!split && sum === split.net;

  if (state.ok) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <Check className="mx-auto h-8 w-8 text-emerald-600" aria-hidden />
        <p className="mt-2 font-bold text-ink">{R.created}</p>
        <a href="/business/retainers" className="mt-3 block text-sm font-bold text-brand hover:underline">
          Voir mes rétainers →
        </a>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      {state.error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          <AlertCircle className="h-4 w-4 shrink-0" /> {state.error}
        </div>
      )}

      {state.notAssigned && (
        <a href="/business/talent?tab=partners" className="inline-flex min-h-tap items-center text-xs font-bold text-brand-700 underline">{B.empty.cta}</a>
      )}
      <div>
        <label htmlFor="ret-partner" className="text-xs font-semibold text-ink">{B.retainerSelect}</label>
        <select id="ret-partner" name="consultant" required value={handle} onChange={(e) => setHandle(e.target.value)}
          className="mt-1 min-h-tap w-full rounded-xl border border-line bg-white px-3 text-[16px] text-ink focus:border-brand focus:outline-none sm:text-sm">
          {partners.map((p) => <option key={p.handle} value={p.handle}>{p.name} · @{p.handle}</option>)}
        </select>
        <p className="mt-1 text-[11px] text-muted">{B.retainerHelp}</p>
      </div>

      <NumField label="Valeur du contrat (FCFA)" name="contract" value={contract} onChange={setContract} />

      <div className="rounded-2xl border border-line bg-surface p-4">
        <Row label={R.cutLabel} value={split ? fmtFcfa(split.cut) : '—'} icon />
        <Row label={R.netLabel} value={split ? fmtFcfa(split.net) : '—'} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <NumField label="Honoraires partenaire" name="fee" value={fee} onChange={setFee} />
        <NumField label="Budget média" name="media" value={media} onChange={setMedia} />
      </div>
      <NumField label="Bonus KPI" name="kpi" value={kpi} onChange={setKpi} />
      <p className="text-[11px] text-muted">{R.kpiNote}</p>

      <div className={`rounded-2xl border p-4 ${balanced ? 'border-line bg-surface' : 'border-rose-200 bg-rose-50'}`}>
        <Row label="Honoraires + média" value={fmtFcfa(sum)} />
        {!balanced && split && <p className="mt-2 text-[11px] font-semibold text-rose-700">{R.splitHint.replace('{net}', fmtFcfa(split.net))}</p>}
      </div>

      <button
        type="submit"
        disabled={pending || !balanced}
        className="flex min-h-tap w-full items-center justify-center gap-2 rounded-xl bg-brand text-sm font-bold text-white shadow-sm transition hover:bg-brand-600 active:scale-95 disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : (<>Proposer le contrat <ArrowRight className="h-3.5 w-3.5" aria-hidden /></>)}
      </button>
      <p className="text-center text-[11px] text-muted">{R.awaitingHint}</p>
    </form>
  );
}

function NumField(props: { label: string; name: string; value: number; onChange: (n: number) => void }) {
  return (
    <div>
      <label className="text-[11px] font-semibold text-ink">{props.label}</label>
      <input
        name={props.name}
        type="number"
        inputMode="numeric"
        min={0}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
        className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-3 text-sm text-ink focus:border-brand focus:outline-none"
      />
    </div>
  );
}

function Row({ label, value, icon = false }: { label: string; value: string; icon?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-0.5 text-xs">
      <span className="flex items-center gap-1 text-muted">{icon && <Lock className="h-3 w-3" aria-hidden />}{label}</span>
      <span className="font-semibold text-ink">{value}</span>
    </div>
  );
}
