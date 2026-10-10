import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@bayele/database';
import { isCampaignId } from '@/lib/data/public-campaigns';
import type { DeliverableType, FloorMap } from '@/lib/managed-listing';

/** One managed brief (admin-only table; RLS lets super_admins read, everyone else gets 0 rows). */
export type ManagedBriefRow = Database['public']['Tables']['managed_briefs']['Row'];
export type CampaignStatus = Database['public']['Enums']['campaign_status'];

export interface PayFloorRow {
  deliverableType: DeliverableType;
  minNetFcfa: number | null;
  updatedAt: string | null;
}

/** All briefs, newest first (admin_list_managed_briefs). null = unavailable (RPC missing / not admin). */
export async function listManagedBriefs(): Promise<ManagedBriefRow[] | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('admin_list_managed_briefs');
    if (error || !data) return null;
    return data;
  } catch {
    return null;
  }
}

export async function getManagedBrief(id: string): Promise<ManagedBriefRow | null> {
  if (!isCampaignId(id)) return null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from('managed_briefs').select('*').eq('id', id).maybeSingle();
    return error ? null : (data ?? null);
  } catch {
    return null;
  }
}

/** Status of the briefs' linked campaigns (admins read every campaign under RLS). */
export async function campaignStatuses(ids: string[]): Promise<Record<string, CampaignStatus>> {
  const list = ids.filter(isCampaignId);
  if (!list.length) return {};
  try {
    const supabase = await createClient();
    const { data } = await supabase.from('campaigns').select('id, status').in('id', list);
    return Object.fromEntries((data ?? []).map((c) => [c.id, c.status]));
  } catch {
    return {};
  }
}

/** Every deliverable type with its floor (pay_floor_list, admin only). null = unavailable. */
export async function listPayFloors(): Promise<PayFloorRow[] | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('pay_floor_list');
    if (error || !data) return null;
    return data.map((r) => ({ deliverableType: r.deliverable_type, minNetFcfa: r.min_net_fcfa ?? null, updatedAt: r.updated_at ?? null }));
  } catch {
    return null;
  }
}

export function floorMap(rows: PayFloorRow[] | null): FloorMap {
  return Object.fromEntries((rows ?? []).map((r) => [r.deliverableType, r.minNetFcfa])) as FloorMap;
}

/**
 * Floors that are SET, for any signed-in user (pay_floors_public) — the brand form's R5 warning.
 * Admin pages keep pay_floor_list(). Best-effort: any error → {} (no warning, never a block).
 */
export async function publicFloorMap(): Promise<FloorMap> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('pay_floors_public');
    if (error || !data) return {};
    return Object.fromEntries(data.map((r) => [r.deliverable_type, r.min_net_fcfa])) as FloorMap;
  } catch {
    return {};
  }
}
