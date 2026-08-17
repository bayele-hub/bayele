'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import type { Database } from '@bayele/database';

type Provider = Database['public']['Enums']['payment_provider'];

export type ProfileState = { error: string | null; ok?: boolean };

const PROVIDERS: Provider[] = ['mtn_momo', 'orange_money', 'wave', 'airtel_money', 'bank_wire'];

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

  const displayName = String(formData.get('display_name') ?? '').trim();
  const bio = String(formData.get('bio') ?? '').trim();
  const city = String(formData.get('city') ?? '').trim();
  if (!displayName) return { error: 'Le nom est requis.' };
  if (!city) return { error: 'La ville est requise.' };

  const supabase = await createClient();

  const { error: pErr } = await supabase
    .from('profiles')
    .update({ display_name: displayName, bio: bio || null, city, updated_at: new Date().toISOString() })
    .eq('id', session.userId);
  if (pErr) return { error: 'La mise à jour a échoué. Réessayez.' };

  if (session.roles.includes('creator')) {
    const providerRaw = String(formData.get('momo_provider') ?? 'mtn_momo') as Provider;
    const momoProvider: Provider = PROVIDERS.includes(providerRaw) ? providerRaw : 'mtn_momo';
    const { error } = await supabase
      .from('creator_profiles')
      .update({
        categories: parseList(formData.get('categories')),
        audience_size: Math.max(0, Math.round(Number(formData.get('audience_size') ?? 0))),
        momo_payout_phone_e164: String(formData.get('momo_phone') ?? '').trim() || null,
        momo_provider: momoProvider,
      })
      .eq('user_id', session.userId);
    if (error) return { error: 'Profil créateur : mise à jour impossible.' };
  }

  if (session.roles.includes('consultant')) {
    const { error } = await supabase
      .from('consultant_profiles')
      .update({
        specialties: parseList(formData.get('specialties')),
        years_experience: Math.max(0, Math.round(Number(formData.get('years_experience') ?? 0))),
      })
      .eq('user_id', session.userId);
    if (error) return { error: 'Profil consultant : mise à jour impossible.' };
  }

  revalidatePath('/profile');
  revalidatePath('/creator/dashboard');
  revalidatePath('/creator/wallet');
  revalidatePath('/consultant/dashboard');
  return { error: null, ok: true };
}
