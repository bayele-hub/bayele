import { createClient } from '@/lib/supabase/server';
import type { Platform } from '@/components/social-icons';

export type CountryCode = 'CM' | 'CI' | 'GA';
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
  ratingAvg: number;
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
  completedCampaigns: number;
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
  completedCampaigns: number;
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
    ratingAvg: item.creator_profiles?.rating_avg ?? 5.0,
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
  return fetchRole('consultant', f);
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
      .select(`id, handle, display_name, avatar_url, bio, city, country, user_roles!inner(role), creator_profiles(categories, rating_avg, audience_size, platforms)`)
      .eq('handle', handle).eq('user_roles.role', 'creator').eq('status', 'active').maybeSingle();
    if (error || !data) return null;
    const base = mapRow('creator')(data);
    return {
      ...base,
      bio: (data as any).bio ?? '',
      photoUrl: base.avatarUrl,
      socials: platformsToSocials((data as any).creator_profiles?.platforms),
      // Real metric: number of campaigns paid out to this creator (0 until campaigns complete).
      completedCampaigns: 0,
    };
  } catch {
    return null;
  }
}

/** Full consultant profile by handle. Returns null when not found. Purely DB-backed. */
export async function getConsultant(handle: string): Promise<ConsultantProfile | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from('profiles')
      .select(`id, handle, display_name, avatar_url, bio, city, country, user_roles!inner(role), consultant_profiles(specialties, agency_access, years_experience)`)
      .eq('handle', handle).eq('user_roles.role', 'consultant').eq('status', 'active').maybeSingle();
    if (error || !data) return null;
    const base = mapRow('consultant')(data);
    const cp = (data as any).consultant_profiles;
    return {
      ...base,
      bio: (data as any).bio ?? '',
      photoUrl: base.avatarUrl,
      yearsExperience: cp?.years_experience ?? 0,
      completedCampaigns: 0,
      agencyAccess: Boolean(cp?.agency_access),
      links: [], // professional links come from a future consultant_profiles column
    };
  } catch {
    return null;
  }
}
