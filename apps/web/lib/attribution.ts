import { normalizeHandle } from '@/lib/handle';

// Sign-up attribution (plan §4.7, council C3/C4). `source` and `ref` travel in URLs only (no cookie):
// every sign-up link on the campaign surfaces appends them, /auth validates them and stores them in
// the sign-up metadata, and onboarding records them once via record_signup_attribution(). The server
// is lenient too (unknown source → 'direct', unknown handle → NULL); validating here keeps junk out
// of auth metadata and out of the URLs we generate.

export const SIGNUP_SOURCES = ['campaigns_list', 'campaign_page', 'referral', 'home', 'direct'] as const;
export type SignupSource = (typeof SIGNUP_SOURCES)[number];

const HANDLE_RE = /^[a-z0-9_]{3,30}$/;

/** Allow-listed source, or null. */
export function parseSignupSource(v: unknown): SignupSource | null {
  if (typeof v !== 'string') return null;
  const s = v.trim().toLowerCase();
  return (SIGNUP_SOURCES as readonly string[]).includes(s) ? (s as SignupSource) : null;
}

/**
 * A referrer handle from an untrusted `?ref=`: a leading "@" and case are tolerated, then the value
 * must already be a valid handle (normalizing must not change it — "a b" or "x/../y" are rejected,
 * not rewritten into someone else's handle). Returns null when invalid.
 */
export function parseRefHandle(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim().replace(/^@/, '').toLowerCase();
  if (!s || normalizeHandle(s) !== s) return null;
  return HANDLE_RE.test(s) ? s : null;
}

/** A valid `ref` always wins: the visitor arrived through someone's share link (design §3). */
export function effectiveSource(source: SignupSource | null, ref: string | null): SignupSource | null {
  return ref ? 'referral' : source;
}

/** Base used only to resolve candidate paths; never emitted. */
const NEXT_BASE = 'https://bayele.local';
/**
 * Control characters, any Unicode whitespace (incl. U+00A0/U+202F/U+3000, zero-width chars) and
 * backslashes. Browsers strip tab/CR/LF anywhere in a URL (WHATWG), so "/\t/evil.com" would become
 * "//evil.com"; "\\" is treated as "/" in special URLs. QA D1.
 */
const UNSAFE_CHARS = /[\u0000-\u0020\u007f-\u00a0\u1680\u180e\u2000-\u200f\u2028-\u202f\u205f-\u2064\u3000\ufeff\\]/;

/**
 * Same-origin internal return path, else null. Used by /auth, the email callback, the dispatcher,
 * the onboarding chain and « Continuer » so `next` can never leave the site.
 *   1. reject control/whitespace characters and backslashes, raw AND percent-decoded;
 *   2. require one leading "/" (not "//"), also after decoding (blocks "/%2F%2Fevil");
 *   3. resolve with `new URL(v, base)` and require the same origin and a single-slash pathname.
 */
export function safeNextPath(v: unknown): string | null {
  if (typeof v !== 'string' || v.length === 0 || v.length > 2048) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(v);
  } catch {
    return null; // malformed percent-encoding
  }
  if (UNSAFE_CHARS.test(v) || UNSAFE_CHARS.test(decoded)) return null;
  for (const s of [v, decoded]) {
    if (!s.startsWith('/') || s.startsWith('//')) return null;
  }
  let u: URL;
  try {
    u = new URL(v, NEXT_BASE);
  } catch {
    return null;
  }
  if (u.origin !== NEXT_BASE || !u.pathname.startsWith('/') || u.pathname.startsWith('//')) return null;
  return v;
}
