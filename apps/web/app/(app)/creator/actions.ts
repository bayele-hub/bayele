'use server';

import { createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';

export type ApplyState = { error: string | null; ok?: boolean };
export type ProofState = { error: string | null; ok?: boolean };

/**
 * Creator applies to a published campaign. Authorization (creator role, active status, campaign open,
 * no double-apply) all lives inside the apply_to_campaign RPC (self-scoped to auth.uid()); this action
 * only relays the caller's session. The DB is the boundary, never a client-trusted check.
 */
export async function applyAction(_prev: ApplyState, formData: FormData): Promise<ApplyState> {
  const campaign = String(formData.get('campaign') ?? '');
  if (!campaign) return { error: 'Campagne manquante.' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('apply_to_campaign', { p_campaign_id: campaign });

  if (error) {
    const msg = (error.message ?? '').trim();
    if (msg === 'not_a_creator') return { error: 'Seuls les créateurs peuvent postuler.' };
    if (msg === 'profile_not_active') return { error: 'Votre profil doit être validé avant de postuler.' };
    if (msg === 'already_applied') return { error: 'Vous avez déjà postulé à cette campagne.' };
    if (msg === 'campaign_not_open') return { error: "Cette campagne n'accepte plus de candidatures." };
    if (msg === 'campaign_not_found') return { error: 'Campagne introuvable.' };
    return { error: 'La candidature a échoué. Réessayez.' };
  }

  revalidatePath('/creator/campaigns');
  revalidatePath('/creator/dashboard');
  return { error: null, ok: true };
}

/**
 * Creator submits proof-of-post for an approved assignment. The post URL is the proof medium (v1 —
 * media upload/Gemini scoring lands later); we compute its sha256 here so the DB stays free of an
 * extension dependency, and the creator_submit_proof RPC earmarks the payout from the escrow pool.
 */
export async function submitProofAction(_prev: ProofState, formData: FormData): Promise<ProofState> {
  const session = await getSession();
  if (!session.userId) redirect('/auth?mode=signin');

  const cc = String(formData.get('cc') ?? '');
  const url = String(formData.get('url') ?? '').trim();
  if (!cc) return { error: 'Assignation manquante.' };
  if (!url) return { error: 'Collez le lien de votre publication.' };
  if (!/^https?:\/\//i.test(url)) return { error: 'Entrez une URL valide (https://…).' };

  const sha256 = createHash('sha256').update(url).digest('hex');

  const supabase = await createClient();
  const { error } = await supabase.rpc('creator_submit_proof', {
    p_campaign_creator_id: cc,
    p_post_url: url,
    p_media_sha256: sha256,
    p_media_type: 'url',
  });

  if (error) {
    const msg = (error.message ?? '').trim();
    if (msg === 'not_authorized') return { error: "Cette assignation ne vous appartient pas." };
    if (msg === 'not_approved') return { error: "Votre candidature n'est pas encore acceptée." };
    if (msg === 'already_submitted') return { error: 'Une preuve a déjà été soumise.' };
    return { error: 'La soumission a échoué. Réessayez.' };
  }

  revalidatePath('/creator/dashboard');
  return { error: null, ok: true };
}
