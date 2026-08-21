'use client';

import { useActionState, useState } from 'react';
import { Loader2, AlertCircle, Lock, ArrowRight, Globe, EyeOff } from 'lucide-react';
import { createCampaignAction, type CampaignState } from '../../actions';
import { TIERS, computeBudget, fmtFcfa } from '@/lib/data/campaigns';
import { SocialIcon, SOCIAL_META, type Platform } from '@/components/social-icons';

const CATEGORIES = ['Beauté', 'Mode', 'Tech', 'Food', 'Musique', 'Sport', 'Santé & Bien-être', 'Humour', 'Éducation', 'Voyage', 'Business'];
const COUNTRIES = [
  { code: 'CM', label: '🇨🇲 Cameroun' },
  { code: 'CI', label: "🇨🇮 Côte d'Ivoire" },
  { code: 'GA', label: '🇬🇦 Gabon' },
];
// Networks brands run creator campaigns on in-market (WhatsApp-first). Keys match SOCIAL_META.
const CAMPAIGN_PLATFORMS: Platform[] = ['whatsapp', 'tiktok', 'instagram', 'facebook', 'youtube'];
const CONTENT_TYPES = ['Statut / Story', 'Vidéo courte', 'Post photo', 'Reel', 'Carrousel', 'Live', 'Autre'];

