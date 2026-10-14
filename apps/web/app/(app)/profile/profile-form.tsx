'use client';

import { useActionState } from 'react';
import { Loader2, Check, AlertCircle, Save } from 'lucide-react';
import { updateProfileAction, type ProfileState } from './actions';
import { PROVIDERS } from '@/lib/data/campaigns';
import { SocialIcon, SOCIAL_META, type Platform } from '@/components/social-icons';
import { countryOptions, COUNTRIES as COUNTRY_INFO, parseCountry } from '@/lib/countries';
import type { Dictionary } from '@/i18n/dictionaries';
import { LimitedField } from '@/components/limited-field';
import { SectionTip } from '@/components/admin/section-tip';
import { PROFILE_LIMITS, followersTotal } from '@/lib/profile-limits';
import { AudienceField } from '@/components/audience-field';

// Display order for the social editor (WhatsApp first — the dominant channel in-market).
export const SOCIAL_PLATFORMS: Platform[] = [
  'whatsapp', 'instagram', 'tiktok', 'youtube', 'facebook', 'x', 'snapchat', 'telegram', 'linkedin',
];

const COUNTRIES = countryOptions('fr');

export type SocialsMap = Partial<Record<Platform, { url: string; followers: number }>>;

export interface ProfileInitial {
  displayName: string;
  city: string;
  bio: string;
  country: string;
  isCreator: boolean;
  isConsultant: boolean;
  isBusiness: boolean;
  categories: string;
  audienceSize: number;
  momoPhone: string;
  momoProvider: string;
  socials: SocialsMap;
  specialties: string;
  yearsExperience: number;
  partnerMomoPhone: string;
  partnerMomoProvider: string;
  companyName: string;
  industry: string;
  billingEmail: string;
  website: string;
}

type F = Dictionary['creatorForm'];
type T = Dictionary['creatorTips'];

