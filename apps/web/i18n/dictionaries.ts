import 'server-only';
import { cookies, headers } from 'next/headers';
import { defaultLocale, isLocale, LOCALE_COOKIE, locales, type Locale } from './config';
import fr from '../messages/fr.json';
import en from '../messages/en.json';

export type Dictionary = typeof fr;
const dictionaries: Record<Locale, Dictionary> = { fr, en: en as Dictionary };

/** Resolve locale: cookie → Accept-Language → default (French). */
export async function getLocale(): Promise<Locale> {
  const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(cookieLocale)) return cookieLocale;

  const accept = (await headers()).get('accept-language') ?? '';
  const preferred = accept.split(',').map((p) => p.split(';')[0]?.trim().slice(0, 2).toLowerCase());
  const match = preferred.find((p) => (locales as readonly string[]).includes(p ?? ''));
  return isLocale(match) ? match : defaultLocale;
}

export async function getDictionary(): Promise<{ locale: Locale; t: Dictionary }> {
  const locale = await getLocale();
  return { locale, t: dictionaries[locale] };
}

export { formatFcfa, formatFollowers } from './format';
