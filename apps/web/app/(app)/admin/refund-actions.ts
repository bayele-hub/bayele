'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type RefundState = { error: string | null; ok?: boolean };

/**
 * Admin refunds a funded campaign's escrow back to the business and cancels it. Authorization +
 * all money movement live in the admin_refund_campaign RPC (private.is_admin, transition_escrow);
 * this only relays the caller's session. The RPC is idempotent and refuses once any creator has
 * been paid out ('partial_payouts_present'), so a double-submit never double-refunds.
 */
export async function refundCampaignAction(_prev: RefundState, formData: FormData): Promise<RefundState> {
  const campaign = String(formData.get('campaign') ?? '');
  const receipt = String(formData.get('receipt') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim();

  if (!campaign) return { error: 'Campagne manquante.' };
  if (!reason) return { error: 'Un motif de remboursement est requis.' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_refund_campaign', {
    p_campaign_id: campaign,
    p_sokoclick_receipt_id: receipt || undefined,
    p_reason: reason,
  });

  if (error) {
    const msg = (error.message ?? '').trim();
    if (msg === 'not_authorized') return { error: "Vous n'êtes pas autorisé." };
    if (msg === 'campaign_not_found') return { error: 'Campagne introuvable.' };
    if (msg === 'campaign_not_funded') return { error: "Cette campagne n'a pas de séquestre à rembourser." };
    if (msg === 'partial_payouts_present')
      return { error: 'Un créateur a déjà été payé — remboursement partiel non pris en charge (traitement manuel).' };
    if (msg === 'inbound_not_refundable') return { error: 'Le séquestre de cette campagne ne peut pas être remboursé.' };
    return { error: 'Le remboursement a échoué. Réessayez.' };
  }

  revalidatePath('/admin/disputes');
  revalidatePath('/admin/ledger');
  revalidatePath('/admin/dashboard');
  return { error: null, ok: true };
}
