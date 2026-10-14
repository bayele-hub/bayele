// Pure rules for partner governance (G3, G4, G5, G7, P3). Kept out of components so they are testable.
type Role = string;

/** Map an RPC error code through a namespace's error dictionary; unknown codes fall back. */
export function mapCode(map: Record<string, unknown>, code: string | null | undefined, fallback: string): string {
  const v = code ? map[code] : undefined;
  return typeof v === 'string' && v ? v : fallback;
}

// ---------- G3: retainers only to assigned partners ----------
export interface AssignmentLite { id: string; partner_id: string; brand_id: string; status: 'active' | 'ended'; campaign_id?: string | null }

/** Partners the brand may propose a retainer to: its ACTIVE assignments only (one entry per partner). */
export function retainerPartnerIds(assignments: readonly AssignmentLite[], brandId: string): string[] {
  return Array.from(new Set(assignments.filter((a) => a.brand_id === brandId && a.status === 'active').map((a) => a.partner_id)));
}
export function canProposeRetainer(assignments: readonly AssignmentLite[], brandId: string, partnerId: string): boolean {
  return retainerPartnerIds(assignments, brandId).includes(partnerId);
}

// ---------- §2.1: the « Demander ce partenaire » CTA on /partners/[handle] ----------
export type BrandCta =
  | { kind: 'signup' }
  | { kind: 'request' }
  | { kind: 'pending' }
  | { kind: 'assigned'; conversationId: string | null }
  | { kind: 'not_approved' }
  | { kind: 'none' };

export function brandCtaState(v: {
  signedIn: boolean; roles: readonly Role[] | readonly string[]; status: string | null;
  pendingRequest: boolean; activeAssignment: { conversationId: string | null } | null; self?: boolean;
}): BrandCta {
  if (!v.signedIn) return { kind: 'signup' };
  if (!(v.roles as readonly string[]).includes('business') || v.self) return { kind: 'none' };
  if (v.activeAssignment) return { kind: 'assigned', conversationId: v.activeAssignment.conversationId };
  if (v.status !== 'active') return { kind: 'not_approved' };
  if (v.pendingRequest) return { kind: 'pending' };
  return { kind: 'request' };
}

// ---------- §3.2: thread states ----------
export type ThreadMode = 'normal' | 'masked' | 'signed' | 'expired' | 'suspended' | 'closed';

export function threadMode(c: {
  context: string; frozenReason: string | null; expiresAt: string | null; fundedRetainer: boolean; assignmentEnded?: boolean;
}, now = Date.now()): ThreadMode {
  const pair = c.context === 'partner_assignment' || c.context === 'retainer';
  if (c.frozenReason === 'member_suspended') return 'suspended';
  if (c.frozenReason === 'assignment_ended' || c.frozenReason === 'admin' || c.assignmentEnded) return 'closed';
  if (!pair) return 'normal';
  if (c.fundedRetainer) return 'signed';
  if (c.expiresAt && new Date(c.expiresAt).getTime() < now) return 'expired';
  return 'masked';
}
export const READ_ONLY_MODES: ThreadMode[] = ['expired', 'suspended', 'closed'];

/** send_message error codes that switch the thread to read-only right away. */
export function modeFromSendError(code: string): ThreadMode | null {
  if (code === 'conversation_expired') return 'expired';
  if (code === 'conversation_frozen') return 'suspended';
  if (code === 'conversation_closed') return 'closed';
  return null;
}

// ---------- G7: one-time non-circumvention acknowledgement ----------
export function hasCurrentConsent(consents: readonly { kind: string; version: string }[], version: string): boolean {
  return consents.some((c) => c.kind === 'cgu_non_circumvention' && c.version === version);
}

/**
 * PG-6: fails closed — `consents === null` (unreadable) shows the modal; recording it then succeeds
 * or shows « L'enregistrement a échoué ».
 */
export function needsConsent(v: { roles: readonly string[]; primary: string | null; consents: readonly { kind: string; version: string }[] | null; version: string; path?: string }): boolean {
  if (v.primary === 'super_admin') return false;
  if (!v.roles.includes('business') && !v.roles.includes('consultant')) return false;
  if (v.path && v.path.startsWith('/legal')) return false;
  if (v.consents === null) return true;
  return !hasCurrentConsent(v.consents, v.version);
}

// ---------- §2.3: brand-side status pills ----------
export type PillTone = 'wait' | 'ok' | 'blocked' | 'closed';
export const PILL_CLASS: Record<PillTone, string> = {
  wait: 'bg-accent-soft text-ink',
  ok: 'bg-emerald-50 text-emerald-700',
  blocked: 'bg-rose-50 text-rose-700',
  closed: 'bg-surface text-muted',
};
export function requestTone(status: string): PillTone {
  if (status === 'pending') return 'wait';
  if (status === 'approved') return 'ok';
  if (status === 'declined') return 'blocked';
  return 'closed';
}

/** Hours since an ISO date (for the 24 h overdue chip). */
export function hoursSince(iso: string, now = Date.now()): number {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 3_600_000));
}

/**
 * PG-12: `consent_required` from propose_retainer / request_partner_contact. `error.details` says whose
 * acknowledgement is missing: 'brand' → reload and accept; 'partner' → the partner must accept first
 * (no notification is sent by the server, so we don't claim one). Anything else → null (caller's default).
 */
export function consentErrorMessage(code: string | null | undefined, details: string | null | undefined, C: { requiredError: string; partnerRequired: string }): string | null {
  if (code !== 'consent_required') return null;
  const who = (details ?? '').trim();
  if (who === 'brand') return C.requiredError;
  if (who === 'partner') return C.partnerRequired;
  return null;
}
