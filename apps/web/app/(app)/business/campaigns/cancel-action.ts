'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type CancelState = { error: string | null };

/**
 * Business (or admin) cancels its own UNFUNDED campaign. Authorization + the "no cancel once funded"
 * rule live in the cancel_campaign RPC (auth.uid() = owner OR is_admin; refuses with
 * 'campaign_funded_use_refund' the moment any escrow exists). On success we redirect to the dashboard.
 */
export async function cancelCampaignAction(_prev: CancelState, formData: FormData): Promise<CancelState> {
  const id = String(formData.get('campaign') ?? '');
  if (!id) return { error: 'Campagne manquante.' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('cancel_campaign', { p_campaign_id: id });

  if (error) {
    const msg = (error.message ?? '').trim();
    if (msg === 'not_authorized') return { error: "Vous n'êtes pas autorisé." };
    if (msg === 'campaign_not_found') return { error: 'Campagne introuvable.' };
    if (msg === 'campaign_funded_use_refund')
      return { error: 'Cette campagne est financée — contactez le support pour un remboursement du séquestre.' };
    return { error: "L'annulation a échoué. Réessayez." };
  }

  revalidatePath('/business/dashboard');
  redirect('/business/dashboard');
}
