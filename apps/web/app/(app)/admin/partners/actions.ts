'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getDictionary } from '@/i18n/dictionaries';
import { mapCode } from '@/lib/gov/rules';
import { retainerSplit } from '@/lib/retainers';
import type { BrandSearchRow } from '@/lib/data/partner-gov';
import type { CountryCode } from '@/lib/countries';
import { isCountryCode } from '@/lib/countries';

export type GovResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

async function errorFor(code: string | undefined): Promise<string> {
  const { t } = await getDictionary();
  const E = t.adminPartners.errors as Record<string, string>;
  return mapCode(E, code, E.generic!);
}

function refresh(partnerId?: string) {
  revalidatePath('/admin/partners');
  revalidatePath('/admin/partners/requests');
  revalidatePath('/admin/partners/assignments');
  revalidatePath('/admin/partners/flags');
  if (partnerId) revalidatePath(`/admin/partners/${partnerId}`);
}

const clip = (s: string | null | undefined, n: number) => (s ?? '').trim().slice(0, n + 1);

/** G2: delist (reason required) / relist (reason optional). */
export async function setListingAction(partnerId: string, listed: boolean, reason: string): Promise<GovResult> {
  const why = clip(reason, 500);
  if (!listed && !why) return { ok: false, error: await errorFor('reason_required') };
  if (why.length > 500) return { ok: false, error: await errorFor('reason_too_long') };
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_set_partner_listing', { p_partner_id: partnerId, p_listed: listed, p_reason: why || undefined });
  if (error) return { ok: false, error: await errorFor(error.message) };
  refresh(partnerId);
  return { ok: true, data: null };
}

/** « Mettre en relation » brand search: approved brands only, from 2 characters. */
export async function searchBrandsAction(query: string): Promise<GovResult<BrandSearchRow[]>> {
  const q = query.trim();
  if (q.length < 2) return { ok: false, error: await errorFor('query_too_short') };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_search_brands', { p_query: q.slice(0, 80), p_limit: 20 });
  if (error) return { ok: false, error: await errorFor(error.message) };
  return { ok: true, data: data ?? [] };
}

export async function brandCampaignsAction(brandId: string): Promise<GovResult<{ id: string; title: string; status: string }[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('campaigns').select('id, title, status').eq('owner_id', brandId).order('created_at', { ascending: false }).limit(50);
  if (error) return { ok: false, error: await errorFor(undefined) };
  return { ok: true, data: data ?? [] };
}

/** P3: an admin assignment is active at once and opens the conversation. Note ≤ 280. */
export async function assignPartnerAction(partnerId: string, brandId: string, campaignId: string | null, note: string): Promise<GovResult<{ conversationId: string | null }>> {
  const n = (note ?? '').trim();
  if (n.length > 280) return { ok: false, error: await errorFor('note_too_long') };
  if (!brandId) return { ok: false, error: (await getDictionary()).t.adminPartners.pickBrand };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_assign_partner', { p_partner_id: partnerId, p_brand_id: brandId, p_campaign_id: campaignId || undefined, p_note: n || undefined });
  if (error) return { ok: false, error: await errorFor(error.message) };
  const { data: a } = await supabase.from('partner_assignments').select('conversation_id').eq('id', data as string).maybeSingle();
  refresh(partnerId);
  return { ok: true, data: { conversationId: a?.conversation_id ?? null } };
}

export async function endAssignmentAction(assignmentId: string, reason: string, partnerId?: string): Promise<GovResult> {
  const why = clip(reason, 500);
  if (!why) return { ok: false, error: await errorFor('reason_required') };
  if (why.length > 500) return { ok: false, error: await errorFor('reason_too_long') };
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_end_assignment', { p_assignment_id: assignmentId, p_reason: why });
  if (error) return { ok: false, error: await errorFor(error.message) };
  refresh(partnerId);
  return { ok: true, data: null };
}

export async function dismissEndRequestAction(requestId: string, note: string): Promise<GovResult> {
  const n = clip(note, 500);
  if (!n) return { ok: false, error: (await getDictionary()).t.adminPartners.errors.note_required_dismiss };
  if (n.length > 500) return { ok: false, error: await errorFor('message_too_long') };
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_dismiss_assignment_end_request', { p_request_id: requestId, p_note: n });
  if (error) return { ok: false, error: error.message === 'note_required' ? (await getDictionary()).t.adminPartners.errors.note_required_dismiss : await errorFor(error.message) };
  refresh();
  return { ok: true, data: null };
}

export async function endRepresentationAction(linkId: string, reason: string, partnerId: string): Promise<GovResult> {
  const why = clip(reason, 500);
  if (!why) return { ok: false, error: await errorFor('reason_required') };
  if (why.length > 500) return { ok: false, error: await errorFor('reason_too_long') };
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_end_representation', { p_link_id: linkId, p_reason: why });
  if (error) return { ok: false, error: await errorFor(error.message) };
  refresh(partnerId);
  return { ok: true, data: null };
}

/** Parse « 12,5 » / « 12.5 » (percent) into the stored fraction (0.125). null when invalid. */
function parseRatePct(raw: string): number | null {
  const v = Number(String(raw).replace(',', '.').replace(/[%\s]/g, ''));
  if (!Number.isFinite(v) || v < 1 || v > 30) return null;
  return Math.round(v * 10) / 1000;
}

