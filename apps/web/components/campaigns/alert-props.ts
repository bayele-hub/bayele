import type { Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { countryOptions } from '@/lib/countries';
import { CAMPAIGN_CATEGORIES } from '@/lib/campaign-categories';

/** Options + copy shared by every alert opt-in (server-side; the result is serializable). */
export function alertOptions(t: Dictionary, locale: Locale) {
  return {
    copy: t.alerts,
    countries: countryOptions(locale).map((c) => ({ code: c.code, label: c.label })),
    categories: CAMPAIGN_CATEGORIES.map((c, i) => ({ slug: c.slug, label: locale === 'en' ? (t.categories[i] ?? c.fr) : c.fr })),
  };
}
