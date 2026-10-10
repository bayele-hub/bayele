import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { BoardCampaign } from '@/lib/campaign-board';

export type { CountryCode as CampaignCountry } from '@/lib/countries';
import type { CountryCode as CampaignCountry } from '@/lib/countries';

/**
 * The public (anon-safe) part of a campaign. Migration 0032 revokes anon SELECT on campaigns.brief,
 * mandatory_tags, total_budget_fcfa, platform_fee_rate and match_pass_paid, so this type — and the
 * query behind it — must only ever name the columns anon may read.
 */
export interface PublicCampaign {
  id: string;
  title: string;
  category: string;
  country: CampaignCountry;
  payoutPerCreatorFcfa: number;
  creatorCountTarget: number;
  status: 'published' | 'in_progress';
  createdAt: string;
  brandName: string;
  brandHandle: string | null;
  platforms: string[];
  contentType: string | null;
  deliverableQuantity: number | null;
  deadline: string | null;
}

/** Members-only part of a campaign (D1 soft wall): read only with a signed-in session. */
export interface CampaignBrief {
  brief: string;
  mandatoryTags: string | null;
}

// Only these two states are publicly shareable: a funded, open campaign creators can still join.
const SHAREABLE = ['published', 'in_progress'] as const;
// Exactly the anon-readable columns (see migration 0032). Never add brief / mandatory_tags here.
const PUBLIC_COLUMNS =
  'id, title, category, target_country, status, payout_per_creator_fcfa, creator_count_target, created_at, platforms, content_type, deliverable_quantity, deadline';

/**
 * One row of public_campaign_stats for a public + open campaign (SECURITY DEFINER): live counts plus
 * the owner's public brand name/handle. Brands' profiles are not anon-readable through RLS, so the
 * brand MUST come from here (QA D2), never from a direct profiles read. Cached per request.
 */
const statsRow = cache(async (id: string) => {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('public_campaign_stats', { p_campaign_id: id });
    return (!error && data?.[0]) || null;
  } catch {
    return null;
  }
});

/** Fallback brand label, only when the RPC returns no name. */
const BRAND_FALLBACK = 'Une marque';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** A malformed id would make PostgREST raise 22P02; reject it before any query. */
export function isCampaignId(id: string | null | undefined): id is string {
  return !!id && UUID_RE.test(id);
}

/**
 * A single campaign for its public, shareable page. Public columns only, so it works for anon
 * visitors and crawlers (page, metadata, OG image). Returns null when the campaign doesn't exist or
 * isn't public + open, so the page renders a 404. Cached per request (metadata + page share it).
 */
export const getPublicCampaign = cache(async (id: string): Promise<PublicCampaign | null> => {
  if (!isCampaignId(id)) return null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('campaigns')
      .select(PUBLIC_COLUMNS)
      .eq('id', id)
      .eq('is_public', true) // the public route serves ONLY public campaigns; private ones 404 here
      .in('status', SHAREABLE)
      .maybeSingle();
    if (error || !data) return null;

    // Brand identity from public_campaign_stats (definer RPC), same source as the board cards.
    const row = await statsRow(id);

    return {
      id: data.id,
      title: data.title,
      category: data.category,
      country: data.target_country as CampaignCountry,
      payoutPerCreatorFcfa: data.payout_per_creator_fcfa,
      creatorCountTarget: data.creator_count_target,
      status: data.status as 'published' | 'in_progress',
      createdAt: data.created_at,
      brandName: row?.brand_name?.trim() || BRAND_FALLBACK,
      brandHandle: row?.brand_handle ?? null,
      platforms: data.platforms ?? [],
      contentType: data.content_type ?? null,
      deliverableQuantity: data.deliverable_quantity ?? null,
      deadline: data.deadline ?? null,
    };
  } catch {
    return null;
  }
});

/**
 * Brief + mandatory tags for a SIGNED-IN viewer (authenticated role; RLS still applies). Callers
 * must only invoke this when a session exists — it is never called for logged-out visitors, so the
 * brief can't reach logged-out HTML, metadata or JSON-LD.
 */
export async function getCampaignBriefForMember(id: string): Promise<CampaignBrief | null> {
  if (!isCampaignId(id)) return null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('campaigns')
      .select('brief, mandatory_tags')
      .eq('id', id)
      .in('status', SHAREABLE)
      .maybeSingle();
    if (error || !data) return null;
    return { brief: data.brief ?? '', mandatoryTags: data.mandatory_tags ?? null };
  } catch {
    return null;
  }
}

/** Live counts for one public + open campaign; null → hide both stats. */
export const getCampaignStats = cache(async (id: string): Promise<{ appliedCount: number; placesLeft: number } | null> => {
  if (!isCampaignId(id)) return null;
  const row = await statsRow(id);
  return row ? { appliedCount: Number(row.applied_count) || 0, placesLeft: Number(row.places_left) || 0 } : null;
});

/**
 * The public board: open + public campaigns, already ranked by the RPC (D4 + C1: campaigns with
 * places first, full ones last, then pay ↓, places ↓, newest). Best-effort: any error → [] (empty state).
 */
export async function listCampaignBoard(opts: { country?: CampaignCountry | null; category?: string | null; limit?: number } = {}): Promise<BoardCampaign[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('public_campaign_board', {
      p_country: opts.country ?? undefined,
      p_category: opts.category ?? undefined,
      p_limit: opts.limit ?? 10,
    });
    if (error || !data) return [];
    return data.map((r) => ({
      id: r.id,
      title: r.title,
      category: r.category ?? '',
      country: r.target_country,
      payoutPerCreatorFcfa: Number(r.payout_per_creator_fcfa) || 0,
      creatorCountTarget: Number(r.creator_count_target) || 0,
      platforms: r.platforms ?? [],
      deadline: r.deadline ?? null,
      createdAt: r.created_at,
      brandName: r.brand_name ?? null,
      appliedCount: Number(r.applied_count) || 0,
      placesLeft: Number(r.places_left) || 0,
    }));
  } catch {
    return [];
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
