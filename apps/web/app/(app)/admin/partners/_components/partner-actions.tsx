'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { EyeOff, Eye, Link2, Handshake, Loader2 } from 'lucide-react';
import type { Dictionary } from '@/i18n/dictionaries';
import { ReasonPanel } from '@/components/gov/reason-panel';
import { BrandCombobox } from '@/components/gov/brand-combobox';
import type { BrandSearchRow } from '@/lib/data/partner-gov';
import { retainerSplit } from '@/lib/retainers';
import { adminProposeRetainerAction, assignPartnerAction, brandCampaignsAction, setListingAction } from '../actions';

type A = Dictionary['adminPartners'];
type Open = null | 'listing' | 'assign' | 'retainer';

const btn = 'inline-flex min-h-tap min-w-0 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-center text-sm font-bold leading-tight';

/** §1.2 action bar: delist/relist, « Mettre en relation », « Proposer un rétainer »; panels open in flow. */
/**
 * PG-3: « Mettre en relation » / « Proposer un rétainer » are disabled with a one-line reason when the
 * partner is delisted, suspended, pending or rejected (the server refuses them anyway).
 */
export function PartnerActions({ A, partnerId, name, listed, fmt, blocked = null }: { A: A; partnerId: string; name: string; listed: boolean; fmt: 'fr' | 'en'; blocked?: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState<Open>(null);
  const [done, setDone] = useState<{ text: string; href?: string } | null>(null);
  const toggle = (o: Open) => { setDone(null); setOpen((cur) => (cur === o ? null : o)); };
  const finish = (text: string, href?: string) => { setOpen(null); setDone({ text, href }); router.refresh(); };

  return (
    <div className="min-w-0">
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <button type="button" onClick={() => toggle('listing')} aria-expanded={open === 'listing'} className={`${btn} ${listed ? 'border-rose-200 bg-white text-rose-700' : 'border-line bg-white text-ink'}`}>
          {listed ? <EyeOff className="h-4 w-4 shrink-0" aria-hidden /> : <Eye className="h-4 w-4 shrink-0" aria-hidden />}
          <span className="min-w-0">{listed ? A.action.delist : A.action.relist}</span>
        </button>
        <button type="button" onClick={() => toggle('assign')} aria-expanded={open === 'assign'} disabled={!!blocked} aria-describedby={blocked ? 'pa-blocked' : undefined}
          className={`${btn} border-brand bg-brand text-white disabled:cursor-not-allowed disabled:border-line disabled:bg-surface disabled:text-muted`}>
          <Link2 className="h-4 w-4 shrink-0" aria-hidden /> <span className="min-w-0">{A.action.assign}</span>
        </button>
        <button type="button" onClick={() => toggle('retainer')} aria-expanded={open === 'retainer'} disabled={!!blocked} aria-describedby={blocked ? 'pa-blocked' : undefined}
          className={`${btn} border-line bg-white text-ink disabled:cursor-not-allowed disabled:bg-surface disabled:text-muted`}>
          <Handshake className="h-4 w-4 shrink-0" aria-hidden /> <span className="min-w-0">{A.action.retainer}</span>
        </button>
      </div>
      {blocked && <p id="pa-blocked" className="mt-2 text-[12px] text-muted">{blocked}</p>}

      {open === 'listing' && (
        <ReasonPanel
          id="listing"
          title={(listed ? A.delist.title : A.relist.title).replace('{name}', name)}
          effect={listed ? A.delist.effect : undefined}
          label={listed ? A.reason : A.reasonOptional}
          required={listed}
          max={500}
          submitLabel={listed ? A.action.delist : A.action.relist}
          cancelLabel={A.cancel}
          destructive={listed}
          onCancel={() => setOpen(null)}
          onSubmit={async (text) => {
            const r = await setListingAction(partnerId, !listed, text);
            if (!r.ok) return r.error;
            finish((listed ? A.delist.done : A.relist.done).replace('{name}', name));
            return null;
          }}
        />
      )}
      {open === 'assign' && !blocked && <AssignPanel A={A} partnerId={partnerId} onCancel={() => setOpen(null)} onDone={(conv) => finish(A.assign.done, conv ? `/messages/${conv}` : undefined)} />}
      {open === 'retainer' && !blocked && <RetainerPanel A={A} partnerId={partnerId} fmt={fmt} onCancel={() => setOpen(null)} onDone={() => finish(A.retainer.done)} />}

      {done && (
        <p role="status" className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {done.text}{' '}
          {done.href && <Link href={done.href} className="font-bold underline">{A.assign.openThread}</Link>}
        </p>
      )}
    </div>
  );
}

function comboLabels(A: A) {
  return { brand: A.assign.brand, searchHint: A.assign.searchHint, searching: A.searching, noBrand: A.noBrand, activeCount: A.assign.activeCount };
}

function AssignPanel({ A, partnerId, onCancel, onDone }: { A: A; partnerId: string; onCancel: () => void; onDone: (conversationId: string | null) => void }) {
  const [brand, setBrand] = useState<BrandSearchRow | null>(null);
  const [campaigns, setCampaigns] = useState<{ id: string; title: string; status: string }[]>([]);
  const [campaign, setCampaign] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    setCampaign('');
    setCampaigns([]);
    if (!brand) return;
    void brandCampaignsAction(brand.id).then((r) => r.ok && setCampaigns(r.data));
  }, [brand]);

  return (
    <section role="region" aria-labelledby="assign-title" onKeyDown={(e) => { if (e.key === 'Escape') onCancel(); }} className="mt-3 min-w-0 space-y-3 rounded-xl border border-line bg-surface p-3">
      <h3 id="assign-title" className="text-sm font-bold text-ink">{A.action.assign}</h3>
      <p className="text-[12px] text-muted">{A.assign.help}</p>
      <BrandCombobox L={comboLabels(A)} value={brand} onChange={setBrand} />
      <div>
        <label htmlFor="assign-campaign" className="block text-xs font-semibold text-ink">{A.assign.campaign}</label>
        <select id="assign-campaign" value={campaign} onChange={(e) => setCampaign(e.target.value)} disabled={!brand}
          className="mt-1 min-h-tap w-full rounded-xl border border-line bg-white px-3 text-[16px] text-ink disabled:opacity-60 sm:text-sm">
          <option value="">{A.scope.brand}</option>
          {campaigns.map((c) => <option key={c.id} value={c.id}>{c.title} · {(A.campaignStatus as Record<string, string>)[c.status] ?? c.status}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="assign-note" className="block text-xs font-semibold text-ink">{A.assign.note}</label>
        <textarea id="assign-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} aria-describedby="assign-note-count"
          className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-[16px] text-ink focus:border-brand focus:outline-none sm:text-sm" />
        <p id="assign-note-count" className={`text-right text-[11px] tabular-nums ${note.trim().length > 280 ? 'font-bold text-rose-700' : 'text-muted'}`}>{A.assign.noteCounter.replace('{n}', String(note.trim().length))}</p>
      </div>
      {error && <p role="alert" className="text-xs font-semibold text-rose-700">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onCancel} className="inline-flex min-h-tap items-center rounded-xl border border-line bg-white px-4 text-sm font-bold text-ink">{A.cancel}</button>
        <button type="button" disabled={pending || note.trim().length > 280}
          onClick={() => start(async () => {
            if (!brand) { setError(A.pickBrand); return; }
            const r = await assignPartnerAction(partnerId, brand.id, campaign || null, note);
            if (!r.ok) setError(r.error); else onDone(r.data.conversationId);
          })}
          className="inline-flex min-h-tap items-center gap-1.5 rounded-xl bg-brand px-4 text-sm font-bold text-white disabled:opacity-50">
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} {A.assign.submit}
        </button>
      </div>
    </section>
  );
}