export function ProfileForm({ initial, F, T, locale = 'fr' }: { initial: ProfileInitial; F: F; T: T; locale?: 'fr' | 'en' }) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(updateProfileAction, { error: null });
  const tip = (key: keyof T, label: string) => <SectionTip id={`creator-${String(key)}`} label={label} text={T[key]} ariaTemplate={T.aria} />;
  const fieldErr = (f: 'displayName' | 'city' | 'bio') => (state.field === f ? state.error : null);
  const networksTotal = followersTotal(initial.socials);
  const payoutCard = (
    <div id="paiement" className="scroll-mt-4 space-y-3 rounded-2xl border border-line bg-white p-4 shadow-card">
      <h2 className="text-sm font-bold text-ink">{F.payoutTitle}</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field id="field-momo" label={F.payoutLabel} tip={tip('payout', F.payoutLabel)} name="momo_phone" type="tel" inputMode="tel" autoComplete="tel" defaultValue={initial.momoPhone} placeholder={`${COUNTRY_INFO[parseCountry(initial.country)].dial} …`} />
        <div>
          <label htmlFor="field-provider" className="flex items-center text-xs font-semibold text-ink">{F.providerLabel}{tip('provider', F.providerLabel)}</label>
          <select
            id="field-provider"
            name="momo_provider"
            defaultValue={initial.momoProvider || 'mtn_momo'}
            className="mt-1 min-h-tap w-full rounded-xl border border-line bg-white px-3 py-3 text-[16px] text-ink focus:border-brand focus:outline-none sm:text-sm"
          >
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );

  return (
    <form action={action} className="space-y-5">
      {state.ok && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-700">
          <Check className="h-4 w-4 shrink-0" /> Profil mis à jour.
        </div>
      )}
      {state.error && !state.field && (
        <div role="alert" className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          <AlertCircle className="h-4 w-4 shrink-0" /> {state.error}
        </div>
      )}

      {/* Mobile Money first for creators: no number = no payment (design §B.2 #3). */}
      {initial.isCreator && payoutCard}

      <Card title="Informations">
        <LimitedField id="field-display-name" name="display_name" label={F.displayNameLabel} max={PROFILE_LIMITS.displayName} defaultValue={initial.displayName} required
          tip={tip('displayName', F.displayNameLabel)} error={fieldErr('displayName')} overLimitError={F.errors.displayName} autoComplete="name" />
        <div className="grid gap-3 sm:grid-cols-2">
          <LimitedField id="field-city" name="city" label={F.cityLabel} max={PROFILE_LIMITS.city} defaultValue={initial.city} required helper={F.cityHelp}
            tip={tip('city', F.cityLabel)} error={fieldErr('city')} overLimitError={F.errors.city} autoComplete="address-level2" />
          <div>
            <label className="text-xs font-semibold text-ink">Pays</label>
            <select
              name="country"
              defaultValue={initial.country}
              className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-3 text-sm text-ink focus:border-brand focus:outline-none"
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>
        <LimitedField id="field-bio" name="bio" label={F.bioLabel} max={PROFILE_LIMITS.bio} defaultValue={initial.bio} multiline placeholder={F.bioPlaceholder}
          tip={tip('bio', F.bioLabel)} error={fieldErr('bio')} overLimitError={F.errors.bio} />
      </Card>

      {initial.isCreator && (
        <Card title="Profil créateur">
          <Field id="field-categories" label={F.categoriesLabel} tip={tip('categories', F.categoriesLabel)} name="categories" defaultValue={initial.categories} placeholder="Mode, Beauté, Lifestyle" />
          {/* AR-1: the typed audience; the per-network sum is only a hint. */}
          <AudienceField label={F.audienceLabel} tip={tip('audience', F.audienceLabel)} defaultValue={initial.audienceSize}
            networksTotal={networksTotal} networksTemplate={F.audienceNetworks} locale={locale} />
        </Card>
      )}

      {initial.isCreator && (
        <div id="reseaux" className="scroll-mt-4 space-y-3 rounded-2xl border border-line bg-white p-4 shadow-card">
          <div>
            <h2 className="flex items-center text-sm font-bold text-ink">{F.socialsTitle}{tip('socials', F.socialsTitle)}</h2>
            <p className="mt-0.5 text-[11px] text-muted">
              Ajoutez le lien et le nombre d'abonnés de chaque réseau. Ils s'affichent sur votre profil public.
            </p>
          </div>
          <div className="grid gap-2.5">
            {SOCIAL_PLATFORMS.map((p) => (
              <SocialRow key={p} platform={p} url={initial.socials[p]?.url ?? ''} followers={initial.socials[p]?.followers} followersLabel={F.followers} />
            ))}
          </div>
        </div>
      )}

      {initial.isConsultant && (
        <Card title="Profil partenaire" id={initial.isCreator ? undefined : 'paiement'}>
          <div>
            <Field label="Spécialités (séparées par des virgules)" name="specialties" defaultValue={initial.specialties} placeholder="Stratégie, Social Ads, Influence" />
            <p className="mt-1 text-[11px] text-muted">{F.specialtiesHint}</p>
          </div>
          <NumberField label="Années d'expérience" name="years_experience" defaultValue={initial.yearsExperience} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Mobile Money pour vos commissions" name="partner_momo_phone" type="tel" inputMode="tel" autoComplete="tel" defaultValue={initial.partnerMomoPhone} placeholder={`${COUNTRY_INFO[parseCountry(initial.country)].dial} …`} />
            <div>
              <label className="text-xs font-semibold text-ink">Opérateur</label>
              <select
                name="partner_momo_provider"
                defaultValue={initial.partnerMomoProvider || 'mtn_momo'}
                className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-3 text-sm text-ink focus:border-brand focus:outline-none"
              >
                {PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-[11px] text-muted">Bayele y verse vos commissions sur les missions des créateurs que vous représentez. Ce numéro reste privé.</p>
        </Card>
      )}

      {initial.isBusiness && (
        <Card title="Profil entreprise" id="entreprise">
          <Field label="Nom de l'entreprise" name="company_name" defaultValue={initial.companyName} required />
          <Field label="Secteur d'activité" name="industry" defaultValue={initial.industry} placeholder="Beauté, FMCG, Télécom…" required />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Email de facturation" name="billing_email" type="email" inputMode="email" autoComplete="email" defaultValue={initial.billingEmail} placeholder="factures@entreprise.com" />
            <Field label="Site web" name="website" type="url" inputMode="url" defaultValue={initial.website} placeholder="https://…" />
          </div>
        </Card>
      )}

      <button
        type="submit"
        disabled={pending}
        className="flex min-h-tap w-full items-center justify-center gap-2 rounded-xl bg-brand text-sm font-bold text-white shadow-sm transition hover:bg-brand-600 active:scale-95 disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : (<><Save className="h-4 w-4" /> Enregistrer</>)}
      </button>
    </form>
  );
}

