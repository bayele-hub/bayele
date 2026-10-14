'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { CheckCircle2, ImagePlus, Loader2, ShieldCheck, Upload } from 'lucide-react';
import { createClient } from '@bayele/database/client';
import type { Dictionary } from '@/i18n/dictionaries';
import { SectionTip } from '@/components/admin/section-tip';
import { compressImageFile, extFor, isAcceptedType, proofPath, sha256Hex, withRetry } from '@/lib/gov/proof-shots';
import { submitWhatsappProofAction, type ShotInput } from '../actions';
import { ProofForm } from './proof-form';

type P = Dictionary['proofShots'];
type Kind = 'posted' | 'views' | 'extra';
type Slot = { state: 'empty' | 'working' | 'ready' | 'error'; preview?: string; shot?: ShotInput; error?: string; blob?: Blob; type?: string };

/**
 * G8 / §5 WhatsApp proof (low priority, P6: no crop step). Three slots: posted (required), views
 * (required, ≥ 24 h later), extra (optional). Each file is compressed to ≈ 300 KB, hashed (SHA-256),
 * uploaded to proofs/{creator}/{cc}/{uuid}.{ext} (upsert:false, 2 automatic retries), then submitted.
 */
export function WhatsappProof({ P, cc, creatorId, onlyWhatsapp, recapture, aria, linkProps }: {
  P: P; cc: string; creatorId: string; onlyWhatsapp: boolean; recapture?: { reason: string | null; previous: string[] } | null; aria: string;
  linkProps: { help?: string; tip?: string; tipAria?: string };
}) {
  const [mode, setMode] = useState<'link' | 'shots'>(onlyWhatsapp || recapture ? 'shots' : 'link');
  const [slots, setSlots] = useState<Record<Kind, Slot>>({ posted: { state: 'empty' }, views: { state: 'empty' }, extra: { state: 'empty' } });
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();
  const urls = useRef<string[]>([]);
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const set = (k: Kind, v: Slot) => setSlots((s) => ({ ...s, [k]: v }));

  async function upload(k: Kind, blob: Blob, type: string, preview: string) {
    set(k, { state: 'working', preview, blob, type });
    try {
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const sha = await sha256Hex(bytes);
      const path = proofPath(creatorId, cc, crypto.randomUUID(), extFor(type));
      const supabase = createClient();
      await withRetry(async () => {
        const { error: e } = await supabase.storage.from('proofs').upload(path, blob, { upsert: false, contentType: type });
        if (e) throw e;
      });
      set(k, { state: 'ready', preview, shot: { path, sha256: sha }, blob, type });
    } catch {
      set(k, { state: 'error', preview, error: P.errors.network, blob, type });
    }
  }

  async function onFile(k: Kind, file: File | undefined) {
    setError(null);
    if (!file) return;
    if (!isAcceptedType(file.type)) { set(k, { state: 'error', error: P.errors.type }); return; }
    set(k, { state: 'working' });
    const out = await compressImageFile(file).catch(() => null);
    if (!out) { set(k, { state: 'error', error: P.errors.invalid_screenshot }); return; }
    if (out.tooLarge) { set(k, { state: 'error', error: P.errors.tooLarge }); return; }
    const preview = URL.createObjectURL(out.blob);
    urls.current.push(preview);
    await upload(k, out.blob, out.type, preview);
  }

  const ready = slots.posted.state === 'ready' && slots.views.state === 'ready' && slots.extra.state !== 'working';
  const identical = !!slots.posted.shot && slots.posted.shot.sha256 === slots.views.shot?.sha256;

  if (sent) {
    return <p role="status" className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> {P.sent}</p>;
  }

  const slot = (k: Kind, label: string, required: boolean) => {
    const s = slots[k];
    const inputId = `shot-${cc}-${k}`;
    return (
      <div className={`min-w-0 rounded-xl ${s.state === 'error' ? 'ring-2 ring-rose-300' : ''}`}>
        <p className="mb-1 text-[11px] font-semibold text-ink">{label}{required && <span aria-hidden className="text-rose-700"> *</span>}</p>
        <input id={inputId} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { void onFile(k, e.target.files?.[0]); e.target.value = ''; }} />
        {s.state === 'empty' ? (
          <label htmlFor={inputId} className="flex min-h-[7rem] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-line bg-surface p-3 text-center text-xs font-bold text-ink">
            <ImagePlus className="h-5 w-5 text-brand-700" aria-hidden /> {P.add}
          </label>
        ) : (
          <div className="flex min-w-0 items-start gap-2 rounded-xl border border-line bg-white p-2" aria-live="polite">
            {s.preview ? <img src={s.preview} alt="" className="aspect-[9/16] max-h-40 w-20 shrink-0 rounded-lg object-cover" /> : <span className="h-28 w-20 shrink-0 rounded-lg bg-surface" />}
            <div className="min-w-0 space-y-1 text-xs">
              {s.state === 'working' && <p className="flex items-center gap-1 text-muted"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> {P.state.uploading}</p>}
              {s.state === 'ready' && <p className="flex items-center gap-1 font-bold text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> {P.state.ready}</p>}
              {s.state === 'error' && <p role="alert" className="font-semibold text-rose-700">{s.error}</p>}
              <div className="flex flex-wrap gap-1">
                {s.state === 'error' && s.blob && s.type && (
                  <button type="button" onClick={() => void upload(k, s.blob!, s.type!, s.preview ?? '')} className="inline-flex min-h-tap items-center rounded-lg px-2 font-bold text-brand-700">{P.retry}</button>
                )}
                {s.state !== 'working' && <label htmlFor={inputId} className="inline-flex min-h-tap cursor-pointer items-center rounded-lg px-2 font-bold text-brand-700">{s.state === 'error' ? P.other : P.replace}</label>}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="mt-3 min-w-0 space-y-3">
      {!onlyWhatsapp && !recapture && (
        <div role="tablist" className="inline-flex gap-1 rounded-xl bg-surface p-1">
          {(['link', 'shots'] as const).map((m) => (
            <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
              className={`inline-flex min-h-tap items-center rounded-lg px-3 text-xs font-bold ${mode === m ? 'bg-white text-ink shadow-sm' : 'text-muted'}`}>
              {m === 'link' ? P.modeLink : P.modeShots}
            </button>
          ))}
        </div>
      )}
      {mode === 'link' ? (
        <ProofForm cc={cc} {...linkProps} />
      ) : (
        <>
          {recapture && (
            <p className="flex items-start gap-1.5 rounded-xl border border-brand-100 bg-brand-50 p-3 text-[12px] text-ink">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" aria-hidden /> {P.recaptureBanner.replace('{reason}', recapture.reason ?? '')}
            </p>
          )}
          <p className="flex items-center text-xs font-bold text-ink">{P.title}<SectionTip id={`shots-tip-${cc}`} label={P.title} text={P.tip} ariaTemplate={aria} /></p>
          <div className="rounded-xl border border-brand-100 bg-brand-50 p-3 text-[12px] text-ink">
            <p className="font-bold">{P.guide.title}</p>
            <ol className="mt-1 list-decimal space-y-0.5 pl-5">{P.guide.steps.map((x) => <li key={x}>{x}</li>)}</ol>
            <p className="mt-1">{P.guide.private}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {slot('posted', P.slot.posted, true)}
            {slot('views', P.slot.views, true)}
            <div className="sm:col-span-2">{slot('extra', P.slot.extra, false)}</div>
          </div>
          {identical && <p role="alert" className="text-xs font-semibold text-rose-700">{P.identicalClient}</p>}
          {error && <p role="alert" className="text-xs font-semibold text-rose-700">{error}</p>}
          <button type="button" disabled={!ready || identical || pending}
            onClick={() => start(async () => {
              const r = await submitWhatsappProofAction(cc, slots.posted.shot!, slots.views.shot!, slots.extra.state === 'ready' ? slots.extra.shot! : null);
              if (r.ok) setSent(true); else setError(r.error);
            })}
            className="inline-flex min-h-tap items-center gap-1.5 rounded-xl bg-brand px-4 text-xs font-bold text-white disabled:opacity-50">
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Upload className="h-3.5 w-3.5" aria-hidden />} {recapture ? P.resubmit : P.submit}
          </button>
          {recapture && recapture.previous.length > 0 && (
            <details className="text-xs">
              <summary className="min-h-tap cursor-pointer py-2 font-bold text-brand-700">{P.previous.replace('{n}', String(recapture.previous.length))}</summary>
              <div className="flex flex-wrap gap-2">{recapture.previous.map((u) => <a key={u} href={u} target="_blank" rel="noopener noreferrer"><img src={u} alt="" className="h-24 w-14 rounded-lg object-cover" /></a>)}</div>
            </details>
          )}
        </>
      )}
    </div>
  );
}
