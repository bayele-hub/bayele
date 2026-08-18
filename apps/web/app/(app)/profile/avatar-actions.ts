'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';

export type AvatarState = { error: string | null; ok?: boolean };

// Persist (or clear) the caller's profile photo URL. The image itself is uploaded to the owner-scoped
// `avatars` storage bucket client-side; this only writes the resulting public URL onto profiles,
// scoped to auth.uid(). We accept only a URL from our own avatars bucket (or null to remove).
export async function updateAvatarAction(avatarUrl: string | null): Promise<AvatarState> {
  const session = await getSession();
  if (!session.userId) redirect('/auth?mode=signin');

  if (avatarUrl !== null) {
    if (typeof avatarUrl !== 'string' || !/\/storage\/v1\/object\/public\/avatars\//.test(avatarUrl)) {
      return { error: 'URL de photo invalide.' };
    }
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
    .eq('id', session.userId);
  if (error) return { error: 'La mise à jour de la photo a échoué. Réessayez.' };

  revalidatePath('/profile');
  revalidatePath('/creator/dashboard');
  revalidatePath('/consultant/dashboard');
  revalidatePath('/business/dashboard');
  return { error: null, ok: true };
}
