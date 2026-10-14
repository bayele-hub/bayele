// Admin member review (D2/D4/D7, migration 0036): URL filters, decision validation (mirrors
// admin_moderate_member) and the admin_member_detail shape. Pure; shared by pages, actions and tests.

import { isCountryCode, type CountryCode } from '@/lib/countries';

export const MEMBER_STATUSES = ['pending_review', 'active', 'suspended', 'rejected'] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];
export const MEMBER_ROLES = ['creator', 'business', 'consultant', 'super_admin'] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];
export const PAGE_SIZE = 50;

export interface MemberFilters {
  /** null = « Tous ». */
  status: MemberStatus | null;
  role: MemberRole | null;
  country: CountryCode | null;
  q: string;
  /** « À vérifier » toggle. */
  flag: boolean;
  page: number;
}

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

/**
 * Parse the URL. No `status` at all → « À valider » when `pendingCount > 0` (design §A.3: first and
 * default when there are pending members); `status=all` → every status.
 */
export function parseMemberFilters(sp: SP, pendingCount = 0): MemberFilters {
  const rawStatus = one(sp.status);
  const status: MemberStatus | null =
    rawStatus === 'all' ? null : (MEMBER_STATUSES as readonly string[]).includes(rawStatus) ? (rawStatus as MemberStatus) : rawStatus ? null : pendingCount > 0 ? 'pending_review' : null;
  const role = (MEMBER_ROLES as readonly string[]).includes(one(sp.role)) ? (one(sp.role) as MemberRole) : null;
  const c = one(sp.country).toUpperCase();
  const page = Math.max(1, Math.min(10_000, Math.floor(Number(one(sp.page)) || 1)));
  return { status, role, country: isCountryCode(c) ? c : null, q: one(sp.q).trim().slice(0, 80), flag: one(sp.flag) === '1', page };
}

/** Canonical URL for a filter set (status `all` is explicit so it survives the pending default). */
export function membersHref(f: MemberFilters, over: Partial<MemberFilters> = {}): string {
  const n = { ...f, ...over };
  const p = new URLSearchParams();
  p.set('status', n.status ?? 'all');
  if (n.role) p.set('role', n.role);
  if (n.country) p.set('country', n.country);
  if (n.q) p.set('q', n.q);
  if (n.flag) p.set('flag', '1');
  if (n.page > 1) p.set('page', String(n.page));
  return `/admin/users?${p.toString()}`;
}

export function hasActiveFilters(f: MemberFilters): boolean {
  return !!(f.role || f.country || f.q || f.flag);
}

/** « 51–100 » for page 2 of 50; null when empty. */
export function pageRange(page: number, total: number, size = PAGE_SIZE): { from: number; to: number } | null {
  if (total <= 0) return null;
  const from = (page - 1) * size + 1;
  if (from > total) return null;
  return { from, to: Math.min(total, page * size) };
}

/** The detail page's back link: only an internal /admin/users URL is accepted (same-origin rule). */
export function safeMembersBack(from: string | null | undefined): string {
  const v = (from ?? '').trim();
  return /^\/admin\/users(\?[^\s]*)?$/.test(v) && !v.startsWith('//') ? v : '/admin/users';
}

// ── Decisions (D4) ────────────────────────────────────────────────────────────────────────────────

export const DECISION_ACTIONS = ['approve', 'reject', 'request_changes', 'suspend', 'reactivate'] as const;
export type DecisionAction = (typeof DECISION_ACTIONS)[number];
export const REASON_CODES = ['fake_or_unreachable', 'duplicate', 'incomplete', 'inappropriate', 'not_eligible', 'spam_or_test', 'other'] as const;
export type ReasonCode = (typeof REASON_CODES)[number];
export const FIX_FIELDS = ['city', 'bio', 'avatar', 'socials', 'payout_phone', 'display_name', 'company_info', 'phone', 'other'] as const;
export type FixField = (typeof FIX_FIELDS)[number];
export const MESSAGE_MAX = 500;
export const NOTE_MAX = 1000;

/** Which decisions the bar offers for a status (same matrix as the RPC). */
export function allowedDecisions(status: string): DecisionAction[] {
  switch (status) {
    case 'pending_review':
      return ['reject', 'request_changes', 'approve', 'suspend'];
    case 'active':
      return ['request_changes', 'suspend'];
    case 'suspended':
    case 'rejected':
      return ['reactivate'];
    default:
      return [];
  }
}

export function needsReason(a: DecisionAction): boolean {
  return a === 'reject' || a === 'request_changes' || a === 'suspend';
}

export interface DecisionInput {
  action: string;
  reasonCode?: string | null;
  message?: string | null;
  note?: string | null;
  fields?: string[] | null;
}

export type DecisionError = 'invalid_action' | 'reason_required' | 'invalid_reason_code' | 'message_required' | 'message_too_long' | 'note_too_long' | 'fields_required' | 'invalid_fields';

