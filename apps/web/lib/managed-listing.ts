// Managed campaigns (« Géré par Bayele ») — pure listing libraries and money math shared by the admin
// brief editor, the brand self-serve form, the pay-floor page and the public campaign page.
// Every figure here is computed from numbers someone typed; nothing is invented (standing rule).
// The money functions mirror the SQL exactly (migration 0033: managed_net_preview,
// private.managed_floor_check, admin_publish_managed_brief; funding fee = floor(total × rate)).

import type { Database } from '@bayele/database';
import type { Locale } from '@/i18n/config';
import { categoryNeedsClaims } from '@/lib/campaign-categories';
import { countryName } from '@/lib/countries';

export type DeliverableType = Database['public']['Enums']['deliverable_type'];

interface DeliverableInfo {
  key: DeliverableType;
  fr: string;
  en: string;
  unitFr: string;
  unitEn: string;
  /** Count nouns for the public « 3 vidéos courtes » line (council R1). */
  oneFr: string;
  manyFr: string;
  oneEn: string;
  manyEn: string;
}

/** Keys = enum public.deliverable_type (0033), in the enum's order. */
export const DELIVERABLE_TYPES: readonly DeliverableInfo[] = [
  { key: 'photo', fr: 'Photo retouchée', en: 'Retouched photo', unitFr: 'par photo', unitEn: 'per photo', oneFr: 'photo retouchée', manyFr: 'photos retouchées', oneEn: 'retouched photo', manyEn: 'retouched photos' },
  { key: 'short_video', fr: 'Vidéo courte (Reel, TikTok, Short)', en: 'Short video (Reel, TikTok, Short)', unitFr: 'par vidéo', unitEn: 'per video', oneFr: 'vidéo courte', manyFr: 'vidéos courtes', oneEn: 'short video', manyEn: 'short videos' },
  { key: 'long_video', fr: 'Film ou vidéo longue (1 à 3 min)', en: 'Film or long video (1–3 min)', unitFr: 'par film', unitEn: 'per film', oneFr: 'film', manyFr: 'films', oneEn: 'film', manyEn: 'films' },
  { key: 'animation', fr: 'Vidéo explicative ou animée', en: 'Explainer or animated video', unitFr: 'par vidéo', unitEn: 'per video', oneFr: 'vidéo animée', manyFr: 'vidéos animées', oneEn: 'animated video', manyEn: 'animated videos' },
  { key: 'shoot_day', fr: 'Journée de tournage ou shooting', en: 'Shoot day', unitFr: 'par journée', unitEn: 'per day', oneFr: 'journée de tournage', manyFr: 'journées de tournage', oneEn: 'shoot day', manyEn: 'shoot days' },
  { key: 'post', fr: 'Post (LinkedIn, Facebook…)', en: 'Post (LinkedIn, Facebook…)', unitFr: 'par post', unitEn: 'per post', oneFr: 'post', manyFr: 'posts', oneEn: 'post', manyEn: 'posts' },
  { key: 'story', fr: 'Story ou statut', en: 'Story or status', unitFr: 'par story', unitEn: 'per story', oneFr: 'story', manyFr: 'stories', oneEn: 'story', manyEn: 'stories' },
  { key: 'ugc_video', fr: 'Vidéo UGC', en: 'UGC video', unitFr: 'par vidéo', unitEn: 'per video', oneFr: 'vidéo UGC', manyFr: 'vidéos UGC', oneEn: 'UGC video', manyEn: 'UGC videos' },
  { key: 'other', fr: 'Autre', en: 'Other', unitFr: 'par unité', unitEn: 'per unit', oneFr: 'contenu', manyFr: 'contenus', oneEn: 'piece of content', manyEn: 'pieces of content' },
];

export const DELIVERABLE_KEYS: readonly DeliverableType[] = DELIVERABLE_TYPES.map((d) => d.key);

export function isDeliverableType(v: unknown): v is DeliverableType {
  return typeof v === 'string' && (DELIVERABLE_KEYS as readonly string[]).includes(v);
}

