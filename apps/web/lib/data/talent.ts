import { createClient } from '@bayele/database/server';
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

// ---- Demo photos (stock portrait placeholders — replace with real photos) ----
const PHOTO = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=480&h=480&q=80&crop=faces`;
const DEMO_PHOTOS: Record<string, string> = {
  lala_mode: PHOTO('1531123897727-8f129e1688ce'),
  awa_beauty: PHOTO('1517841905240-472988babdf9'),
  fatou_ci: PHOTO('1522252234503-e356532cafd5'),
  yao_tech: PHOTO('1506794778202-cad84cf45f1d'),
  eric_nze: PHOTO('1500648767791-00dcc994a43e'),
  nadege_237: PHOTO('1487412720507-e7ab37603c6f'),
  bak_food: PHOTO('1519085360753-af0119f7cbe7'),
  joel_ga: PHOTO('1507003211169-0a1dd7228f2d'),
  chris_ci: PHOTO('1524504388940-b1c1722653e1'),
  rachel_wellness: PHOTO('1544005313-94ddf0286df2'),
  marie_ondo: PHOTO('1573496359142-b8d87734a5a2'),
  sandrine_m: PHOTO('1580489944761-15a19d654956'),
  ibrahim_sow: PHOTO('1560250097-0b93528c311a'),
  paul_ngm: PHOTO('1568602471122-7832951cc4c5'),
  aisha_cm: PHOTO('1589156280159-27698a70f29e'),
  kader_ci: PHOTO('1507591064344-4c6ce005b128'),
};

function baseCreator(id: string, handle: string, name: string, city: string, country: CountryCode, tags: string[], rating: number, audience: number): TalentSummary {
  return { id, handle, displayName: name, avatarUrl: DEMO_PHOTOS[handle] ?? null, city, country, role: 'creator', tags, ratingAvg: rating, audienceSize: audience };
}
function baseConsultant(id: string, handle: string, name: string, city: string, country: CountryCode, tags: string[], rating: number): TalentSummary {
  return { id, handle, displayName: name, avatarUrl: DEMO_PHOTOS[handle] ?? null, city, country, role: 'consultant', tags, ratingAvg: rating };
}

const DEMO_CREATORS: TalentSummary[] = [
  baseCreator('c1', 'lala_mode', 'Lala Mbarga', 'Yaoundé', 'CM', ['Mode', 'Beauté'], 4.9, 212000),
  baseCreator('c2', 'awa_beauty', 'Awa Ngassa', 'Douala', 'CM', ['Beauté', 'Lifestyle'], 4.9, 128000),
  baseCreator('c9', 'fatou_ci', 'Fatou Coulibaly', 'Bouaké', 'CI', ['Beauté', 'Mode'], 4.8, 96000),
  baseCreator('c3', 'yao_tech', 'Yao Kouassi', 'Abidjan', 'CI', ['Tech', 'Gaming'], 4.8, 74000),
  baseCreator('c4', 'eric_nze', 'Éric Nzé', 'Port-Gentil', 'GA', ['Sport', 'Musique'], 4.8, 61000),
  baseCreator('c10', 'rachel_wellness', 'Rachel Eyenga', 'Douala', 'CM', ['Santé & Bien-être', 'Sport'], 4.8, 58000),
  baseCreator('c7', 'nadege_237', 'Nadège Fotso', 'Douala', 'CM', ['Food', 'Lifestyle'], 4.7, 52000),
  baseCreator('c5', 'bak_food', 'Bakary Traoré', 'Abidjan', 'CI', ['Food', 'Cuisine'], 4.7, 45000),
  baseCreator('c8', 'joel_ga', 'Joël Mba', 'Libreville', 'GA', ['Humour', 'Musique'], 4.5, 41000),
  baseCreator('c6', 'chris_ci', 'Christelle Ba', 'Abidjan', 'CI', ['Lifestyle', 'Voyage'], 4.6, 33000),
];
const DEMO_CONSULTANTS: TalentSummary[] = [
  baseConsultant('s1', 'marie_ondo', 'Marie Ondo', 'Libreville', 'GA', ['Media Buying', 'PR'], 5.0),
  baseConsultant('s2', 'sandrine_m', 'Sandrine Mbede', 'Yaoundé', 'CM', ['Growth', 'Stratégie'], 4.9),
  baseConsultant('s3', 'ibrahim_sow', 'Ibrahim Sow', 'Abidjan', 'CI', ['Média', 'Influence'], 4.8),
  baseConsultant('s4', 'paul_ngm', 'Paul Nguema', 'Libreville', 'GA', ['Branding', 'RP'], 4.7),
  baseConsultant('s5', 'aisha_cm', 'Aïsha Bello', 'Douala', 'CM', ['Social Ads', 'Growth'], 4.9),
  baseConsultant('s6', 'kader_ci', 'Kader Diomandé', 'Abidjan', 'CI', ['Stratégie', 'Média'], 4.6),
];

const DEMO_BIOS: Record<string, string> = {
  lala_mode: "Créatrice mode & beauté à Yaoundé. Je mets en avant les marques africaines à travers mes statuts WhatsApp et TikTok, avec une communauté fidèle et engagée.",
  awa_beauty: "Passionnée de beauté et de lifestyle à Douala. Tutoriels, routines et bons plans pour ma communauté au Cameroun.",
  yao_tech: "Créateur tech & gaming à Abidjan. Tests de produits, astuces et reviews pour une audience jeune et connectée.",
  rachel_wellness: "Coach santé & bien-être à Douala. Fitness, nutrition et routines pour une vie plus saine, partagés au quotidien avec ma communauté.",
};
const DEMO_CONSULTANT_BIOS: Record<string, string> = {
  marie_ondo: "Consultante média & relations presse à Libreville. J'accompagne les marques dans l'achat média et l'activation d'influenceurs à travers l'Afrique centrale.",
  sandrine_m: "Stratège growth à Yaoundé. Je conçois et pilote des campagnes d'influence orientées performance pour PME et agences.",
  ibrahim_sow: "Consultant média & influence à Abidjan. Dix ans d'expérience en planification de campagnes multi-plateformes en Afrique de l'Ouest.",
};
const DEMO_CONSULTANT_META: Record<string, { years: number; campaigns: number; agency: boolean }> = {
  marie_ondo: { years: 9, campaigns: 47, agency: true },
  sandrine_m: { years: 6, campaigns: 32, agency: true },
  ibrahim_sow: { years: 8, campaigns: 40, agency: false },
  paul_ngm: { years: 5, campaigns: 24, agency: false },
  aisha_cm: { years: 7, campaigns: 38, agency: true },
  kader_ci: { years: 4, campaigns: 19, agency: false },
};

const demo = () => process.env.NEXT_PUBLIC_BAYELE_DEMO === '1';

// The platforms brands most use to communicate, with relevance/African-usage weights.
// Every creator profile surfaces this full roster.
const CREATOR_PLATFORMS: { platform: Platform; weight: number; url: (h: string) => string }[] = [
  { platform: 'whatsapp', weight: 0.22, url: () => 'https://wa.me/' },
  { platform: 'instagram', weight: 0.2, url: (h) => `https://instagram.com/${h}` },
  { platform: 'tiktok', weight: 0.2, url: (h) => `https://tiktok.com/@${h}` },
  { platform: 'facebook', weight: 0.14, url: (h) => `https://facebook.com/${h}` },
  { platform: 'youtube', weight: 0.1, url: (h) => `https://youtube.com/@${h}` },
  { platform: 'x', weight: 0.08, url: (h) => `https://x.com/${h}` },
  { platform: 'linkedin', weight: 0.05, url: (h) => `https://linkedin.com/in/${h}` },
  { platform: 'snapchat', weight: 0.04, url: (h) => `https://snapchat.com/add/${h}` },
  { platform: 'telegram', weight: 0.02, url: (h) => `https://t.me/${h}` },
];

