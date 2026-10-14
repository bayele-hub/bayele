// D5 text limits — same numbers as the NOT VALID CHECKs of migration 0036 (profiles_city_len ≤ 60,
// profiles_display_name_len ≤ 80, profiles_bio_len ≤ 500) and onboard_profile's codes.

export const PROFILE_LIMITS = { displayName: 80, city: 60, bio: 500 } as const;
export type LimitedField = keyof typeof PROFILE_LIMITS;

/** Trim + collapse spaces like onboard_profile does. */
export function cleanText(s: unknown): string {
  return String(s ?? '').replace(/\s+/g, ' ').trim();
}

/** Field-level problems before submit (or for an old value that is now over the limit). */
export function checkProfileText(v: { displayName?: string; city?: string; bio?: string }): Partial<Record<LimitedField, 'required' | 'tooLong'>> {
  const out: Partial<Record<LimitedField, 'required' | 'tooLong'>> = {};
  if (v.displayName !== undefined) {
    const d = cleanText(v.displayName);
    if (!d) out.displayName = 'required';
    else if (d.length > PROFILE_LIMITS.displayName) out.displayName = 'tooLong';
  }
  if (v.city !== undefined) {
    const c = cleanText(v.city);
    if (!c) out.city = 'required';
    else if (c.length > PROFILE_LIMITS.city) out.city = 'tooLong';
  }
  if (v.bio !== undefined && String(v.bio).trim().length > PROFILE_LIMITS.bio) out.bio = 'tooLong';
  return out;
}

/** A DB error (23514 constraint name, or an onboard_profile code) → the field it concerns. */
export function limitErrorField(message: string | null | undefined): LimitedField | null {
  const m = message ?? '';
  if (/profiles_city_len|city_too_long|city_required/.test(m)) return 'city';
  if (/profiles_display_name_len|display_name_too_long|display_name_required/.test(m)) return 'displayName';
  if (/profiles_bio_len|bio_too_long/.test(m)) return 'bio';
  return null;
}

/**
 * AR-1: the creator's audience is the figure they typed. A blank, missing or malformed field returns
 * null = « leave the stored value alone » (a save never lowers an audience the creator didn't edit).
 */
export function parseAudience(raw: FormDataEntryValue | null | undefined): number | null {
  const s = String(raw ?? '').replace(/[\s  .,]/g, '');
  if (!s || !/^\d+$/.test(s)) return null;
  return Math.min(Number(s), 2_000_000_000);
}

/** Sum of the per-network follower counts (shown only as a hint, never written as the audience). */
export function followersTotal(platforms: Record<string, { followers?: number | null } | null | undefined>): number {
  return Object.values(platforms).reduce((sum, v) => sum + (Number(v?.followers) || 0), 0);
}
