'use client';

import { useActionState } from 'react';
import { Loader2, Check, AlertCircle, Save } from 'lucide-react';
import { updateProfileAction, type ProfileState } from './actions';
import { PROVIDERS } from '@/lib/data/campaigns';
import { SocialIcon, SOCIAL_META, type Platform } from '@/components/social-icons';

// Display order for the social editor (WhatsApp first — the dominant channel in-market).
export const SOCIAL_PLATFORMS: Platform[] = [
  'whatsapp', 'instagram', 'tiktok', 'youtube', 'facebook', 'x', 'snapchat', 'telegram', 'linkedin',
];

export type SocialsMap = Partial<Record<Platform, { url: string; followers: number }>>;

export interface ProfileInitial {
  displayName: string;
  city: string;
  bio: string;
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
  companyName: string;
  industry: string;
  billingEmail: string;
  website: string;
}

export function ProfileForm({ initial }: { initial: ProfileInitial }) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(updateProfileAction, { error: null });

  return (
    <form action={action} className="space-y-5">
      {state.ok && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-700">
          <Check className="h-4 w-4 shrink-0" /> Profil mis à jour.
        </div>
      )}
      {state.error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          <AlertCircle className="h-4 w-4 shrink-0" /> {state.error}
        </div>
      )}

      <Card title="Informations">
        <Field label="Nom affiché" name="display_name" defaultValue={initial.displayName} required />
        <Field label="Ville" name="city" defaultValue={initial.city} required />
        <div>
          <label className="text-xs font-semibold text-ink">Bio</label>
          <textarea
            name="bio"
            rows={3}
            defaultValue={initial.bio}
            placeholder="Présentez-vous en quelques mots…"
            className="mt-1 w-full resize-none rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink placeholder-muted/60 focus:border-brand focus:outline-none"
          />
        </div>
      </Card>

      {initial.isCreator && (
        <Card title="Profil créateur">
          <Field label="Catégories (séparées par des virgules)" name="categories" defaultValue={initial.categories} placeholder="Mode, Beauté, Lifestyle" />
          <NumberField label="Taille d'audience" name="audience_size" defaultValue={initial.audienceSize} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Numéro Mobile Money" name="momo_phone" defaultValue={initial.momoPhone} placeholder="+237 6XX XXX XXX" />
            <div>
              <label className="text-xs font-semibold text-ink">Opérateur</label>
              <select
                name="momo_provider"
                defaultValue={initial.momoProvider || 'mtn_momo'}
                className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-3 text-sm text-ink focus:border-brand focus:outline-none"
              >
                {PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>
        </Card>
      )}

      {initial.isCreator && (
        <div className="space-y-3 rounded-2xl border border-line bg-white p-4 shadow-card">
          <div>
            <h2 className="text-sm font-bold text-ink">Réseaux sociaux</h2>
            <p className="mt-0.5 text-[11px] text-muted">
              Ajoutez le lien et le nombre d'abonnés de chaque réseau. Ils s'affichent sur votre profil public.
            </p>
          </div>
          <div className="grid gap-2.5">
            {SOCIAL_PLATFORMS.map((p) => (
              <SocialRow key={p} platform={p} url={initial.socials[p]?.url ?? ''} followers={initial.socials[p]?.followers} />
            ))}
          </div>
        </div>
      )}

      {initial.isConsultant && (
        <Card title="Profil consultant">
          <Field label="Spécialités (séparées par des virgules)" name="specialties" defaultValue={initial.specialties} placeholder="Stratégie, Social Ads, Influence" />
          <NumberField label="Années d'expérience" name="years_experience" defaultValue={initial.yearsExperience} />
        </Card>
      )}

      {initial.isBusiness && (
        <Card title="Profil entreprise">
          <Field label="Nom de l'entreprise" name="company_name" defaultValue={initial.companyName} required />
          <Field label="Secteur d'activité" name="industry" defaultValue={initial.industry} placeholder="Beauté, FMCG, Télécom…" required />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Email de facturation" name="billing_email" defaultValue={initial.billingEmail} placeholder="factures@entreprise.com" />
            <Field label="Site web" name="website" defaultValue={initial.website} placeholder="https://…" />
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

function SocialRow({ platform, url, followers }: { platform: Platform; url: string; followers?: number }) {
  const meta = SOCIAL_META[platform];
  return (
    <div className="rounded-xl border border-line p-2.5">
      <div className="mb-2 flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg text-white" style={{ backgroundColor: meta.brand }}>
          <SocialIcon platform={platform} className="h-3.5 w-3.5" />
        </span>
        <span className="text-xs font-bold text-ink">{meta.label}</span>
      </div>
      <div className="flex gap-2">
        <input
          name={`soc_${platform}_url`}
          defaultValue={url}
          inputMode="url"
          placeholder="https://…"
          className="min-w-0 flex-1 rounded-lg border border-line bg-white px-2.5 py-2 text-xs text-ink placeholder-muted/60 focus:border-brand focus:outline-none"
        />
        <input
          name={`soc_${platform}_followers`}
          type="number"
          min={0}
          defaultValue={followers ? String(followers) : ''}
          placeholder="abonnés"
          className="w-24 shrink-0 rounded-lg border border-line bg-white px-2.5 py-2 text-xs text-ink focus:border-brand focus:outline-none"
        />
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-2xl border border-line bg-white p-4 shadow-card">
      <h2 className="text-sm font-bold text-ink">{title}</h2>
      {children}
    </div>
  );
}

function Field(props: { label: string; name: string; defaultValue?: string; placeholder?: string; required?: boolean }) {
  return (
    <div>
      <label className="text-xs font-semibold text-ink">{props.label}</label>
      <input
        name={props.name}
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
