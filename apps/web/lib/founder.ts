// "Créateur fondateur" — a free, numbered, permanent badge for the first 10 000 creators.
//
// Numbers are assigned by the database (migration 0026, trigger on user_roles) in sign-up order;
// this module is pure so the display rules can be unit-tested. The badge is earned by timing only
// and can never be bought (see /pricing: "la confiance ne s'achète pas").

import type { Locale } from '@/i18n/config';

export const FOUNDER_COHORT = 10_000;

/** "n° 42" (fr, with a no-break space) · "#42" (en). */
export function formatFounderNumber(n: number, locale: Locale): string {
  return locale === 'fr' ? `n° ${n}` : `#${n}`;
}

/** Locale-aware integer ("9 874" in fr with a narrow no-break space, "9,874" in en). */
export function formatCount(n: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-US').format(n);
}

/**
 * Remaining founder places to advertise, or null when the number must not be shown: unknown
 * (query failed — never guess), or the cohort is full (the offer is over, stop promoting it).
 */
export function remainingToShow(remaining: number | null | undefined): number | null {
  if (remaining === null || remaining === undefined || !Number.isFinite(remaining)) return null;
  const r = Math.trunc(remaining);
  if (r <= 0) return null;
  return Math.min(r, FOUNDER_COHORT);
}

/** Is the founder offer still open? Unknown counts as open (the DB enforces the cap anyway). */
export function founderOfferOpen(remaining: number | null | undefined): boolean {
  if (remaining === null || remaining === undefined || !Number.isFinite(remaining)) return true;
  return remaining > 0;
}

/** Fill a "{n}" template with a locale-formatted count. */
export function withCount(template: string, n: number, locale: Locale): string {
  return template.replace('{n}', formatCount(n, locale));
}

// ── Managed creators (partner representation) ─────────────────────────────

/** Commission bounds enforced by the database (partner_creator_links.pcl_rate_bounds). */
export const COMMISSION_MIN_PCT = 1;
export const COMMISSION_MAX_PCT = 30;

/**
 * Split a creator payout for a managed deal exactly as admin_confirm_creator_payout does:
 * commission rounded DOWN to the franc (in the creator's favour), the rest to the creator.
 */
export function splitPayout(grossFcfa: number, rate: number | null | undefined): { creator: number; partner: number } {
  const gross = Math.max(0, Math.trunc(grossFcfa));
  if (!rate || rate <= 0) return { creator: gross, partner: 0 };
  // Work in thousandths (numeric(4,3)) to avoid float drift: 33333 × 0.15 must give 4999.
  const permille = Math.round(rate * 1000);
  const partner = Math.floor((gross * permille) / 1000);
  return { creator: gross - partner, partner };
}

/** Parse a percent typed by a partner ("15", "12,5") into a rate, or null if out of bounds. */
export function parseCommissionPct(raw: string): number | null {
  const v = Number(String(raw).trim().replace(',', '.'));
  if (!Number.isFinite(v) || v < COMMISSION_MIN_PCT || v > COMMISSION_MAX_PCT) return null;
  return Math.round(v * 10) / 1000; // one decimal of a percent → numeric(4,3)
}

/** 0.15 → "15 %" (fr) / "15%" (en). */
export function formatPct(rate: number, locale: Locale): string {
  const pct = Math.round(rate * 1000) / 10;
  const s = new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-US', { maximumFractionDigits: 1 }).format(pct);
  return locale === 'fr' ? `${s} %` : `${s}%`;
}