export function deliverableInfo(key: string | null | undefined): DeliverableInfo | null {
  return DELIVERABLE_TYPES.find((d) => d.key === key) ?? null;
}

export function deliverableLabel(key: string | null | undefined, locale: Locale): string {
  const d = deliverableInfo(key);
  return d ? d[locale] : '';
}

/** « 3 vidéos courtes » / « 1 short video ». */
export function deliverableCount(key: DeliverableType, qty: number, locale: Locale): string {
  const d = deliverableInfo(key)!;
  const noun = locale === 'fr' ? (qty === 1 ? d.oneFr : d.manyFr) : qty === 1 ? d.oneEn : d.manyEn;
  return `${qty} ${noun}`;
}

/** The city to print next to a managed label — skipped when the label already names it. */
export function cityUnlessInLabel(label: string, city: string | null | undefined): string | null {
  const c = (city ?? '').trim();
  if (!c) return null;
  return norm(label).includes(norm(c)) ? null : c;
}

// ── Self-serve content types (the brand form's existing list, stored as the FR label) ─────────────

interface ContentTypeInfo {
  fr: string;
  en: string;
  /** Pay-floor lookup (R5): which deliverable type this content type is checked against. */
  floorType: DeliverableType;
  oneFr: string;
  manyFr: string;
  oneEn: string;
  manyEn: string;
}

export const CONTENT_TYPES: readonly ContentTypeInfo[] = [
  { fr: 'Statut / Story', en: 'Status / Story', floorType: 'story', oneFr: 'statut / story', manyFr: 'statuts / stories', oneEn: 'status / story', manyEn: 'statuses / stories' },
  { fr: 'Vidéo courte', en: 'Short video', floorType: 'short_video', oneFr: 'vidéo courte', manyFr: 'vidéos courtes', oneEn: 'short video', manyEn: 'short videos' },
  { fr: 'Post photo', en: 'Photo post', floorType: 'post', oneFr: 'post photo', manyFr: 'posts photo', oneEn: 'photo post', manyEn: 'photo posts' },
  { fr: 'Reel', en: 'Reel', floorType: 'short_video', oneFr: 'Reel', manyFr: 'Reels', oneEn: 'Reel', manyEn: 'Reels' },
  { fr: 'Carrousel', en: 'Carousel', floorType: 'post', oneFr: 'carrousel', manyFr: 'carrousels', oneEn: 'carousel', manyEn: 'carousels' },
  { fr: 'Live', en: 'Live', floorType: 'other', oneFr: 'live', manyFr: 'lives', oneEn: 'live', manyEn: 'lives' },
  { fr: 'Autre', en: 'Other', floorType: 'other', oneFr: 'contenu', manyFr: 'contenus', oneEn: 'piece of content', manyEn: 'pieces of content' },
];

export const CONTENT_TYPE_VALUES: string[] = CONTENT_TYPES.map((c) => c.fr);

