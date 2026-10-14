// Agency retainers (O7, migration 0035). Bayele's cut is fixed server-side at 25 % (the client value
// is ignored); the partner must accept before the brand can invoice; funded/active retainers end only
// through the admin settlement. Pure helpers shared by the brand form, both lists and the tests.

export const RETAINER_CUT_PCT = 25;

/** cut = floor(contract × 25 / 100), net = contract − cut (= partner fee + media budget). */
export function retainerSplit(contract: unknown): { contract: number; cut: number; net: number } | null {
  const c = Math.floor(Number(contract));
  if (!Number.isFinite(c) || c <= 0) return null;
  const cut = Math.floor((c * RETAINER_CUT_PCT) / 100);
  return { contract: c, cut, net: c - cut };
}

/** fee + media must equal the net exactly (the RPC raises `invalid_split` otherwise). */
export function splitIsBalanced(contract: unknown, fee: unknown, media: unknown): boolean {
  const s = retainerSplit(contract);
  const f = Math.floor(Number(fee));
  const m = Math.floor(Number(media));
  return !!s && f >= 0 && m >= 0 && f + m === s.net;
}

export interface RetainerRowLike {
  status: string;
  partner_accepted_at?: string | null;
  partner_declined_at?: string | null;
}

export type RetainerStage =
  | 'awaiting_partner'
  | 'declined'
  | 'ready_to_invoice'
  | 'invoiced'
  | 'funded'
  | 'active'
  | 'completed'
  | 'terminated';

export function retainerStage(r: RetainerRowLike): RetainerStage {
  if (r.partner_declined_at) return 'declined';
  switch (r.status) {
    case 'draft':
      return r.partner_accepted_at ? 'ready_to_invoice' : 'awaiting_partner';
    case 'invoiced':
      // legacy rows invoiced before 0035 may still be awaiting the partner's answer
      return r.partner_accepted_at ? 'invoiced' : 'awaiting_partner';
    case 'funded':
    case 'active':
    case 'completed':
    case 'terminated':
      return r.status;
    default:
      return 'terminated';
  }
}

/** The brand may attach the invoice only once the partner has accepted (O7). */
export function canInvoice(r: RetainerRowLike): boolean {
  return retainerStage(r) === 'ready_to_invoice';
}

/** The partner can answer a draft (or legacy invoiced) retainer they haven't answered yet. */
export function canRespond(r: RetainerRowLike): boolean {
  return retainerStage(r) === 'awaiting_partner' && (r.status === 'draft' || r.status === 'invoiced');
}

/** Early end (admin): kept = floor(cut × p / net), brand refund = contract − p − kept. */
export function earlyEndSettlement(contract: number, partnerPayout: number): { kept: number; refund: number } | null {
  const s = retainerSplit(contract);
  const p = Math.floor(partnerPayout);
  if (!s || !Number.isFinite(p) || p < 0 || p > s.net) return null;
  const kept = Math.floor((s.cut * p) / s.net);
  return { kept, refund: s.contract - p - kept };
}
