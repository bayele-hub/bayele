// §4.2: the server returns bodies already masked with these exact tokens; the bubble renders them as
// inline marks. The token text itself is what screen readers read.
import type { ContactKind } from './contact-detect';

export const MASK_TOKENS = ['[numéro masqué]', '[e-mail masqué]', '[lien masqué]', '[compte masqué]'] as const;
const TOKEN_RE = /(\[numéro masqué\]|\[e-mail masqué\]|\[lien masqué\]|\[compte masqué\])/g;

export type Segment = { text: string; masked: boolean };

/** Split a body into plain and masked segments (order kept, empty plain pieces dropped). */
export function splitMasked(body: string): Segment[] {
  return body
    .split(TOKEN_RE)
    .filter((s) => s !== '')
    .map((s) => ({ text: s, masked: (MASK_TOKENS as readonly string[]).includes(s) }));
}

/** « un numéro de téléphone et une adresse e-mail » — FR « et » / EN "and" before the last item. */
export function joinKinds(kinds: readonly ContactKind[], labels: Record<ContactKind, string>, and: string): string {
  const parts = Array.from(new Set(kinds)).map((k) => labels[k]).filter(Boolean);
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')} ${and} ${parts[parts.length - 1]}`;
}
