import { safeNextPath } from '@/lib/attribution';

/**
 * Return path kept across sign-up → email confirmation → onboarding → « Continuer ».
 * The `next` value is always re-validated (same-origin only) at every hop.
 */

/** `path` with `?next=<encoded next>` appended when `next` is a safe internal path. */
export function withNext(path: string, next: unknown): string {
  const safe = safeNextPath(next);
  if (!safe) return path;
  return `${path}${path.includes('?') ? '&' : '?'}next=${encodeURIComponent(safe)}`;
}

/**
 * Where « Continuer » (end of onboarding) or the dispatcher sends a user who arrived with `next`:
 * only accounts that can use the site now (active, or pending_review — they can already browse and
 * apply). Suspended / rejected / unknown statuses keep their status screen.
 */
export function continueTarget(status: string | null | undefined, next: unknown): string | null {
  const safe = safeNextPath(next);
  if (!safe) return null;
  return status === 'active' || status === 'pending_review' ? safe : null;
}
