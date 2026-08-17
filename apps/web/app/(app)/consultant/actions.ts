'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type RetainerActionState = { error: string | null; ok?: boolean };

/**
 * Consultant declines (terminates) a retainer they were offered or hold. Authorization + the legal
 * hop matrix live in transition_retainer (party-or-admin for 'terminated'); this relays the session.
 */
export async function declineRetainerAction(_prev: RetainerActionState, formData: FormData): Promise<RetainerActionState> {
  const id = String(formData.get('retainer') ?? '');
  if (!id) return { error: 'Rétainer manquant.' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('transition_retainer', { p_retainer_id: id, p_to_status: 'terminated' });

  if (error) {
    const msg = (error.message ?? '').trim();
    if (msg === 'not_authorized') return { error: "Vous n'êtes pas autorisé." };
    if (msg === 'illegal_retainer_transition') return { error: 'Ce contrat ne peut plus être annulé.' };
    return { error: "L'annulation a échoué. Réessayez." };
  }

  revalidatePath('/consultant/dashboard');
  return { error: null, ok: true };
}
