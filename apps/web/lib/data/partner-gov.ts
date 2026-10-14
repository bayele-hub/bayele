import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@bayele/database';
import { SPECIALTIES_FALLBACK, type Specialty } from '@/lib/gov/specialties';
import { COUNTRY_CODES, type CountryCode } from '@/lib/countries';

type Fn = Database['public']['Functions'];
export type AdminPartnerRow = Fn['admin_partner_list']['Returns'][number];
export type ContactRequestRow = Fn['admin_contact_requests']['Returns'][number];
export type EndRequestRow = Fn['admin_assignment_end_requests']['Returns'][number];
export type MessageFlagRow = Fn['admin_message_flags']['Returns'][number];
export type SelfDealingRow = Fn['admin_self_dealing_flags']['Returns'][number];
export type BrandSearchRow = Fn['admin_search_brands']['Returns'][number];
type Tables = Database['public']['Tables'];
export type AssignmentRow = Tables['partner_assignments']['Row'];
export type ContactRequest = Tables['partner_contact_requests']['Row'];
export type EndRequest = Tables['assignment_end_requests']['Row'];

const ALL = null as never; // the queue RPCs take null for « all statuses »

/** Active specialties ordered by sort (public read); the G1 list when the read fails. */
export const getSpecialties = cache(async (): Promise<Specialty[]> => {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from('partner_specialties').select('code, label_fr, label_en, sort').eq('active', true).order('sort');
    if (error || !data?.length) return SPECIALTIES_FALLBACK;
    return data;
  } catch {
    return SPECIALTIES_FALLBACK;
  }
});

/** Active cities per country, ordered by sort (public read). Empty lists when the read fails. */
export const getCitiesByCountry = cache(async (): Promise<Record<CountryCode, string[]>> => {
  const out = Object.fromEntries(COUNTRY_CODES.map((c) => [c, [] as string[]])) as Record<CountryCode, string[]>;
  try {
    const supabase = await createClient();
    const { data } = await supabase.from('cities').select('country, name, sort').eq('active', true).order('sort');
    for (const r of data ?? []) if (r.country in out) out[r.country as CountryCode].push(r.name);
  } catch {
    /* picker falls back to « Autre » only */
  }
  return out;
});

/** The caller's latest consent per kind (my_consents). null when it can't be read (never block then). */
export async function getMyConsents(): Promise<{ kind: string; version: string }[] | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('my_consents');
    if (error || !data) return null;
    return data.map((r) => ({ kind: r.kind, version: r.version }));
  } catch {
    return null;
  }
}

// ---------------- admin hub ----------------
export const ADMIN_PAGE = 50;
export type ListingFilter = 'listed' | 'delisted' | 'suspended' | 'pending' | 'all';
export interface PartnerFilters { listing: ListingFilter; q: string; spec: string | null; page: number }

export function parsePartnerFilters(sp: Record<string, string | string[] | undefined>): PartnerFilters {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : sp[k]) ?? '';
  const l = one('listing');
  const listing: ListingFilter = (['listed', 'delisted', 'suspended', 'pending', 'all'] as const).includes(l as ListingFilter) ? (l as ListingFilter) : 'all';
  const page = Math.max(1, Math.min(1000, parseInt(one('page'), 10) || 1));
  return { listing, q: one('q').trim().slice(0, 80), spec: one('spec').trim() || null, page };
}

export function partnersHref(f: PartnerFilters, patch: Partial<PartnerFilters> = {}): string {
  const n = { ...f, ...patch };
  const p = new URLSearchParams();
  if (n.listing !== 'all') p.set('listing', n.listing);
  if (n.q) p.set('q', n.q);
  if (n.spec) p.set('spec', n.spec);
  if (n.page > 1) p.set('page', String(n.page));
  const s = p.toString();
  return `/admin/partners${s ? `?${s}` : ''}`;
}

export function listingArgs(l: ListingFilter): { p_status?: Database['public']['Enums']['account_status']; p_listed?: boolean } {
  if (l === 'listed') return { p_listed: true, p_status: 'active' };
  if (l === 'delisted') return { p_listed: false };
  if (l === 'suspended') return { p_status: 'suspended' };
  if (l === 'pending') return { p_status: 'pending_review' };
  return {};
}

