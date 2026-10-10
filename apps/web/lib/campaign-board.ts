// Pure card logic for the public campaign board (design §0.3). Every number shown comes from the
// board RPC and disappears when zero or unknown — nothing here invents a figure.

export interface BoardCampaign {
  id: string;
  title: string;
  category: string;
  country: string;
  payoutPerCreatorFcfa: number;
  creatorCountTarget: number;
  platforms: string[];
  deadline: string | null; // YYYY-MM-DD
  createdAt: string; // ISO
  brandName: string | null;
  appliedCount: number;
  placesLeft: number;
  /** « Géré par Bayele »: brandName is then the public brand_label (never the admin's name). */
  isManaged: boolean;
  /** Managed only: the city shown next to the label (« Restaurant · Douala »). */
  brandCity: string | null;
  /** Council R1: deliverable count + type are public on every listing. */
  contentType: string | null;
  deliverableQuantity: number | null;
}

export type Meter =
  | { kind: 'bar'; left: number; target: number; takenPct: number }
  | { kind: 'total'; target: number }
  | { kind: 'full' };

export type Pill = 'full' | 'almostFull' | 'new' | null;

/** Places meter (design §0.3): a bar only once someone has been selected; full → « Complet ». */
export function placesMeter(placesLeft: number | null | undefined, target: number | null | undefined): Meter | null {
  if (placesLeft == null || target == null || !Number.isFinite(placesLeft) || !Number.isFinite(target) || target <= 0) return null;
  if (placesLeft <= 0) return { kind: 'full' };
  if (placesLeft >= target) return { kind: 'total', target };
  return { kind: 'bar', left: placesLeft, target, takenPct: Math.round(((target - placesLeft) / target) * 100) };
}

const DAY = 86_400_000;

/** Today's date (YYYY-MM-DD) on the Africa/Douala calendar. */
export function doualaToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Douala', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** Whole calendar days until the deadline (Africa/Douala); null when missing, malformed or past. */
export function daysUntil(deadline: string | null | undefined, now: Date = new Date()): number | null {
  if (!deadline || !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return null;
  const end = Date.parse(`${deadline}T00:00:00Z`);
  const today = Date.parse(`${doualaToday(now)}T00:00:00Z`);
  if (Number.isNaN(end)) return null;
  const n = Math.round((end - today) / DAY);
  return n < 0 ? null : n;
}

/** At most one pill: Complet › Bientôt complet (≤ 20 % left) › Nouveau (< 7 days). */
export function cardPill(c: Pick<BoardCampaign, 'placesLeft' | 'creatorCountTarget' | 'createdAt'>, now: Date = new Date()): Pill {
  if (c.creatorCountTarget > 0 && c.placesLeft <= 0) return 'full';
  // Only once someone has been selected: a 1-place managed listing nobody has taken is not « bientôt complet ».
  if (c.placesLeft >= 1 && c.creatorCountTarget > 0 && c.placesLeft < c.creatorCountTarget && c.placesLeft <= Math.ceil(c.creatorCountTarget * 0.2)) return 'almostFull';
  const created = Date.parse(c.createdAt);
  if (!Number.isNaN(created) && now.getTime() - created < 7 * DAY) return 'new';
  return null;
}

/** "{n}" / "{brand}" placeholder fill for dictionary strings. */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** One/Many plural pick (the dictionaries carry separate keys; no ICU). */
export function plural(n: number, one: string, many: string): string {
  return fill(n === 1 ? one : many, { n });
}
