// G9 / §6: the city picker. Options come from public.cities (per country, ordered by sort) plus
// « Autre ville… » (free text ≤ 60). The server trigger normalises a listed city to its spelling.
import { PROFILE_LIMITS } from '@/lib/profile-limits';

export const OTHER_CITY = '__other__';

/** Accent- and case-insensitive fold (« Yaoundé » ≈ « yaounde »). */
export function foldCity(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Options matching the typed text (prefix matches first, then contains); all when empty. */
export function filterCities(list: readonly string[], query: string): string[] {
  const q = foldCity(query);
  if (!q) return [...list];
  const starts = list.filter((c) => foldCity(c).startsWith(q));
  const contains = list.filter((c) => !foldCity(c).startsWith(q) && foldCity(c).includes(q));
  return [...starts, ...contains];
}

/**
 * Resolve what the member chose into the value sent to the server:
 * - a listed city (any case/accents) → its listed spelling, inList = true;
 * - « Autre » text (or typed text matching nothing) → the text as typed (cleaned), inList = false;
 * - nothing → error 'required'; over 60 characters → error 'too_long'.
 */
export function resolveCity(list: readonly string[], choice: string, otherText = ''): { city: string; inList: boolean; error: 'required' | 'too_long' | null } {
  const raw = (choice === OTHER_CITY ? otherText : choice).replace(/\s+/g, ' ').trim();
  if (!raw) return { city: '', inList: false, error: 'required' };
  const hit = list.find((c) => foldCity(c) === foldCity(raw));
  if (hit) return { city: hit, inList: true, error: null };
  if (raw.length > PROFILE_LIMITS.city) return { city: raw, inList: false, error: 'too_long' };
  return { city: raw, inList: false, error: null };
}

/** The picker's initial state for a stored value: a listed city, or « Autre » with the text. */
export function initialCityChoice(list: readonly string[], stored: string | null | undefined): { choice: string; other: string } {
  const v = (stored ?? '').trim();
  if (!v) return { choice: '', other: '' };
  const hit = list.find((c) => foldCity(c) === foldCity(v));
  return hit ? { choice: hit, other: '' } : { choice: OTHER_CITY, other: v };
}

/**
 * The city sent by the picker: `city_choice` (a listed name or __other__) + `city_other`; falls back to
 * a plain `city` field (old forms). The DB trigger normalises a listed city to its spelling.
 */
export function cityFromForm(get: (k: string) => FormDataEntryValue | null): string {
  const choice = String(get('city_choice') ?? '').trim();
  if (choice === OTHER_CITY) return String(get('city_other') ?? '');
  if (choice) return choice;
  const other = String(get('city_other') ?? '').trim();
  if (other) return other;
  return String(get('city') ?? '');
}