export function CampaignForm() {
  const [state, action, pending] = useActionState<CampaignState, FormData>(createCampaignAction, { error: null });
  const [tier, setTier] = useState<(typeof TIERS)[number]>(TIERS[0]);
  const [payout, setPayout] = useState(50000);
  const [count, setCount] = useState(5);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [isPublic, setIsPublic] = useState(false);

  const togglePlatform = (p: Platform) =>
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));

  const { pool, total, fee } = computeBudget(payout, count, tier.rate);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="tier" value={tier.id} />

      {state.error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          <AlertCircle className="h-4 w-4 shrink-0" /> {state.error}
        </div>
      )}

      <Field label="Titre de la campagne" name="title" placeholder="Lancement Djino" required />

      <div>
        <label className="text-xs font-semibold text-ink">Message clé & consignes</label>
        <textarea
          name="brief"
          rows={3}
          required
          placeholder="Le message à faire passer, le ton, les à-faire et à-éviter…"
          className="mt-1 w-full resize-none rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink placeholder-muted/60 focus:border-brand focus:outline-none"
        />
      </div>

      {/* Structured deliverables — what proof-of-post is judged against. */}
      <div className="rounded-2xl border border-line bg-surface p-4">
        <p className="text-xs font-bold text-ink">Livrables attendus</p>

        <div className="mt-2">
          <label className="text-[11px] font-semibold text-muted">Plateforme(s)</label>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {CAMPAIGN_PLATFORMS.map((p) => {
              const on = platforms.includes(p);
              return (
                <button
                  type="button"
                  key={p}
                  onClick={() => togglePlatform(p)}
                  className={`inline-flex min-h-tap items-center gap-1.5 rounded-full border px-3 text-xs font-bold transition ${on ? 'border-brand bg-brand-50 text-brand-700' : 'border-line bg-white text-muted hover:border-brand-100'}`}
                >
                  <span className="grid h-4 w-4 place-items-center rounded text-white" style={{ backgroundColor: SOCIAL_META[p].brand }}>
                    <SocialIcon platform={p} className="h-2.5 w-2.5" />
                  </span>
                  {SOCIAL_META[p].label}
                </button>
              );
            })}
          </div>
          <input type="hidden" name="platforms" value={platforms.join(',')} />
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="col-span-2">
            <label className="text-[11px] font-semibold text-muted">Type de contenu</label>
            <select name="content_type" required defaultValue="" className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink focus:border-brand focus:outline-none">
              <option value="" disabled>Choisir…</option>
              {CONTENT_TYPES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted">Quantité</label>
            <input name="quantity" type="number" inputMode="numeric" min={1} defaultValue={1} className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink focus:border-brand focus:outline-none" />
          </div>
        </div>

        <div className="mt-3">
          <label className="text-[11px] font-semibold text-muted">Éléments obligatoires (optionnel)</label>
          <input name="mandatory_tags" placeholder="#hashtag, @marque, lien ou code promo…" className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink placeholder-muted/60 focus:border-brand focus:outline-none" />
        </div>

        <div className="mt-3">
          <label className="text-[11px] font-semibold text-muted">Date limite de publication (optionnel)</label>
          <input name="deadline" type="date" className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink focus:border-brand focus:outline-none" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-ink">Catégorie</label>
          <select name="category" required className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-3 text-sm text-ink focus:border-brand focus:outline-none">
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-ink">Pays cible</label>
          <select name="country" className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-3 text-sm text-ink focus:border-brand focus:outline-none">
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <NumField label="Paiement / créateur (FCFA)" name="payout" value={payout} onChange={setPayout} />
        <NumField label="Nombre de créateurs" name="count" value={count} onChange={setCount} />
      </div>

      <div>
        <label className="text-xs font-semibold text-ink">Formule (commission)</label>
        <div className="mt-1.5 grid grid-cols-3 gap-2">
          {TIERS.map((t) => (
            <button
              type="button"
              key={t.id}
              onClick={() => setTier(t)}
              className={`rounded-xl border p-2.5 text-left transition ${tier.id === t.id ? 'border-brand bg-brand-50' : 'border-line bg-white hover:border-brand-100'}`}
            >
              <div className="text-xs font-bold text-ink">{t.label}</div>
              <div className="text-[11px] font-semibold text-brand-700">{Math.round(t.rate * 100)}%</div>
              <div className="mt-0.5 text-[10px] text-muted">{t.blurb}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Live budget breakdown — the business sees exactly what to fund. */}
      <div className="rounded-2xl border border-line bg-surface p-4">
        <Row label="Cagnotte créateurs" value={fmtFcfa(pool)} />
        <Row label={`Commission Bayele (${Math.round(tier.rate * 100)}%)`} value={fmtFcfa(fee)} />
        <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
          <span className="flex items-center gap-1.5 text-sm font-bold text-ink">
            <Lock className="h-3.5 w-3.5 text-brand" /> Total à financer
          </span>
          <span className="font-display text-lg font-extrabold text-ink">{fmtFcfa(total)}</span>
        </div>
      </div>

      {/* Visibility — private by default (signed-in creators only); public adds a shareable link + SEO. */}
      <div className="rounded-2xl border border-line bg-surface p-4">
        <p className="text-xs font-bold text-ink">Visibilité</p>
        <input type="hidden" name="is_public" value={isPublic ? 'true' : 'false'} />
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setIsPublic(false)}
            className={`flex items-start gap-2 rounded-xl border p-3 text-left transition ${!isPublic ? 'border-brand bg-brand-50' : 'border-line bg-white hover:border-brand-100'}`}
          >
            <EyeOff className={`mt-0.5 h-4 w-4 shrink-0 ${!isPublic ? 'text-brand' : 'text-muted'}`} />
            <span>
              <span className="block text-xs font-bold text-ink">Privée</span>
              <span className="block text-[11px] text-muted">Visible par les créateurs connectés uniquement.</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => setIsPublic(true)}
            className={`flex items-start gap-2 rounded-xl border p-3 text-left transition ${isPublic ? 'border-brand bg-brand-50' : 'border-line bg-white hover:border-brand-100'}`}
          >
            <Globe className={`mt-0.5 h-4 w-4 shrink-0 ${isPublic ? 'text-brand' : 'text-muted'}`} />
            <span>
              <span className="block text-xs font-bold text-ink">Publique</span>
              <span className="block text-[11px] text-muted">Lien partageable + référencement. Tout le monde peut la voir.</span>
            </span>
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="flex min-h-tap w-full items-center justify-center gap-2 rounded-xl bg-brand text-sm font-bold text-white shadow-sm transition hover:bg-brand-600 active:scale-95 disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : (<>Créer la campagne <ArrowRight className="h-3.5 w-3.5" /></>)}
      </button>
      <p className="text-center text-[11px] text-muted">
        La campagne est créée en brouillon. Le séquestre s'active après confirmation du paiement Mobile Money.
      </p>
    </form>
  );
}

function Field(props: { label: string; name: string; placeholder?: string; required?: boolean }) {
  return (
    <div>
      <label className="text-xs font-semibold text-ink">{props.label}</label>
      <input
        name={props.name}
        required={props.required}
        placeholder={props.placeholder}
        className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-3 text-sm text-ink placeholder-muted/60 focus:border-brand focus:outline-none"
      />
    </div>
  );
}

function NumField(props: { label: string; name: string; value: number; onChange: (n: number) => void }) {
  return (
    <div>
      <label className="text-xs font-semibold text-ink">{props.label}</label>
      <input
        name={props.name}
        type="number"
        inputMode="numeric"
        min={1}
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
