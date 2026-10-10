'use server';

import { revalidatePath } from 'next/cache';
import type { Database } from '@bayele/database';
import { createClient } from '@/lib/supabase/server';
import { getDictionary } from '@/i18n/dictionaries';
import { managedErrorMessage } from '@/lib/managed-errors';

/**
 * Admin « Briefs gérés » actions. Every check (admin, E5 lock, E6 statuses, listing standard, floor,
 * claims) lives in the SECURITY DEFINER RPCs of migration 0033; these relay the caller's session and
 * map the contract error codes to copy (lib/managed-errors.ts).
 */

// The generated Json type, reached through the RPC signature (@bayele/database exports only Database).
type Json = Database['public']['Functions']['admin_upsert_managed_brief']['Args']['p_brief'];

export type BriefResult = { ok: true; id: string; at: string } | { ok: false; error: string; code?: string; details?: string };

// The keys admin_upsert_managed_brief accepts (contract §5). Anything else is dropped here.
const KEYS = [
  'id', 'brand_name', 'brand_label', 'brand_consent', 'brand_consent_proof', 'contact_name', 'contact_whatsapp', 'country',
  'city', 'sector', 'category', 'service', 'title', 'deliverables', 'deliverable_type', 'deliverable_count', 'places',
  'total_budget_fcfa', 'platforms', 'content_type', 'language', 'usage_rights', 'creator_requirements', 'equipment',
  'claims_verified', 'deadline', 'order_confirmed_at', 'order_proof', 'deposit_status', 'status', 'notes',
] as const;

export type BriefPayload = Partial<Record<(typeof KEYS)[number], Json>>;

async function fail(error: { message?: string; details?: string } | null): Promise<BriefResult> {
  const { locale } = await getDictionary();
  return { ok: false, error: managedErrorMessage(error, locale), code: error?.message?.trim(), details: error?.details ?? undefined };
}

function revalidate(id?: string) {
  revalidatePath('/admin/briefs');
  if (id) revalidatePath(`/admin/briefs/${id}`);
  revalidatePath('/admin/funding');
}

export async function saveBriefAction(payload: BriefPayload): Promise<BriefResult> {
  const clean: Record<string, Json> = {};
  for (const k of KEYS) if (k in payload && payload[k] !== undefined) clean[k] = payload[k] as Json;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_upsert_managed_brief', { p_brief: clean as Json });
  if (error || !data) return fail(error);
  revalidate(data);
  return { ok: true, id: data, at: new Date().toISOString() };
}

/** Manual status (E6): only draft / awaiting_order here; declining goes through declineBriefAction. */
export async function setBriefStatusAction(id: string, status: 'draft' | 'awaiting_order'): Promise<BriefResult> {
  if (status !== 'draft' && status !== 'awaiting_order') return fail({ message: 'invalid_status' });
  return saveBriefAction({ id, status });
}

/** Creates the campaign in pending_funding (invisible until admin_confirm_campaign_funding). */
export async function publishBriefAction(id: string): Promise<BriefResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_publish_managed_brief', { p_brief_id: id });
  if (error || !data) return fail(error);
  revalidate(id);
  return { ok: true, id: data, at: new Date().toISOString() };
}

/** E4: declines the brief and cancels its unfunded (pending_funding) campaign in the same RPC. */
export async function declineBriefAction(id: string, reason: string): Promise<BriefResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_decline_managed_brief', { p_brief_id: id, p_reason: reason.trim().slice(0, 500) || undefined });
  if (error) return fail(error);
  revalidate(id);
  return { ok: true, id, at: new Date().toISOString() };
}

/**
 * « Dupliquer » (design §2.10): a new draft with every listing field, without status, « OUI »,
 * deposit, consent proof or campaign link — how a monthly renewal is sold (M9).
 */
export async function duplicateBriefAction(id: string): Promise<BriefResult> {
  const supabase = await createClient();
  const { data: b, error } = await supabase.from('managed_briefs').select('*').eq('id', id).maybeSingle();
  if (error || !b) return fail(error ?? { message: 'brief_not_found' });
  return saveBriefAction({
    brand_name: b.brand_name,
    brand_label: b.brand_label,
    brand_consent: b.brand_consent,
    contact_name: b.contact_name,
    contact_whatsapp: b.contact_whatsapp,
    country: b.country,
    city: b.city,
    sector: b.sector,
    category: b.category,
    service: b.service,
    title: b.title,
    deliverables: b.deliverables,
    deliverable_type: b.deliverable_type,
    deliverable_count: b.deliverable_count,
    places: b.places,
    total_budget_fcfa: b.total_budget_fcfa,
    platforms: b.platforms,
    content_type: b.content_type,
    language: b.language,
    usage_rights: b.usage_rights,
    creator_requirements: b.creator_requirements,
    equipment: b.equipment,
    claims_verified: b.claims_verified,
    deadline: b.deadline,
  });
}
