import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@bayele/database';
import { isCampaignId } from '@/lib/data/public-campaigns';
import { normalizeDetail, PAGE_SIZE, type AdminMemberDetail, type MemberFilters, type MemberStatus } from '@/lib/admin-members';
import { cardWarnings } from '@/lib/member-quality';

export type MemberListRow = Database['public']['Functions']['admin_member_list']['Returns'][number];

export interface MemberPage {
  rows: MemberListRow[];
  total: number;
  counts: Record<MemberStatus, number>;
}

const EMPTY_COUNTS: Record<MemberStatus, number> = { pending_review: 0, active: 0, suspended: 0, rejected: 0 };

/** Chip counts per status for the current role/country (admin_member_counts). null = unavailable. */
export async function memberCounts(f: Pick<MemberFilters, 'role' | 'country'>): Promise<Record<MemberStatus, number> | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('admin_member_counts', { p_role: f.role ?? undefined, p_country: f.country ?? undefined });
    if (error || !data) return null;
    const out = { ...EMPTY_COUNTS };
    for (const r of data) if (r.status in out) out[r.status as MemberStatus] = Number(r.members) || 0;
    return out;
  } catch {
    return null;
  }
}

/**
 * One page of members (admin_member_list, 50 per page, server-side filters + search). With « À vérifier »
 * on, the server has no such filter, so this reads the filtered set in pages of 100 (capped at 2 000),
 * keeps the rows with a card-level data-quality warning, then paginates locally.
 */
export async function listMembers(f: MemberFilters): Promise<MemberPage | null> {
  try {
    const supabase = await createClient();
    const args = { p_status: f.status ?? undefined, p_role: f.role ?? undefined, p_country: f.country ?? undefined, p_search: f.q || undefined };
    const counts = (await memberCounts(f)) ?? { ...EMPTY_COUNTS };
    if (!f.flag) {
      const { data, error } = await supabase.rpc('admin_member_list', { ...args, p_limit: PAGE_SIZE, p_offset: (f.page - 1) * PAGE_SIZE });
      if (error || !data) return null;
      return { rows: data, total: Number(data[0]?.total_count ?? 0), counts };
    }
    const all: MemberListRow[] = [];
    for (let offset = 0; offset < 2000; offset += 100) {
      const { data, error } = await supabase.rpc('admin_member_list', { ...args, p_limit: 100, p_offset: offset });
      if (error || !data) return null;
      all.push(...data);
      if (data.length < 100) break;
    }
    const flagged = all.filter((r) => cardWarnings({ city: r.city, displayName: r.display_name, roles: r.roles ?? [] }).length > 0);
    return { rows: flagged.slice((f.page - 1) * PAGE_SIZE, f.page * PAGE_SIZE), total: flagged.length, counts };
  } catch {
    return null;
  }
}

/** admin_member_detail (logs one 'view' per admin/member/day server-side). null = not found / unavailable. */
export async function getMemberDetail(id: string): Promise<AdminMemberDetail | null> {
  if (!isCampaignId(id)) return null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('admin_member_detail', { p_user_id: id });
    if (error || !data) return null;
    return normalizeDetail(data);
  } catch {
    return null;
  }
}
