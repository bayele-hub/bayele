import { isCountryCode, type CountryCode } from '@/lib/countries';
import { parseCategorySlug, type CategorySlug } from '@/lib/campaign-categories';

/** Message keys under `alerts.*` in the dictionaries (FR copy lives in messages/fr.json). */
export type AlertErrorKey = 'limit' | 'invalid' | 'profileRequired' | 'error';

export type AlertState =
  | { status: 'idle' }
  | { status: 'ok' | 'duplicate'; country: CountryCode | null; cat: CategorySlug | null }
  | { status: 'error'; error: AlertErrorKey };

/** subscribe_campaign_alert error codes (backend contract §5) → dictionary key. */
export function alertErrorKey(code: string | null | undefined): AlertErrorKey {
  switch ((code ?? '').trim()) {
    case 'alert_limit_reached':
      return 'limit';
    case 'invalid_category':
      return 'invalid';
    case 'profile_required':
    case 'not_authenticated':
      return 'profileRequired';
    default:
      return 'error';
  }
}

/**
 * Validate the opt-in form fields. Empty = "any"; anything else must be a known country / category
 * slug, otherwise the whole submission is invalid (never silently widened to "any").
 */
export function parseAlertFilters(country: unknown, cat: unknown): { ok: true; country: CountryCode | null; cat: CategorySlug | null } | { ok: false } {
  const c = typeof country === 'string' ? country.trim().toUpperCase() : '';
  const k = typeof cat === 'string' ? cat.trim() : '';
  if (c && !isCountryCode(c)) return { ok: false };
  const slug = k ? parseCategorySlug(k) : null;
  if (k && !slug) return { ok: false };
  return { ok: true, country: c ? (c as CountryCode) : null, cat: slug };
}
