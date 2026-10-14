// admin_partner_overview JSON shape + defensive normalisation (pure; testable outside the server).

export interface PartnerOverview {
  partner: { id: string; handle: string; display_name: string; status: string; directory_listed: boolean; listing_reason: string | null; listing_changed_at: string | null; specialties: string[]; specialties_legacy: string[] | null; payouts_on_hold: boolean; cgu_version: string | null };
  links: { id: string; creator_id: string; creator_handle: string; commission_rate: number; status: string; invited_at: string | null; responded_at: string | null; ended_at: string | null }[];
  deals: { id: string; campaign_id: string; campaign_title: string; creator_handle: string; status: string; agreed_payout_fcfa: number; commission_rate: number | null; applied_by_partner: boolean; updated_at: string }[];
  commissions: { owed_fcfa: number; paid_fcfa: number; count: number };
  retainers: { id: string; brand_id: string; brand_handle: string; status: string; contract_value_fcfa: number; partner_accepted_at: string | null; settlements: { id: string; kind: string; amount_fcfa: number; status: string }[]; created_at: string }[];
  assignments: { id: string; brand_id: string; brand_handle: string; campaign_id: string | null; origin: string; status: string; conversation_id: string | null; created_at: string; ended_at: string | null; end_reason: string | null }[];
  end_requests: { id: string; assignment_id: string; reason: string; status: string; decision_note: string | null; created_at: string; decided_at: string | null }[];
  contact_requests: { id: string; brand_handle: string; status: string; decision_reason_code: string | null; created_at: string }[];
  flags: { open: number; last_30_days: number; recent: { id: string; source: string; kinds: string[]; mask_count: number; status: string; created_at: string }[] };
  self_dealing: { id: string; brand_id: string; kinds: string[]; source: string; status: string; created_at: string }[];
}

const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const n0 = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** Defensive normalisation of admin_partner_overview's JSON (missing arrays/counts default). */
export function normalizeOverview(raw: unknown): PartnerOverview | null {
  const r = raw as Record<string, any> | null;
  if (!r || typeof r !== 'object' || !r.partner) return null;
  const p = r.partner;
  return {
    partner: {
      id: String(p.id), handle: String(p.handle ?? ''), display_name: String(p.display_name ?? ''), status: String(p.status ?? ''),
      directory_listed: p.directory_listed !== false, listing_reason: p.listing_reason ?? null, listing_changed_at: p.listing_changed_at ?? null,
      specialties: arr<string>(p.specialties), specialties_legacy: Array.isArray(p.specialties_legacy) && p.specialties_legacy.length ? p.specialties_legacy : null,
      payouts_on_hold: !!p.payouts_on_hold, cgu_version: p.cgu_version ?? null,
    },
    links: arr(r.links), deals: arr(r.deals),
    commissions: { owed_fcfa: n0(r.commissions?.owed_fcfa), paid_fcfa: n0(r.commissions?.paid_fcfa), count: n0(r.commissions?.count) },
    retainers: arr<any>(r.retainers).map((x) => ({ ...x, settlements: arr(x.settlements) })),
    assignments: arr(r.assignments), end_requests: arr(r.end_requests), contact_requests: arr(r.contact_requests),
    flags: { open: n0(r.flags?.open), last_30_days: n0(r.flags?.last_30_days), recent: arr(r.flags?.recent) },
    self_dealing: arr(r.self_dealing),
  };
}

