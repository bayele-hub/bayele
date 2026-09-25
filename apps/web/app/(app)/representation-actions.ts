'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { parseCommissionPct, COMMISSION_MIN_PCT, COMMISSION_MAX_PCT } from '@/lib/founder';

/**
 * Managed-creator actions (migration 0027). Every rule — consent, exclusivity, rate bounds, who may
 * do what — lives in the SECURITY DEFINER RPCs; these actions only relay the caller's session and
 * turn the RPC error codes into French messages.
 */

export type RepState = { error: string | null; ok?: boolean };

const ERRORS: Record<string, string> = {
  not_authenticated: 'Connectez-vous pour continuer.',
  not_authorized: "Vous n'êtes pas autorisé.",
  not_a_partner: 'Réservé aux partenaires Bayele.',
  partner_not_active: 'Votre compte partenaire doit être validé avant de représenter des créateurs.',
  invalid_commission_rate: `La commission doit être comprise entre ${COMMISSION_MIN_PCT} et ${COMMISSION_MAX_PCT} %.`,
  message_too_long: 'Le message est trop long (500 caractères maximum).',
  creator_not_found: 'Aucun créateur avec ce nom d’utilisateur.',
  cannot_represent_self: 'Vous ne pouvez pas vous représenter vous-même.',
  creator_not_eligible: "Ce créateur n'est pas éligible pour le moment.",
  already_representing: 'Vous représentez déjà ce créateur.',
  creator_already_represented: 'Ce créateur est déjà représenté par un partenaire.',
  invite_already_pending: 'Une proposition est déjà en attente pour ce créateur.',
  too_many_pending_invites: 'Trop de propositions en attente. Attendez quelques réponses.',
  link_not_found: 'Proposition introuvable.',
  not_pending: 'Cette proposition a déjà reçu une réponse.',
  use_respond: 'Répondez à la proposition avec Accepter ou Refuser.',
  not_representing: 'Vous ne représentez pas (ou plus) ce créateur.',
  profile_not_eligible: "Le compte de ce créateur n'est pas éligible pour postuler.",
  campaign_not_found: 'Campagne introuvable.',
  cannot_apply_own_campaign: 'Impossible de postuler à votre propre campagne.',
  campaign_not_open: "Cette campagne n'accepte plus de candidatures.",
  already_applied: 'Ce créateur a déjà postulé à cette campagne.',
};

function fail(error: { message?: string } | null, fallback: string): RepState {
  const code = (error?.message ?? '').trim();
  return { error: ERRORS[code] ?? fallback };
}

function refresh() {
  revalidatePath('/partner/creators');
  revalidatePath('/partner/dashboard');
  revalidatePath('/partner/campaigns');
  revalidatePath('/creator/partner');
  revalidatePath('/creator/dashboard');
}

/** Partner → creator: propose to represent them. */
export async function inviteCreatorAction(_prev: RepState, formData: FormData): Promise<RepState> {
  const handle = String(formData.get('handle') ?? '').trim();
  const rate = parseCommissionPct(String(formData.get('rate') ?? ''));
  const message = String(formData.get('message') ?? '').trim();
  if (!handle) return { error: 'Indiquez le nom d’utilisateur du créateur.' };
  if (rate === null) return { error: ERRORS.invalid_commission_rate! };
  if (message.length > 500) return { error: ERRORS.message_too_long! };

  const supabase = await createClient();
  const { error } = await supabase.rpc('partner_invite_creator', {
    p_creator_handle: handle,
    p_commission_rate: rate,
    p_message: message || undefined,
  });
  if (error) return fail(error, "L'envoi de la proposition a échoué. Réessayez.");
  refresh();
  return { error: null, ok: true };
}

/** Creator: accept or decline a pending offer. */
export async function respondRepresentationAction(_prev: RepState, formData: FormData): Promise<RepState> {
  const link = String(formData.get('link') ?? '');
  const accept = String(formData.get('accept') ?? '') === 'true';
  if (!link) return { error: 'Proposition manquante.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('respond_representation', { p_link_id: link, p_accept: accept });
  if (error) return fail(error, 'La réponse a échoué. Réessayez.');
  refresh();
  return { error: null, ok: true };
}

/** Either side: end an active representation; the partner can also withdraw a pending offer. */
export async function endRepresentationAction(_prev: RepState, formData: FormData): Promise<RepState> {
  const link = String(formData.get('link') ?? '');
  if (!link) return { error: 'Représentation manquante.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('end_representation', { p_link_id: link });
  if (error) return fail(error, "L'opération a échoué. Réessayez.");
  refresh();
  return { error: null, ok: true };
}

/** Partner: apply to an open campaign on behalf of a represented creator. */
export async function applyForCreatorAction(_prev: RepState, formData: FormData): Promise<RepState> {
  const campaign = String(formData.get('campaign') ?? '');
  const creator = String(formData.get('creator') ?? '');
  if (!campaign) return { error: 'Campagne manquante.' };
  if (!creator) return { error: 'Choisissez un créateur.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('partner_apply_for_creator', { p_campaign_id: campaign, p_creator_id: creator });
  if (error) return fail(error, 'La candidature a échoué. Réessayez.');
  refresh();
  return { error: null, ok: true };
}
