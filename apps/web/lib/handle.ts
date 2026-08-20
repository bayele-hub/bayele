/**
 * Normalize a user-typed identifier into the handle format the database enforces
 * (`^[a-z0-9_]{3,30}$` in onboard_profile). Safe to run on every keystroke:
 *   - strips accents/diacritics so "cleopatre" keeps its letters, "cléopâtre" loses the marks
 *   - lowercases
 *   - collapses any run of invalid characters (spaces, punctuation, …) to a single "_"
 *   - caps length at 30
 *
 * It intentionally does NOT trim a trailing "_", so a user can still type "jean_dupont"
 * one character at a time. Handles shorter than 3 chars are left as-is here; the final
 * 3–30 length check stays server-side in onboard_profile.
 */
export function normalizeHandle(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // drop combining diacritical marks (accents)
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_') // any run of disallowed chars → single underscore
    .slice(0, 30);
}
