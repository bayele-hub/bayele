'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from 'react';
import {
  AlertCircle, BadgeCheck, Check, CheckCircle2, ChevronLeft, Clock, EyeOff, Globe, Info, Loader2, Lock, Store, TriangleAlert,
} from 'lucide-react';
import type { Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { formatFcfa } from '@/i18n/format';
import type { Database } from '@bayele/database';
import { SocialIcon, SOCIAL_META, type Platform } from '@/components/social-icons';
import { ManagedBadge } from '@/components/campaigns/managed-badge';
import { COUNTRIES, COUNTRY_CODES, countryName, isCountryCode } from '@/lib/countries';
import { CAMPAIGN_CATEGORIES, categoryNeedsClaims } from '@/lib/campaign-categories';
import { fill } from '@/lib/campaign-board';
import {
  CHECKLIST_KEYS, DELIVERABLE_TYPES, LANGUAGES, RIGHTS_PRESETS, briefChecklist, cityUnlessInLabel, deliverableCount, deliverableLabel,
  floorCheck, isDeliverableType, labelReusesName, languageKeyOf, languageValue, managedNetPreview, readyForOrder, resolveRights,
  rightsPresetOf, type BriefDraft, type DeliverableType, type FloorMap, type LanguageKey, type RightsPresetKey,
} from '@/lib/managed-listing';
import { MANAGED_TEMPLATES, findTemplate } from '@/lib/managed-templates';
import { isLive, pipelineKey } from '@/lib/managed-brief-state';
import { nudgeText, orderFormText } from '@/lib/managed-order-form';
import { waMeHref } from '@/lib/whatsapp';
import { WhatsAppTile } from '@/components/campaigns/card-parts';
import { declineBriefAction, duplicateBriefAction, publishBriefAction, saveBriefAction, setBriefStatusAction, type BriefPayload } from '../actions';
import { NetPayPanel } from './net-pay-panel';
import { PayFloorVerdict } from './pay-floor-verdict';
import { MandatoryChecklist } from './mandatory-checklist';
import { OrderFormCopy } from './order-form-copy';
import { StatusPill } from './brief-bits';

type Row = Database['public']['Tables']['managed_briefs']['Row'];
type CampaignStatus = Database['public']['Enums']['campaign_status'];
type L = Dictionary['admin']['briefs'];

// Networks managed campaigns run on (keys match SOCIAL_META; publish needs ≥ 1).
const PLATFORMS: Platform[] = ['whatsapp', 'tiktok', 'instagram', 'facebook', 'youtube', 'linkedin'];

interface Form {
  brandName: string;
  contactName: string;
  contactWhatsapp: string;
  realName: boolean;
  brandLabel: string;
  brandConsent: boolean;
  brandConsentProof: string;
  city: string;
  country: string;
  templateKey: string;
  service: string;
  title: string;
  category: string;
  claimsVerified: boolean;
  deliverableType: DeliverableType | '';
  deliverableCount: string;
  platforms: string[];
  deliverables: string;
  deadline: string;
  totalBudget: string;
  places: string;
  rightsKey: RightsPresetKey;
  rightsCustom: string;
  creatorRequirements: string;
  languageKey: LanguageKey;
  languageOther: string;
  equipment: string;
  orderConfirmed: boolean;
  orderConfirmedAt: string; // datetime-local
  orderProof: string;
  depositStatus: 'none' | 'partial' | 'full';
  notes: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
function toLocalInput(iso: string | null | undefined): string {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formFromRow(r: Row | null): Form {
  const countryFr = countryName(r?.country ?? '', 'fr');
  const lang = languageKeyOf(r?.language);
  const rightsKey = r?.usage_rights ? rightsPresetOf(r.usage_rights, countryFr) : 'organic_6m';
  const tpl = MANAGED_TEMPLATES.find((t) => t.label.fr === r?.sector);
  return {
    brandName: r?.brand_name ?? '',
    contactName: r?.contact_name ?? '',
    contactWhatsapp: r?.contact_whatsapp ?? '',
    realName: !!r?.brand_consent,
    brandLabel: r?.brand_label ?? '',
    brandConsent: !!r?.brand_consent,
    brandConsentProof: r?.brand_consent_proof ?? '',
    city: r?.city ?? '',
    country: r?.country ?? '',
    templateKey: tpl?.key ?? '',
    service: r?.service ?? '',
    title: r?.title ?? '',
    category: r?.category ?? '',
    claimsVerified: !!r?.claims_verified,
    deliverableType: r?.deliverable_type ?? '',
    deliverableCount: r?.deliverable_type ? String(r.deliverable_count) : '',
    platforms: r?.platforms ?? [],
    deliverables: r?.deliverables ?? '',
    deadline: r?.deadline ?? '',
    totalBudget: r?.total_budget_fcfa ? String(r.total_budget_fcfa) : '',
    places: String(r?.places ?? 1),
    rightsKey,
    rightsCustom: rightsKey === 'custom' ? (r?.usage_rights ?? '') : '',
    creatorRequirements: r?.creator_requirements ?? '',
    languageKey: r?.language ? lang.key : 'fr',
    languageOther: lang.other,
    equipment: r?.equipment ?? '',
    orderConfirmed: !!r?.order_confirmed_at,
    orderConfirmedAt: toLocalInput(r?.order_confirmed_at),
    orderProof: r?.order_proof ?? '',
    depositStatus: r?.deposit_status ?? 'none',
    notes: r?.notes ?? '',
  };
}

const int = (s: string): number | null => {
  const n = Number(String(s).replace(/[\s  ]/g, ''));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
};

/** « +237 6 90 00 00 00 » → « +237690000000 » (E.164 with '+', DB CHECK). */
function normalizePhone(s: string): string {
  const v = s.replace(/[\s\-.()]/g, '');
  if (!v) return '';
  if (v.startsWith('00')) return `+${v.slice(2)}`;
  return v.startsWith('+') ? v : `+${v}`;
}

function rightsText(f: Form, locale: Locale): string {
  // A preset needs the campaign country (« {pays} »); without it the rights are not complete yet.
  if (f.rightsKey !== 'custom' && !f.country) return '';
  return resolveRights(f.rightsKey, countryName(f.country, locale), locale, f.rightsCustom);
}

/** The listing fields (everything the brand says « OUI » to); used to detect changes after the order form. */
function listingPayload(f: Form): BriefPayload {
  const type = isDeliverableType(f.deliverableType) ? f.deliverableType : null;
  return {
    brand_name: f.brandName.trim(),
    brand_label: f.brandLabel,
    brand_consent: f.realName && f.brandConsent,
    country: f.country || null,
    city: f.city,
    sector: findTemplate(f.templateKey)?.label.fr ?? null,
    category: f.category || null,
    service: f.service,
    title: f.title,
    deliverables: f.deliverables,
    deliverable_type: type,
    deliverable_count: int(f.deliverableCount) ?? 1,
    places: int(f.places) ?? 1,
    total_budget_fcfa: int(f.totalBudget),
    platforms: f.platforms,
    content_type: type ? deliverableLabel(type, 'fr') : null,
    language: languageValue(f.languageKey, f.languageOther),
    usage_rights: rightsText(f, 'fr') || null,
    creator_requirements: f.creatorRequirements,
    equipment: f.equipment,
    claims_verified: categoryNeedsClaims(f.category) ? f.claimsVerified : false,
    deadline: f.deadline || null,
  };
}

function draftOf(f: Form): BriefDraft {
  return {
    brandName: f.brandName,
    brandLabel: f.brandLabel,
    realName: f.realName,
    brandConsent: f.brandConsent,
    brandConsentProof: f.brandConsentProof,
    city: f.city,
    country: f.country,
    service: f.service,
    title: f.title,
    category: f.category,
    deliverableType: f.deliverableType,
    deliverableCount: f.deliverableCount,
    platforms: f.platforms,
    deliverables: f.deliverables,
    deadline: f.deadline,
    totalBudget: f.totalBudget,
    places: f.places,
    rightsText: rightsText(f, 'fr'),
    creatorRequirements: f.creatorRequirements,
    language: languageValue(f.languageKey, f.languageOther) ?? '',
    claimsVerified: f.claimsVerified,
    orderConfirmed: f.orderConfirmed,
    orderProof: f.orderProof,
  };
}

export function BriefEditor({
  row,
  campaignStatus,
  floors,
  floorsAvailable,
  L,
  badge,
  categoryLabels,
  locale,
  today,
}: {
  row: Row | null;
  campaignStatus: CampaignStatus | null;
  floors: FloorMap;
  floorsAvailable: boolean;
  L: L;
  badge: string;
  categoryLabels: string[];
  locale: Locale;
  today: string;
}) {
  const router = useRouter();
  const initial = useMemo(() => formFromRow(row), [row]);
  const [f, setF] = useState<Form>(initial);
  const [saved, setSaved] = useState<Form>(initial);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [tplConfirm, setTplConfirm] = useState<string | null>(null);
  const [orderLang, setOrderLang] = useState<Locale>(locale);
  const [publishOpen, setPublishOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState(0);
  const [declineNote, setDeclineNote] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const errRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setF(initial);
    setSaved(initial);
  }, [initial]);

  const id = row?.id ?? null;
  const live = isLive(row?.campaign_id ?? null, campaignStatus);
  const locked = live; // E5: listing fields frozen once the campaign exists
  const stage = row ? pipelineKey(row, campaignStatus) : 'draft';
  const declined = row?.status === 'declined';
  const dirty = JSON.stringify(f) !== JSON.stringify(saved);

  // Unsaved-changes guard.
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));

  const units = int(f.deliverableCount) ?? 1;
  const net = managedNetPreview(f.totalBudget, f.places, f.deliverableCount || 1);
  const floor = floorCheck(f.deliverableType || null, units, net, floors);
  const checks = briefChecklist(draftOf(f), floor, today);
  const doneCount = CHECKLIST_KEYS.filter((k) => checks[k]).length;
  const orderReady = readyForOrder(checks);
  const allGreen = doneCount === CHECKLIST_KEYS.length;
  const missingItems = CHECKLIST_KEYS.map((k, i) => (k !== 'yes' && !checks[k] ? L.checklist.items[i] : null)).filter(Boolean).join(', ');
  const labelClash = !f.realName && labelReusesName(f.brandLabel, f.brandName);
  const claimsNeeded = categoryNeedsClaims(f.category);
  const tpl = findTemplate(f.templateKey);
  const service = (f.title || f.service).trim();

  const orderInput = (lang: Locale) => ({
    brandName: f.brandName,
    brandLabel: f.brandLabel,
    brandConsent: f.realName && f.brandConsent,
    city: f.city,
    country: f.country,
    contactName: f.contactName,
    contactWhatsapp: normalizePhone(f.contactWhatsapp),
    title: service,
    deliverableType: f.deliverableType,
    deliverableCount: int(f.deliverableCount),
    deliverables: f.deliverables,
    places: int(f.places),
    language: languageValue(f.languageKey, f.languageOther) ?? '',
    deadline: f.deadline,
    rightsText: rightsText(f, lang),
    totalBudget: int(f.totalBudget),
  });
  const orderTexts = { fr: orderFormText(orderInput('fr'), 'fr'), en: orderFormText(orderInput('en'), 'en') };
  const counterText =
    floor.kind === 'below'
      ? nudgeText('counterOffer', orderLang, {
          contact: f.contactName.trim(),
          service,
          net: net ? formatFcfa(net.netPerPlaceFcfa, orderLang) : '',
          total: formatFcfa(floor.totalForSameWorkFcfa, orderLang),
          qty: f.deliverableType && floor.unitsForSameBudget > 0 ? deliverableCount(f.deliverableType, floor.unitsForSameBudget, orderLang) : '—',
        })
      : null;

  const fail = (msg: string) => {
    setError(msg);
    setNotice(null);
    setTimeout(() => errRef.current?.focus(), 0);
  };

  const save = (extra: BriefPayload = {}, after?: (newId: string) => void) => {
    setError(null);
    setNotice(null);
    let payload: BriefPayload;
    let resent = false;
    if (locked) {
      // E5: only these may change on a live brief.
      payload = {
        id,
        notes: f.notes,
        order_proof: f.orderProof,
        brand_consent_proof: f.brandConsentProof,
        contact_name: f.contactName,
        contact_whatsapp: normalizePhone(f.contactWhatsapp) || null,
        deposit_status: f.depositStatus,
        ...extra,
      };
    } else {
      const listing = listingPayload(f);
      const listingChanged = JSON.stringify(listing) !== JSON.stringify(listingPayload(saved));
      payload = {
        ...(id ? { id } : {}),
        ...listing,
        brand_consent_proof: f.realName ? f.brandConsentProof : null,
        contact_name: f.contactName,
        contact_whatsapp: normalizePhone(f.contactWhatsapp) || null,
        order_confirmed_at: f.orderConfirmed && f.orderConfirmedAt ? new Date(f.orderConfirmedAt).toISOString() : null,
        order_proof: f.orderProof,
        deposit_status: f.depositStatus,
        notes: f.notes,
        ...extra,
      };
      // The brand must say « OUI » to what is published: editing the listing after the order form was
      // sent drops the brief back to draft and clears the « OUI » (design §1.1).
      if (row && listingChanged && (row.status === 'awaiting_order' || row.order_confirmed_at) && !('status' in extra)) {
        resent = true;
        payload.status = 'draft';
        payload.order_confirmed_at = null;
        setF((p) => ({ ...p, orderConfirmed: false }));
      }
    }
    start(async () => {
      const r = await saveBriefAction(payload);
      if (!r.ok) return fail(r.error);
      setSaved(f);
      setSavedAt(new Date().toLocaleTimeString(locale === 'fr' ? 'fr-FR' : 'en-GB', { hour: '2-digit', minute: '2-digit' }));
      if (resent) setNotice(L.editor.resendNotice);
      if (!id) {
        router.replace(`/admin/briefs/${r.id}`);
        return;
      }
      after?.(r.id);
      router.refresh();
    });
  };

  const applyTemplate = (key: string) => {
    const t = findTemplate(key);
    setTplConfirm(null);
    if (!t) return set('templateKey', '');
    setF((p) => ({
      ...p,
      templateKey: t.key,
      service: t.service[locale],
      category: t.category,
      deliverableType: t.type,
      platforms: t.platforms,
      deliverables: t.deliverables[locale],
      creatorRequirements: t.requirements[locale],
      equipment: t.equipment ? t.equipment[locale] : '',
      rightsKey: t.rights,
    }));
  };
  const pickTemplate = (key: string) => {
    const filled = [f.service, f.deliverables, f.creatorRequirements, f.equipment].some((x) => x.trim());
    if (filled && key) setTplConfirm(key);
    else applyTemplate(key);
  };

  const publish = () => {
    if (!id) return;
    setError(null);
    start(async () => {
      const r = await publishBriefAction(id);
      if (!r.ok) return fail(r.error);
      setPublishOpen(false);
      router.refresh();
    });
  };
  const decline = () => {
    if (!id) return;
    const reason = [L.decline.reasons[declineReason], declineNote.trim()].filter(Boolean).join(' — ');
    start(async () => {
      const r = await declineBriefAction(id, reason);
      if (!r.ok) return fail(r.error);
      setDeclineOpen(false);
      router.refresh();
    });
  };
  const manualStatus = (status: 'draft' | 'awaiting_order') => {
    if (!id) return;
    start(async () => {
      const r = await setBriefStatusAction(id, status);
      if (!r.ok) return fail(r.error);
      router.refresh();
    });
  };
  const duplicate = () => {
    if (!id) return;
    start(async () => {
      const r = await duplicateBriefAction(id);
      if (!r.ok) return fail(r.error);
      router.push(`/admin/briefs/${r.id}`);
    });
  };
  const copyLink = async () => {
    if (!row?.campaign_id) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/campaigns/${row.campaign_id}`);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  // ── field shell helpers ──────────────────────────────────────────────────────────────────────
  const input =
    'mt-1 w-full min-h-tap rounded-xl border border-line bg-white px-3 text-[16px] text-ink focus:border-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 disabled:bg-surface disabled:text-muted sm:text-sm';
  const area = input.replace('min-h-tap', 'min-h-[5rem] py-2.5');
  const vl = L.editor.vis;
  const Vis = (v: 'public' | 'members' | 'internal') => <VisTag v={v} labels={vl} />;

  const brandLine = (
    <span className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
      <span className="min-w-0 truncate">
        <span className="font-semibold text-ink">{f.brandLabel.trim() || '—'}</span>
        {cityUnlessInLabel(f.brandLabel, f.city) && <span className="text-muted"> · {f.city.trim()}</span>}
      </span>
      <ManagedBadge label={badge} />
    </span>
  );

  const floorSmall =
    floor.kind === 'below' ? (
      <span className="text-[11px] font-semibold text-rose-700">{L.row.floorBelow}</span>
    ) : floor.kind === 'pass' ? (
      <span className="text-[11px] font-semibold text-emerald-700">{L.row.floorOk}</span>
    ) : (
      <span className="text-[11px] text-muted">{L.row.floorNotSet}</span>
    );

  const publishDate = row?.status === 'published' ? new Date(row.updated_at) : null;

  return (
    <div>
      <Link href="/admin/briefs" className="mb-3 inline-flex min-h-[44px] items-center gap-1 text-xs font-semibold text-muted hover:text-ink">
        <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> {L.editor.back}
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-display text-xl font-extrabold text-ink">{row ? fill(L.editor.editTitle, { name: row.brand_name }) : L.editor.newTitle}</h2>
        <StatusPill stage={stage} label={L.status[stage]} />
      </div>

      {error && (
        <div ref={errRef} tabIndex={-1} role="alert" className="mt-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 focus:outline-none">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {error}
        </div>
      )}
      {notice && <p role="status" className="mt-3 rounded-xl border border-line bg-surface p-3 text-xs text-ink">{notice}</p>}
      {locked && (
        <p className="mt-3 flex items-start gap-2 rounded-xl border border-line bg-surface p-3 text-xs text-ink">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden /> {L.publish.readOnly}
        </p>
      )}

      <div className="mt-4 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-6">
        <div className="space-y-4">
          {/* Template rail */}
          {!locked && (
            <div>
              <p className="text-xs font-semibold text-ink">{L.template.title}</p>
              <div className="no-scrollbar -mx-4 mt-1.5 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
                {[{ key: '', label: L.template.none }, ...MANAGED_TEMPLATES.map((t) => ({ key: t.key, label: t.label[locale] }))].map((t) => (
                  <button key={t.key || 'none'} type="button" onClick={() => pickTemplate(t.key)} aria-pressed={f.templateKey === t.key}
                    className={`inline-flex min-h-tap shrink-0 items-center whitespace-nowrap rounded-xl border px-3 text-xs font-bold transition ${f.templateKey === t.key ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink hover:border-brand'}`}>
                    {t.label}
                  </button>
                ))}
              </div>
              <Help>{L.template.hint}</Help>
              {tplConfirm && (
                <div role="region" aria-label={L.template.title} className="mt-2 rounded-xl border border-line bg-surface p-3 text-xs text-ink">
                  {L.template.confirm}
                  <div className="mt-2 flex gap-2">
                    <button type="button" autoFocus onClick={() => applyTemplate(tplConfirm)} className="min-h-tap rounded-lg bg-brand px-3 font-bold text-white">{L.template.replace}</button>
                    <button type="button" onClick={() => setTplConfirm(null)} className="min-h-tap rounded-lg border border-line bg-white px-3 font-bold text-ink">{L.template.cancel}</button>
                  </div>
                </div>
              )}
            </div>
          )}

          <fieldset disabled={locked || pending} className="space-y-4">
            {/* ① Marque */}
            <Section n={1} title={L.section.brand}>
              <div>
                <FieldLabel labels={vl} htmlFor="field-brand-name" vis="internal">{L.brand.internalName}</FieldLabel>
                <input id="field-brand-name" className={input} value={f.brandName} onChange={(e) => set('brandName', e.target.value)} maxLength={160} required aria-describedby="h-brand-name" />
                <Help id="h-brand-name">{L.brand.internalNameHint}</Help>
              </div>
              {!locked && contactFields()}
              <div>
                <p className="text-xs font-semibold text-ink">{L.brand.display}</p>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  {[
                    { real: false, Icon: Store, title: L.brand.descriptor, hint: L.brand.descriptorHint },
                    { real: true, Icon: BadgeCheck, title: L.brand.realName, hint: L.brand.realNameHint },
                  ].map(({ real, Icon, title, hint }) => (
                    <button key={title} type="button" onClick={() => set('realName', real)} aria-pressed={f.realName === real}
                      className={`flex items-start gap-2 rounded-xl border p-3 text-left transition ${f.realName === real ? 'border-brand bg-brand-50' : 'border-line bg-white hover:border-brand-100'}`}>
                      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${f.realName === real ? 'text-brand' : 'text-muted'}`} aria-hidden />
                      <span>
                        <span className="block text-xs font-bold text-ink">{title}</span>
                        <span className="block text-[11px] text-muted">{hint}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <FieldLabel labels={vl} htmlFor="field-brand-label" vis="public">{L.brand.label}</FieldLabel>
                <input id="field-brand-label" className={input} value={f.brandLabel} onChange={(e) => set('brandLabel', e.target.value)} maxLength={80}
                  aria-invalid={labelClash || undefined} aria-describedby="h-brand-label" />
                <Help id="h-brand-label">{f.realName ? L.brand.labelHintReal : L.brand.labelHintDescriptor}</Help>
                {labelClash && <p className="mt-1 text-[11px] text-rose-600">{L.brand.labelEqualsName}</p>}
              </div>
              {f.realName && (
                <div id="field-consent" className="space-y-3 rounded-xl border border-line bg-surface p-3">
                  <label className="flex min-h-tap cursor-pointer items-center gap-3 text-xs font-semibold text-ink">
                    <input type="checkbox" className="h-5 w-5 accent-brand" checked={f.brandConsent} onChange={(e) => set('brandConsent', e.target.checked)} />
                    {L.brand.consent} {Vis('internal')}
                  </label>
                  <Help>{L.brand.consentHint}</Help>
                  {f.brandConsent && (
                    <div>
                      <FieldLabel labels={vl} htmlFor="field-consent-proof" vis="internal">{L.brand.consentProof}</FieldLabel>
                      <input id="field-consent-proof" className={input} value={f.brandConsentProof} onChange={(e) => set('brandConsentProof', e.target.value)} maxLength={2000} placeholder={L.brand.consentProofHint} />
                    </div>
                  )}
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <FieldLabel labels={vl} htmlFor="field-city" vis="public">{L.brand.city}</FieldLabel>
                  <input id="field-city" className={input} value={f.city} onChange={(e) => set('city', e.target.value)} maxLength={80} />
                </div>
                <div>
                  <FieldLabel labels={vl} htmlFor="field-country" vis="public">{L.brand.country}</FieldLabel>
                  <select id="field-country" className={input} value={f.country} onChange={(e) => set('country', e.target.value)}>
                    <option value="">{L.brand.choose}</option>
                    {COUNTRY_CODES.map((c) => (
                      <option key={c} value={c}>{countryName(c, locale)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="flex flex-wrap items-center gap-2 text-xs text-muted">{L.brand.preview} {brandLine}</p>
            </Section>

            {/* ② Service */}
            <Section n={2} title={L.section.service}>
              <div>
                <FieldLabel labels={vl} htmlFor="field-service" vis="public">{L.service.service}</FieldLabel>
                <input id="field-service" className={input} value={f.service} onChange={(e) => set('service', e.target.value)} maxLength={90} placeholder={tpl?.service[locale]} />
                <p className="mt-1 text-right text-[11px] tabular-nums text-muted">{f.service.length}/90</p>
              </div>
              <div>
                <FieldLabel labels={vl} htmlFor="field-title" vis="public">{L.service.title}</FieldLabel>
                <input id="field-title" className={input} value={f.title} onChange={(e) => set('title', e.target.value)} maxLength={90} />
                <Help>{L.service.titleHint}</Help>
              </div>
              <div>
                <FieldLabel labels={vl} htmlFor="field-category" vis="public">{L.service.category}</FieldLabel>
                <select id="field-category" className={input} value={f.category} onChange={(e) => set('category', e.target.value)}>
                  <option value="">{L.brand.choose}</option>
                  {CAMPAIGN_CATEGORIES.map((c, i) => (
                    <option key={c.slug} value={c.fr}>{locale === 'en' ? (categoryLabels[i] ?? c.fr) : c.fr}</option>
                  ))}
                </select>
              </div>
              {claimsNeeded && (
                <div className="rounded-xl border border-accent/30 bg-accent-soft p-3">
                  <label className="flex min-h-tap cursor-pointer items-center gap-3 text-xs font-bold text-ink">
                    <input type="checkbox" className="h-5 w-5 accent-brand" checked={f.claimsVerified} onChange={(e) => set('claimsVerified', e.target.checked)} />
                    {L.deliv.claims} {Vis('internal')}
                  </label>
                  <p className="mt-1 text-[12px] text-ink">{L.deliv.claimsHint}</p>
                </div>
              )}
            </Section>

            {/* ③ Livrables */}
            <Section n={3} title={L.section.deliverables} id="field-deliverables">
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <FieldLabel labels={vl} htmlFor="field-deliv-type" vis="public">{L.deliv.main}</FieldLabel>
                  <select id="field-deliv-type" className={input} value={f.deliverableType} onChange={(e) => set('deliverableType', isDeliverableType(e.target.value) ? e.target.value : '')}>
                    <option value="">{L.brand.choose}</option>
                    {DELIVERABLE_TYPES.map((d) => (
                      <option key={d.key} value={d.key}>{d[locale]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <FieldLabel labels={vl} htmlFor="field-deliv-count" vis="public">{L.deliv.units}</FieldLabel>
                  <input id="field-deliv-count" className={input} inputMode="numeric" value={f.deliverableCount} onChange={(e) => set('deliverableCount', e.target.value.replace(/\D/g, '').slice(0, 4))} />
                </div>
              </div>
              <Help>{L.deliv.mainHint}</Help>
              <div id="field-platforms">
                <p className="flex items-center text-xs font-semibold text-ink">{L.deliv.platforms} {Vis('public')}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {PLATFORMS.map((p) => {
                    const on = f.platforms.includes(p);
                    return (
                      <button key={p} type="button" aria-pressed={on} onClick={() => set('platforms', on ? f.platforms.filter((x) => x !== p) : [...f.platforms, p])}
                        className={`inline-flex min-h-tap items-center gap-1.5 rounded-full border px-3 text-xs font-bold transition ${on ? 'border-brand bg-brand-50 text-brand-700' : 'border-line bg-white text-muted hover:border-brand-100'}`}>
                        <span className="grid h-4 w-4 place-items-center rounded text-white" style={{ backgroundColor: SOCIAL_META[p].brand }}>
                          <SocialIcon platform={p} className="h-2.5 w-2.5" />
                        </span>
                        {SOCIAL_META[p].label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <FieldLabel labels={vl} htmlFor="field-deliv-detail" vis="members">{L.deliv.detail}</FieldLabel>
                <textarea id="field-deliv-detail" className={area} rows={4} value={f.deliverables} onChange={(e) => set('deliverables', e.target.value)} maxLength={4000} aria-describedby="h-deliv-detail" />
                <Help id="h-deliv-detail">{L.deliv.detailHint}</Help>
              </div>
              <div className="rounded-xl border border-accent/30 bg-accent-soft p-3 text-[12px] text-ink">
                <p className="flex items-start gap-1.5"><TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> <span>{tpl?.hint ? `${tpl.hint[locale]} ` : ''}{L.deliv.disclosureHint}</span></p>
              </div>
            </Section>

            {/* ④ Date limite */}
            <Section n={4} title={L.section.deadline}>
              <div>
                <FieldLabel labels={vl} htmlFor="field-deadline" vis="public">{L.deadline.label}</FieldLabel>
                <input id="field-deadline" type="date" min={today} className={input} value={f.deadline} onChange={(e) => set('deadline', e.target.value)} aria-describedby="h-deadline" />
                <Help id="h-deadline">{L.deadline.hint}</Help>
              </div>
            </Section>

            {/* ⑤ Budget */}
            <Section n={5} title={L.section.budget} id="field-budget">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel labels={vl} htmlFor="field-total" vis="internal">{L.budget.total}</FieldLabel>
                  <input id="field-total" className={input} inputMode="numeric" value={f.totalBudget} onChange={(e) => set('totalBudget', e.target.value.replace(/\D/g, '').slice(0, 12))} aria-describedby="h-total" />
                </div>
                <div>
                  <FieldLabel labels={vl} htmlFor="field-places" vis="public">{L.budget.places}</FieldLabel>
                  <input id="field-places" className={input} inputMode="numeric" value={f.places} onChange={(e) => set('places', e.target.value.replace(/\D/g, '').slice(0, 4))} />
                </div>
              </div>
              <Help id="h-total">{L.budget.totalHint}</Help>
              <p className="text-[12px] text-muted">{L.budget.plan}</p>
              <div className="lg:hidden">
                <NetPayPanel preview={net} type={f.deliverableType} labels={L.pay} locale={locale} />
              </div>
              <div className="lg:hidden">
                <PayFloorVerdict state={floor} type={f.deliverableType} units={units} available={floorsAvailable} labels={L.floor} floorsLink={L.floorsLink} locale={locale} counterOfferText={counterText} />
              </div>
            </Section>

            {/* ⑥ Droits d'usage */}
            <Section n={6} title={L.section.rights} id="field-rights">
              <fieldset>
                <legend className="flex items-center text-xs font-semibold text-ink">{L.rights.label} {Vis('public')}</legend>
                <div className="mt-1.5 grid gap-1.5">
                  {RIGHTS_PRESETS.map((r) => (
                    <label key={r.key} className={`flex min-h-tap cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-[13px] ${f.rightsKey === r.key ? 'border-brand bg-brand-50' : 'border-line bg-white'}`}>
                      <input type="radio" name="rights" className="mt-0.5 h-4 w-4 accent-brand" checked={f.rightsKey === r.key} onChange={() => set('rightsKey', r.key)} />
                      <span className="text-ink">{r.key === 'custom' ? L.rights.custom : resolveRights(r.key, countryName(f.country, locale) || '…', locale)}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

          {/* E5: on a live brief only contact, consent proof, « OUI » proof, deposit and notes stay editable. */}
          {locked && (
            <Section title={L.section.brand}>
              {contactFields()}
              {f.realName && (
                <div>
                  <FieldLabel labels={vl} htmlFor="field-consent-proof" vis="internal">{L.brand.consentProof}</FieldLabel>
                  <input id="field-consent-proof" className={input} value={f.brandConsentProof} onChange={(e) => set('brandConsentProof', e.target.value)} maxLength={2000} placeholder={L.brand.consentProofHint} disabled={pending} />
                </div>
              )}
              <div>
                <label htmlFor="field-yes-proof" className="text-xs font-semibold text-ink">{L.order.proof}</label>
                <input id="field-yes-proof" className={input} value={f.orderProof} onChange={(e) => set('orderProof', e.target.value)} maxLength={2000} placeholder={L.order.proofHint} disabled={pending} />
              </div>
            </Section>
          )}
              {f.rightsKey === 'custom' && (
                <textarea aria-label={L.rights.custom} className={area} rows={3} value={f.rightsCustom} onChange={(e) => set('rightsCustom', e.target.value)} maxLength={500} placeholder={L.rights.customPlaceholder} />
              )}
              <p className="text-[12px] text-muted">{L.rights.keep}</p>
            </Section>

            {/* ⑦ Profil créateur */}
            <Section n={7} title={L.section.profile}>
              <div>
                <FieldLabel labels={vl} htmlFor="field-requirements" vis="public">{L.profile.requirements}</FieldLabel>
                <textarea id="field-requirements" className={area} rows={2} value={f.creatorRequirements} onChange={(e) => set('creatorRequirements', e.target.value)} maxLength={1000} aria-describedby="h-req" />
                <Help id="h-req">{L.profile.requirementsHint}</Help>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <FieldLabel labels={vl} htmlFor="field-language" vis="public">{L.profile.language}</FieldLabel>
                  <select id="field-language" className={input} value={f.languageKey} onChange={(e) => set('languageKey', e.target.value as LanguageKey)}>
                    {LANGUAGES.map((l) => (
                      <option key={l.key} value={l.key}>{l[locale]}</option>
                    ))}
                  </select>
                  {f.languageKey === 'other' && (
                    <input aria-label={L.profile.languageOther} placeholder={L.profile.languageOther} className={input} value={f.languageOther} onChange={(e) => set('languageOther', e.target.value)} maxLength={60} />
                  )}
                </div>
                <div>
                  <FieldLabel labels={vl} htmlFor="field-equipment" vis="public">{L.profile.equipment}</FieldLabel>
                  <input id="field-equipment" className={input} value={f.equipment} onChange={(e) => set('equipment', e.target.value)} maxLength={500} aria-describedby="h-eq" />
                  <Help id="h-eq">{L.profile.equipmentHint}</Help>
                </div>
              </div>
            </Section>

            {/* ⑧ Candidature (fixed text, as printed on the public page) */}
            <Section n={8} title={L.section.application}>
              <p className="flex items-start gap-2 rounded-xl bg-surface p-3 text-[13px] text-ink">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden /> {L.application.text}
              </p>
            </Section>
          </fieldset>

          <div className="lg:hidden">
            <MandatoryChecklist id="checklist" checks={checks} title={L.checklist.title} items={L.checklist.items} doneLabel={L.checklist.done} todoLabel={L.checklist.todo} />
          </div>

          {/* Bon de commande (internal) */}
          {!locked && (
            <Section title={L.section.order}>
              <OrderFormCopy texts={orderTexts} contactWhatsapp={normalizePhone(f.contactWhatsapp)} enabled={orderReady} lang={orderLang} onLang={setOrderLang}
                missing={orderReady ? null : fill(L.checklist.missing, { fields: missingItems })} labels={L.order} />
              {id && row?.status === 'draft' && !declined && (
                <button type="button" disabled={!orderReady || pending || dirty} onClick={() => manualStatus('awaiting_order')}
                  className="inline-flex min-h-tap items-center gap-1.5 rounded-lg border border-line bg-white px-3 text-xs font-bold text-ink hover:border-brand disabled:cursor-not-allowed disabled:opacity-50">
                  {L.order.sent}
                </button>
              )}
              <div id="field-yes" className="scroll-mt-4 space-y-3 rounded-xl border border-line bg-surface p-3">
                <label className="flex min-h-tap cursor-pointer items-center gap-3 text-xs font-bold text-ink">
                  <input type="checkbox" className="h-5 w-5 accent-brand" checked={f.orderConfirmed} disabled={pending}
                    onChange={(e) => setF((p) => ({ ...p, orderConfirmed: e.target.checked, orderConfirmedAt: p.orderConfirmedAt || toLocalInput(null) }))} />
                  {L.order.yes} {Vis('internal')}
                </label>
                {f.orderConfirmed && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label htmlFor="field-yes-at" className="text-xs font-semibold text-ink">{L.order.yesAt}</label>
                      <input id="field-yes-at" type="datetime-local" className={input} value={f.orderConfirmedAt} onChange={(e) => set('orderConfirmedAt', e.target.value)} />
                    </div>
                    <div>
                      <label htmlFor="field-yes-proof" className="text-xs font-semibold text-ink">{L.order.proof}</label>
                      <input id="field-yes-proof" className={input} value={f.orderProof} onChange={(e) => set('orderProof', e.target.value)} maxLength={2000} placeholder={L.order.proofHint} />
                    </div>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* Publication + Paiement */}
          {id && (
            <Section title={L.section.publish} id="publish">
              <ol className="flex flex-wrap gap-2 text-[12px] font-semibold">
                {L.publish.steps.map((s, i) => {
                  const done = i === 0 ? live || row?.status === 'published' : row?.status === 'published';
                  return (
                    <li key={s} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${done ? 'bg-emerald-50 text-emerald-700' : 'bg-surface text-muted'}`}>
                      {done ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> : <span className="tabular-nums">{i + 1}.</span>} {s}
                    </li>
                  );
                })}
              </ol>

              {row?.status === 'published' ? (
                <div className="space-y-2">
                  <p className="flex items-center gap-1.5 text-sm font-bold text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" aria-hidden /> {L.publish.done}
                    {publishDate && <span className="font-normal text-muted"> · {publishDate.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB')}</span>}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {row.campaign_id && (
                      <Link href={`/campaigns/${row.campaign_id}`} className="inline-flex min-h-tap items-center rounded-lg bg-brand px-3 text-xs font-bold text-white">{L.action.viewListing}</Link>
                    )}
                    <button type="button" onClick={copyLink} className="inline-flex min-h-tap items-center rounded-lg border border-line bg-white px-3 text-xs font-bold text-ink">
                      {linkCopied ? L.publish.linkCopied : L.publish.copyLink}
                    </button>
                  </div>
                </div>
              ) : live ? (
                <div className="space-y-3">
                  <p className="flex items-center gap-1.5 text-sm font-bold text-ink"><Clock className="h-4 w-4 text-brand" aria-hidden /> {L.publish.step2Title}</p>
                  <p className="text-[12px] text-muted">{L.publish.step2Body}</p>
                  <div>
                    <p className="text-xs font-semibold text-ink">{L.payment.deposit}</p>
                    <div className="mt-1.5 inline-flex gap-1 rounded-xl border border-line bg-surface p-1">
                      {(['none', 'partial', 'full'] as const).map((d, i) => (
                        <button key={d} type="button" aria-pressed={f.depositStatus === d} onClick={() => set('depositStatus', d)}
                          className={`min-h-tap rounded-lg px-3 text-xs font-bold ${f.depositStatus === d ? 'bg-brand text-white' : 'bg-white text-ink'}`}>
                          {L.payment.depositOptions[i]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="text-[12px] text-muted">{L.payment.refHint}</p>
                  <div className="flex flex-wrap gap-2">
                    {row?.campaign_id && (
                      <Link href={`/admin/funding?campaign=${row.campaign_id}`} className="inline-flex min-h-tap items-center rounded-lg bg-brand px-3 text-xs font-bold text-white">{L.action.confirmFunding}</Link>
                    )}
                    {waNudge('payment')}
                  </div>
                </div>
              ) : declined ? null : (
                <div className="space-y-2">
                  {row?.campaign_id && campaignStatus === 'cancelled' && <p className="text-[12px] text-muted">{L.publish.republish}</p>}
                  {!publishOpen ? (
                    <>
                      <button type="button" disabled={!allGreen || dirty || pending} onClick={() => setPublishOpen(true)}
                        className="inline-flex min-h-tap items-center gap-1.5 rounded-xl bg-brand px-4 text-sm font-bold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50">
                        {L.action.publish}
                      </button>
                      <p className="text-[11px] text-muted">
                        {dirty ? L.publish.saveFirst : floor.kind === 'below' ? L.floor.blocked : !checks.yes && orderReady ? L.publish.needYes : !allGreen ? L.publish.needChecklist : ''}
                      </p>
                    </>
                  ) : (
                    <div role="region" aria-label={L.section.publish} className="rounded-xl border border-line bg-surface p-3 text-[13px] text-ink">
                      <p>{L.publish.explain}</p>
                      <div className="mt-3 flex gap-2">
                        <button type="button" autoFocus onClick={publish} disabled={pending} className="inline-flex min-h-tap items-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-bold text-white disabled:opacity-50">
                          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />} {L.publish.create}
                        </button>
                        <button type="button" onClick={() => setPublishOpen(false)} className="min-h-tap rounded-lg border border-line bg-white px-3 text-xs font-bold text-ink">{L.publish.cancel}</button>
                      </div>
                    </div>
                  )}
                  {row?.status === 'awaiting_order' && waNudge('order')}
                </div>
              )}
            </Section>
          )}

          {/* Notes + status + decline */}
          <Section title={L.section.notes}>
            <div>
              <FieldLabel labels={vl} htmlFor="field-notes" vis="internal">{L.notes.label}</FieldLabel>
              <textarea id="field-notes" className={area} rows={3} value={f.notes} onChange={(e) => set('notes', e.target.value)} maxLength={4000} disabled={pending} aria-describedby="h-notes" />
              <Help id="h-notes">{L.notes.hint}</Help>
            </div>
            {row?.decline_reason && declined && <p className="text-[12px] text-rose-700">{fill(L.decline.declinedOn, { reason: row.decline_reason })}</p>}
            {id && !live && !declined && row?.status !== 'published' && (
              <div>
                <label htmlFor="field-manual" className="text-xs font-semibold text-ink">{L.manual.label}</label>
                <select id="field-manual" className={input} value={row?.status === 'awaiting_order' ? 'awaiting_order' : 'draft'} disabled={pending}
                  onChange={(e) => manualStatus(e.target.value === 'awaiting_order' ? 'awaiting_order' : 'draft')}>
                  <option value="draft">{L.status.draft}</option>
                  <option value="awaiting_order">{L.status.awaiting_order}</option>
                </select>
                <Help>{L.manual.hint}</Help>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {declined && (
                <button type="button" onClick={() => manualStatus('draft')} disabled={pending} className="inline-flex min-h-tap items-center rounded-lg bg-brand px-3 text-xs font-bold text-white">{L.action.reopen}</button>
              )}
              {(declined || row?.status === 'published') && (
                <button type="button" onClick={duplicate} disabled={pending} className="inline-flex min-h-tap items-center rounded-lg border border-line bg-white px-3 text-xs font-bold text-ink">{L.action.duplicate}</button>
              )}
            </div>
            {id && !declined && row?.status !== 'published' && (
              <div>
                {!declineOpen ? (
                  <button type="button" onClick={() => setDeclineOpen(true)} className="inline-flex min-h-tap items-center text-xs font-bold text-rose-700 hover:underline">{L.decline.action}</button>
                ) : (
                  <div role="region" aria-label={L.decline.action} className="space-y-2 rounded-xl border border-rose-200 bg-rose-50 p-3">
                    <label htmlFor="decline-reason" className="text-xs font-semibold text-ink">{L.decline.reason}</label>
                    <select id="decline-reason" className={input} value={declineReason} onChange={(e) => setDeclineReason(Number(e.target.value))}>
                      {L.decline.reasons.map((r, i) => (
                        <option key={r} value={i}>{r}</option>
                      ))}
                    </select>
                    <input aria-label={L.decline.note} placeholder={L.decline.note} className={input} value={declineNote} onChange={(e) => setDeclineNote(e.target.value)} maxLength={400} />
                    {live && <p className="text-[12px] font-semibold text-rose-700">{L.decline.cancelsCampaign}</p>}
                    <div className="flex gap-2">
                      <button type="button" autoFocus onClick={decline} disabled={pending} className="min-h-tap rounded-lg bg-rose-600 px-3 text-xs font-bold text-white disabled:opacity-50">{L.decline.confirm}</button>
                      <button type="button" onClick={() => setDeclineOpen(false)} className="min-h-tap rounded-lg border border-line bg-white px-3 text-xs font-bold text-ink">{L.decline.cancel}</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Section>

          {/* Desktop save row */}
          <div className="hidden items-center justify-end gap-3 lg:flex">
            {saveStatus()}
            {saveButton()}
          </div>
        </div>

        {/* Desktop aside */}
        <aside className="hidden space-y-4 lg:sticky lg:top-4 lg:block lg:self-start">
          <div className="rounded-2xl border border-line bg-white p-4 shadow-card">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{L.section.preview}</p>
            <div className="mt-2">{brandLine}</div>
            <p className="mt-1 line-clamp-2 font-display text-[15px] font-bold text-ink">{service || '—'}</p>
            <p className="mt-1 text-[13px] text-muted">
              <span className="font-display text-lg font-extrabold tabular-nums text-ink">{net ? formatFcfa(net.netPerPlaceFcfa, locale) : '—'}</span>
              {net && ` · ${net.places === 1 ? L.pay.divideOne.replace('÷ ', '') : fill(L.pay.divide, { n: net.places }).replace('÷ ', '')}`}
              {f.deadline && ` · ${f.deadline.split('-').reverse().join('/')}`}
            </p>
          </div>
          <NetPayPanel preview={net} type={f.deliverableType} labels={L.pay} locale={locale} />
          <PayFloorVerdict state={floor} type={f.deliverableType} units={units} available={floorsAvailable} labels={L.floor} floorsLink={L.floorsLink} locale={locale} counterOfferText={counterText} />
          <MandatoryChecklist checks={checks} title={L.checklist.title} items={L.checklist.items} doneLabel={L.checklist.done} todoLabel={L.checklist.todo} />
        </aside>
      </div>

      {/* Mobile sticky bar (inside <main>, above BottomNav) */}
      <div className="sticky bottom-0 z-20 -mx-4 mt-4 border-t border-line bg-white/95 px-4 py-2 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] text-muted">{L.editor.netShort}</p>
            <p className="whitespace-nowrap font-display text-lg font-extrabold leading-tight tabular-nums text-ink">
              {net ? formatFcfa(net.netPerPlaceFcfa, locale).replace(/ FCFA$/, '') : '—'}
              {net && <span className="ml-1 text-[0.65em] font-bold text-muted">FCFA</span>}
            </p>
            {floorSmall}
          </div>
          <div className="flex items-center gap-2">
            <a href="#checklist" className="inline-flex min-h-tap items-center rounded-xl border border-line px-3 text-xs font-bold tabular-nums text-ink">{doneCount}/{CHECKLIST_KEYS.length}</a>
            {saveButton()}
          </div>
        </div>
        {saveStatus()}
      </div>
    </div>
  );

  function contactFields() {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <FieldLabel labels={vl} htmlFor="field-contact-name" vis="internal">{L.brand.contactName}</FieldLabel>
          <input id="field-contact-name" className={input} value={f.contactName} onChange={(e) => set('contactName', e.target.value)} maxLength={120} disabled={pending} />
        </div>
        <div>
          <FieldLabel labels={vl} htmlFor="field-contact-wa" vis="internal">{L.brand.contactWhatsapp}</FieldLabel>
          <input id="field-contact-wa" type="tel" inputMode="tel" className={input} value={f.contactWhatsapp} onChange={(e) => set('contactWhatsapp', e.target.value)}
            placeholder={isCountryCode(f.country) ? COUNTRIES[f.country].dial : COUNTRIES.CM.dial} aria-describedby="h-contact-wa" disabled={pending} />
          <Help id="h-contact-wa">{L.brand.contactWhatsappHint}</Help>
        </div>
      </div>
    );
  }

  function saveButton() {
    const disabled = pending || (!dirty && !!id) || !f.brandName.trim();
    return (
      <button type="button" onClick={() => save()} disabled={disabled}
        className="inline-flex min-h-tap items-center gap-1.5 rounded-xl bg-brand px-4 text-sm font-bold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : !dirty && savedAt ? <Check className="h-4 w-4" aria-hidden /> : null}
        {pending ? L.editor.saving : !dirty && savedAt ? L.editor.saved : L.editor.save}
      </button>
    );
  }

  function saveStatus() {
    return (
      <p role="status" className="text-[11px] text-muted">
        {dirty ? L.editor.unsaved : savedAt ? fill(L.editor.savedAt, { time: savedAt }) : ''}
      </p>
    );
  }

  function waNudge(kind: 'order' | 'payment') {
    const href = waMeHref(
      normalizePhone(f.contactWhatsapp),
      nudgeText(kind, orderLang, { contact: f.contactName.trim(), service, total: net ? formatFcfa(net.totalFcfa, orderLang) : '' }),
    );
    if (!href) return null;
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-tap items-center gap-1.5 rounded-lg border border-line bg-white px-3 text-xs font-bold text-ink hover:border-[#25D366]">
        <WhatsAppTile className="h-5 w-5" /> {L.action.nudge}
      </a>
    );
  }
}

// ── Field shell (module level so inputs keep focus across renders) ───────────────────────────────
type VisLabels = { public: string; members: string; internal: string };

/** Who will read what the admin types (soft wall + K3): Public / Membres / Interne. */
function VisTag({ v, labels }: { v: 'public' | 'members' | 'internal'; labels: VisLabels }) {
  const Icon = v === 'public' ? Globe : v === 'members' ? Lock : EyeOff;
  return (
    <span className="ml-2 inline-flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wide text-muted">
      <Icon className="h-3 w-3" aria-hidden /> {labels[v]}
    </span>
  );
}

function FieldLabel({ htmlFor, children, vis, labels }: { htmlFor: string; children: ReactNode; vis: 'public' | 'members' | 'internal'; labels: VisLabels }) {
  return (
    <label htmlFor={htmlFor} className="flex items-center text-xs font-semibold text-ink">
      {children}
      <VisTag v={vis} labels={labels} />
    </label>
  );
}

function Help({ children, id }: { children: ReactNode; id?: string }) {
  return <p id={id} className="mt-1 text-[11px] text-muted">{children}</p>;
}

function Section({ n, title, children, id }: { n?: number; title: string; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="scroll-mt-4 rounded-2xl border border-line bg-white p-4 shadow-card">
      <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
        {n !== undefined && <span className="grid h-6 w-6 place-items-center rounded-lg bg-brand text-[12px] font-extrabold text-white">{n}</span>}
        {title}
      </h3>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}
