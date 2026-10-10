'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@bayele/database';
import { parseProvider } from '@/lib/data/campaigns';

type Provider = Database['public']['Enums']['payment_provider'];

export type PayoutState = { error: string | null; ok?: boolean };


/**
 * Admin confirms the outbound Mobile Money disbursement for a verified creator (ADR-001 — the launch
 * bridge until a disbursement webhook exists). Authorization + idempotency live in the
 * admin_confirm_creator_payout RPC (private.is_admin, no-op if already paid_out); this relays session.
 */
export async function payoutAction(_prev: PayoutState, formData: FormData): Promise<PayoutState> {
  const cc = String(formData.get('cc') ?? '');
  const ref = String(formData.get('ref') ?? '').trim();
  const provider: Provider = parseProvider(formData.get('provider'));

  if (!cc) return { error: 'Assignation manquante.' };
  if (!ref) return { error: 'Référence de décaissement requise.' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_confirm_creator_payout', {
    p_campaign_creator_id: cc,
    p_provider: provider,
    p_disbursement_ref: ref,
  });

  if (error) {
    const msg = (error.message ?? '').trim();
    if (msg === 'not_authorized') return { error: "Vous n'êtes pas autorisé." };
    if (msg === 'payout_not_releasable') return { error: "Ce paiement n'est pas encore prêt à décaisser." };
    if (msg === 'no_payout_txn') return { error: 'Aucune transaction de paiement trouvée.' };
    return { error: 'La confirmation a échoué. Réessayez.' };
  }

  revalidatePath('/admin/dashboard');
  revalidatePath('/admin/payouts'); // clear the paid-out row from its own queue
  return { error: null, ok: true };
}

/**
 * Admin confirms a partner commission was disbursed (managed creators, migration 0027). Authorization,
 * the required reference and idempotency live in admin_confirm_partner_commission.
 */
export async function commissionPayoutAction(_prev: PayoutState, formData: FormData): Promise<PayoutState> {
  const id = String(formData.get('commission') ?? '');
  const ref = String(formData.get('ref') ?? '').trim();
  const provider: Provider = parseProvider(formData.get('provider'));

  if (!id) return { error: 'Commission manquante.' };
  if (!ref) return { error: 'Référence de décaissement requise.' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_confirm_partner_commission', {
    p_commission_id: id,
    p_provider: provider,
    p_disbursement_ref: ref,
  });

  if (error) {
    const msg = (error.message ?? '').trim();
    if (msg === 'not_authorized') return { error: "Vous n'êtes pas autorisé." };
    if (msg === 'commission_not_found') return { error: 'Commission introuvable.' };
    if (msg === 'ref_required') return { error: 'Référence de décaissement requise.' };
    return { error: 'La confirmation a échoué. Réessayez.' };
  }

  revalidatePath('/admin/payouts');
  return { error: null, ok: true };
}