export async function adminPartnerList(f: PartnerFilters): Promise<{ rows: AdminPartnerRow[]; total: number } | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('admin_partner_list', {
      p_search: f.q || undefined, p_specialty: f.spec ?? undefined, ...listingArgs(f.listing),
      p_limit: ADMIN_PAGE, p_offset: (f.page - 1) * ADMIN_PAGE,
    });
    if (error || !data) return null;
    return { rows: data, total: Number(data[0]?.total_count ?? 0) };
  } catch {
    return null;
  }
}

export { normalizeOverview, type PartnerOverview } from './partner-gov-normalize';
import { normalizeOverview, type PartnerOverview } from './partner-gov-normalize';

export async function adminPartnerOverview(id: string): Promise<PartnerOverview | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('admin_partner_overview', { p_partner_id: id });
    if (error || !data) return null;
    return normalizeOverview(data);
  } catch {
    return null;
  }
}

export async function adminContactRequests(status: ContactRequestRow['status'] | null): Promise<ContactRequestRow[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_contact_requests', { p_status: status ?? ALL });
  return error ? null : data ?? [];
}
export async function adminEndRequests(status: EndRequestRow['status'] | null): Promise<EndRequestRow[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_assignment_end_requests', { p_status: status ?? ALL });
  return error ? null : data ?? [];
}
export async function adminMessageFlags(status: MessageFlagRow['status'] | null): Promise<MessageFlagRow[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_message_flags', { p_status: status ?? ALL, p_limit: 100 });
  return error ? null : data ?? [];
}
export async function adminSelfDealing(status: SelfDealingRow['status'] | null): Promise<SelfDealingRow[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_self_dealing_flags', { p_status: status ?? ALL });
  return error ? null : data ?? [];
}

/** Open-item counts for the hub rail (pending requests, open end requests, open flags). */
export async function hubCounts(): Promise<{ requests: number; ends: number; flags: number }> {
  const [r, e, f, s] = await Promise.all([
    adminContactRequests('pending').catch(() => null),
    adminEndRequests('open').catch(() => null),
    adminMessageFlags('open').catch(() => null),
    adminSelfDealing('open').catch(() => null),
  ]);
  return { requests: r?.length ?? 0, ends: e?.length ?? 0, flags: (f?.length ?? 0) + (s?.length ?? 0) };
}

/** A brand's campaigns (title · status) for the « Mettre en relation » campaign select (admin read). */
export async function brandCampaigns(brandId: string): Promise<{ id: string; title: string; status: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase.from('campaigns').select('id, title, status').eq('owner_id', brandId).order('created_at', { ascending: false }).limit(50);
  return data ?? [];
}

// ---------------- brand side ----------------
export interface PartyLite { id: string; handle: string; display_name: string; avatar_url: string | null; city: string | null }

async function profilesById(ids: string[]): Promise<Map<string, PartyLite>> {
  const out = new Map<string, PartyLite>();
  if (!ids.length) return out;
  const supabase = await createClient();
  const { data } = await supabase.from('profiles').select('id, handle, display_name, avatar_url, city').in('id', Array.from(new Set(ids)));
  for (const p of data ?? []) out.set(p.id, p);
  return out;
}

export async function campaignTitles(ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const list = Array.from(new Set(ids.filter(Boolean)));
  if (!list.length) return out;
  const supabase = await createClient();
  const { data } = await supabase.from('campaigns').select('id, title').in('id', list);
  for (const c of data ?? []) out.set(c.id, c.title);
  return out;
}

async function conversationExpiry(ids: string[]): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  const list = Array.from(new Set(ids.filter(Boolean)));
  if (!list.length) return out;
  const supabase = await createClient();
  const { data } = await supabase.from('conversations').select('id, expires_at').in('id', list);
  for (const c of data ?? []) out.set(c.id, c.expires_at);
  return out;
}

