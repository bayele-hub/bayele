'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@bayele/database';

type Provider = Database['public']['Enums']['payment_provider'];

export type PayoutState = { error: string | null; ok?: boolean };

const PROVIDERS: Provider[] = ['mtn_momo', 'orange_money', 'wave', 'airtel_money', 'bank_wire'];

/**
 * Admin confirms the outbound Mobile Money disbursement for a verified creator (ADR-001 — the launch
 * bridge until a disbursement webhook exists). Authorization + idempotency live in the
 * admin_confirm_creator_payout RPC (private.is_admin, no-op if already paid_out); this relays session.
 */
export async function payoutAction(_prev: PayoutState, formData: FormData): Promise<PayoutState> {
  const cc = String(formData.get('cc') ?? '');
  const ref = String(formData.get('ref') ?? '').trim();
  const providerRaw = String(formData.get('provider') ?? 'mtn_momo') as Provider;
  const provider: Provider = PROVIDERS.includes(providerRaw) ? providerRaw : 'mtn_momo';

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
