'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import type { Database } from '@bayele/database';
import { parseCountry } from '@/lib/countries';
import { parseProvider } from '@/lib/data/campaigns';
import { getDictionary } from '@/i18n/dictionaries';
import { checkProfileText, cleanText, limitErrorField, parseAudience, type LimitedField } from '@/lib/profile-limits';

type Provider = Database['public']['Enums']['payment_provider'];
type Country = Database['public']['Enums']['country_code'];
type CreatorPlatforms = Database['public']['Tables']['creator_profiles']['Update']['platforms'];

export type ProfileState = { error: string | null; ok?: boolean; field?: LimitedField | null };


// Normalize a Mobile-Money number to E.164 (strip spaces/dashes/parens). Returns the normalized
// string, or null for empty. Throws a sentinel for a non-empty but malformed number.
function normalizeMomo(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const compact = trimmed.replace(/[\s().-]/g, '');
  if (!/^\+[1-9]\d{7,14}$/.test(compact)) throw new Error('invalid_momo');
  return compact;
}
const SOCIAL_PLATFORMS = ['whatsapp', 'instagram', 'tiktok', 'youtube', 'facebook', 'x', 'snapchat', 'telegram', 'linkedin'] as const;

function parseList(v: FormDataEntryValue | null): string[] {
  return String(v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12);
}

/**
 * Self-service profile update. RLS is the boundary: the base `profiles` UPDATE policy and the role
 * "manage own" policies only permit a user to write their OWN row (auth.uid() = id / user_id), so we
 * never trust a client-supplied id — every write is scoped by the session user id. Roles are re-derived
 * server-side (never from the form) to decide which role table to touch.
 */
export async function updateProfileAction(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const session = await getSession();
  if (!session.userId) redirect('/auth?mode=signin');

  const { t } = await getDictionary();
  const FE = t.creatorForm.errors;
  const displayName = cleanText(formData.get('display_name'));
  const bio = String(formData.get('bio') ?? '').trim();
  const city = cleanText(formData.get('city'));
  // D5 limits (same as the 0036 CHECKs) → a clear field error instead of a generic failure.
  const msgFor = (field: LimitedField, kind: 'required' | 'tooLong'): string =>
    field === 'city' ? (kind === 'required' ? FE.cityRequired : FE.city) : field === 'displayName' ? (kind === 'required' ? FE.displayNameRequired : FE.displayName) : FE.bio;
  const problems = checkProfileText({ displayName, city, bio });
  const firstBad = (['displayName', 'city', 'bio'] as const).find((k) => problems[k]);
  if (firstBad) return { error: msgFor(firstBad, problems[firstBad]!), field: firstBad };
  const country: Country = parseCountry(formData.get('country'));

  const supabase = await createClient();

  const { error: pErr } = await supabase
    .from('profiles')
    .update({ display_name: displayName, bio: bio || null, city, country, updated_at: new Date().toISOString() })
    .eq('id', session.userId);
  if (pErr) {
    // 23514 on a grandfathered row (old value over the limit): the constraint name says which field.
    const field = limitErrorField(pErr.message);
    if (field) return { error: msgFor(field, 'tooLong'), field };
    return { error: 'La mise à jour a échoué. Réessayez.' };
  }

  if (session.roles.includes('creator')) {
    const momoProvider: Provider = parseProvider(formData.get('momo_provider'));

    let momoPhone: string | null;
    try {
      momoPhone = normalizeMomo(String(formData.get('momo_phone') ?? ''));
    } catch {
      return { error: 'Numéro Mobile Money invalide. Utilisez le format international, ex. +2376XXXXXXXX.' };
    }

    // Build the platforms JSON from the per-network URL + followers fields (empty URLs are dropped).
    const platforms: Record<string, { url: string; followers: number }> = {};
    for (const p of SOCIAL_PLATFORMS) {
      const url = String(formData.get(`soc_${p}_url`) ?? '').trim();
      if (!url) continue;
      platforms[p] = { url, followers: Math.max(0, Math.round(Number(formData.get(`soc_${p}_followers`) ?? 0))) };
    }
    // AR-1: the typed audience; blank/missing keeps the stored value (never replaced by the followers sum).
    const audience = parseAudience(formData.get('audience_size'));

    const { error } = await supabase
      .from('creator_profiles')
      .update({
        categories: parseList(formData.get('categories')),
        ...(audience === null ? {} : { audience_size: audience }),
        momo_payout_phone_e164: momoPhone,
        momo_provider: momoProvider,
        platforms: platforms as unknown as CreatorPlatforms,
      })
      .eq('user_id', session.userId);
    if (error) return { error: 'Profil créateur : mise à jour impossible.' };
  }

  if (session.roles.includes('consultant')) {
    const partnerProvider: Provider = parseProvider(formData.get('partner_momo_provider'));
    let partnerPhone: string | null;
    try {
      partnerPhone = normalizeMomo(String(formData.get('partner_momo_phone') ?? ''));
    } catch {
      return { error: 'Numéro Mobile Money invalide. Utilisez le format international, ex. +2376XXXXXXXX.' };
    }
    const { error } = await supabase
      .from('consultant_profiles')
      .update({
        specialties: parseList(formData.get('specialties')),
        years_experience: Math.max(0, Math.round(Number(formData.get('years_experience') ?? 0))),
        momo_payout_phone_e164: partnerPhone,
        momo_provider: partnerProvider,
      })
      .eq('user_id', session.userId);
    if (error) return { error: 'Profil partenaire : mise à jour impossible.' };
  }

  if (session.roles.includes('business')) {
    const company = String(formData.get('company_name') ?? '').trim();
    const industry = String(formData.get('industry') ?? '').trim();
    if (!company) return { error: "Le nom de l'entreprise est requis." };
    if (!industry) return { error: "Le secteur d'activité est requis." };
    const { error } = await supabase
      .from('business_profiles')
      .update({
        company_name: company,
        industry,
        billing_email: String(formData.get('billing_email') ?? '').trim() || null,
        website: String(formData.get('website') ?? '').trim() || null,
      })
      .eq('user_id', session.userId);
    if (error) return { error: 'Profil entreprise : mise à jour impossible.' };
  }

  revalidatePath('/profile');
  revalidatePath('/creator/dashboard');
  revalidatePath('/creator/wallet');
  revalidatePath('/partner/dashboard');
  revalidatePath('/partner/creators');
  revalidatePath('/business/dashboard');
  return { error: null, ok: true };
}
