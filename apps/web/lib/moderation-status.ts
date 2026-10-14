// The member's own moderation view (my_moderation_status, D4/D8): pending steps, open correction
// request, last decision. Never contains the internal note or the admin's identity.

export interface MyModerationStatus {
  status: 'pending_review' | 'active' | 'suspended' | 'rejected';
  resubmitted_at: string | null;
  open_correction: { fields: string[]; reason_code: string; reason_label: string; message: string | null; requested_at: string } | null;
  last_decision: { action: string; reason_code: string | null; reason_label: string | null; message: string | null; at: string } | null;
}

export function parseModerationStatus(raw: unknown): MyModerationStatus | null {
  const r = raw as Partial<MyModerationStatus> | null;
  if (!r || typeof r !== 'object' || !r.status) return null;
  return {
    status: r.status,
    resubmitted_at: r.resubmitted_at ?? null,
    open_correction: r.open_correction && Array.isArray(r.open_correction.fields) ? r.open_correction : null,
    last_decision: r.last_decision ?? null,
  };
}

/** « Reçu → En revue → Décision »: index of the current step (0-based). */
export function pendingStep(s: MyModerationStatus): 0 | 1 | 2 {
  if (s.status !== 'pending_review') return 2;
  return 1;
}

/** Correction field → where to fix it (profile anchors). */
export const FIX_ANCHOR: Record<string, string> = {
  city: '/profile#field-city',
  bio: '/profile#field-bio',
  display_name: '/profile#field-display-name',
  avatar: '/profile#photo',
  socials: '/profile#reseaux',
  payout_phone: '/profile#paiement',
  company_info: '/profile#entreprise',
  phone: '/profile',
  other: '/profile',
};

export function fixLink(fields: string[]): string {
  return FIX_ANCHOR[fields[0] ?? 'other'] ?? '/profile';
}