/** Pairs (brand, partner) with a funded/active/completed retainer → « Contrat signé ». */
async function signedPairs(field: 'business_id' | 'consultant_id', me: string): Promise<Set<string>> {
  const supabase = await createClient();
  const { data } = await supabase.from('agency_retainers').select('business_id, consultant_id, status').eq(field, me).in('status', ['funded', 'active', 'completed']);
  return new Set((data ?? []).map((r) => `${r.business_id}:${r.consultant_id}`));
}

export interface AssignmentView extends AssignmentRow {
  other: PartyLite | null;
  campaignTitle: string | null;
  expiresAt: string | null;
  signed: boolean;
  goal: string | null;
  endRequests: EndRequest[];
}

/** The caller's assignments (as brand or as partner), newest first, with the other party resolved. */
export async function myAssignments(me: string, side: 'brand' | 'partner'): Promise<AssignmentView[]> {
  const supabase = await createClient();
  const col = side === 'brand' ? 'brand_id' : 'partner_id';
  const { data } = await supabase.from('partner_assignments').select('*').eq(col, me).order('created_at', { ascending: false }).limit(200);
  const rows = data ?? [];
  if (!rows.length) return [];
  const [people, titles, expiry, signed, ends, reqs] = await Promise.all([
    profilesById(rows.map((r) => (side === 'brand' ? r.partner_id : r.brand_id))),
    campaignTitles(rows.map((r) => r.campaign_id ?? '')),
    conversationExpiry(rows.map((r) => r.conversation_id ?? '')),
    signedPairs(side === 'brand' ? 'business_id' : 'consultant_id', me),
    side === 'partner'
      ? supabase.from('assignment_end_requests').select('*').in('assignment_id', rows.map((r) => r.id)).order('created_at', { ascending: false }).then((x) => x.data ?? [])
      : Promise.resolve([] as EndRequest[]),
    supabase.from('partner_contact_requests').select('id, goal').in('id', rows.map((r) => r.contact_request_id).filter((x): x is string => !!x)).then((x) => x.data ?? []),
  ]);
  const goals = new Map(reqs.map((r) => [r.id, r.goal]));
  return rows.map((r) => ({
    ...r,
    other: people.get(side === 'brand' ? r.partner_id : r.brand_id) ?? null,
    campaignTitle: r.campaign_id ? titles.get(r.campaign_id) ?? null : null,
    expiresAt: r.conversation_id ? expiry.get(r.conversation_id) ?? null : null,
    signed: signed.has(`${r.brand_id}:${r.partner_id}`),
    goal: r.contact_request_id ? goals.get(r.contact_request_id) ?? null : null,
    endRequests: (ends as EndRequest[]).filter((e) => e.assignment_id === r.id),
  }));
}

export interface ContactRequestView extends ContactRequest { partner: PartyLite | null }

/** The brand's contact requests, newest first, with the partner resolved. */
export async function myContactRequests(me: string): Promise<ContactRequestView[]> {
  const supabase = await createClient();
  const { data } = await supabase.from('partner_contact_requests').select('*').eq('brand_id', me).order('created_at', { ascending: false }).limit(200);
  const rows = data ?? [];
  const people = await profilesById(rows.map((r) => r.partner_id));
  return rows.map((r) => ({ ...r, partner: people.get(r.partner_id) ?? null }));
}

/** A listed, active partner by handle (public directory read), or null. */
export async function partnerByHandle(handle: string): Promise<(PartyLite & { specialties: string[] }) | null> {
  const supabase = await createClient();
  const { data: p } = await supabase.from('profiles').select('id, handle, display_name, avatar_url, city, status').eq('handle', handle).maybeSingle();
  if (!p || p.status !== 'active') return null;
  const { data: c } = await supabase.from('consultant_profiles').select('specialties, directory_listed').eq('user_id', p.id).maybeSingle();
  if (!c || c.directory_listed === false) return null;
  return { id: p.id, handle: p.handle, display_name: p.display_name, avatar_url: p.avatar_url, city: p.city, specialties: c.specialties ?? [] };
}

/** Is the signed-in partner delisted? (directory_listed is client-readable.) */
export async function amIDelisted(me: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.from('consultant_profiles').select('directory_listed').eq('user_id', me).maybeSingle();
  return data?.directory_listed === false;
}
