export const locales = ['fr', 'en'] as const;
export type Locale = (typeof locales)[number];

// Market-primary language. French URLs stay canonical; English is additive.
export const defaultLocale: Locale = 'fr';
export const LOCALE_COOKIE = 'NEXT_LOCALE';

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}
