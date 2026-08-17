'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@bayele/database';

type Status = Database['public']['Enums']['account_status'];

export type ModerateState = { error: string | null; ok?: string };

const ALLOWED: Status[] = ['active', 'rejected', 'suspended'];

/**
 * Admin approve/reject/suspend. Authorization is enforced inside the moderate_profile RPC
 * (private.is_admin(auth.uid())); this action just relays the caller's session. A non-admin who
 * somehow reaches it gets 'not_authorized' from the database, not a client-trusted check.
 */
export async function moderateAction(_prev: ModerateState, formData: FormData): Promise<ModerateState> {
  const target = String(formData.get('target') ?? '');
  const status = String(formData.get('status') ?? '') as Status;
  if (!target) return { error: 'Profil cible manquant.' };
  if (!ALLOWED.includes(status)) return { error: 'Action invalide.' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('moderate_profile', { p_target: target, p_status: status });

  if (error) {
    const msg = (error.message ?? '').trim();
    if (msg === 'not_authorized') return { error: "Vous n'êtes pas autorisé à modérer les profils." };
    return { error: 'La modération a échoué. Réessayez.' };
  }

  revalidatePath('/admin/dashboard');
  revalidatePath('/admin/moderation');
  revalidatePath('/admin/users');
  return { error: null, ok: status === 'active' ? 'approved' : status };
}
