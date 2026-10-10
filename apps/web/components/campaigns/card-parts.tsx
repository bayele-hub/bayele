import type { CSSProperties } from 'react';
import { SocialIcon, SOCIAL_META, type Platform } from '@/components/social-icons';
import type { Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { countryName } from '@/lib/countries';
import { categoryLabel } from '@/lib/campaign-categories';
import { cityUnlessInLabel, deliverableSummary } from '@/lib/managed-listing';
import { ManagedBadge } from './managed-badge';
import { cardPill, daysUntil, fill, placesMeter, plural, type BoardCampaign, type Meter, type Pill } from '@/lib/campaign-board';

/** Stagger helper for [data-reveal] / .anim-* delays (design §0.2). */
export const d = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties;

const KNOWN: Platform[] = ['whatsapp', 'facebook', 'instagram', 'tiktok', 'youtube', 'x', 'linkedin', 'snapchat', 'telegram'];
export function knownPlatforms(list: string[] | null | undefined): Platform[] {
  return (list ?? []).filter((p): p is Platform => (KNOWN as string[]).includes(p));
}

/** Everything a card prints, resolved once from the RPC row (design §0.3). Hidden fields are null. */
export interface CardCopy {
  category: string | null;
  countryName: string | null;
  by: string | null;
  /** Managed listing: the public label's city (null when absent or already in the label). */
  brandCity: string | null;
  managed: boolean;
  /** Council R1: « 3 vidéos courtes » — public on every listing. */
  deliverables: string | null;
  deadline: string | null;
  applied: string | null;
  pill: Pill;
  pillLabel: string | null;
  meter: Meter | null;
  meterLabel: string | null;
  meterOf: string | null;
}

export function cardCopy(c: BoardCampaign, t: Dictionary, locale: Locale, now: Date = new Date()): CardCopy {
  const k = t.campaignBoard.card;
  const days = daysUntil(c.deadline, now);
  const deadline = days === null ? null : days === 0 ? k.closesToday : days === 1 ? k.closesTomorrow : fill(k.closesIn, { n: days });
  const pill = cardPill(c, now);
  const meter = placesMeter(c.placesLeft, c.creatorCountTarget);
  const brand = (c.brandName ?? '').trim();
  return {
    category: categoryLabel(c.category, locale, t.categories) || null,
    countryName: countryName(c.country, locale) || null,
    by: brand ? brand : null,
    brandCity: c.isManaged ? cityUnlessInLabel(brand, c.brandCity) : null,
    managed: !!c.isManaged,
    deliverables: deliverableSummary(c.deliverableQuantity, c.contentType, locale),
    deadline,
    applied: c.appliedCount > 0 ? plural(c.appliedCount, k.appliedOne, k.appliedMany) : null,
    pill,
    pillLabel: pill === 'full' ? k.pillFull : pill === 'almostFull' ? k.pillAlmostFull : pill === 'new' ? k.pillNew : null,
    meter,
    meterLabel:
      meter?.kind === 'bar' ? plural(meter.left, k.placesLeftOne, k.placesLeftMany) : meter?.kind === 'total' ? plural(meter.target, k.placesTotalOne, k.placesTotal) : null,
    meterOf: meter?.kind === 'bar' ? fill(k.placesOf, { total: meter.target }) : null,
  };
}

/**
 * Brand line (design §5.2): self-serve → « par **{brand}** »; managed → « {label} · {city} » +
 * « Géré par Bayele », without « par » and never linked (v2 returns no handle for managed rows).
 * On 360 px the label truncates before the badge wraps.
 */
export function BrandLine({
  brand,
  city,
  managed,
  byTemplate,
  badgeLabel,
  tone = 'light',
  size = 'sm',
  className = '',
}: {
  brand: string;
  city: string | null;
  managed: boolean;
  byTemplate: string;
  badgeLabel: string;
  tone?: 'light' | 'dark';
  size?: 'sm' | 'md';
  className?: string;
}) {
  const dark = tone === 'dark';
  if (!managed) {
    return (
      <ByBrand
        template={byTemplate}
        brand={brand}
        className={className}
        strongClassName={dark ? 'font-semibold text-white' : 'font-semibold text-ink'}
      />
    );
  }
  return (
    <p className={`flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 ${className}`}>
      <span className="min-w-0 truncate">
        <span className={`font-semibold ${dark ? 'text-white' : 'text-ink'}`}>{brand}</span>
        {city && <span className={dark ? 'text-white/70' : 'text-muted'}> · {city}</span>}
      </span>
      <ManagedBadge label={badgeLabel} tone={tone} size={size} />
    </p>
  );
}

/** « par **{brand}** » with the brand in bold. */
export function ByBrand({ template, brand, className, strongClassName }: { template: string; brand: string; className?: string; strongClassName?: string }) {
  const [before, after = ''] = template.split('{brand}');
  return (
    <p className={className}>
      {before}
      <span className={strongClassName ?? 'font-semibold text-ink'}>{brand}</span>
      {after}
    </p>
  );
}

/** Platform tiles (20 px brand-colour tiles; the ticket uses white-on-ink tiles). */
export function PlatformTiles({ platforms, label, tone = 'brand', className = '' }: { platforms: string[]; label: string; tone?: 'brand' | 'ink'; className?: string }) {
  const list = knownPlatforms(platforms);
  if (!list.length) return null;
  return (
    <ul aria-label={label} className={`flex flex-wrap gap-1.5 ${className}`}>
      {list.map((p) =>
        tone === 'ink' ? (
          <li key={p} className="grid h-7 w-7 place-items-center rounded-lg bg-white/10 text-white">
            <SocialIcon platform={p} className="h-3.5 w-3.5" aria-hidden />
            <span className="sr-only">{SOCIAL_META[p].label}</span>
          </li>
        ) : (
          <li key={p} className="grid h-5 w-5 place-items-center rounded text-white" style={{ backgroundColor: SOCIAL_META[p].brand }}>
            <SocialIcon platform={p} className="h-3 w-3" aria-hidden />
            <span className="sr-only">{SOCIAL_META[p].label}</span>
          </li>
        ),
      )}
    </ul>
  );
}

/**
 * Places meter: label row + decorative bar (bar width is static, only scaleX animates).
 * `motion="grow"` = above the fold (.meter-grow); `motion="reveal"` = scroll reveal (data-reveal="fill").
 */
export function PlacesMeter({ copy, motion, className = '' }: { copy: CardCopy; motion: 'grow' | 'reveal'; className?: string }) {
  const m = copy.meter;
  if (!m || m.kind === 'full' || !copy.meterLabel) return null;
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-2 text-[13px]">
        <span className="font-semibold text-ink">{copy.meterLabel}</span>
        {copy.meterOf && <span className="text-muted">{copy.meterOf}</span>}
      </div>
      {m.kind === 'bar' && (
        <div aria-hidden className="mt-1.5 h-2 overflow-hidden rounded-full bg-brand-50">
          <div className="h-full" style={{ width: `${m.takenPct}%` }}>
            {motion === 'grow' ? (
              <span className="meter-grow block h-full rounded-full bg-accent" style={d(600)} />
            ) : (
              <span data-reveal="fill" className="block h-full rounded-full bg-accent" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** WhatsApp glyph tile (green tile, white glyph — never white text on green: 2:1). */
export function WhatsAppTile({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <span aria-hidden className={`grid shrink-0 place-items-center rounded-md text-white ${className}`} style={{ backgroundColor: SOCIAL_META.whatsapp.brand }}>
      <SocialIcon platform="whatsapp" className="h-3.5 w-3.5" />
    </span>
  );
}

/** Icon-only WhatsApp share link for card footers (sits above the stretched card link). */
export function WhatsAppIconLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="relative z-10 grid h-tap w-tap shrink-0 place-items-center rounded-xl border border-line bg-white transition hover:border-[#25D366] active:scale-95"
    >
      <WhatsAppTile />
    </a>
  );
}
