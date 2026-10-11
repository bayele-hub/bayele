'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@bayele/database';
import { getDictionary } from '@/i18n/dictionaries';
import { parseProvider } from '@/lib/data/campaigns';
import { confirmFunding, type FundingClient, type FundResult } from '@/lib/funding';

type Provider = Database['public']['Enums']['payment_provider'];

export type FundState = FundResult;

/**
 * Admin confirms an inbound Mobile Money collection for a campaign (ADR-001). Authorization lives in
 * the admin_confirm_campaign_funding RPC (private.is_admin); this relays the caller's session.
 * Idempotency is per campaign since 0034: a ref already used by another campaign raises
 * `invoice_already_used`. ok:true only when the re-read status is published / in_progress (F3).
 */
export async function fundCampaignAction(_prev: FundState, formData: FormData): Promise<FundState> {
  const { t } = await getDictionary();
  const provider: Provider = parseProvider(formData.get('provider'));
  const supabase = await createClient();
  const result = await confirmFunding(
    supabase as unknown as FundingClient,
    { campaign: String(formData.get('campaign') ?? ''), invoice: String(formData.get('invoice') ?? '').trim(), provider },
    t.admin.briefs.funding.errors,
  );
  if (!result.ok) return result;

  revalidatePath('/admin/dashboard');
  revalidatePath('/admin/funding'); // the just-funded campaign must leave its own queue too
  revalidatePath('/admin/briefs'); // a managed brief moves to « Publiée » (trigger)
  return result;
}
