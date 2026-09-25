// Launch gate for the public creator directory.
//
// Until Bayele has 10 000 registered creators, creator profiles are UNLISTED: they're kept off the
// home page, the public directory, the sitemap and search indexing, but each profile page still
// works for anyone holding its direct link (so creators can share it as a media kit). Brands get
// creators through Bayele (a brief) instead of browsing. The gate lifts on its own once the real
// registered-creator count crosses the threshold — no redeploy.
//
// This module is pure (no I/O) so the decision can be unit-tested; the DB count lives in
// lib/data/launch-gate.ts.

export const CREATOR_DIRECTORY_THRESHOLD = 10_000;

/** Optional manual override (env `BAYELE_CREATOR_DIRECTORY`): force the directory open or closed. */
export type DirectoryOverride = 'open' | 'closed' | null;

export function parseDirectoryOverride(value: string | undefined | null): DirectoryOverride {
  const v = (value ?? '').trim().toLowerCase();
  return v === 'open' || v === 'closed' ? v : null;
}

/**
 * Is the public creator directory open?
 * Fails CLOSED: an unknown count (query error, missing key) keeps profiles unlisted, because
 * accidentally exposing a thin directory is worse than briefly hiding a full one.
 */
export function isCreatorDirectoryOpen(
  count: number | null,
  threshold: number = CREATOR_DIRECTORY_THRESHOLD,
  override: DirectoryOverride = null,
): boolean {
  if (override === 'open') return true;
  if (override === 'closed') return false;
  if (count === null || !Number.isFinite(count)) return false;
  return count >= threshold;
}
