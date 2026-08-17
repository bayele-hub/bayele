import type { Locale } from './config';

/** Locale-aware money. Currency stays FCFA (XAF/XOF) in both languages. */
export function formatFcfa(amount: number, locale: Locale): string {
  return `${new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-US').format(amount)} FCFA`;
}

/** Compact follower count. fr: "128 k" · en: "128K". */
export function formatFollowers(count: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(count);
}
