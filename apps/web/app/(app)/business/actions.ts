'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import { feeRateForTier, computeBudget } from '@/lib/data/campaigns';
import type { Database } from '@bayele/database';

type Country = Database['public']['Enums']['country_code'];

export type CampaignState = { error: string | null };

const COUNTRIES: Country[] = ['CM', 'CI', 'GA'];

export async function createCampaignAction(_prev: CampaignState, formData: FormData): Promise<CampaignState> {
  const session = await getSession();
  if (!session.userId) redirect('/auth?mode=signin');
  if (!session.roles.includes('business') && session.primary !== 'super_admin') {
    return { error: 'La création de campagne est réservée aux marques.' };
  }

  const title = String(formData.get('title') ?? '').trim();
  const brief = String(formData.get('brief') ?? '').trim();
  const category = String(formData.get('category') ?? '').trim();
  const countryRaw = String(formData.get('country') ?? 'CM') as Country;
  const country: Country = COUNTRIES.includes(countryRaw) ? countryRaw : 'CM';
  const tier = String(formData.get('tier') ?? 'spark');
  const rate = feeRateForTier(tier);
  const payout = Math.round(Number(formData.get('payout') ?? 0));
  const count = Math.round(Number(formData.get('count') ?? 0));

  // Structured deliverable fields — these make expectations explicit (what proof-of-post is judged on).
  const platforms = String(formData.get('platforms') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const contentType = String(formData.get('content_type') ?? '').trim() || null;
  const quantity = Math.max(1, Math.round(Number(formData.get('quantity') ?? 1))) || 1;
  const mandatoryTags = String(formData.get('mandatory_tags') ?? '').trim() || null;
  const deadlineRaw = String(formData.get('deadline') ?? '').trim();
  const deadline = /^\d{4}-\d{2}-\d{2}$/.test(deadlineRaw) ? deadlineRaw : null;
  // Visibility: private by default (signed-in creators only); brand opts a campaign public.
  const isPublic = String(formData.get('is_public') ?? '') === 'true';

  if (!title || !brief || !category) return { error: 'Titre, brief et catégorie sont requis.' };
  if (!platforms.length || !contentType) return { error: 'Indiquez au moins une plateforme et un type de contenu.' };
  if (payout <= 0 || count <= 0) return { error: 'Indiquez un paiement par créateur et un nombre de créateurs.' };

  const { total } = computeBudget(payout, count, rate);

  const supabase = await createClient();
  const { error } = await supabase.from('campaigns').insert({
    owner_id: session.userId,
    owner_role: 'business',
    title,
    brief,
    category,
    target_country: country,
    total_budget_fcfa: total,
    payout_per_creator_fcfa: payout,
    creator_count_target: count,
    platform_fee_rate: rate,
    status: 'draft',
    platforms,
    content_type: contentType,
    deliverable_quantity: quantity,
    mandatory_tags: mandatoryTags,
    deadline,
    is_public: isPublic,
  });

  if (error) return { error: 'La création a échoué. Vérifiez les montants et réessayez.' };

  redirect('/business/dashboard');
}
