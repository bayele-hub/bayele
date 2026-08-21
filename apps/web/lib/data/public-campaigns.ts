import { createClient } from '@/lib/supabase/server';

export type CampaignCountry = 'CM' | 'CI' | 'GA';

export interface PublicCampaign {
  id: string;
  title: string;
  brief: string;
  category: string;
  country: CampaignCountry;
  payoutPerCreatorFcfa: number;
  creatorCountTarget: number;
  status: 'published' | 'in_progress';
  createdAt: string;
  brandName: string;
  brandHandle: string | null;
  // Structured deliverables.
  platforms: string[];
  contentType: string | null;
  deliverableQuantity: number | null;
  mandatoryTags: string | null;
  deadline: string | null;
}

// Only these two states are publicly shareable: a funded, open campaign creators can still join.
const SHAREABLE = ['published', 'in_progress'] as const;

/**
 * Fetch a single campaign for its public, shareable page (LinkedIn-job style). Readable by anyone —
 * RLS already exposes published/in_progress/completed campaigns to anon — but we surface only the
 * shareable states and only non-sensitive fields (never the total budget / fee / owner internals).
 * Returns null when the campaign doesn't exist or isn't shareable, so the page renders a 404.
 */
export async function getPublicCampaign(id: string): Promise<PublicCampaign | null> {
  // A malformed id would make PostgREST throw; guard the obvious case cheaply.
  if (!id || id.length < 10) return null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('campaigns')
      .select('id, owner_id, title, brief, category, target_country, status, payout_per_creator_fcfa, creator_count_target, created_at, platforms, content_type, deliverable_quantity, mandatory_tags, deadline')
      .eq('id', id)
      .eq('is_public', true) // the public route serves ONLY public campaigns; private ones 404 here
      .in('status', SHAREABLE)
      .maybeSingle();
    if (error || !data) return null;

    // Brand identity comes from the owner's public profile (display_name is anon-readable; the
    // business_profiles company row is not, by design).
    const { data: owner } = await supabase
      .from('profiles')
      .select('display_name, handle')
      .eq('id', data.owner_id)
      .maybeSingle();

    return {
      id: data.id,
      title: data.title,
      brief: data.brief ?? '',
      category: data.category,
      country: data.target_country as CampaignCountry,
      payoutPerCreatorFcfa: data.payout_per_creator_fcfa,
      creatorCountTarget: data.creator_count_target,
      status: data.status as 'published' | 'in_progress',
      createdAt: data.created_at,
      brandName: owner?.display_name ?? 'Une marque',
      brandHandle: owner?.handle ?? null,
      platforms: data.platforms ?? [],
      contentType: data.content_type ?? null,
      deliverableQuantity: data.deliverable_quantity ?? null,
      mandatoryTags: data.mandatory_tags ?? null,
      deadline: data.deadline ?? null,
    };
  } catch {
    return null;
  }
}

/** Ids of all currently shareable campaigns, for the sitemap. Best-effort. */
export async function listPublicCampaignIds(limit = 500): Promise<{ id: string; createdAt: string }[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('campaigns')
      .select('id, created_at')
      .eq('is_public', true)
      .in('status', SHAREABLE)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data.map((c) => ({ id: c.id, createdAt: c.created_at }));
  } catch {
    return [];
  }
}
