// Countries Bayele operates in — the single list every form, filter, flag and label reads from.
// Must match the `country_code` enum in Postgres (migrations 0001 + 0029). Add a country here and
// in a migration; nothing else should hardcode country codes.
//
// Campaign money stays in FCFA everywhere for now (CM/GA → XAF, CI → XOF; the new markets are
// invoiced in XAF). Payouts in Nigeria, Kenya and South Africa use local rails (M-Pesa, OPay,
// PalmPay, MTN MoMo or bank transfer) and are converted by the admin at payout time.

import type { Locale } from '@/i18n/config';

export const COUNTRY_CODES = ['CM', 'CI', 'GA', 'NG', 'KE', 'ZA'] as const;
export type CountryCode = (typeof COUNTRY_CODES)[number];

interface CountryInfo {
  flag: string;
  fr: string;
  en: string;
  /** French with its preposition ("au Nigeria", "en Afrique du Sud"). */
  frIn: string;
  /** International dialling prefix, used as the phone placeholder hint. */
  dial: string;
}

export const COUNTRIES: Record<CountryCode, CountryInfo> = {
  CM: { flag: '🇨🇲', fr: 'Cameroun', en: 'Cameroon', frIn: 'au Cameroun', dial: '+237' },
  CI: { flag: '🇨🇮', fr: "Côte d'Ivoire", en: "Côte d'Ivoire", frIn: "en Côte d'Ivoire", dial: '+225' },
  GA: { flag: '🇬🇦', fr: 'Gabon', en: 'Gabon', frIn: 'au Gabon', dial: '+241' },
  NG: { flag: '🇳🇬', fr: 'Nigeria', en: 'Nigeria', frIn: 'au Nigeria', dial: '+234' },
  KE: { flag: '🇰🇪', fr: 'Kenya', en: 'Kenya', frIn: 'au Kenya', dial: '+254' },
  ZA: { flag: '🇿🇦', fr: 'Afrique du Sud', en: 'South Africa', frIn: 'en Afrique du Sud', dial: '+27' },
};

export const DEFAULT_COUNTRY: CountryCode = 'CM';

export function isCountryCode(v: unknown): v is CountryCode {
  return typeof v === 'string' && (COUNTRY_CODES as readonly string[]).includes(v);
}

/** Validate untrusted input (form field, URL param, auth metadata); falls back to the default. */
export function parseCountry(v: unknown, fallback: CountryCode = DEFAULT_COUNTRY): CountryCode {
  const s = typeof v === 'string' ? v.trim().toUpperCase() : v;
  return isCountryCode(s) ? s : fallback;
}

export function countryName(code: string | null | undefined, locale: Locale = 'fr'): string {
  return isCountryCode(code) ? COUNTRIES[code][locale] : (code ?? '');
}

export function countryFlag(code: string | null | undefined): string {
  return isCountryCode(code) ? COUNTRIES[code].flag : '';
}

/** "au Nigeria" / "en Afrique du Sud" — for French sentences. */
export function countryIn(code: string | null | undefined): string {
  return isCountryCode(code) ? COUNTRIES[code].frIn : '';
}

/** "🇳🇬 Nigeria" — for selects and campaign cards. */
export function countryLabel(code: string | null | undefined, locale: Locale = 'fr'): string {
  return isCountryCode(code) ? `${COUNTRIES[code].flag} ${COUNTRIES[code][locale]}` : (code ?? '');
}

/** Options for a <select>, in display order. */
export function countryOptions(locale: Locale = 'fr'): { code: CountryCode; label: string }[] {
  return COUNTRY_CODES.map((code) => ({ code, label: countryLabel(code, locale) }));
}

/** ISO currency for FCFA amounts shown to search engines: XOF in UEMOA (CI), XAF otherwise. */
export function fcfaCurrency(code: string | null | undefined): 'XOF' | 'XAF' {
  return code === 'CI' ? 'XOF' : 'XAF';
}
