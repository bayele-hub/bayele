'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@bayele/database';

type Role = Database['public']['Enums']['user_role'];
type Country = Database['public']['Enums']['country_code'];
type OnboardPlatforms = Database['public']['Functions']['onboard_profile']['Args']['p_platforms'];

const ROLES: Role[] = ['creator', 'consultant', 'business'];
const COUNTRIES: Country[] = ['CM', 'CI', 'GA'];
const ONBOARD_SOCIALS = ['whatsapp', 'instagram', 'tiktok', 'youtube'] as const;

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

export type OnboardState = { error: string | null };

export async function onboardAction(_prev: OnboardState, formData: FormData): Promise<OnboardState> {
  const role = String(formData.get('role') ?? '') as Role;
  if (!ROLES.includes(role)) return { error: 'Rôle invalide.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth?mode=signin');

  const countryRaw = String(formData.get('country') ?? 'CM') as Country;
  const country: Country = COUNTRIES.includes(countryRaw) ? countryRaw : 'CM';

  const csv = (k: string) =>
    String(formData.get(k) ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  const opt = (k: string) => {
    const v = String(formData.get(k) ?? '').trim();
    return v.length ? v : undefined;
  };

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
    p_city: String(formData.get('city') ?? ''),
    p_country: country,
    p_bio: opt('bio'),
    p_categories: csv('categories'),
    p_audience_size: Number(formData.get('audience_size') ?? 0) || 0,
    p_platforms: platforms as unknown as OnboardPlatforms,
    p_specialties: csv('specialties'),
    p_years_experience: Number(formData.get('years_experience') ?? 0) || 0,
    p_company_name: opt('company_name'),
    p_industry: opt('industry'),
    p_billing_email: opt('billing_email'),
  });

  if (error) {
    const key = (error.message ?? '').trim();
    return { error: ERR_FR[key] ?? 'Une erreur est survenue. Vérifiez vos informations et réessayez.' };
  }

  redirect('/onboarding/done');
}
