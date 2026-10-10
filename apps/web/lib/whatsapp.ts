// « Publiez par WhatsApp » (K5): Bayele's business number comes ONLY from NEXT_PUBLIC_BAYELE_WHATSAPP
// (E.164 digits). Unset or invalid → every builder returns null and the CTA is not rendered.
// Never hardcode a number here or in a component (guarded by lib/campaign-guards.test.ts).

/** Digits-only E.164 (8–15 digits). A leading « + » and spaces are tolerated and stripped. */
export function parseWhatsappNumber(raw: string | null | undefined): string | null {
  const v = (raw ?? '').replace(/[\s ]/g, '').replace(/^\+/, '');
  return /^\d{8,15}$/.test(v) ? v : null;
}

/** Bayele's number from the build-time env (inlined by Next for client components). */
export function bayeleWhatsappNumber(): string | null {
  return parseWhatsappNumber(process.env.NEXT_PUBLIC_BAYELE_WHATSAPP);
}

/** wa.me link to a given number with a prefilled message; null when the number is invalid. */
export function waMeHref(number: string | null | undefined, text: string): string | null {
  const n = parseWhatsappNumber(number);
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(text)}` : null;
}

/** wa.me link to Bayele's number; null when NEXT_PUBLIC_BAYELE_WHATSAPP is unset or invalid. */
export function bayeleWhatsappHref(text: string, number: string | null = bayeleWhatsappNumber()): string | null {
  return waMeHref(number, text);
}

export type PublishSource = 'home' | 'campaigns' | 'signup' | 'new-campaign' | 'pricing';

export interface PublishAnswers {
  what?: string;
  howMany?: string;
  where?: string;
  deadline?: string;
  budget?: string;
  rights?: string;
}

/**
 * The prefilled brief message (design §6.4): the 6 questions of plan §2, answers already typed are
 * inserted, empty ones become '' (the brand types after the colon), plus the source code for Ops.
 */
export function publishMessage(template: string, answers: PublishAnswers, source: PublishSource): string {
  const vars: Record<string, string> = {
    what: answers.what ?? '',
    howMany: answers.howMany ?? '',
    where: answers.where ?? '',
    deadline: answers.deadline ?? '',
    budget: answers.budget ?? '',
    rights: answers.rights ?? '',
    source,
  };
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? vars[k]! : m));
}
