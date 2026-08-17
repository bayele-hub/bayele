'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@bayele/database';

type RetainerStatus = Database['public']['Enums']['retainer_status'];

export type AdminRetainerState = { error: string | null; ok?: boolean };

const TRANSITIONS: RetainerStatus[] = ['active', 'completed', 'terminated'];

/** Admin confirms the retainer invoice was paid (MoMo bridge) → funded. Idempotent in the RPC. */
export async function fundRetainerAction(_prev: AdminRetainerState, formData: FormData): Promise<AdminRetainerState> {
  const id = String(formData.get('retainer') ?? '');
  const receipt = String(formData.get('receipt') ?? '').trim() || undefined;
  if (!id) return { error: 'Rétainer manquant.' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_confirm_retainer_funding', {
    p_retainer_id: id,
    p_sokoclick_receipt_id: receipt,
  });

  if (error) {
    const msg = (error.message ?? '').trim();
    if (msg === 'not_authorized') return { error: "Vous n'êtes pas autorisé." };
    if (msg === 'not_invoiced') return { error: "Ce rétainer n'a pas encore de facture." };
    return { error: 'La confirmation a échoué. Réessayez.' };
  }

  revalidatePath('/admin/retainers');
  return { error: null, ok: true };
}

/** Admin advances the retainer lifecycle (funded→active, active→completed) or terminates it. */
export async function retainerTransitionAction(_prev: AdminRetainerState, formData: FormData): Promise<AdminRetainerState> {
  const id = String(formData.get('retainer') ?? '');
  const to = String(formData.get('to') ?? '') as RetainerStatus;
  if (!id) return { error: 'Rétainer manquant.' };
  if (!TRANSITIONS.includes(to)) return { error: 'Transition invalide.' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('transition_retainer', { p_retainer_id: id, p_to_status: to });

  if (error) {
    const msg = (error.message ?? '').trim();
    if (msg === 'not_authorized') return { error: "Vous n'êtes pas autorisé." };
    if (msg === 'illegal_retainer_transition') return { error: 'Transition non permise depuis cet état.' };
    return { error: "L'action a échoué. Réessayez." };
  }

  revalidatePath('/admin/retainers');
  return { error: null, ok: true };
}
