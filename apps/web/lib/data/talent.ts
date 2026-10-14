import { createClient } from '@/lib/supabase/server';
import type { Platform } from '@/components/social-icons';
import { ratingDisplay, type RatingDisplay } from '@/lib/ratings';

export type { CountryCode } from '@/lib/countries';
import type { CountryCode } from '@/lib/countries';
import { getSpecialties } from '@/lib/data/partner-gov';
import { specialtyLabels } from '@/lib/gov/specialties';
import { getDictionary } from '@/i18n/dictionaries';
export type Role = 'creator' | 'consultant';

export interface TalentSummary {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  city: string;
  country: CountryCode;
  role: Role;
  tags: string[];
  /** Partner specialty CODES (G1); `tags` carries their labels for display. */
  specialtyCodes?: string[];
  /** D6: « Nouveau » until real reviews exist (the DB default 5.00 is not a review). */
  rating: RatingDisplay;
  audienceSize?: number;
}

export interface SocialLink {
  platform: Platform;
  url: string;
  followers: number;
}

export interface CreatorProfile extends TalentSummary {
  bio: string;
  photoUrl: string | null;
  socials: SocialLink[];
  /** Not computed yet → null = hidden (never a hard-coded 0, F9). */
  completedCampaigns: number | null;
  /** "Créateur fondateur" number (1–10 000), or null. */
  founderNumber: number | null;
}

export type ConsultantLinkKind = 'linkedin' | 'x' | 'whatsapp' | 'website';
export interface ConsultantLink {
  kind: ConsultantLinkKind;
  url: string;
}

export interface ConsultantProfile extends TalentSummary {
  bio: string;
  photoUrl: string | null;
  yearsExperience: number;
  /** No real count is available to the public pages → null = hidden (F9). */
  completedCampaigns: number | null;
  agencyAccess: boolean;
  links: ConsultantLink[];
}

export interface FeaturedTalent {
  creators: TalentSummary[];
  consultants: TalentSummary[];
}
export interface DirectoryFilters {
  country?: CountryCode;
  category?: string;
  limit?: number;
}

// This module is 100% database-driven: every creator/consultant surfaced here comes from the
// `profiles` table (joined to user_roles + the role-specific profile). There is no demo/mock
// fallback — when a query fails or returns nothing, the directory shows its empty state and a
// profile lookup returns null, so production never renders fabricated talent.

// Shape the joined profile row into the summary used by directory cards.
function mapRow(role: Role) {
  return (item: any): TalentSummary => ({
    id: item.id,
    handle: item.handle,
    displayName: item.display_name,
    avatarUrl: item.avatar_url,
    city: item.city,
    country: item.country,
    role,
    tags: item.creator_profiles?.categories ?? item.consultant_profiles?.specialties ?? [],
    // No review system yet: zero reviews back any rating, so it always reads « Nouveau » (D6).
    rating: ratingDisplay(item.creator_profiles?.rating_avg ?? null, 0),
    audienceSize: role === 'creator' ? (item.creator_profiles?.audience_size ?? 0) : undefined,
  });
}

// Category is matched in-memory (it lives inside the role-specific array column, not on profiles).
function applyFilters(list: TalentSummary[], f: DirectoryFilters): TalentSummary[] {
  let out = list;
  if (f.country) out = out.filter((p) => p.country === f.country);
  if (f.category) out = out.filter((p) => p.tags.some((tag) => tag.toLowerCase() === f.category!.toLowerCase()));
  return out.slice(0, f.limit ?? 24);
}

// G1: partner specialties are stored as codes — show their labels (« Spécialités déclarées »).
async function labelSpecialties<T extends TalentSummary>(list: T[]): Promise<T[]> {
  if (!list.some((p) => p.role === 'consultant')) return list;
  const [specs, locale] = await Promise.all([
    getSpecialties(),
    getDictionary().then((d) => (d.locale === 'en' ? 'en' : 'fr') as 'fr' | 'en').catch(() => 'fr' as const),
  ]);
  return list.map((p) => (p.role === 'consultant' ? { ...p, specialtyCodes: p.tags, tags: specialtyLabels(p.tags, specs, locale) } : p));
}

