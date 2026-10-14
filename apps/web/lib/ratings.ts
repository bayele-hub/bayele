// D6: never show an invented rating. There is no review system yet, so every creator and partner shows
// « Nouveau ». The DB default creator_profiles.rating_avg = 5.00 is NOT a review.

export type RatingDisplay = { kind: 'new' } | { kind: 'rating'; value: number; reviews: number };

/** A rating is shown only when real reviews back it (reviews > 0); otherwise « Nouveau ». */
export function ratingDisplay(value: number | null | undefined, reviews: number | null | undefined = 0): RatingDisplay {
  const n = Number(reviews) || 0;
  if (n <= 0 || value == null || !Number.isFinite(value)) return { kind: 'new' };
  return { kind: 'rating', value: Math.round(value * 10) / 10, reviews: n };
}

export function ratingLabel(r: RatingDisplay, newLabel: string, locale: 'fr' | 'en'): string {
  return r.kind === 'new' ? newLabel : new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(r.value);
}
