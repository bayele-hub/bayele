'use client';

import { useActionState, useState } from 'react';
import { Loader2, AlertCircle, Lock, ArrowRight, Globe, EyeOff, TriangleAlert } from 'lucide-react';
import type { Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { formatFcfa } from '@/i18n/format';
import { createCampaignAction, type CampaignState } from '../../actions';
import { TIERS } from '@/lib/data/campaigns';
import { SocialIcon, SOCIAL_META, type Platform } from '@/components/social-icons';
import { COUNTRY_CODES, DEFAULT_COUNTRY, countryName } from '@/lib/countries';
import { CAMPAIGN_CATEGORIES } from '@/lib/campaign-categories';
import {
  CONTENT_TYPES, LANGUAGES, RIGHTS_PRESETS, deliverableSummary, rightsShortLabel, selfServeFloor, selfServeFromPayout, selfServeFromTotal,
  type DeliverableType, type FloorMap, type LanguageKey, type RightsPresetKey,
} from '@/lib/managed-listing';
import { MANAGED_TEMPLATES, findTemplate } from '@/lib/managed-templates';
import { MORE_FIELDS } from '@/lib/brand-campaign';
import { fill } from '@/lib/campaign-board';
import { publishMessage } from '@/lib/whatsapp';
import { PublishWhatsAppCta } from '@/components/publish-whatsapp-cta';

// Networks brands run creator campaigns on in-market (WhatsApp-first). Keys match SOCIAL_META.
const CAMPAIGN_PLATFORMS: Platform[] = ['whatsapp', 'tiktok', 'instagram', 'facebook', 'youtube', 'linkedin'];

// A template's main deliverable → the brand form's content type (prefill only when still empty).
const CONTENT_FOR_TYPE: Partial<Record<DeliverableType, string>> = {
  short_video: 'Vidéo courte', ugc_video: 'Vidéo courte', animation: 'Vidéo courte', long_video: 'Vidéo courte',
  photo: 'Post photo', post: 'Post photo', story: 'Statut / Story',
};

type F = Dictionary['brandForm'];
type W = Dictionary['publishWhatsapp'];

/**
 * Brand self-serve form (design §7, council R4/R5): sector chips (text templates, no prices), six
 * required answers, the rest under « Plus de détails », a TOTAL budget with the live net per creator
 * (net editable as an advanced option), a pay-floor warning with a required acknowledgement, and the
 * « Publiez par WhatsApp » escape hatch at the top (only when the env number is set, K5).
 */
export function CampaignForm({ F, W, locale, floors, categoryLabels, today }: { F: F; W: W; locale: Locale; floors: FloorMap; categoryLabels: string[]; today: string }) {
  const [state, action, pending] = useActionState<CampaignState, FormData>(createCampaignAction, { error: null });
  const [sector, setSector] = useState('');
  const [category, setCategory] = useState('');
  const [contentType, setContentType] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [count, setCount] = useState('1');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState<string>(DEFAULT_COUNTRY);
  const [deadline, setDeadline] = useState('');
  const [mode, setMode] = useState<'total' | 'payout'>('total');
  const [total, setTotal] = useState('');
  const [payout, setPayout] = useState('');
  const [rights, setRights] = useState<RightsPresetKey>('organic_6m');
  const [rightsCustom, setRightsCustom] = useState('');
  const [tier, setTier] = useState<(typeof TIERS)[number]>(TIERS[0]);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [brief, setBrief] = useState('');
  const [requirements, setRequirements] = useState('');
  const [equipment, setEquipment] = useState('');
  const [languageKey, setLanguageKey] = useState<LanguageKey | ''>('');
  // D2: new campaigns are public by default (listed on /campaigns once funded); the brand can switch it off.
  const [isPublic, setIsPublic] = useState(true);

  const split = mode === 'payout' ? selfServeFromPayout(payout, count, tier.rate) : selfServeFromTotal(total, count, tier.rate);
  const floor = selfServeFloor(contentType, quantity, split?.payoutPerCreatorFcfa ?? null, floors);
  const f = (n: number) => formatFcfa(n, locale);
  const countryLabel = countryName(country, locale);
  const what = deliverableSummary(Number(quantity) || 1, contentType, locale) ?? '';
  const n = Number(count) || 0;
  const moreOpen = !!state.field && (MORE_FIELDS as readonly string[]).includes(state.field);

  const pickSector = (key: string) => {
    setSector(key);
    const t = findTemplate(key);
    if (!t) return;
    setCategory(t.category);
    setPlatforms(t.platforms.filter((p) => (CAMPAIGN_PLATFORMS as string[]).includes(p)));
    setBrief(t.deliverables[locale]);
    setRequirements(t.requirements[locale]);
    setEquipment(t.equipment ? t.equipment[locale] : '');
    setRights(t.rights);
    if (!contentType && CONTENT_FOR_TYPE[t.type]) setContentType(CONTENT_FOR_TYPE[t.type]!);
  };

  const waMessage = publishMessage(
    W.message,
    {
      what,
      howMany: [what, n > 0 ? (n === 1 ? F.creatorsOne : fill(F.creatorsMany, { n })) : ''].filter(Boolean).join(', '),
      where: [city.trim(), city.trim() ? countryLabel : ''].filter(Boolean).join(', '),
      deadline: deadline ? deadline.split('-').reverse().join('/') : '',
      budget: split ? new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-US').format(split.totalFcfa) : '',
      rights: rights === 'custom' ? rightsCustom.trim() : rightsShortLabel(rights, countryLabel, locale),
    },
    'new-campaign',
  );

  const input = 'mt-1 w-full min-h-tap rounded-xl border border-line bg-white px-3 text-[16px] text-ink placeholder-muted/60 focus:border-brand focus:outline-none sm:text-sm';
  const err = (field: string) => (state.field === field ? { 'aria-invalid': true as const, 'aria-describedby': 'form-error' } : {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="tier" value={tier.id} />
      <input type="hidden" name="category" value={category} />
      <input type="hidden" name="budget_mode" value={mode} />
      <input type="hidden" name="platforms" value={platforms.join(',')} />
      <input type="hidden" name="is_public" value={isPublic ? 'true' : 'false'} />

      {/* Escape hatch (design §7.4) — one clear exit, not repeated at the bottom. */}
      <PublishWhatsAppCta variant="band" title={W.formTitle} body={W.formBody} label={W.cta} ariaSuffix={W.ariaSuffix} message={waMessage} />

      {state.error && (
        <div id="form-error" role="alert" className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden /> {state.error}
        </div>
      )}

      {/* Sector: one tap — sets the category and prefills text, never a price. */}
      <div>
        <p className="text-xs font-bold text-ink">{F.sector}</p>
        <div className="no-scrollbar -mx-4 mt-1.5 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {[...MANAGED_TEMPLATES.map((t) => ({ key: t.key, label: t.label[locale] })), { key: 'other', label: F.sectorOther }].map((t) => (
            <button key={t.key} type="button" aria-pressed={sector === t.key} onClick={() => pickSector(t.key)}
              className={`inline-flex min-h-tap shrink-0 items-center whitespace-nowrap rounded-full border px-3.5 text-xs font-bold transition ${sector === t.key ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink hover:border-brand'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[11px] text-muted">{F.sectorHint}</p>
        {(sector === 'other' || state.field === 'category') && (
          <label className="mt-2 block">
            <span className="text-[11px] font-semibold text-muted">{F.category}</span>
            <select className={input} value={category} onChange={(e) => setCategory(e.target.value)} {...err('category')}>
              <option value="" disabled>{F.choose}</option>
              {CAMPAIGN_CATEGORIES.map((c, i) => (
                <option key={c.slug} value={c.fr}>{locale === 'en' ? (categoryLabels[i] ?? c.fr) : c.fr}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      <Q n={1} label={F.what} hint={F.whatHint}>
        <div className="grid grid-cols-3 gap-2">
          <label className="col-span-2">
            <span className="text-[11px] font-semibold text-muted">{F.contentType}</span>
            <select name="content_type" required className={input} value={contentType} onChange={(e) => setContentType(e.target.value)} {...err('content_type')}>
              <option value="" disabled>{F.choose}</option>
              {CONTENT_TYPES.map((c) => (
                <option key={c.fr} value={c.fr}>{c[locale]}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="text-[11px] font-semibold text-muted">{F.quantity}</span>
            <input name="quantity" inputMode="numeric" className={input} value={quantity} onChange={(e) => setQuantity(e.target.value.replace(/\D/g, '').slice(0, 4))} />
          </label>
        </div>
      </Q>

      <Q n={2} label={F.count} hint={F.countHint}>
        <input name="count" aria-label={F.count} inputMode="numeric" required className={input} value={count} onChange={(e) => setCount(e.target.value.replace(/\D/g, '').slice(0, 4))} {...err('count')} />
      </Q>

      <Q n={3} label={F.where} hint={F.cityHint}>
        <div className="grid grid-cols-2 gap-2">
          <label>
            <span className="text-[11px] font-semibold text-muted">{F.city}</span>
            <input name="city" required maxLength={80} className={input} value={city} onChange={(e) => setCity(e.target.value)} {...err('city')} />
          </label>
          <label>
            <span className="text-[11px] font-semibold text-muted">{F.country}</span>
            <select name="country" className={input} value={country} onChange={(e) => setCountry(e.target.value)}>
              {COUNTRY_CODES.map((c) => (
                <option key={c} value={c}>{countryName(c, locale)}</option>
              ))}
            </select>
          </label>
        </div>
      </Q>

      <Q n={4} label={F.when} hint={F.whenHint}>
        <input name="deadline" type="date" aria-label={F.when} required min={today} className={input} value={deadline} onChange={(e) => setDeadline(e.target.value)} {...err('deadline')} />
      </Q>

      <Q
        n={5}
        label={mode === 'total' ? F.budget : F.payout}
        hint={
          <>
            {split ? (
              <>
                {mode === 'total' && (
                  <p className="text-[13px] text-ink" aria-live="polite">
                    {fill(F.budgetHint, { payout: '' })}<strong className="font-display tabular-nums">{f(split.payoutPerCreatorFcfa)}</strong>
                  </p>
                )}
                <p>{fill(F.budgetSplit, { pool: f(split.poolFcfa), fee: f(split.feeFcfa), rate: split.ratePct })}</p>
              </>
            ) : mode === 'payout' ? (
              <p>{F.payoutHint}</p>
            ) : null}
            <button type="button" onClick={() => setMode(mode === 'total' ? 'payout' : 'total')} className="mt-1 inline-flex min-h-[44px] items-center text-[12px] font-semibold text-brand-700 hover:text-brand">
              {mode === 'total' ? F.advancedToggle : F.advancedBack}
            </button>
          </>
        }
      >
        {mode === 'total' ? (
          <input name="total" aria-label={F.budget} inputMode="numeric" required className={input} value={total} onChange={(e) => setTotal(e.target.value.replace(/\D/g, '').slice(0, 12))} {...err('total')} />
        ) : (
          <input name="payout" aria-label={F.payout} inputMode="numeric" required className={input} value={payout} onChange={(e) => setPayout(e.target.value.replace(/\D/g, '').slice(0, 12))} {...err('payout')} />
        )}
        {floor.below && floor.floorFcfa && (
          <div className="mt-3 rounded-xl border border-accent/30 bg-accent-soft p-3 text-[12px] text-ink">
            <p className="flex items-start gap-1.5"><TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> {fill(F.belowFloorHint, { floor: f(floor.floorFcfa) })}</p>
            <label className="mt-2 flex min-h-tap cursor-pointer items-center gap-2.5 font-semibold">
              <input type="checkbox" name="floor_ack" required className="h-5 w-5 shrink-0 accent-brand" {...err('floor_ack')} /> {F.floorAck}
            </label>
          </div>
        )}
      </Q>

      <Q n={6} label={F.rights} hint={F.rightsHint}>
        <div className="grid gap-1.5">
          {RIGHTS_PRESETS.map((r) => (
            <label key={r.key} className={`flex min-h-tap cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 text-[13px] ${rights === r.key ? 'border-brand bg-brand-50' : 'border-line bg-white'}`}>
              <input type="radio" name="rights" value={r.key} className="h-4 w-4 accent-brand" checked={rights === r.key} onChange={() => setRights(r.key)} />
              <span className="text-ink">
                {rightsShortLabel(r.key, countryLabel, locale)} {r.key === 'organic_6m' && <span className="text-muted">{F.rightsRecommended}</span>}
              </span>
            </label>
          ))}
        </div>
        {rights === 'custom' && (
          <textarea name="rights_custom" aria-label={F.rightsCustom} placeholder={F.rightsCustom} rows={2} maxLength={500} required
            className={`${input} min-h-[4rem] py-2.5`} value={rightsCustom} onChange={(e) => setRightsCustom(e.target.value)} {...err('rights')} />
        )}
      </Q>

      <details open={moreOpen || undefined} className="group rounded-2xl border border-line bg-white">
        <summary className="flex min-h-tap cursor-pointer items-center justify-between px-4 text-sm font-bold text-ink">
          {F.more} <ArrowRight className="h-4 w-4 transition group-open:rotate-90" aria-hidden />
        </summary>
        <div className="space-y-3 border-t border-line p-4">
          <label className="block">
            <span className="text-xs font-semibold text-ink">{F.titleField}</span>
            <input name="title" maxLength={120} className={input} placeholder={what && city ? `${what} · ${city}` : ''} {...err('title')} />
            <span className="mt-1 block text-[11px] text-muted">{F.titleHint}</span>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-ink">{F.message}</span>
            <textarea name="brief" rows={3} maxLength={4000} placeholder={F.messagePlaceholder} className={`${input} min-h-[5rem] py-2.5`} value={brief} onChange={(e) => setBrief(e.target.value)} />
          </label>
          <div>
            <p className="text-xs font-semibold text-ink">{F.platforms}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {CAMPAIGN_PLATFORMS.map((p) => {
                const on = platforms.includes(p);
                return (
                  <button type="button" key={p} aria-pressed={on} onClick={() => setPlatforms((prev) => (on ? prev.filter((x) => x !== p) : [...prev, p]))}
                    className={`inline-flex min-h-tap items-center gap-1.5 rounded-full border px-3 text-xs font-bold transition ${on ? 'border-brand bg-brand-50 text-brand-700' : 'border-line bg-white text-muted hover:border-brand-100'}`}>
                    <span className="grid h-4 w-4 place-items-center rounded text-white" style={{ backgroundColor: SOCIAL_META[p].brand }}>
                      <SocialIcon platform={p} className="h-2.5 w-2.5" />
                    </span>
                    {SOCIAL_META[p].label}
                  </button>
                );
              })}
            </div>
          </div>
          <label className="block">
            <span className="text-xs font-semibold text-ink">{F.mandatory}</span>
            <input name="mandatory_tags" maxLength={500} placeholder={F.mandatoryPlaceholder} className={input} />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-ink">{F.requirements}</span>
            <textarea name="creator_requirements" rows={2} maxLength={1000} className={`${input} min-h-[4rem] py-2.5`} value={requirements} onChange={(e) => setRequirements(e.target.value)} />
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold text-ink">{F.language}</span>
              <select name="language_key" className={input} value={languageKey} onChange={(e) => setLanguageKey(e.target.value as LanguageKey)}>
                <option value="">{F.choose}</option>
                {LANGUAGES.map((l) => (
                  <option key={l.key} value={l.key}>{l[locale]}</option>
                ))}
              </select>
              {languageKey === 'other' && <input name="language_other" aria-label={F.languageOther} placeholder={F.languageOther} maxLength={60} className={input} />}
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-ink">{F.equipment}</span>
              <input name="equipment" maxLength={500} className={input} value={equipment} onChange={(e) => setEquipment(e.target.value)} />
            </label>
          </div>

          <div>
            <p className="text-xs font-semibold text-ink">{F.plan}</p>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {TIERS.map((t) => (
                <button type="button" key={t.id} aria-pressed={tier.id === t.id} onClick={() => setTier(t)}
                  className={`rounded-xl border p-2.5 text-left transition ${tier.id === t.id ? 'border-brand bg-brand-50' : 'border-line bg-white hover:border-brand-100'}`}>
                  <div className="text-xs font-bold text-ink">{t.label}</div>
                  <div className="text-[11px] font-semibold text-brand-700">{Math.round(t.rate * 100)}{locale === 'fr' ? ' %' : '%'}</div>
                  <div className="mt-0.5 text-[10px] text-muted">{t.blurb}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-ink">{F.visibility}</p>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {[
                { pub: false, Icon: EyeOff, title: F.visibilityPrivate, hint: F.visibilityPrivateHint },
                { pub: true, Icon: Globe, title: F.visibilityPublic, hint: F.visibilityPublicHint },
              ].map(({ pub, Icon, title, hint }) => (
                <button key={title} type="button" aria-pressed={isPublic === pub} onClick={() => setIsPublic(pub)}
                  className={`flex items-start gap-2 rounded-xl border p-3 text-left transition ${isPublic === pub ? 'border-brand bg-brand-50' : 'border-line bg-white hover:border-brand-100'}`}>
                  <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${isPublic === pub ? 'text-brand' : 'text-muted'}`} aria-hidden />
                  <span>
                    <span className="block text-xs font-bold text-ink">{title}</span>
                    <span className="block text-[11px] text-muted">{hint}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </details>

      {/* R4: total, fee and net shown before confirming. */}
      <div className="rounded-2xl border border-line bg-surface p-4">
        <p className="text-xs font-bold text-ink">{F.summaryTitle}</p>
        <div className="mt-2 grid gap-1 text-xs">
          <div className="flex justify-between"><span className="text-muted">{fill(F.summaryFee, { rate: Math.round(tier.rate * 100) })}</span><span className="font-semibold tabular-nums text-ink">{split ? f(split.feeFcfa) : '—'}</span></div>
          <div className="flex justify-between"><span className="text-muted">{F.summaryNet}</span><span className="font-semibold tabular-nums text-ink">{split ? f(split.payoutPerCreatorFcfa) : '—'}</span></div>
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
          <span className="flex items-center gap-1.5 text-sm font-bold text-ink"><Lock className="h-3.5 w-3.5 text-brand" aria-hidden /> {F.summaryTotal}</span>
          <span className="font-display text-lg font-extrabold tabular-nums text-ink">{split ? f(split.totalFcfa) : '—'}</span>
        </div>
      </div>

      <button type="submit" disabled={pending}
        className="flex min-h-tap w-full items-center justify-center gap-2 rounded-xl bg-brand text-sm font-bold text-white shadow-sm transition hover:bg-brand-600 active:scale-95 disabled:opacity-50">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : (<>{F.submit} <ArrowRight className="h-3.5 w-3.5" aria-hidden /></>)}
      </button>
      <p className="text-center text-[11px] text-muted">{F.footnote}</p>
    </form>
  );
}

/** One numbered question card (module level so inputs keep focus across renders). */
function Q({ n: num, label, children, hint }: { n: number; label: string; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <fieldset className="rounded-2xl border border-line bg-white p-4">
      <legend className="sr-only">{label}</legend>
      <p aria-hidden className="flex items-center gap-2 text-sm font-bold text-ink">
        <span className="grid h-6 w-6 place-items-center rounded-lg bg-brand text-[12px] font-extrabold text-white">{num}</span> {label}
      </p>
      <div className="mt-2">{children}</div>
      {hint && <div className="mt-1.5 text-[12px] text-muted">{hint}</div>}
    </fieldset>
  );
}
