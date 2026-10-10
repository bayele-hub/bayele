// Brand self-serve campaign form — pure validation + money mapping shared by the server action
// (app/(app)/business/actions.ts) and its tests. Council R4 (total budget → net per creator, net
// editable as an advanced option), R5 (below a pay floor: warning + required acknowledgement, never a
// block), design §7 (6 required answers; city + deadline required; platforms optional).

import type { Locale } from '@/i18n/config';
import { feeRateForTier } from '@/lib/data/campaigns';
import { countryName, parseCountry, type CountryCode } from '@/lib/countries';
import { CATEGORY_VALUES } from '@/lib/campaign-categories';
import {
  CONTENT_TYPE_VALUES, deliverableSummary, isRightsPreset, languageValue, resolveRights, selfServeFloor,
  selfServeFromPayout, selfServeFromTotal, type FloorMap, type LanguageKey, LANGUAGES, DEFAULT_RIGHTS,
} from '@/lib/managed-listing';

export type BrandFormError = 'required' | 'deadline' | 'budget' | 'floorAck';
/** Fields inside « Plus de détails » (the <details> opens when an error concerns one of them). */
export const MORE_FIELDS = ['title', 'brief', 'platforms', 'mandatory_tags', 'creator_requirements', 'language', 'equipment', 'tier'] as const;

export interface BrandCampaignValues {
  title: string;
  brief: string;
  category: string;
  target_country: CountryCode;
  total_budget_fcfa: number;
  payout_per_creator_fcfa: number;
  creator_count_target: number;
  platform_fee_rate: number;
  platforms: string[];
  content_type: string;
  deliverable_quantity: number;
  mandatory_tags: string | null;
  deadline: string;
  is_public: boolean;
  usage_rights: string;
  language: string | null;
  creator_requirements: string | null;
  equipment: string | null;
}

export type BrandParse = { ok: true; values: BrandCampaignValues; belowFloor: boolean } | { ok: false; error: BrandFormError; field: string };

const str = (f: Record<string, unknown>, k: string, max = 4000) => String(f[k] ?? '').trim().slice(0, max);
const int = (v: string) => {
  const n = Number(v.replace(/[\s  ]/g, ''));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};
const fill = (t: string, vars: Record<string, string>) => t.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);

export interface BrandCopy {
  autoTitle: string;
  generatedBrief: string;
  briefPlace: string;
}

/**
 * Validate the brand form and map it to a campaigns row. `budget_math_check` holds by construction
 * (payout × count ≤ pool ≤ total); the DB re-checks. Generated title/brief follow the brand's locale;
 * usage_rights is stored as the French preset text so public pages can re-render it per locale.
 */
export function parseBrandCampaign(form: Record<string, unknown>, opts: { today: string; floors: FloorMap; copy: BrandCopy; locale?: Locale }): BrandParse {
  const locale = opts.locale ?? 'fr';
  const contentType = str(form, 'content_type', 60);
  const quantity = int(str(form, 'quantity')) || 1;
  const count = int(str(form, 'count'));
  const city = str(form, 'city', 80);
  const country = parseCountry(form.country);
  const deadline = str(form, 'deadline', 10);
  const mode = str(form, 'budget_mode') === 'payout' ? 'payout' : 'total';
  const rightsKey = isRightsPreset(form.rights) ? form.rights : DEFAULT_RIGHTS;
  const rights = resolveRights(rightsKey, countryName(country, 'fr'), 'fr', str(form, 'rights_custom', 500));
  const categoryRaw = str(form, 'category', 80);
  const category = CATEGORY_VALUES.includes(categoryRaw) ? categoryRaw : '';

  // The six answers (design §7.2) + the sector's category.
  if (!CONTENT_TYPE_VALUES.includes(contentType)) return { ok: false, error: 'required', field: 'content_type' };
  if (!count) return { ok: false, error: 'required', field: 'count' };
  if (!city) return { ok: false, error: 'required', field: 'city' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return { ok: false, error: 'required', field: 'deadline' };
  if (deadline < opts.today) return { ok: false, error: 'deadline', field: 'deadline' };
  if (!rights) return { ok: false, error: 'required', field: 'rights' };
  if (!category) return { ok: false, error: 'required', field: 'category' };

  const rate = feeRateForTier(str(form, 'tier') || 'spark');
  const split = mode === 'payout' ? selfServeFromPayout(str(form, 'payout'), count, rate) : selfServeFromTotal(str(form, 'total'), count, rate);
  if (!split || split.payoutPerCreatorFcfa < 1) return { ok: false, error: 'budget', field: mode === 'payout' ? 'payout' : 'total' };

  const floor = selfServeFloor(contentType, quantity, split.payoutPerCreatorFcfa, opts.floors);
  const ack = ['on', 'true', '1'].includes(str(form, 'floor_ack'));
  if (floor.below && !ack) return { ok: false, error: 'floorAck', field: 'floor_ack' };

  const what = deliverableSummary(quantity, contentType, locale) ?? contentType;
  const title = str(form, 'title', 120) || fill(opts.copy.autoTitle, { what: what.charAt(0).toUpperCase() + what.slice(1), sector: category, city });
  const message = str(form, 'brief');
  const [y, m, d] = deadline.split('-');
  const brief = [
    message || fill(opts.copy.generatedBrief, { what: what.charAt(0).toUpperCase() + what.slice(1), deadline: `${d}/${m}/${y}` }),
    fill(opts.copy.briefPlace, { city, country: countryName(country, locale) }),
  ].join('\n\n');
  const langKey = (LANGUAGES.some((l) => l.key === form.language_key) ? form.language_key : '') as LanguageKey | '';

  return {
    ok: true,
    belowFloor: floor.below,
    values: {
      title,
      brief,
      category,
      target_country: country,
      total_budget_fcfa: split.totalFcfa,
      payout_per_creator_fcfa: split.payoutPerCreatorFcfa,
      creator_count_target: count,
      platform_fee_rate: rate,
      platforms: str(form, 'platforms').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 10),
      content_type: contentType,
      deliverable_quantity: quantity,
      mandatory_tags: str(form, 'mandatory_tags', 500) || null,
      deadline,
      is_public: str(form, 'is_public') !== 'false',
      usage_rights: rights,
      language: langKey ? languageValue(langKey, str(form, 'language_other', 60)) : null,
      creator_requirements: str(form, 'creator_requirements', 1000) || null,
      equipment: str(form, 'equipment', 500) || null,
    },
  };
}
