'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type DecideState = { error: string | null; ok?: boolean };
export type ReviewState = { error: string | null; ok?: boolean };

/**
 * Owner (or admin) approves/rejects a creator application. Authorization + capacity are enforced in
 * the decide_application RPC (owner_id = auth.uid() OR private.is_admin); this relays the session.
 */
export async function decideAction(_prev: DecideState, formData: FormData): Promise<DecideState> {
  const cc = String(formData.get('cc') ?? '');
  const approve = String(formData.get('decision') ?? '') === 'approve';
  if (!cc) return { error: 'Candidature manquante.' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('decide_application', { p_campaign_creator_id: cc, p_approve: approve });

  if (error) {
    const msg = (error.message ?? '').trim();
    if (msg === 'not_authorized') return { error: "Vous n'êtes pas autorisé." };
    if (msg === 'campaign_full') return { error: 'Le nombre de créateurs visé est déjà atteint.' };
    if (msg === 'not_pending') return { error: 'Cette candidature a déjà été traitée.' };
    return { error: 'Action impossible. Réessayez.' };
  }

  revalidatePath('/business/campaigns/[id]', 'page');
  return { error: null, ok: true };
}

/**
 * Owner (or admin) verifies/rejects a submitted proof. The review_proof RPC wraps verify_proof_of_post,
 * which self-authorizes owner/admin and moves the escrow proof_pending → releasable on approval.
 */
export async function reviewProofAction(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  const proof = String(formData.get('proof') ?? '');
  const approve = String(formData.get('decision') ?? '') === 'approve';
  const reason = String(formData.get('reason') ?? '').trim() || null;
  if (!proof) return { error: 'Preuve manquante.' };
  if (!approve && !reason) return { error: 'Indiquez un motif de refus.' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('review_proof', {
    p_proof_id: proof,
    p_approve: approve,
    p_reason: reason ?? undefined,
  });

  if (error) {
    const msg = (error.message ?? '').trim();
    if (msg.includes('not authorized')) return { error: "Vous n'êtes pas autorisé à vérifier cette preuve." };
    return { error: 'La vérification a échoué. Réessayez.' };
  }

  revalidatePath('/business/campaigns/[id]', 'page');
  return { error: null, ok: true };
}