function buildSocials(handle: string, audience: number): SocialLink[] {
  return CREATOR_PLATFORMS.map((p) => ({
    platform: p.platform,
    url: p.url(handle),
    followers: Math.max(0, Math.round(audience * p.weight)),
  }));
}
function buildConsultantLinks(handle: string): ConsultantLink[] {
  return [
    { kind: 'linkedin', url: `https://linkedin.com/in/${handle}` },
    { kind: 'x', url: `https://x.com/${handle}` },
    { kind: 'website', url: `https://${handle.replace(/_/g, '')}.com` },
    { kind: 'whatsapp', url: `https://wa.me/` },
  ];
}

function toCreatorProfile(base: TalentSummary): CreatorProfile {
  return {
    ...base,
    bio: DEMO_BIOS[base.handle] ?? `Nano-créateur ${base.tags.join(' & ')} basé à ${base.city}. Disponible pour des campagnes rémunérées et sécurisées via Bayele.`,
    photoUrl: base.avatarUrl,
    socials: buildSocials(base.handle, base.audienceSize ?? 0),
    completedCampaigns: Math.max(3, Math.round((base.audienceSize ?? 0) / 12000)),
  };
}
function toConsultantProfile(base: TalentSummary): ConsultantProfile {
  const meta = DEMO_CONSULTANT_META[base.handle] ?? { years: 5, campaigns: 20, agency: false };
  return {
    ...base,
    bio: DEMO_CONSULTANT_BIOS[base.handle] ?? `Consultant ${base.tags.join(' & ')} basé à ${base.city}. J'accompagne marques et agences dans leurs campagnes d'influence, de la stratégie à l'exécution.`,
    photoUrl: base.avatarUrl,
    yearsExperience: meta.years,
    completedCampaigns: meta.campaigns,
    agencyAccess: meta.agency,
    links: buildConsultantLinks(base.handle),
  };
}