const norm = (s: string | null | undefined) =>
  (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

function contentTypeInfo(value: string | null | undefined) {
  const v = norm(value);
  return CONTENT_TYPES.find((c) => norm(c.fr) === v) ?? null;
}

/**
 * A stored campaigns.content_type in the page locale. Self-serve values come from CONTENT_TYPES;
 * managed values are the FR label of the main deliverable type. Unknown free text is returned as is.
 */
export function contentTypeLabel(value: string | null | undefined, locale: Locale): string {
  const raw = (value ?? '').trim();
  const ct = contentTypeInfo(raw);
  if (ct) return ct[locale];
  const d = DELIVERABLE_TYPES.find((x) => norm(x.fr) === norm(raw));
  return d ? d[locale] : raw;
}

/**
 * Council R1: the deliverable COUNT + TYPE is public on every listing (« 3 vidéos courtes »).
 * Null when either part is missing; unknown content types fall back to « 3 × {type} ».
 */
export function deliverableSummary(qty: number | null | undefined, contentType: string | null | undefined, locale: Locale): string | null {
  const n = qty && Number.isFinite(qty) && qty > 0 ? Math.round(qty) : null;
  const raw = (contentType ?? '').trim();
  if (!n || !raw) return null;
  const ct = contentTypeInfo(raw);
  if (ct) return `${n} ${locale === 'fr' ? (n === 1 ? ct.oneFr : ct.manyFr) : n === 1 ? ct.oneEn : ct.manyEn}`;
  const d = DELIVERABLE_TYPES.find((x) => norm(x.fr) === norm(raw));
  if (d) return deliverableCount(d.key, n, locale);
  return `${n} × ${raw}`;
}

/** The deliverable type a self-serve content type is floor-checked against (R5). */
export function floorTypeForContent(contentType: string | null | undefined): DeliverableType | null {
  return contentTypeInfo(contentType)?.floorType ?? null;
}

// ── Usage rights presets (M7 default: organic, campaign country, 6 months) ───────────────────────

export type RightsPresetKey = 'organic_6m' | 'organic_web' | 'paid_ads' | 'custom';

interface RightsPreset {
  key: RightsPresetKey;
  fr: string;
  en: string;
  /** Short radio label for the brand form. */
  shortFr: string;
  shortEn: string;
}

export const RIGHTS_PRESETS: readonly RightsPreset[] = [
  {
    key: 'organic_6m',
    fr: 'Usage organique sur les réseaux de la marque, {pays}, 6 mois.',
    en: "Organic use on the brand's own channels, {country}, 6 months.",
    shortFr: 'Vos réseaux, {pays}, 6 mois',
    shortEn: 'Your channels, {country}, 6 months',
  },
  {
    key: 'organic_web',
    fr: 'Usage organique sur les réseaux et le site web de la marque, {pays}, 6 mois.',
    en: "Organic use on the brand's channels and website, {country}, 6 months.",
    shortFr: 'Vos réseaux + site web, {pays}, 6 mois',
    shortEn: 'Your channels + website, {country}, 6 months',
  },
  {
    key: 'paid_ads',
    fr: 'Usage organique et publicité payante sur les comptes de la marque, {pays}, 6 mois — option payante, avec l’accord écrit du créateur.',
    en: "Organic use and paid ads on the brand's accounts, {country}, 6 months — a paid extra, with the creator's written agreement.",
    shortFr: 'Vos réseaux + publicité payante, {pays}, 6 mois',
    shortEn: 'Your channels + paid ads, {country}, 6 months',
  },
  { key: 'custom', fr: '', en: '', shortFr: 'Autre', shortEn: 'Other' },
];

export const DEFAULT_RIGHTS: RightsPresetKey = 'organic_6m';

export function isRightsPreset(v: unknown): v is RightsPresetKey {
  return typeof v === 'string' && RIGHTS_PRESETS.some((r) => r.key === v);
}

/** Preset text with the campaign country filled in. `custom` returns the free text (trimmed). */
export function resolveRights(key: RightsPresetKey, countryLabel: string, locale: Locale, custom = ''): string {
  if (key === 'custom') return custom.trim();
  const p = RIGHTS_PRESETS.find((r) => r.key === key)!;
  return p[locale].replace('{pays}', countryLabel).replace('{country}', countryLabel);
}

export function rightsShortLabel(key: RightsPresetKey, countryLabel: string, locale: Locale): string {
  const p = RIGHTS_PRESETS.find((r) => r.key === key)!;
  return (locale === 'fr' ? p.shortFr : p.shortEn).replace('{pays}', countryLabel).replace('{country}', countryLabel);
}

/** Which preset produced a stored text (for re-opening a brief); `custom` when none matches. */
export function rightsPresetOf(text: string | null | undefined, countryLabel: string): RightsPresetKey {
  const t = (text ?? '').trim();
  if (!t) return DEFAULT_RIGHTS;
  const hit = RIGHTS_PRESETS.find((r) => r.key !== 'custom' && resolveRights(r.key, countryLabel, 'fr') === t);
  return hit?.key ?? 'custom';
}

/** Stored rights text (FR preset or free text) in the page locale: presets are re-rendered, free text kept. */
export function localizedRights(text: string | null | undefined, country: string | null | undefined, locale: Locale): string {
  const raw = (text ?? '').trim();
  if (!raw || locale === 'fr') return raw;
  const key = rightsPresetOf(raw, countryName(country, 'fr'));
  return key === 'custom' ? raw : resolveRights(key, countryName(country, locale), locale);
}

// ── Content language (council R7: fixed list + « Autre » with free text) ─────────────────────────

export const LANGUAGES = [
  { key: 'fr', fr: 'Français', en: 'French' },
  { key: 'en', fr: 'Anglais', en: 'English' },
  { key: 'pcm', fr: 'Pidgin', en: 'Pidgin' },
  { key: 'sw', fr: 'Kiswahili', en: 'Kiswahili' },
  { key: 'ar', fr: 'Arabe', en: 'Arabic' },
  { key: 'other', fr: 'Autre', en: 'Other' },
] as const;

export type LanguageKey = (typeof LANGUAGES)[number]['key'];

/** The stored value: the FR label for a listed language, the free text for « Autre » (≤ 60, DB cap). */
export function languageValue(key: LanguageKey, other = ''): string | null {
  if (key === 'other') return other.trim().slice(0, 60) || null;
  return LANGUAGES.find((l) => l.key === key)!.fr;
}

/** Stored value → select state (re-opening a brief). */
export function languageKeyOf(value: string | null | undefined): { key: LanguageKey; other: string } {
  const v = norm(value);
  if (!v) return { key: 'fr', other: '' };
  const hit = LANGUAGES.find((l) => l.key !== 'other' && (norm(l.fr) === v || norm(l.en) === v));
  return hit ? { key: hit.key, other: '' } : { key: 'other', other: (value ?? '').trim() };
}

/** Stored value in the page locale; free text (« Autre ») is shown as typed. */
export function languageLabel(value: string | null | undefined, locale: Locale): string {
  const raw = (value ?? '').trim();
  const hit = LANGUAGES.find((l) => l.key !== 'other' && (norm(l.fr) === norm(raw) || norm(l.en) === norm(raw)));
  return hit ? hit[locale] : raw;
}

// ── Money (K7 + E3) ───────────────────────────────────────────────────────────────────────────────

export const MANAGED_FEE_RATE = 0.25;

export interface NetPreview {
  places: number;
  units: number;
  totalFcfa: number;
  feeFcfa: number;
  poolFcfa: number;
  netPerPlaceFcfa: number;
  netPerUnitFcfa: number;
  /** pool − net × places (≥ 0); stays in the escrow pool (E3). */
  remainderFcfa: number;
}

const posInt = (n: unknown): number | null => {
  const v = typeof n === 'string' ? Number(n.replace(/[\s  ]/g, '')) : Number(n);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : null;
};

/**
 * Client mirror of public.managed_net_preview: fee = floor(total × 0.25), pool = total − fee,
 * net/place = floor(total × 3 ÷ (4 × places)), unit = floor(net ÷ count), remainder = pool − net × places.
 * Null for incomplete input (total ≤ 0, places < 1), like the SQL's zero rows.
 */
export function managedNetPreview(total: unknown, places: unknown, count: unknown = 1): NetPreview | null {
  const t = posInt(total);
  const p = posInt(places);
  if (!t || !p) return null;
  const c = posInt(count) ?? 1;
  const fee = Math.floor(t / 4);
  const pool = t - fee;
  const net = Math.floor((t * 3) / (4 * p));
  return { places: p, units: c, totalFcfa: t, feeFcfa: fee, poolFcfa: pool, netPerPlaceFcfa: net, netPerUnitFcfa: Math.floor(net / c), remainderFcfa: pool - net * p };
}

/** K7 headline: net per place = floor(total × 0.75 ÷ places). */
export function netPerPlace(total: number, places: number): number {
  return managedNetPreview(total, places)?.netPerPlaceFcfa ?? 0;
}

/** Integer percent for a valid_fee_rate value (0.10 / 0.15 / 0.25 → 10 / 15 / 25). */
const pct = (rate: number) => Math.round(rate * 100);

export interface SelfServeSplit {
  totalFcfa: number;
  feeFcfa: number;
  poolFcfa: number;
  payoutPerCreatorFcfa: number;
  ratePct: number;
}

/**
 * Council R4 — brand self-serve form from the TOTAL budget: payout = floor(total × (1 − rate) ÷ count).
 * fee = floor(total × rate) (what admin_confirm_campaign_funding takes), pool = total − fee.
 * payout × count ≤ pool ≤ total, so budget_math_check holds by construction.
 */
export function selfServeFromTotal(total: unknown, count: unknown, rate: number): SelfServeSplit | null {
  const t = posInt(total);
  const n = posInt(count);
  if (!t || !n) return null;
  const r = pct(rate);
  const fee = Math.floor((t * r) / 100);
  return { totalFcfa: t, feeFcfa: fee, poolFcfa: t - fee, payoutPerCreatorFcfa: Math.floor((t * (100 - r)) / (100 * n)), ratePct: r };
}

/**
 * Advanced option (R4): the brand types the per-creator net; the total is grossed up so the creator
 * pool after the fee still covers payout × count (same rounding as the existing computeBudget).
 */
export function selfServeFromPayout(payout: unknown, count: unknown, rate: number): SelfServeSplit | null {
  const p = posInt(payout);
  const n = posInt(count);
  if (!p || !n) return null;
  const r = pct(rate);
  const need = p * n;
  // Smallest total whose post-fee pool (total − floor(total × r%)) covers payout × count.
  let total = Math.ceil((need * 100) / (100 - r));
  while (total - Math.floor((total * r) / 100) < need) total += 1;
  const fee = Math.floor((total * r) / 100);
  return { totalFcfa: total, feeFcfa: fee, poolFcfa: total - fee, payoutPerCreatorFcfa: p, ratePct: r };
}

// ── Pay floors (K1 managed: blocked · R5 self-serve: warning + acknowledgement) ──────────────────

export type FloorMap = Partial<Record<DeliverableType, number | null>>;

export type FloorState =
  | { kind: 'not_set' }
  | { kind: 'pass'; floorFcfa: number; perUnitFcfa: number }
  | {
      kind: 'below';
      floorFcfa: number;
      perUnitFcfa: number;
      /** Missing net per place to reach the floor. */
      gapPerPlaceFcfa: number;
      /** Counter-offer 1 — same work: smallest total that clears the floor. */
      totalForSameWorkFcfa: number;
      /** Counter-offer 2 — same budget: units per place the net covers (0 = hide the option). */
      unitsForSameBudget: number;
    };

/**
 * Same rule as private.managed_floor_check / admin_publish_managed_brief (E10: main type only):
 * below ⇔ net per place < floor × units. Equal passes. No floor (or incomplete numbers) → not_set.
 */
export function floorCheck(
  type: DeliverableType | null | undefined,
  units: number | null | undefined,
  net: NetPreview | null,
  floors: FloorMap,
): FloorState {
  const floor = type ? floors[type] : null;
  if (!floor || floor <= 0 || !net) return { kind: 'not_set' };
  const u = Math.max(1, Math.floor(units ?? 1) || 1);
  const required = floor * u;
  const perUnit = Math.floor(net.netPerPlaceFcfa / u);
  if (net.netPerPlaceFcfa >= required) return { kind: 'pass', floorFcfa: floor, perUnitFcfa: perUnit };
  return {
    kind: 'below',
    floorFcfa: floor,
    perUnitFcfa: perUnit,
    gapPerPlaceFcfa: required - net.netPerPlaceFcfa,
    totalForSameWorkFcfa: Math.ceil((4 * net.places * required) / 3),
    unitsForSameBudget: Math.floor(net.netPerPlaceFcfa / floor),
  };
}

/** Self-serve floor state (R5): per-creator payout ÷ quantity vs the floor of the content's type. */
export function selfServeFloor(contentType: string | null | undefined, quantity: unknown, payout: number | null | undefined, floors: FloorMap): { below: boolean; floorFcfa: number | null } {
  const type = floorTypeForContent(contentType);
  const floor = type ? floors[type] ?? null : null;
  if (!floor || floor <= 0 || !payout || payout <= 0) return { below: false, floorFcfa: floor && floor > 0 ? floor : null };
  const q = posInt(quantity) ?? 1;
  return { below: payout < floor * q, floorFcfa: floor };
}

// ── K3 guard + mandatory checklist (plan §4; items 1–14 mirror the publish RPC's checks) ─────────

/** Descriptor mode: the public label must not reuse the internal brand name (case/accent-insensitive). */
export function labelReusesName(label: string | null | undefined, internalName: string | null | undefined): boolean {
  const l = norm(label);
  const n = norm(internalName);
  if (!l || !n || n.length < 2) return false;
  return l.includes(n) || n.includes(l);
}

export interface BriefDraft {
  brandName: string;
  brandLabel: string;
  realName: boolean; // « Nom réel » display mode
  brandConsent: boolean;
  brandConsentProof: string;
  city: string;
  country: string;
  service: string;
  title: string;
  category: string;
  deliverableType: DeliverableType | '';
  deliverableCount: string;
  platforms: string[];
  deliverables: string;
  deadline: string; // YYYY-MM-DD
  totalBudget: string;
  places: string;
  rightsText: string;
  creatorRequirements: string;
  language: string;
  claimsVerified: boolean;
  orderConfirmed: boolean;
  orderProof: string;
}

export const CHECKLIST_KEYS = [
  'label', 'consent', 'service', 'deliverables', 'platforms', 'city', 'country', 'language', 'deadline',
  'budget', 'net', 'rights', 'profile', 'floor', 'yes',
] as const;
export type ChecklistKey = (typeof CHECKLIST_KEYS)[number];

/** HTML id of the field a checklist item links to. */
export const CHECKLIST_FIELD: Record<ChecklistKey, string> = {
  label: 'field-brand-label', consent: 'field-consent', service: 'field-service', deliverables: 'field-deliverables',
  platforms: 'field-platforms', city: 'field-city', country: 'field-country', language: 'field-language',
  deadline: 'field-deadline', budget: 'field-budget', net: 'field-places', rights: 'field-rights',
  profile: 'field-requirements', floor: 'field-budget', yes: 'field-yes',
};

export function briefChecklist(d: BriefDraft, floor: FloorState, today: string): Record<ChecklistKey, boolean> {
  const has = (s: string) => s.trim().length > 0;
  const units = posInt(d.deliverableCount);
  const net = managedNetPreview(d.totalBudget, d.places, d.deliverableCount);
  return {
    label: has(d.brandLabel) && (d.realName ? true : !labelReusesName(d.brandLabel, d.brandName)),
    consent: d.realName ? d.brandConsent && has(d.brandConsentProof) : true,
    // Service + category, and R8/Legal « Allégations vérifiées » for the sensitive categories.
    service: (has(d.service) || has(d.title)) && has(d.category) && (!categoryNeedsClaims(d.category) || d.claimsVerified),
    deliverables: !!d.deliverableType && !!units && has(d.deliverables),
    platforms: d.platforms.length > 0,
    city: has(d.city),
    country: has(d.country),
    language: has(d.language),
    deadline: /^\d{4}-\d{2}-\d{2}$/.test(d.deadline) && d.deadline >= today,
    budget: !!posInt(d.totalBudget),
    net: !!posInt(d.places) && !!net && net.netPerPlaceFcfa >= 1,
    rights: has(d.rightsText),
    profile: has(d.creatorRequirements),
    floor: floor.kind !== 'below',
    yes: d.orderConfirmed && has(d.orderProof),
  };
}

/** Items 1–14 (everything but the brand's « OUI »): required before sending the order form. */
export function readyForOrder(c: Record<ChecklistKey, boolean>): boolean {
  return CHECKLIST_KEYS.filter((k) => k !== 'yes').every((k) => c[k]);
}
