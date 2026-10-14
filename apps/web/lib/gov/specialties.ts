// G1: a fixed specialty list (codes), max 3 per partner, validated server-side (0040).
export const MAX_SPECIALTIES = 3;

export interface Specialty { code: string; label_fr: string; label_en: string; sort: number }

/** The v1 list (G1/P1), used only when the partner_specialties read fails; the table is the source. */
export const SPECIALTIES_FALLBACK: Specialty[] = [
  ['talent_management', 'Gestion de talents', 'Talent management'],
  ['content_strategy', 'Stratégie de contenu', 'Content strategy'],
  ['video_production', 'Production vidéo', 'Video production'],
  ['photography', 'Photographie', 'Photography'],
  ['social_media_management', 'Gestion des réseaux sociaux', 'Social media management'],
  ['influencer_campaigns', "Campagnes d'influence", 'Influencer campaigns'],
  ['ugc', 'UGC', 'UGC'],
  ['brand_partnerships', 'Partenariats de marque', 'Brand partnerships'],
  ['event_coverage', "Couverture d'événements", 'Event coverage'],
  ['music_entertainment', 'Musique et divertissement', 'Music & entertainment'],
  ['fashion_beauty', 'Mode et beauté', 'Fashion & beauty'],
  ['food_hospitality', 'Gastronomie et hôtellerie', 'Food & hospitality'],
  ['tech_fintech', 'Tech et fintech', 'Tech & fintech'],
  ['ngo_impact', 'ONG et impact social', 'NGO & social impact'],
].map(([code, label_fr, label_en], i) => ({ code: code!, label_fr: label_fr!, label_en: label_en!, sort: (i + 1) * 10 }));

/**
 * Toggle one code in the selection. Removing is always allowed; adding past the max is refused
 * (`limitHit`) so the picker can show « 3 spécialités au maximum… » without changing the selection.
 */
export function toggleSpecialty(selected: readonly string[], code: string, max = MAX_SPECIALTIES): { next: string[]; limitHit: boolean } {
  if (selected.includes(code)) return { next: selected.filter((c) => c !== code), limitHit: false };
  if (selected.length >= max) return { next: [...selected], limitHit: true };
  return { next: [...selected, code], limitHit: false };
}

/** Parse the hidden input (comma-joined codes): known codes only, deduplicated, at most `max`. */
export function parseSpecialtyCodes(raw: unknown, known: readonly string[]): { codes: string[]; error: 'invalid_specialty' | 'too_many_specialties' | null } {
  const parts = String(raw ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const unique = Array.from(new Set(parts));
  if (unique.some((c) => !known.includes(c))) return { codes: unique.filter((c) => known.includes(c)), error: 'invalid_specialty' };
  if (unique.length > MAX_SPECIALTIES) return { codes: unique.slice(0, MAX_SPECIALTIES), error: 'too_many_specialties' };
  return { codes: unique, error: null };
}

/** Display labels for stored values: codes map to their label; legacy free text is shown as typed. */
export function specialtyLabels(values: readonly string[] | null | undefined, list: readonly Specialty[], locale: 'fr' | 'en'): string[] {
  const by = new Map(list.map((s) => [s.code, locale === 'fr' ? s.label_fr : s.label_en]));
  return (values ?? []).map((v) => by.get(v) ?? v);
}
