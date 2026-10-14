'use server';

import { createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getDictionary } from '@/i18n/dictionaries';
import { getSession } from '@/lib/auth/session';

export type ApplyState = { error: string | null; ok?: boolean };
export type ProofState = { error: string | null; ok?: boolean };

/**
 * Creator applies to a published campaign. Authorization (creator role, active status, campaign open,
 * no double-apply) all lives inside the apply_to_campaign RPC (self-scoped to auth.uid()); this action
 * only relays the caller's session. The DB is the boundary, never a client-trusted check.
 */
export async function applyAction(_prev: ApplyState, formData: FormData): Promise<ApplyState> {
  const { t } = await getDictionary();
  const e = t.applyCta.errors;
  const campaign = String(formData.get('campaign') ?? '');
  if (!campaign) return { error: e.missing };

  const supabase = await createClient();
  const { error } = await supabase.rpc('apply_to_campaign', { p_campaign_id: campaign });

  if (error) {
    const msg = (error.message ?? '').trim();
    if (msg === 'not_a_creator') return { error: e.notCreator };
    if (msg === 'profile_not_eligible') return { error: e.notEligible };
    if (msg === 'already_applied') return { error: e.alreadyApplied };
    if (msg === 'campaign_not_open') return { error: e.notOpen };
    if (msg === 'campaign_not_found') return { error: e.notFound };
    return { error: e.generic };
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
    if (msg === 'campaign_not_funded') return { error: "Le séquestre de cette campagne n'est pas actif — contactez la marque." };
    if (msg === 'escrow_pool_exceeded') return { error: 'Le budget de cette campagne est épuisé — contactez la marque.' };
    return { error: 'La soumission a échoué. Réessayez.' };
  }

  revalidatePath('/creator/dashboard');
  return { error: null, ok: true };
}

export type ShotInput = { path: string; sha256: string };

/**
 * G8 (low priority, P6): submit the WhatsApp screenshots already uploaded to the private `proofs`
 * bucket. First submission goes through the existing money path (submit_proof_of_post inside the RPC);
 * after « Demander une nouvelle capture » the same proof gets a new round.
 */
export async function submitWhatsappProofAction(cc: string, posted: ShotInput, views: ShotInput, extra: ShotInput | null): Promise<ProofState> {
  const { t } = await getDictionary();
  const E = t.proofShots.errors as Record<string, string>;
  if (!posted?.path || !views?.path) return { error: E.screenshots_required! };
  if (posted.sha256 === views.sha256) return { error: t.proofShots.identicalClient };
  const supabase = await createClient();
  const { error } = await supabase.rpc('creator_submit_whatsapp_proof', {
    p_campaign_creator_id: cc,
    p_posted_path: posted.path, p_posted_sha256: posted.sha256,
    p_views_path: views.path, p_views_sha256: views.sha256,
    p_extra_path: extra?.path || undefined, p_extra_sha256: extra?.sha256 || undefined,
  });
  if (error) return { error: E[(error.message ?? '').trim()] ?? E.generic! };
  revalidatePath('/creator/dashboard');
  return { error: null, ok: true };
}