function mapRow(role: Role) {
  return (item: any): TalentSummary => ({
    id: item.id, handle: item.handle, displayName: item.display_name, avatarUrl: item.avatar_url,
    city: item.city, country: item.country, role,
    tags: item.creator_profiles?.categories ?? item.consultant_profiles?.specialties ?? [],
    ratingAvg: item.creator_profiles?.rating_avg ?? 5.0,
    audienceSize: role === 'creator' ? (item.creator_profiles?.audience_size ?? 0) : undefined,
  });
}

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
    if (error || !data || data.length === 0) {
      const fb = role === 'creator' ? DEMO_CREATORS : DEMO_CONSULTANTS;
      return demo() ? applyFilters(fb, f) : [];
    }
    return applyFilters(data.map(mapRow(role)), { category: f.category, limit: f.limit });
  } catch {
    const fb = role === 'creator' ? DEMO_CREATORS : DEMO_CONSULTANTS;
    return demo() ? applyFilters(fb, f) : [];
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

function platformsToSocials(platforms: any): SocialLink[] {
  if (!platforms || typeof platforms !== 'object') return [];
  const known: Platform[] = ['whatsapp', 'facebook', 'instagram', 'tiktok', 'youtube', 'x', 'linkedin', 'snapchat', 'telegram'];
  return known.filter((p) => platforms[p]).map((p) => ({ platform: p, url: platforms[p].url ?? '#', followers: Number(platforms[p].followers ?? 0) }));
}

/** Full creator profile by handle. Returns null when not found. */
export async function getCreator(handle: string): Promise<CreatorProfile | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from('profiles')
      .select(`id, handle, display_name, avatar_url, bio, city, country, user_roles!inner(role), creator_profiles(categories, rating_avg, audience_size, platforms)`)
      .eq('handle', handle).eq('user_roles.role', 'creator').eq('status', 'active').maybeSingle();
    if (error || !data) {
      const base = DEMO_CREATORS.find((c) => c.handle === handle);
      return demo() && base ? toCreatorProfile(base) : null;
    }
    const base = mapRow('creator')(data);
    return { ...base, bio: (data as any).bio ?? '', photoUrl: base.avatarUrl, socials: platformsToSocials((data as any).creator_profiles?.platforms), completedCampaigns: 0 };
  } catch {
    const base = DEMO_CREATORS.find((c) => c.handle === handle);
    return demo() && base ? toCreatorProfile(base) : null;
  }
}

/** Full consultant profile by handle. Returns null when not found. */
export async function getConsultant(handle: string): Promise<ConsultantProfile | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from('profiles')
      .select(`id, handle, display_name, avatar_url, bio, city, country, user_roles!inner(role), consultant_profiles(specialties, agency_access, years_experience)`)
      .eq('handle', handle).eq('user_roles.role', 'consultant').eq('status', 'active').maybeSingle();
    if (error || !data) {
      const base = DEMO_CONSULTANTS.find((c) => c.handle === handle);
      return demo() && base ? toConsultantProfile(base) : null;
    }
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
    const base = DEMO_CONSULTANTS.find((c) => c.handle === handle);
    return demo() && base ? toConsultantProfile(base) : null;
  }
}
