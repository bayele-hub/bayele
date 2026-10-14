// §4.1: a LIGHTER client mirror of the server masking rules (private.mask_contacts). It only drives the
// pre-send notice; the server is the authority and masks before insert, preview and realtime.
export type ContactKind = 'phone' | 'email' | 'messaging_link' | 'social_handle';

const MESSAGING = /(wa\.me\/|api\.whatsapp\.com|chat\.whatsapp\.com|whatsapp\.com\/(send|channel)|t\.me\/|telegram\.me)/i;
const EMAIL = /[\w.+-]+\s*(@|\(at\)|\[at\]|\sarobase\s)\s*[\w-]+\s*(\.|\(dot\)|\spoint\s)\s*[a-z]{2,}/i;
const SOCIAL_URL = /(instagram\.com|tiktok\.com|facebook\.com|fb\.me|snapchat\.com|twitter\.com|x\.com|linkedin\.com\/in)\/\S+/i;
const SOCIAL_LABEL = /\b(insta|ig|snap|tiktok|telegram|twitter|fb|facebook|linkedin)\s*[:=]\s*\S+/i;
const HANDLE = /(^|[\s(])@[A-Za-z0-9_][A-Za-z0-9_.]{1,29}/;
// 8–15 digits with optional +/00 and space . - separators.
const PHONE = /(\+|00)?\d(?:[\s.-]?\d){7,14}/g;
const MONEY_AFTER = /^\s*(fcfa|cfa|xaf|xof|f\b|francs?\b|%)/i;
const GROUPED_AMOUNT = /^\d{1,3}([\s.  ]\d{3})+$/;

function hasPhone(text: string): boolean {
  for (const m of text.matchAll(PHONE)) {
    const raw = m[0];
    const end = (m.index ?? 0) + raw.length;
    const start = m.index ?? 0;
    if (MONEY_AFTER.test(text.slice(end))) continue; // « 150000 FCFA », « 15 % »
    if (GROUPED_AMOUNT.test(raw.trim())) continue; // « 150 000 », « 1 500 000 », « 75.000 »
    if (/[A-Za-z]-?$/.test(text.slice(Math.max(0, start - 2), start))) continue; // « SOKO-2026… »
    const digits = raw.replace(/\D/g, '');
    if (digits.length < 8 || digits.length > 15) continue;
    return true;
  }
  return false;
}

/** The kinds of contact detail the text seems to contain (deduplicated, stable order). */
export function detectContacts(text: string): ContactKind[] {
  const out: ContactKind[] = [];
  if (!text) return out;
  if (MESSAGING.test(text)) out.push('messaging_link');
  if (EMAIL.test(text)) out.push('email');
  if (SOCIAL_URL.test(text) || SOCIAL_LABEL.test(text) || HANDLE.test(text)) out.push('social_handle');
  if (hasPhone(text.replace(/\d{1,2}\/\d{1,2}\/\d{2,4}/g, ' '))) out.push('phone');
  return out;
}