function RetainerPanel({ A, partnerId, fmt, onCancel, onDone }: { A: A; partnerId: string; fmt: 'fr' | 'en'; onCancel: () => void; onDone: () => void }) {
  const [brand, setBrand] = useState<BrandSearchRow | null>(null);
  const [contract, setContract] = useState(0);
  const [fee, setFee] = useState(0);
  const [media, setMedia] = useState(0);
  const [kpi, setKpi] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const split = retainerSplit(contract);
  const nf = new Intl.NumberFormat(fmt === 'fr' ? 'fr-FR' : 'en-US');
  const money = (n: number) => `${nf.format(n)} FCFA`;
  const balanced = !!split && fee + media === split.net;
  const num = (label: string, value: number, set: (n: number) => void, id: string) => (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-ink">{label}</label>
      <input id={id} type="number" inputMode="numeric" min={0} step={1} value={value || ''} onChange={(e) => set(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
        className="mt-1 min-h-tap w-full rounded-xl border border-line bg-white px-3 text-[16px] text-ink focus:border-brand focus:outline-none sm:text-sm" />
    </div>
  );
  return (
    <section role="region" aria-labelledby="ret-title" onKeyDown={(e) => { if (e.key === 'Escape') onCancel(); }} className="mt-3 min-w-0 space-y-3 rounded-xl border border-line bg-surface p-3">
      <h3 id="ret-title" className="text-sm font-bold text-ink">{A.action.retainer}</h3>
      <p className="text-[12px] text-muted">{A.retainer.help}</p>
      <BrandCombobox L={{ ...comboLabels(A), brand: A.retainer.brand }} value={brand} onChange={setBrand} />
      <div className="grid gap-3 sm:grid-cols-2">
        {num(A.retainer.contract, contract, setContract, 'ret-contract')}
        {num(A.retainer.kpi, kpi, setKpi, 'ret-kpi')}
        {num(A.retainer.fee, fee, setFee, 'ret-fee')}
        {num(A.retainer.media, media, setMedia, 'ret-media')}
      </div>
      {split && <p className="text-[12px] text-ink">{A.retainer.cut.replace('{cut}', money(split.cut)).replace('{net}', money(split.net))}</p>}
      {split && !balanced && <p className="text-[12px] font-semibold text-rose-700">{A.retainer.unbalanced.replace('{net}', money(split.net))}</p>}
      {error && <p role="alert" className="text-xs font-semibold text-rose-700">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onCancel} className="inline-flex min-h-tap items-center rounded-xl border border-line bg-white px-4 text-sm font-bold text-ink">{A.cancel}</button>
        <button type="button" disabled={pending || !balanced}
          onClick={() => start(async () => {
            const r = await adminProposeRetainerAction({ brandId: brand?.id ?? '', partnerId, contract, fee, media, kpi });
            if (!r.ok) setError(r.error); else onDone();
          })}
          className="inline-flex min-h-tap items-center gap-1.5 rounded-xl bg-brand px-4 text-sm font-bold text-white disabled:opacity-50">
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} {A.retainer.submit}
        </button>
      </div>
    </section>
  );
}