async function fetchRole(role: Role, f: DirectoryFilters): Promise<TalentSummary[]> {
  try {
    const supabase = await createClient();
    const extra = role === 'creator'
      ? 'creator_profiles(categories, rating_avg, audience_size)'
      : 'consultant_profiles(specialties)';
    let q = supabase.from('profiles')
      .select(`id, handle, display_name, avatar_url, city, country, user_roles!inner(role), ${extra}`)
      .eq('status', 'active').eq('user_roles.role', role);
    if (f.country) q = q.eq('country', f.country);
    const { data, error } = await q.limit(f.limit ?? 24);
    if (error || !data) return [];
    return applyFilters(data.map(mapRow(role)), { category: f.category, limit: f.limit });
  } catch {
    return [];
  }
}

export function listCreators(f: DirectoryFilters = {}): Promise<TalentSummary[]> {
  return fetchRole('creator', f).then((l) => l.sort((a, b) => (b.audienceSize ?? 0) - (a.audienceSize ?? 0)));
}
export function listConsultants(f: DirectoryFilters = {}): Promise<TalentSummary[]> {
  return fetchRole('consultant', f).then(labelSpecialties);
}
export async function getFeaturedTalent(perRole = 6): Promise<FeaturedTalent> {
  const [creators, consultants] = await Promise.all([listCreators({ limit: perRole }), listConsultants({ limit: perRole })]);
  return { creators, consultants };
}

// Convert the creator_profiles.platforms JSON ({ instagram: { url, followers }, … }) into typed links.
function platformsToSocials(platforms: any): SocialLink[] {
  if (!platforms || typeof platforms !== 'object') return [];
  const known: Platform[] = ['whatsapp', 'facebook', 'instagram', 'tiktok', 'youtube', 'x', 'linkedin', 'snapchat', 'telegram'];
  return known
    .filter((p) => platforms[p])
    .map((p) => ({ platform: p, url: platforms[p].url ?? '#', followers: Number(platforms[p].followers ?? 0) }));
}

/** Full creator profile by handle. Returns null when not found. Purely DB-backed. */
export async function getCreator(handle: string): Promise<CreatorProfile | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from('profiles')
      .select(`id, handle, display_name, avatar_url, bio, city, country, user_roles!inner(role), creator_profiles(categories, rating_avg, audience_size, platforms), founder_creators(founder_number)`)
      .eq('handle', handle).eq('user_roles.role', 'creator').eq('status', 'active').maybeSingle();
    if (error || !data) return null;
    const base = mapRow('creator')(data);
    return {
      ...base,
      bio: (data as any).bio ?? '',
      photoUrl: base.avatarUrl,
      socials: platformsToSocials((data as any).creator_profiles?.platforms),
      completedCampaigns: null,
      founderNumber: pickFounder((data as any).founder_creators),
    };
  } catch {
    return null;
  }
}

// founder_creators is one-to-one with profiles; PostgREST may still hand back an array.
function pickFounder(v: unknown): number | null {
  const row = Array.isArray(v) ? v[0] : v;
  const n = (row as { founder_number?: unknown } | null | undefined)?.founder_number;
  return typeof n === 'number' ? n : null;
}

/** Full consultant profile by handle. Returns null when not found. Purely DB-backed. */
export async function getConsultant(handle: string): Promise<ConsultantProfile | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from('profiles')
      .select(`id, handle, display_name, avatar_url, bio, city, country, user_roles!inner(role), consultant_profiles(specialties, agency_access, years_experience)`)
      .eq('handle', handle).eq('user_roles.role', 'consultant').eq('status', 'active').maybeSingle();
    if (error || !data) return null;
    const base = (await labelSpecialties([mapRow('consultant')(data)]))[0]!;
    const cp = (data as any).consultant_profiles;
    return {
      ...base,
      bio: (data as any).bio ?? '',
      photoUrl: base.avatarUrl,
      yearsExperience: cp?.years_experience ?? 0,
      completedCampaigns: null,
      agencyAccess: Boolean(cp?.agency_access),
      links: [], // professional links come from a future consultant_profiles column
    };
  } catch {
    return null;
  }
}
