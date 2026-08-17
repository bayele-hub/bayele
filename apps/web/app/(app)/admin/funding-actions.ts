'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@bayele/database';

type Provider = Database['public']['Enums']['payment_provider'];

export type FundState = { error: string | null; ok?: boolean };

const PROVIDERS: Provider[] = ['mtn_momo', 'orange_money', 'wave', 'airtel_money', 'bank_wire'];

/**
 * Admin confirms an inbound Mobile Money collection for a campaign (ADR-001). Authorization lives in
 * the admin_confirm_campaign_funding RPC (private.is_admin); this relays the caller's session.
 * The RPC is idempotent on the SokoClick invoice id, so a double-submit never double-funds.
 */
export async function fundCampaignAction(_prev: FundState, formData: FormData): Promise<FundState> {
  const campaign = String(formData.get('campaign') ?? '');
  const invoice = String(formData.get('invoice') ?? '').trim();
  const providerRaw = String(formData.get('provider') ?? 'mtn_momo') as Provider;
  const provider: Provider = PROVIDERS.includes(providerRaw) ? providerRaw : 'mtn_momo';

  if (!campaign) return { error: 'Campagne manquante.' };
  if (!invoice) return { error: 'Référence de facture SokoClick / MoMo requise.' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_confirm_campaign_funding', {
    p_campaign_id: campaign,
    p_sokoclick_invoice_id: invoice,
    p_provider: provider,
  });

  if (error) {
    const msg = (error.message ?? '').trim();
    if (msg === 'not_authorized') return { error: "Vous n'êtes pas autorisé." };
    if (msg === 'campaign_not_fundable') return { error: 'Cette campagne est déjà financée.' };
    return { error: 'La confirmation a échoué. Réessayez.' };
  }

  revalidatePath('/admin/dashboard');
  return { error: null, ok: true };
}
