'use client';

import { useActionState, useState } from 'react';
import { Loader2, AlertCircle, ArrowRight } from 'lucide-react';
import { onboardAction, type OnboardState } from '../actions';
import { SocialIcon, SOCIAL_META, type Platform } from '@/components/social-icons';
import { OnboardingAvatar } from '@/components/onboarding-avatar';
import { normalizeHandle } from '@/lib/handle';

type Role = 'creator' | 'consultant' | 'business';
type CC = 'CM' | 'CI' | 'GA';

// Curated primary networks for onboarding (the rest are addable later in Profil) — keeps signup fast.
// Keep this list in sync with ONBOARD_SOCIALS in ../actions.ts, which persists these same keys.
const ONBOARD_SOCIALS: Platform[] = ['whatsapp', 'instagram', 'facebook', 'tiktok', 'youtube', 'linkedin'];

const COUNTRIES: { code: CC; label: string }[] = [
  { code: 'CM', label: '🇨🇲 Cameroun' },
  { code: 'CI', label: "🇨🇮 Côte d'Ivoire" },
  { code: 'GA', label: '🇬🇦 Gabon' },
];

const CATEGORIES = [
  'Beauté', 'Mode', 'Tech', 'Food', 'Musique', 'Sport',
  'Santé & Bien-être', 'Humour', 'Éducation', 'Voyage', 'Business',
];

const ROLE_COPY: Record<Role, { title: string; blurb: string }> = {
  creator: { title: 'Profil créateur', blurb: 'Votre vitrine pour les marques. Vous êtes payé par campagne, via séquestre.' },
  consultant: { title: 'Profil consultant', blurb: 'Pilotez les campagnes et accédez à la base de créateurs vérifiés.' },
  business: { title: 'Profil marque', blurb: 'Lancez des campagnes sous séquestre. Facturation OHADA incluse.' },
};