export async function setCommissionRateAction(linkId: string, ratePct: string, reason: string, partnerId: string): Promise<GovResult> {
  const rate = parseRatePct(ratePct);
  if (rate === null) return { ok: false, error: await errorFor('invalid_commission_rate') };
  const why = clip(reason, 500);
  if (!why) return { ok: false, error: await errorFor('reason_required') };
  if (why.length > 500) return { ok: false, error: await errorFor('reason_too_long') };
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_set_commission_rate', { p_link_id: linkId, p_rate: rate, p_reason: why });
  if (error) return { ok: false, error: await errorFor(error.message) };
  refresh(partnerId);
  return { ok: true, data: null };
}

/** §1.7: Bayele proposes a retainer on the brand's behalf (25 % cut fixed, no assignment needed). */
export async function adminProposeRetainerAction(input: { brandId: string; partnerId: string; contract: number; fee: number; media: number; kpi: number }): Promise<GovResult> {
  const split = retainerSplit(input.contract);
  if (!input.brandId) return { ok: false, error: (await getDictionary()).t.adminPartners.pickBrand };
  if (!split || input.fee < 0 || input.media < 0 || input.kpi < 0 || input.fee + input.media !== split.net) return { ok: false, error: await errorFor('invalid_amounts') };
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_propose_retainer', {
    p_brand_id: input.brandId, p_partner_id: input.partnerId, p_contract_value: input.contract,
    p_consultant_fee: input.fee, p_media_budget: input.media, p_kpi_bonus: input.kpi || 0,
  });
  if (error) return { ok: false, error: await errorFor(error.message) };
  refresh(input.partnerId);
  revalidatePath('/admin/retainers');
  return { ok: true, data: null };
}

const REASONS = ['incomplete', 'brand_unverified', 'poor_fit', 'suspected_offplatform', 'other'] as const;
type ReasonCode = (typeof REASONS)[number];

/** G4 / P3: approve (assignment active at once) or decline with a reason code (+ message for other). */
export async function decideContactRequestAction(requestId: string, approve: boolean, reasonCode: string | null, message: string): Promise<GovResult<{ conversationId: string | null }>> {
  const msg = (message ?? '').trim();
  if (msg.length > 500) return { ok: false, error: await errorFor('message_too_long') };
  if (!approve) {
    if (!reasonCode) return { ok: false, error: await errorFor('reason_required') };
    if (!(REASONS as readonly string[]).includes(reasonCode)) return { ok: false, error: await errorFor('invalid_reason_code') };
    if (reasonCode === 'other' && !msg) return { ok: false, error: await errorFor('message_required') };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_decide_contact_request', {
    p_request_id: requestId, p_approve: approve, p_reason_code: approve ? undefined : (reasonCode as ReasonCode), p_message: msg || undefined,
  });
  if (error) return { ok: false, error: await errorFor(error.message) };
  let conversationId: string | null = null;
  if (approve && data) {
    const { data: a } = await supabase.from('partner_assignments').select('conversation_id').eq('id', data as string).maybeSingle();
    conversationId = a?.conversation_id ?? null;
  }
  refresh();
  return { ok: true, data: { conversationId } };
}

/** P5: read a masked original with a required reason (logged server-side as a reveal). Never cached. */
export async function readMaskedOriginalAction(messageId: string, reason: string): Promise<GovResult<string>> {
  const why = clip(reason, 500);
  if (!why) return { ok: false, error: await errorFor('reason_required') };
  if (why.length > 500) return { ok: false, error: await errorFor('reason_too_long') };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_read_masked_original', { p_message_id: messageId, p_reason: why });
  if (error) return { ok: false, error: await errorFor(error.message) };
  return { ok: true, data: String(data ?? '') };
}

export async function resolveFlagAction(flagId: string, note: string): Promise<GovResult> {
  const n = (note ?? '').trim();
  if (n.length > 500) return { ok: false, error: await errorFor('note_too_long') };
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_resolve_flag', { p_flag_id: flagId, p_note: n || undefined });
  if (error) return { ok: false, error: await errorFor(error.message) };
  refresh();
  return { ok: true, data: null };
}

export async function decideSelfDealingAction(flagId: string, decision: 'cleared' | 'confirmed', note: string): Promise<GovResult> {
  const n = (note ?? '').trim();
  if (decision === 'confirmed' && !n) return { ok: false, error: await errorFor('note_required') };
  if (n.length > 500) return { ok: false, error: await errorFor('note_too_long') };
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_decide_self_dealing_flag', { p_flag_id: flagId, p_decision: decision, p_note: n || undefined });
  if (error) return { ok: false, error: await errorFor(error.message) };
  refresh();
  return { ok: true, data: null };
}

/** G9: add a member's free-text city to the country list (admin). */
export async function addCityAction(country: string, name: string, memberId: string): Promise<GovResult> {
  const { t } = await getDictionary();
  const E = t.cityPicker.admin.errors as Record<string, string>;
  const city = (name ?? '').replace(/\s+/g, ' ').trim();
  if (!isCountryCode(country) || !city || city.length > 60) return { ok: false, error: E.invalid_city! };
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_add_city', { p_country: country as CountryCode, p_name: city });
  if (error) return { ok: false, error: mapCode(E, error.message, t.adminPartners.errors.generic) };
  revalidatePath(`/admin/users/${memberId}`);
  return { ok: true, data: null };
}
