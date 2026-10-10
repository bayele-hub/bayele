import Link from 'next/link';
import type { CSSProperties } from 'react';
import { ArrowRight, Bell, CalendarClock, Coins, Users } from 'lucide-react';
import type { Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { formatFcfa } from '@/i18n/format';
import { fill, type BoardCampaign } from '@/lib/campaign-board';
import { whatsappHref } from '@/lib/auth/campaign-ctas';
import { ByBrand, PlacesMeter, PlatformTiles, WhatsAppIconLink, cardCopy } from './card-parts';

export interface CardLinks {
  /** Campaign page link (campaign-ctas.campaignCardHref). */
  href: string;
  /** Absolute share URL (campaign-ctas.campaignShareUrl). */
  shareUrl: string;
  /** Anchor to the page's alert opt-in, offered on full campaigns (C1); null = no alert form here. */
  alertHref?: string | null;
}

/** Prefilled WhatsApp message (design §3). */
export function shareMessage(t: Dictionary, c: Pick<BoardCampaign, 'title' | 'payoutPerCreatorFcfa'>, locale: Locale, url: string): string {
  return fill(t.share.message, { title: c.title, pay: formatFcfa(c.payoutPerCreatorFcfa, locale), url });
}

/**
 * Grid card (design §1.5) — used for board cards 2–10 and the home strip. One link per card: the
 * title carries a stretched link; the visual « Voir l'offre » is aria-hidden; the WhatsApp button
 * and the full-campaign alert link sit above the stretched link (z-10).
 */
export function CampaignCard({
  c,
  t,
  locale,
  links,
  style,
  className = '',
  reveal = true,
  headingLevel = 3,
}: {
  c: BoardCampaign;
  t: Dictionary;
  locale: Locale;
  links: CardLinks;
  style?: CSSProperties;
  className?: string;
  reveal?: boolean;
  headingLevel?: 2 | 3;
}) {
  const k = t.campaignBoard.card;
  const copy = cardCopy(c, t, locale);
  const H = headingLevel === 2 ? 'h2' : 'h3';
  const full = copy.pill === 'full';

  return (
    <article
      data-reveal={reveal ? 'up' : undefined}
      style={style}
      className={`group relative flex h-full flex-col rounded-3xl border border-line bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-cardHover has-[a[data-card-link]:focus-visible]:ring-2 has-[a[data-card-link]:focus-visible]:ring-brand has-[a[data-card-link]:focus-visible]:ring-offset-2 ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {copy.category && <span className="truncate rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-bold uppercase text-brand-700">{copy.category}</span>}
          {copy.countryName && (
            <span className="truncate text-[12px] text-muted">
              <span aria-hidden>{copy.countryFlag} </span>
              {copy.countryName}
            </span>
          )}
        </div>
        {copy.pillLabel && (
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${full ? 'bg-surface text-muted' : 'bg-accent-soft text-ink'}`}>{copy.pillLabel}</span>
        )}
      </div>

      <H className="mt-3 line-clamp-2 font-display text-[17px] font-bold leading-snug text-ink">
        <Link data-card-link href={links.href} className="after:absolute after:inset-0 after:rounded-[inherit] focus-visible:outline-none">
          {c.title}
        </Link>
      </H>
      {copy.by && <ByBrand template={k.by} brand={copy.by} className="mt-0.5 text-[13px] text-muted" />}

      {c.payoutPerCreatorFcfa > 0 && (
        <p className="mt-3 flex items-baseline gap-1.5">
          <Coins className="h-4 w-4 self-center text-accent" aria-hidden />
          <span className="whitespace-nowrap font-display text-xl font-extrabold tabular-nums text-ink">{formatFcfa(c.payoutPerCreatorFcfa, locale)}</span>
          <span className="text-[12px] text-muted">{k.perCreatorShort}</span>
        </p>
      )}

      <PlatformTiles platforms={c.platforms} label={k.platforms} className="mt-3" />
      <PlacesMeter copy={copy} motion={reveal ? 'reveal' : 'grow'} className="mt-4" />

      {(copy.deadline || copy.applied) && (
        <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-muted">
          {copy.deadline && (
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="h-3.5 w-3.5 text-brand" aria-hidden /> {copy.deadline}
            </span>
          )}
          {copy.applied && (
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5 text-brand" aria-hidden /> {copy.applied}
            </span>
          )}
        </p>
      )}

      {/* mt-auto keeps footers aligned across a row; pt-4 is the minimum gap above them. */}
      <div className="mt-auto pt-4">
      <div className="flex items-center justify-between gap-2 border-t border-line pt-3">
        {full && links.alertHref ? (
          <a href={links.alertHref} className="relative z-10 inline-flex min-h-tap items-center gap-1.5 text-sm font-bold text-brand-700 hover:text-brand">
            <Bell className="h-4 w-4" aria-hidden /> {t.alerts.fullCardLink}
          </a>
        ) : (
          <span aria-hidden className="inline-flex min-h-tap items-center gap-1.5 text-sm font-bold text-brand-700 group-hover:text-brand">
            {k.cta} <ArrowRight className="h-4 w-4" />
          </span>
        )}
        <WhatsAppIconLink href={whatsappHref(shareMessage(t, c, locale, links.shareUrl))} label={fill(t.share.whatsappAria, { title: c.title })} />
      </div>
      </div>
    </article>
  );
}
