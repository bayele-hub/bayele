// Campaign categories — the single list the creation form, the public board filters and the alert
// opt-in read from. `fr` is the value stored in campaigns.category (what the brand picked); `slug` is
// the URL form used by /campaigns?cat=… ; the English label comes from `t.categories[index]`, whose
// order matches this list.

export const CAMPAIGN_CATEGORIES = [
  { slug: 'beaute', fr: 'Beauté' },
  { slug: 'mode', fr: 'Mode' },
  { slug: 'tech', fr: 'Tech' },
  { slug: 'food', fr: 'Food' },
  { slug: 'musique', fr: 'Musique' },
  { slug: 'sport', fr: 'Sport' },
  { slug: 'sante-bien-etre', fr: 'Santé & Bien-être' },
  { slug: 'humour', fr: 'Humour' },
  { slug: 'education', fr: 'Éducation' },
  { slug: 'voyage', fr: 'Voyage' },
  { slug: 'business', fr: 'Business' },
  // Council R8 (2026-10-11): appended at the end so existing indices (EN labels) stay stable.
  { slug: 'ong-impact-social', fr: 'ONG / Impact social' },
  { slug: 'immobilier', fr: 'Immobilier' },
  { slug: 'hotellerie', fr: 'Hôtellerie' },
  { slug: 'finance-fintech', fr: 'Finance / Fintech' },
] as const;

export type CategorySlug = (typeof CAMPAIGN_CATEGORIES)[number]['slug'];

/** The DB values, in display order (what the creation form offers). */
export const CATEGORY_VALUES: string[] = CAMPAIGN_CATEGORIES.map((c) => c.fr);

/** Validate an untrusted slug (URL param, form field). */
export function parseCategorySlug(v: unknown): CategorySlug | null {
  if (typeof v !== 'string') return null;
  const s = v.trim().toLowerCase();
  return CAMPAIGN_CATEGORIES.some((c) => c.slug === s) ? (s as CategorySlug) : null;
}

/** Slug → DB value ("sante-bien-etre" → "Santé & Bien-être"). */
export function categoryValue(slug: CategorySlug | null | undefined): string | null {
  return CAMPAIGN_CATEGORIES.find((c) => c.slug === slug)?.fr ?? null;
}

/** DB value → slug, case-insensitive. Null for free text that is not in the list. */
export function categorySlugOf(value: string | null | undefined): CategorySlug | null {
  const v = (value ?? '').trim().toLocaleLowerCase('fr');
  return CAMPAIGN_CATEGORIES.find((c) => c.fr.toLocaleLowerCase('fr') === v)?.slug ?? null;
}

/**
 * Display label. French shows the DB value as typed; English uses the dictionary label by index
 * (`labels` = `t.categories`) and falls back to the raw value for anything unknown.
 */
export function categoryLabel(value: string | null | undefined, locale: 'fr' | 'en', labels: readonly string[]): string {
  const raw = (value ?? '').trim();
  if (locale === 'fr') return raw;
  const slug = categorySlugOf(raw);
  const i = CAMPAIGN_CATEGORIES.findIndex((c) => c.slug === slug);
  return i >= 0 && labels[i] ? labels[i] : raw;
}

/**
 * Council R8 + Legal: categories whose claims (price, yield, health…) must be substantiated before a
 * managed campaign is published. Exactly the strings private.category_needs_claims_check compares
 * (trimmed, case-insensitive) — the publish RPC raises `claims_not_verified` otherwise.
 */
export const CLAIMS_CHECK_CATEGORIES = ['Immobilier', 'Finance / Fintech', 'Santé & Bien-être'] as const;

export function categoryNeedsClaims(value: string | null | undefined): boolean {
  const v = (value ?? '').trim().toLowerCase();
  return CLAIMS_CHECK_CATEGORIES.some((c) => c.toLowerCase() === v);
}
