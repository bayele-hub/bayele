'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@bayele/database';
import { parseCountry } from '@/lib/countries';
import { parseRefHandle, parseSignupSource, effectiveSource } from '@/lib/attribution';
import { withNext } from '@/lib/auth/return-path';
import { getDictionary } from '@/i18n/dictionaries';
import { checkProfileText, limitErrorField, parseAudience, type LimitedField } from '@/lib/profile-limits';
import { cityFromForm } from '@/lib/gov/cities';
import { parseSpecialtyCodes } from '@/lib/gov/specialties';
import { getSpecialties } from '@/lib/data/partner-gov';
import { NON_CIRCUMVENTION_VERSION } from '@/lib/legal';

type Role = Database['public']['Enums']['user_role'];
type Country = Database['public']['Enums']['country_code'];
type OnboardPlatforms = Database['public']['Functions']['onboard_profile']['Args']['p_platforms'];

const ROLES: Role[] = ['creator', 'consultant', 'business'];
// Keep in sync with ONBOARD_SOCIALS in [role]/onboarding-form.tsx (the fields rendered there).
const ONBOARD_SOCIALS = ['whatsapp', 'instagram', 'facebook', 'tiktok', 'youtube', 'linkedin'] as const;

// Map the RPC's stable error codes to French, user-facing copy.
const ERR_FR: Record<string, string> = {
  handle_taken: 'Cet identifiant est déjà pris — choisissez-en un autre.',
  invalid_handle_format: "L'identifiant doit faire 3 à 30 caractères (a–z, 0–9, _).",
  profile_already_exists: 'Votre profil est déjà créé.',
  actor_mismatch: 'Session invalide. Reconnectez-vous et réessayez.',
  display_name_required: 'Le nom est requis.',
  city_required: 'La ville est requise.',
  company_name_required: "Le nom de l'entreprise est requis.",
  industry_required: 'Le secteur est requis.',
};

export type OnboardState = { error: string | null; field?: LimitedField | 'specialties' | 'consent' | null };

export async function onboardAction(_prev: OnboardState, formData: FormData): Promise<OnboardState> {
  const role = String(formData.get('role') ?? '') as Role;
  if (!ROLES.includes(role)) return { error: 'Rôle invalide.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth?mode=signin');

  const country: Country = parseCountry(formData.get('country'));

  // D5 limits before the RPC (onboard_profile re-checks: display_name_too_long / city_too_long / bio_too_long).
  const { t } = await getDictionary();
  const FE = t.creatorForm.errors;
  const fieldMsg = (f: LimitedField, kind: 'required' | 'tooLong') =>
    f === 'city' ? (kind === 'required' ? FE.cityRequired : FE.city) : f === 'displayName' ? (kind === 'required' ? FE.displayNameRequired : FE.displayName) : FE.bio;
  const city = cityFromForm((k) => formData.get(k));
  const problems = checkProfileText({ displayName: String(formData.get('display_name') ?? ''), city, bio: String(formData.get('bio') ?? '') });
  const bad = (['displayName', 'city', 'bio'] as const).find((k) => problems[k]);
  if (bad) return { error: fieldMsg(bad, problems[bad]!), field: bad };

  // G1: partner specialties are codes from the list, 3 at most.
  const SE = t.specialties.errors;
  let specialties: string[] = [];
  if (role === 'consultant') {
    const known = (await getSpecialties()).map((s) => s.code);
    const parsed = parseSpecialtyCodes(formData.get('specialties'), known);
    if (parsed.error) return { error: SE[parsed.error], field: 'specialties' };
    specialties = parsed.codes;
  }
  // G7: partners and brands tick the non-circumvention clause at onboarding (recorded after the RPC).
  const needsConsent = role === 'consultant' || role === 'business';
  if (needsConsent && formData.get('consent') !== 'on') return { error: t.consent.onboarding.error, field: 'consent' };

  const csv = (k: string) =>
    String(formData.get(k) ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  const opt = (k: string) => {
    const v = String(formData.get(k) ?? '').trim();
    return v.length ? v : undefined;
  };

  // The avatar_url hidden field is client-supplied, so only accept a URL that points at THIS user's
  // own folder in the public avatars bucket (avatars/{userId}/…). This rejects both arbitrary external
  // URLs and another user's avatar path; anything else is ignored rather than persisted.
  const avatarRaw = opt('avatar_url');
  const avatarUrl =
    avatarRaw && avatarRaw.includes(`/storage/v1/object/public/avatars/${user.id}/`) ? avatarRaw : undefined;

  // Build the creator's social platforms JSON ({ instagram: { url, followers }, … }) from the optional
  // onboarding fields; empty URLs are dropped. Non-creator roles submit none.
  const platforms: Record<string, { url: string; followers: number }> = {};
  if (role === 'creator') {
    for (const p of ONBOARD_SOCIALS) {
      const url = String(formData.get(`soc_${p}_url`) ?? '').trim();
      if (!url) continue;
      platforms[p] = { url, followers: Math.max(0, Math.round(Number(formData.get(`soc_${p}_followers`) ?? 0))) };
    }
  }

  // Called with the USER's own session → onboard_profile enforces auth.uid() = p_actor.
  const { error } = await supabase.rpc('onboard_profile', {
    p_actor: user.id,
    p_role: role,
    p_handle: String(formData.get('handle') ?? ''),
    p_display_name: String(formData.get('display_name') ?? ''),
    p_city: city,
    p_country: country,
    p_bio: opt('bio'),
    // Public URL of the photo uploaded client-side to the owner-scoped avatars bucket (optional).
    p_avatar_url: avatarUrl,
    p_categories: csv('categories'),
    // AR-1: the creator's typed audience (blank = 0 on a new profile).
    p_audience_size: parseAudience(formData.get('audience_size')) ?? 0,
    p_platforms: platforms as unknown as OnboardPlatforms,
    p_specialties: specialties,
    p_years_experience: Number(formData.get('years_experience') ?? 0) || 0,
    p_company_name: opt('company_name'),
    p_industry: opt('industry'),
    p_billing_email: opt('billing_email'),
  });

  if (error) {
    const key = (error.message ?? '').trim();
    const field = limitErrorField(key);
    if (field) return { error: fieldMsg(field, /required/.test(key) ? 'required' : 'tooLong'), field };
    if (key === 'invalid_specialty' || key === 'too_many_specialties') return { error: SE[key], field: 'specialties' };
    return { error: ERR_FR[key] ?? 'Une erreur est survenue. Vérifiez vos informations et réessayez.' };
  }

  if (needsConsent) {
    // Best-effort: a failure here only means the one-time modal (§7) asks again on the next visit.
    try {
      await supabase.rpc('record_consent', { p_kind: 'cgu_non_circumvention', p_version: NON_CIRCUMVENTION_VERSION });
    } catch {
      /* the (app) layout modal covers it */
    }
  }

  // Sign-up attribution (plan §4.7): record once where this account came from — the source and
  // referrer handle /auth stored in the sign-up metadata (URL-only, council C4). Best-effort by
  // design: insert-once, lenient server-side, and its errors never block onboarding.
  try {
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const ref = parseRefHandle(meta.ref);
    const source = effectiveSource(parseSignupSource(meta.signup_source), ref) ?? 'direct';
    await supabase.rpc('record_signup_attribution', { p_source: source, p_referrer_handle: ref ?? undefined });
  } catch {
    /* ignored on purpose */
  }

  // Keep the sign-up return path: /onboarding/done turns it into « Continuer » (re-validated there).
  redirect(withNext('/onboarding/done', formData.get('next')));
}