export function OnboardingForm({
  role,
  userId,
  defaults,
}: {
  role: Role;
  userId: string;
  defaults: { displayName: string; handle: string; country: CC; companyName: string };
}) {
  const [state, formAction, pending] = useActionState<OnboardState, FormData>(onboardAction, { error: null });
  const [cats, setCats] = useState<string[]>([]);
  const copy = ROLE_COPY[role];

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-extrabold text-ink">{copy.title}</h1>
        <p className="mt-1 text-sm text-muted">{copy.blurb}</p>
        <p className="mt-2 inline-flex items-center rounded-full bg-surface px-2.5 py-1 text-[11px] font-semibold text-muted">
          Statut à la création : <code className="ml-1 text-ink">pending_review</code> — validé par un admin.
        </p>
      </div>

      <input type="hidden" name="role" value={role} />

      <OnboardingAvatar userId={userId} name={defaults.displayName || defaults.companyName} />

      {state.error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          <AlertCircle className="h-4 w-4 shrink-0" /> {state.error}
        </div>
      )}

      {role === 'business' ? (
        <>
          <Text name="company_name" label="Nom de l'entreprise" defaultValue={defaults.companyName} required placeholder="SARL Douala Logistics" />
          <div className="grid grid-cols-2 gap-3">
            <Text name="display_name" label="Nom public" defaultValue={defaults.displayName || defaults.companyName} required placeholder="Douala Logistics" />
            <HandleField defaultValue={defaults.handle} placeholder="douala_logistics" />
          </div>
          <Text name="industry" label="Secteur" required placeholder="Logistique, FMCG, Fintech…" />
          <Text name="billing_email" label="Email de facturation (OHADA)" type="email" placeholder="factures@entreprise.com" />
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Text name="display_name" label="Nom complet" defaultValue={defaults.displayName} required placeholder="Awa Ngono" />
            <HandleField defaultValue={defaults.handle} placeholder="awa_beauty" />
          </div>
          {role === 'creator' ? (
            <>
              <div>
                <label className="text-xs font-semibold text-ink">Catégories</label>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {CATEGORIES.map((c) => {
                    const on = cats.includes(c);
                    return (
                      <button
                        type="button"
                        key={c}
                        onClick={() => setCats((p) => (on ? p.filter((x) => x !== c) : [...p, c]))}
                        className={`inline-flex min-h-tap items-center rounded-full border px-3.5 text-[13px] font-bold transition ${on ? 'border-brand bg-brand-50 text-brand-700' : 'border-line bg-white text-muted hover:border-brand-100'}`}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
                <input type="hidden" name="categories" value={cats.join(',')} />
              </div>
              <Text name="audience_size" label="Audience cumulée (abonnés)" type="number" placeholder="45000" />
              <div>
                <label className="text-xs font-semibold text-ink">Réseaux sociaux (optionnel)</label>
                <p className="mt-0.5 text-[11px] text-muted">Ajoutez vos liens principaux — vous pourrez compléter plus tard.</p>
                <div className="mt-2 grid gap-2">
                  {ONBOARD_SOCIALS.map((p) => (
                    <div key={p} className="flex items-center gap-2">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white" style={{ backgroundColor: SOCIAL_META[p].brand }}>
                        <SocialIcon platform={p} className="h-4 w-4" />
                      </span>
                      <input
                        name={`soc_${p}_url`}
                        inputMode="url"
                        placeholder={`Lien ${SOCIAL_META[p].label}`}
                        className="min-w-0 flex-1 rounded-lg border border-line bg-white px-2.5 py-2 text-xs text-ink placeholder-muted/60 focus:border-brand focus:outline-none"
                      />
                      <input
                        name={`soc_${p}_followers`}
                        type="number"
                        min={0}
                        placeholder="abonnés"
                        className="w-20 shrink-0 rounded-lg border border-line bg-white px-2 py-2 text-xs text-ink focus:border-brand focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              <Text name="specialties" label="Spécialités (séparées par des virgules)" required placeholder="Stratégie média, Influence" />
              <Text name="years_experience" label="Années d'expérience" type="number" placeholder="8" />
            </>
          )}
        </>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Text name="city" label="Ville" required placeholder="Douala" />
        <div>
          <label className="text-xs font-semibold text-ink">Pays</label>
          <select
            name="country"
            defaultValue={defaults.country}
            className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-3 text-sm text-ink focus:border-brand focus:outline-none"
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-ink">Bio (optionnel)</label>
        <textarea
          name="bio"
          rows={3}
          placeholder="Présentez votre contenu et votre audience en une phrase."
          className="mt-1 w-full resize-none rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink placeholder-muted/60 focus:border-brand focus:outline-none"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="flex min-h-tap w-full items-center justify-center gap-2 rounded-xl bg-brand text-sm font-bold text-white shadow-sm transition hover:bg-brand-600 active:scale-95 disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : (<>Finaliser mon profil <ArrowRight className="h-3.5 w-3.5" /></>)}
      </button>
    </form>
  );
}

// Controlled identifier field: normalizes every keystroke to the DB's handle format
// (a–z, 0–9, _), so accents/spaces can't reach submit and trigger invalid_handle_format.
function HandleField({ defaultValue, placeholder }: { defaultValue: string; placeholder: string }) {
  const [value, setValue] = useState(() => normalizeHandle(defaultValue));
  return (
    <div>
      <label className="text-xs font-semibold text-ink">Identifiant</label>
      <input
        name="handle"
        required
        value={value}
        onChange={(e) => setValue(normalizeHandle(e.target.value))}
        placeholder={placeholder}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        inputMode="text"
        className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-3 text-sm text-ink placeholder-muted/60 focus:border-brand focus:outline-none"
      />
      <p className="mt-1 text-[11px] text-muted">3–30 caractères : lettres, chiffres et « _ ».</p>
    </div>
  );
}

function Text(props: {
  name: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-ink">{props.label}</label>
      <input
        name={props.name}
        type={props.type ?? 'text'}
        required={props.required}
        defaultValue={props.defaultValue}
        placeholder={props.placeholder}
        className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-3 text-sm text-ink placeholder-muted/60 focus:border-brand focus:outline-none"
      />
    </div>
  );
}
