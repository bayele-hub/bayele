'use client';

import { useActionState, useState } from 'react';
import { Loader2, AlertCircle, Check, ArrowRight, ExternalLink } from 'lucide-react';
import { createRetainerAction, type RetainerState } from './actions';
import { fmtFcfa } from '@/lib/data/campaigns';

export function RetainerForm({ consultantHandle, consultantName }: { consultantHandle: string; consultantName?: string }) {
  const [state, action, pending] = useActionState<RetainerState, FormData>(createRetainerAction, { error: null });
  const [contract, setContract] = useState(1_000_000);
  const [cut, setCut] = useState(150_000);
  const [fee, setFee] = useState(550_000);
  const [media, setMedia] = useState(300_000);
  const [kpi, setKpi] = useState(100_000);

  const sum = cut + fee + media;
  const balanced = sum === contract && contract > 0;

  if (state.ok) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <Check className="mx-auto h-8 w-8 text-emerald-600" />
        <p className="mt-2 font-bold text-ink">Rétainer créé et facturé.</p>
        {state.mode === 'sokoclick' && state.paymentUrl ? (
          <a
            href={state.paymentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex min-h-tap items-center gap-1.5 rounded-xl bg-brand px-4 text-sm font-bold text-white transition hover:bg-brand-600"
          >
            Payer via SokoClick <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : (
          <p className="mt-2 text-xs text-muted">
            Réglez le contrat par Mobile Money — notre équipe confirme le paiement pour activer le contrat.
          </p>
        )}
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

      <div>
        <label className="text-xs font-semibold text-ink">Consultant (identifiant)</label>
        <input
          name="consultant"
          required
          defaultValue={consultantHandle}
          placeholder="@consultant"
          className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-3 text-sm text-ink focus:border-brand focus:outline-none"
        />
        {consultantName && <p className="mt-1 text-[11px] text-muted">Contrat pour {consultantName}.</p>}
      </div>

      <NumField label="Valeur du contrat (FCFA)" name="contract" value={contract} onChange={setContract} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <NumField label="Commission Bayele" name="cut" value={cut} onChange={setCut} />
        <NumField label="Honoraires consultant" name="fee" value={fee} onChange={setFee} />
        <NumField label="Budget média" name="media" value={media} onChange={setMedia} />
      </div>
      <NumField label="Bonus KPI (versé à la clôture, en plus)" name="kpi" value={kpi} onChange={setKpi} />

      <div className={`rounded-2xl border p-4 ${balanced ? 'border-line bg-surface' : 'border-rose-200 bg-rose-50'}`}>
        <Row label="Commission + honoraires + média" value={fmtFcfa(sum)} />
        <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
          <span className="text-sm font-bold text-ink">Doit égaler le contrat</span>
          <span className="font-display text-lg font-extrabold text-ink">{fmtFcfa(contract)}</span>
        </div>
        {!balanced && (
          <p className="mt-2 text-[11px] font-semibold text-rose-600">
            La répartition ({fmtFcfa(sum)}) doit être exactement égale à la valeur du contrat.
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={pending || !balanced}
        className="flex min-h-tap w-full items-center justify-center gap-2 rounded-xl bg-brand text-sm font-bold text-white shadow-sm transition hover:bg-brand-600 active:scale-95 disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : (<>Créer &amp; facturer <ArrowRight className="h-3.5 w-3.5" /></>)}
      </button>
      <p className="text-center text-[11px] text-muted">
        La facture OHADA est générée par SokoClick. Les fonds restent sous séquestre Bayele (ADR-001).
      </p>
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-0.5 text-xs">
      <span className="text-muted">{label}</span>
      <span className="font-semibold text-ink">{value}</span>
    </div>
  );
}