/** Client + server-action validation, same rules as admin_moderate_member (the RPC re-checks). */
export function validateDecision(d: DecisionInput): DecisionError | null {
  if (!(DECISION_ACTIONS as readonly string[]).includes(d.action)) return 'invalid_action';
  const a = d.action as DecisionAction;
  const msg = (d.message ?? '').trim();
  if (msg.length > MESSAGE_MAX) return 'message_too_long';
  if ((d.note ?? '').trim().length > NOTE_MAX) return 'note_too_long';
  if (needsReason(a)) {
    if (!d.reasonCode) return 'reason_required';
    if (!(REASON_CODES as readonly string[]).includes(d.reasonCode)) return 'invalid_reason_code';
    if (d.reasonCode === 'other' && !msg) return 'message_required';
  }
  if (a === 'request_changes') {
    const f = d.fields ?? [];
    if (!f.length) return 'fields_required';
    if (f.some((x) => !(FIX_FIELDS as readonly string[]).includes(x))) return 'invalid_fields';
  }
  return null;
}

// ── Detail (admin_member_detail JSON) ─────────────────────────────────────────────────────────────

export interface Sensitive {
  present: boolean;
  masked: string | null;
}

export type RevealField = 'phone' | 'email' | 'creator_payout_phone' | 'partner_payout_phone' | 'business_tax_id' | 'partner_tax_id' | 'billing_email' | 'billing_address';
export const REVEAL_FIELDS: RevealField[] = ['phone', 'email', 'creator_payout_phone', 'partner_payout_phone', 'business_tax_id', 'partner_tax_id', 'billing_email', 'billing_address'];

export interface ModerationEvent {
  id: number | string;
  action: string;
  from_status: string | null;
  to_status: string | null;
  reason_code: string | null;
  message: string | null;
  internal_note: string | null;
  correction_fields: string[] | null;
  admin_handle: string | null;
  at: string;
}

export interface AdminMemberDetail {
  profile: {
    id: string; handle: string; display_name: string; avatar_url: string | null; bio: string | null; city: string; country: string;
    status: MemberStatus; created_at: string; updated_at: string | null; resubmitted_at: string | null; roles: MemberRole[];
    phone: Sensitive; email: Sensitive; last_sign_in_at: string | null; email_confirmed_at: string | null;
  };
  creator: null | {
    categories: string[]; audience_size: number; platforms: Record<string, { url?: string; followers?: number } | null>;
    is_pro: boolean; pro_expires_at: string | null; rating: { value: number | null; is_default: boolean; reviews: number };
    payout: { phone: Sensitive; provider: string | null }; founder_number: number | null;
    partner: { id: string; handle: string; display_name: string; commission_rate: number; since: string | null } | null;
    pending_partner_offers: number;
    stats: { applications: Record<string, number>; earnings_gross_fcfa: number; earnings_net_fcfa: number; partner_commission_fcfa: number; pending_payout_fcfa: number; proofs_rejected: number };
  };
  partner: null | {
    specialties: string[]; years_experience: number; agency_access: boolean; rating: { value: number | null; is_default: boolean; reviews: number };
    tax_id: Sensitive; payout: { phone: Sensitive; provider: string | null };
    stats: { creators_active: number; creators_ended: number; invites_pending: number; applications_made: number; commission_owed_fcfa: number; commission_paid_fcfa: number; retainers: Record<string, number>; settlements_pending_fcfa: number; settlements_paid_fcfa: number };
  };
  business: null | {
    company_name: string | null; industry: string | null; website: string | null; is_verified: boolean; sokoclick_customer_id: string | null;
    billing_email: Sensitive; billing_address: Sensitive; tax_id: Sensitive;
    stats: { campaigns: Record<string, number>; funded_total_fcfa: number; fees_fcfa: number; escrow_held_net_fcfa: number; refunded_total_fcfa: number; leftover_refund_pending_fcfa: number; retainers: Record<string, number>; retainer_funded_value_fcfa: number };
  };
  trust: { disputes: number; conversations: number; reports_involving: number };
  attribution: { signup_source: string; referred_by: { id: string; handle: string } | null; created_at: string } | null;
  referrals: number;
  moderation: { open_correction: { id: string; fields: string[]; reason_code: string; message: string | null; requested_at: string } | null; history: ModerationEvent[] };
  checklist: string[];
}

const S0: Sensitive = { present: false, masked: null };
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const sens = (v: unknown): Sensitive => {
  const o = v as Partial<Sensitive> | null | undefined;
  return o && typeof o === 'object' ? { present: !!o.present, masked: typeof o.masked === 'string' ? o.masked : null } : S0;
};

/**
 * Defensive normalisation of the RPC JSON: defaults for missing maps/counts, Sensitive objects never
 * carry a full value (only `present` + `masked` are kept, whatever the server sent).
 */
