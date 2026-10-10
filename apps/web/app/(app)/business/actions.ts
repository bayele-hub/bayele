'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import { getDictionary } from '@/i18n/dictionaries';
import { doualaToday } from '@/lib/campaign-board';
import { parseBrandCampaign } from '@/lib/brand-campaign';
import { publicFloorMap } from '@/lib/data/managed-briefs';

export type CampaignState = { error: string | null; field?: string | null };

/**
 * Brand self-serve campaign (design §7, council R4/R5). The brand states a TOTAL budget; the creator
 * net is floor(total × (1 − tier fee) ÷ creators) — or, advanced, the net is typed and the total is
 * grossed up. Validation + money mapping live in lib/brand-campaign.ts (unit-tested); the DB re-checks
 * budget_math_check and valid_fee_rate, and the campaigns guard forces owner_role to a role the caller
 * holds (E9). Pay floors are a warning + acknowledgement here, never a block (R5).
 */
export async function createCampaignAction(_prev: CampaignState, formData: FormData): Promise<CampaignState> {
  const session = await getSession();
  if (!session.userId) redirect('/auth?mode=signin');
  const { locale, t } = await getDictionary();
  const e = t.brandForm.errors;
  if (!session.roles.includes('business') && session.primary !== 'super_admin') return { error: e.notBrand };

  // R5: floors that are set (pay_floors_public, any signed-in user) — warning + tick, never a block.
  const floors = await publicFloorMap();
  const parsed = parseBrandCampaign(Object.fromEntries(formData.entries()), {
    today: doualaToday(),
    floors,
    locale,
    copy: { autoTitle: t.brandForm.autoTitle, generatedBrief: t.brandForm.generatedBrief, briefPlace: t.brandForm.briefPlace },
  });
  if (!parsed.ok) return { error: e[parsed.error], field: parsed.field };

  const supabase = await createClient();
  const { error } = await supabase.from('campaigns').insert({
    owner_id: session.userId,
    owner_role: 'business',
    status: 'draft',
    ...parsed.values,
  });
  if (error) return { error: e.generic };

  redirect('/business/dashboard');
}