function SocialRow({ platform, url, followers, followersLabel }: { platform: Platform; url: string; followers?: number; followersLabel: string }) {
  const meta = SOCIAL_META[platform];
  return (
    <div className="rounded-xl border border-line p-2.5">
      <div className="mb-2 flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg text-white" style={{ backgroundColor: meta.brand }}>
          <SocialIcon platform={platform} className="h-3.5 w-3.5" />
        </span>
        <span className="text-xs font-bold text-ink">{meta.label}</span>
      </div>
      {/* Two lines under sm so the followers field keeps a readable label (design §B.2 #11). */}
      <div className="grid gap-2 sm:grid-cols-[1fr_8rem]">
        <input
          name={`soc_${platform}_url`}
          aria-label={`${meta.label} — URL`}
          defaultValue={url}
          inputMode="url"
          placeholder="https://…"
          className="min-h-tap min-w-0 rounded-lg border border-line bg-white px-2.5 py-2 text-[16px] text-ink placeholder:text-muted focus:border-brand focus:outline-none sm:text-xs"
        />
        <label className="flex min-w-0 items-center gap-2 text-[11px] font-semibold text-muted sm:block">
          <span className="sm:sr-only">{followersLabel}</span>
          <input
            name={`soc_${platform}_followers`}
            type="number"
            min={0}
            aria-label={`${meta.label} — ${followersLabel}`}
            defaultValue={followers ? String(followers) : ''}
            className="min-h-tap w-full min-w-0 rounded-lg border border-line bg-white px-2.5 py-2 text-[16px] text-ink focus:border-brand focus:outline-none sm:text-xs"
          />
        </label>
      </div>
    </div>
  );
}

function Card({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return (
    <div id={id} className="scroll-mt-4 space-y-3 rounded-2xl border border-line bg-white p-4 shadow-card">
      <h2 className="text-sm font-bold text-ink">{title}</h2>
      {children}
    </div>
  );
}

function Field(props: {
  id?: string;
  tip?: React.ReactNode;
  label: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  type?: string;
  inputMode?: 'text' | 'tel' | 'email' | 'url' | 'numeric';
  autoComplete?: string;
}) {
  return (
    <div>
      <label htmlFor={props.id} className="flex items-center text-xs font-semibold text-ink">{props.label}{props.tip}</label>
      <input
        id={props.id}
        name={props.name}
        type={props.type ?? 'text'}
        inputMode={props.inputMode}
        autoComplete={props.autoComplete}
        defaultValue={props.defaultValue}
        required={props.required}
        placeholder={props.placeholder}
        className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-3 text-sm text-ink placeholder-muted/60 focus:border-brand focus:outline-none"
      />
    </div>
  );
}

function NumberField(props: { label: string; name: string; defaultValue: number }) {
  return (
    <div>
      <label className="text-xs font-semibold text-ink">{props.label}</label>
      <input
        name={props.name}
        type="number"
        min={0}
        defaultValue={props.defaultValue}
        className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-3 text-sm text-ink focus:border-brand focus:outline-none"
      />
    </div>
  );
}