export function normalizeDetail(raw: unknown): AdminMemberDetail | null {
  const r = raw as Record<string, any> | null;
  if (!r || typeof r !== 'object' || !r.profile) return null;
  const p = r.profile;
  const detail: AdminMemberDetail = {
    profile: {
      id: String(p.id), handle: String(p.handle ?? ''), display_name: String(p.display_name ?? ''), avatar_url: p.avatar_url ?? null,
      bio: p.bio ?? null, city: String(p.city ?? ''), country: String(p.country ?? ''), status: p.status, created_at: p.created_at,
      updated_at: p.updated_at ?? null, resubmitted_at: p.resubmitted_at ?? null, roles: Array.isArray(p.roles) ? p.roles : [],
      phone: sens(p.phone), email: sens(p.email), last_sign_in_at: p.last_sign_in_at ?? null, email_confirmed_at: p.email_confirmed_at ?? null,
    },
    creator: r.creator
      ? {
          categories: r.creator.categories ?? [], audience_size: num(r.creator.audience_size), platforms: r.creator.platforms ?? {},
          is_pro: !!r.creator.is_pro, pro_expires_at: r.creator.pro_expires_at ?? null,
          rating: { value: r.creator.rating?.value ?? null, is_default: r.creator.rating?.is_default !== false, reviews: num(r.creator.rating?.reviews) },
          payout: { phone: sens(r.creator.payout?.phone), provider: r.creator.payout?.provider ?? null }, founder_number: r.creator.founder_number ?? null,
          partner: r.creator.partner ?? null, pending_partner_offers: num(r.creator.pending_partner_offers),
          stats: {
            applications: r.creator.stats?.applications ?? {}, earnings_gross_fcfa: num(r.creator.stats?.earnings_gross_fcfa),
            earnings_net_fcfa: num(r.creator.stats?.earnings_net_fcfa), partner_commission_fcfa: num(r.creator.stats?.partner_commission_fcfa),
            pending_payout_fcfa: num(r.creator.stats?.pending_payout_fcfa), proofs_rejected: num(r.creator.stats?.proofs_rejected),
          },
        }
      : null,
    partner: r.partner
      ? {
          specialties: r.partner.specialties ?? [], years_experience: num(r.partner.years_experience), agency_access: !!r.partner.agency_access,
          rating: { value: r.partner.rating?.value ?? null, is_default: r.partner.rating?.is_default !== false, reviews: num(r.partner.rating?.reviews) },
          tax_id: sens(r.partner.tax_id), payout: { phone: sens(r.partner.payout?.phone), provider: r.partner.payout?.provider ?? null },
          stats: {
            creators_active: num(r.partner.stats?.creators_active), creators_ended: num(r.partner.stats?.creators_ended), invites_pending: num(r.partner.stats?.invites_pending),
            applications_made: num(r.partner.stats?.applications_made), commission_owed_fcfa: num(r.partner.stats?.commission_owed_fcfa),
            commission_paid_fcfa: num(r.partner.stats?.commission_paid_fcfa), retainers: r.partner.stats?.retainers ?? {},
            settlements_pending_fcfa: num(r.partner.stats?.settlements_pending_fcfa), settlements_paid_fcfa: num(r.partner.stats?.settlements_paid_fcfa),
          },
        }
      : null,
    business: r.business
      ? {
          company_name: r.business.company_name ?? null, industry: r.business.industry ?? null, website: r.business.website ?? null,
          is_verified: !!r.business.is_verified, sokoclick_customer_id: r.business.sokoclick_customer_id ?? null,
          billing_email: sens(r.business.billing_email), billing_address: sens(r.business.billing_address), tax_id: sens(r.business.tax_id),
          stats: {
            campaigns: r.business.stats?.campaigns ?? {}, funded_total_fcfa: num(r.business.stats?.funded_total_fcfa), fees_fcfa: num(r.business.stats?.fees_fcfa),
            escrow_held_net_fcfa: num(r.business.stats?.escrow_held_net_fcfa), refunded_total_fcfa: num(r.business.stats?.refunded_total_fcfa),
            leftover_refund_pending_fcfa: num(r.business.stats?.leftover_refund_pending_fcfa), retainers: r.business.stats?.retainers ?? {},
            retainer_funded_value_fcfa: num(r.business.stats?.retainer_funded_value_fcfa),
          },
        }
      : null,
    trust: { disputes: num(r.trust?.disputes), conversations: num(r.trust?.conversations), reports_involving: num(r.trust?.reports_involving) },
    attribution: r.attribution ?? null,
    referrals: num(r.referrals),
    moderation: { open_correction: r.moderation?.open_correction ?? null, history: Array.isArray(r.moderation?.history) ? r.moderation.history : [] },
    checklist: Array.isArray(r.checklist) ? r.checklist : [],
  };
  return detail;
}

/** Sum of a status → count map (missing keys = 0). */
export function countOf(map: Record<string, number> | null | undefined, keys?: string[]): number {
  const m = map ?? {};
  return (keys ?? Object.keys(m)).reduce((s, k) => s + (Number(m[k]) || 0), 0);
}
