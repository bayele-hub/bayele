// Pure helpers for the « Briefs gérés » tracker: the display pipeline (design §1.1 adapted to E6),
// staleness, search and sort. « Prête à publier » is not a DB status any more (E6 removed `ready`):
// it is derived — a brief with no live campaign whose « OUI » and proof are recorded.

import type { Database } from '@bayele/database';
import { briefChecklist, CHECKLIST_KEYS, floorCheck, managedNetPreview, type BriefDraft, type FloorMap } from '@/lib/managed-listing';
import { doualaToday } from '@/lib/campaign-board';

type Row = Database['public']['Tables']['managed_briefs']['Row'];
type CampaignStatus = Database['public']['Enums']['campaign_status'];

export const PIPELINE = ['draft', 'awaiting_order', 'ready', 'awaiting_payment', 'published', 'declined'] as const;
export type PipelineKey = (typeof PIPELINE)[number];
export const ACTIVE_STAGES: PipelineKey[] = ['draft', 'awaiting_order', 'ready', 'awaiting_payment'];

export function isPipelineKey(v: unknown): v is PipelineKey {
  return typeof v === 'string' && (PIPELINE as readonly string[]).includes(v);
}

/** « Live » brief (E5/E8): linked campaign exists and is not cancelled. */
export function isLive(campaignId: string | null, campaignStatus: CampaignStatus | null | undefined): boolean {
  return !!campaignId && !!campaignStatus && campaignStatus !== 'cancelled';
}

export function pipelineKey(b: Pick<Row, 'status' | 'order_confirmed_at' | 'order_proof' | 'campaign_id'>, campaignStatus?: CampaignStatus | null): PipelineKey {
  if (b.status === 'published' || b.status === 'declined' || b.status === 'awaiting_payment') return b.status;
  const live = isLive(b.campaign_id, campaignStatus ?? null);
  if (!live && b.order_confirmed_at && (b.order_proof ?? '').trim()) return 'ready';
  return b.status;
}

const DAY = 86_400_000;

/** Whole days since `iso` (0 = today). */
export function ageDays(iso: string, now: Date = new Date()): number {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : Math.max(0, Math.floor((now.getTime() - t) / DAY));
}

/** awaiting_order / awaiting_payment untouched for more than 48 h → « À relancer » (M6 window). */
export function isStale(key: PipelineKey, updatedAt: string, now: Date = new Date()): boolean {
  if (key !== 'awaiting_order' && key !== 'awaiting_payment') return false;
  const t = Date.parse(updatedAt);
  return !Number.isNaN(t) && now.getTime() - t > 2 * DAY;
}

const fold = (s: string | null | undefined) => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Search on internal name, public label and contact phone digits. */
export function matchesQuery(b: Pick<Row, 'brand_name' | 'brand_label' | 'contact_whatsapp'>, q: string): boolean {
  const query = fold(q).trim();
  if (!query) return true;
  const digits = query.replace(/\D/g, '');
  if (fold(b.brand_name).includes(query) || fold(b.brand_label).includes(query)) return true;
  return digits.length >= 3 && (b.contact_whatsapp ?? '').replace(/\D/g, '').includes(digits);
}

/** Active stages: the brief waiting longest first; published / declined: most recent first. */
export function sortBriefs<T extends Pick<Row, 'updated_at'>>(rows: T[], filter: PipelineKey | 'all' | null): T[] {
  const asc = filter === null || (filter !== 'all' && ACTIVE_STAGES.includes(filter));
  return [...rows].sort((a, b) => (asc ? 1 : -1) * (Date.parse(a.updated_at) - Date.parse(b.updated_at)));
}

// ── Row ⇄ editor draft ────────────────────────────────────────────────────────────────────────────


/** A stored brief as the editor's draft (the checklist and the tracker's « 13/15 champs » read it). */
export function draftFromRow(b: Row): BriefDraft {
  return {
    brandName: b.brand_name ?? '',
    brandLabel: b.brand_label ?? '',
    realName: !!b.brand_consent,
    brandConsent: !!b.brand_consent,
    brandConsentProof: b.brand_consent_proof ?? '',
    city: b.city ?? '',
    country: b.country ?? '',
    service: b.service ?? '',
    title: b.title ?? '',
    category: b.category ?? b.sector ?? '',
    deliverableType: b.deliverable_type ?? '',
    deliverableCount: b.deliverable_type ? String(b.deliverable_count ?? '') : '',
    platforms: b.platforms ?? [],
    deliverables: b.deliverables ?? '',
    deadline: b.deadline ?? '',
    totalBudget: b.total_budget_fcfa ? String(b.total_budget_fcfa) : '',
    places: String(b.places ?? 1),
    rightsText: b.usage_rights ?? '',
    creatorRequirements: b.creator_requirements ?? '',
    language: b.language ?? '',
    claimsVerified: !!b.claims_verified,
    orderConfirmed: !!b.order_confirmed_at,
    orderProof: b.order_proof ?? '',
  };
}

/** « 13/15 champs » for a tracker row (same 15 items as the editor). */
export function rowChecklist(b: Row, floors: FloorMap, today: string = doualaToday()): { done: number; total: number } {
  const d = draftFromRow(b);
  const net = managedNetPreview(d.totalBudget, d.places, d.deliverableCount);
  const c = briefChecklist(d, floorCheck(d.deliverableType || null, Number(d.deliverableCount) || 1, net, floors), today);
  return { done: CHECKLIST_KEYS.filter((k) => c[k]).length, total: CHECKLIST_KEYS.length };
}
