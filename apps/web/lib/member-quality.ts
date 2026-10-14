// Data-quality warnings for admin member review (design §A.4.4). Deterministic rules only; they
// INFORM and never block approval (D4). One function so the card, the detail page and the
// « À vérifier » filter agree. The server adds its own checklist (admin_member_detail.checklist).

export type WarningKey =
  | 'cityLooksLikeBio'
  | 'cityIsName'
  | 'noSocials'
  | 'audienceNoSource'
  | 'noPayout'
  | 'defaultRating'
  | 'noAvatar'
  | 'businessNoBilling';

/** Warnings that show as a chip on the list card (the rest are detail-page only). */
export const CARD_WARNINGS: WarningKey[] = ['cityLooksLikeBio', 'cityIsName', 'noSocials', 'audienceNoSource'];

export interface MemberQualityInput {
  city: string | null | undefined;
  displayName: string | null | undefined;
  roles: string[];
  /** Creator platforms ({ instagram: { url, followers } }); undefined = unknown (list rows). */
  platforms?: Record<string, { url?: string; followers?: number } | null> | null;
  audienceSize?: number | null;
  hasPayout?: boolean;
  hasAvatar?: boolean;
  /** A rating would be shown without any review behind it (D6: always true today for creators/partners). */
  defaultRating?: boolean;
  hasBillingEmail?: boolean;
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** City longer than 40 chars, or a sentence mark followed by a word, a digit, @, http, or > 4 words. */
export function cityLooksLikeBio(city: string | null | undefined): boolean {
  const c = (city ?? '').trim();
  if (!c) return false;
  if (c.length > 40) return true;
  if (/[.!?,]\s*\p{L}/u.test(c)) return true;
  if (/\d|@|http/i.test(c)) return true;
  return c.split(/\s+/).filter(Boolean).length > 4;
}

/** City equals one of the words of the display name (case/accent-insensitive). */
export function cityIsName(city: string | null | undefined, displayName: string | null | undefined): boolean {
  const c = fold(city ?? '');
  if (!c) return false;
  return fold(displayName ?? '')
    .split(/[\s\-_.']+/)
    .filter((w) => w.length >= 2)
    .includes(c);
}

export function memberWarnings(m: MemberQualityInput): WarningKey[] {
  const out: WarningKey[] = [];
  const creator = m.roles.includes('creator');
  const partner = m.roles.includes('consultant');
  if (cityLooksLikeBio(m.city)) out.push('cityLooksLikeBio');
  else if (cityIsName(m.city, m.displayName)) out.push('cityIsName');
  if (creator && m.platforms !== undefined) {
    const list = Object.values(m.platforms ?? {}).filter((p): p is { url?: string; followers?: number } => !!p);
    if (!list.some((p) => (p.url ?? '').trim())) out.push('noSocials');
    const sum = list.reduce((s, p) => s + (Number(p.followers) || 0), 0);
    if ((m.audienceSize ?? 0) > 0 && sum === 0) out.push('audienceNoSource');
  }
  if ((creator || partner) && m.hasPayout === false) out.push('noPayout');
  if ((creator || partner) && m.defaultRating) out.push('defaultRating');
  if (m.hasAvatar === false) out.push('noAvatar');
  if (m.roles.includes('business') && m.hasBillingEmail === false) out.push('businessNoBilling');
  return out;
}

export function cardWarnings(m: MemberQualityInput): WarningKey[] {
  return memberWarnings(m).filter((w) => CARD_WARNINGS.includes(w));
}
