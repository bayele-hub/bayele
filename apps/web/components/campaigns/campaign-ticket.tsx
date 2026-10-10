import Link from 'next/link';
import type { CSSProperties } from 'react';
import { ArrowRight, Bell, CalendarClock, Lock, Users } from 'lucide-react';
import type { Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { formatFcfa } from '@/i18n/format';
import { fill, type BoardCampaign } from '@/lib/campaign-board';
import { whatsappHref } from '@/lib/auth/campaign-ctas';
import { ByBrand, PlacesMeter, PlatformTiles, WhatsAppIconLink, cardCopy, d } from './card-parts';
import { shareMessage, type CardLinks } from './campaign-card';

/**
 * The #1 offer as a Mobile-Money pay ticket — the page's signature element (design §1.4): a dark
 * offer half, a perforated tear line with two punched notches, and a white « Vous recevez » stub.
 * Above the fold, so it uses .anim-rise and .meter-grow (not scroll reveals).
 */
export function CampaignTicket({ c, t, locale, links }: { c: BoardCampaign; t: Dictionary; locale: Locale; links: CardLinks }) {
  const b = t.campaignBoard;
  const k = b.card;
  const copy = cardCopy(c, t, locale);
  const full = copy.pill === 'full';
  const amount = formatFcfa(c.payoutPerCreatorFcfa, locale).replace(/ FCFA$/, '');

  return (
    <article
      className="anim-rise group relative isolate rounded-[2rem] has-[a[data-card-link]:focus-visible]:ring-2 has-[a[data-card-link]:focus-visible]:ring-brand has-[a[data-card-link]:focus-visible]:ring-offset-2"
      style={d(200)}
    >
      {/* depth 1 — the page's single ambient loop (paused off-screen, off on .perf-lite) */}
      <div aria-hidden data-loop-scope className="pointer-events-none absolute inset-0 -z-10">
        <div className="float-b absolute inset-x-0 -top-6 flex justify-center" style={{ '--fd': '-3s' } as CSSProperties}>
          <div className="h-48 w-[80%] rounded-full bg-accent/25 blur-3xl" />
        </div>
      </div>

      <div className="relative overflow-hidden rounded-[2rem] shadow-cardHover ring-1 ring-ink/5 transition-transform group-hover:-translate-y-0.5 lg:grid lg:grid-cols-[1.4fr_1fr]">
        {/* Offer half */}
        {/* Not positioned on purpose: the title's stretched link must cover the whole ticket. The dot
            texture (depth 2) is a background so it needs no absolutely-positioned layer. */}
        <div
          className="bg-ink p-5 text-white sm:p-7 lg:p-9"
          style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,.05) 1px, transparent 1px)', backgroundSize: '18px 18px' }}
        >
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="rounded-full bg-white/10 px-3 py-1 text-[12px] font-bold uppercase tracking-wide text-accent">{b.featured.label}</span>
              {copy.pillLabel && (
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${full ? 'bg-white/15 text-white' : 'bg-accent text-ink'}`}>{copy.pillLabel}</span>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {copy.category && <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-bold uppercase">{copy.category}</span>}
              {copy.countryName && (
                <span className="text-[13px] text-white/80">
                  <span aria-hidden>{copy.countryFlag} </span>
                  {copy.countryName}
                </span>
              )}
            </div>

            <h3 className="mt-3 line-clamp-3 text-balance font-headline text-[1.6rem] font-bold leading-[1.1] tracking-[-0.02em] sm:text-[2rem]">
              <Link data-card-link href={links.href} className="after:absolute after:inset-0 after:z-[1] after:rounded-[2rem] focus-visible:outline-none">
                {c.title}
              </Link>
            </h3>
            {copy.by && <ByBrand template={k.by} brand={copy.by} className="mt-1 text-[14px] text-white/70" strongClassName="font-semibold text-white" />}

            <PlatformTiles platforms={c.platforms} label={k.platforms} tone="ink" className="mt-4" />

            {(copy.deadline || copy.applied) && (
              <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-white/80">
                {copy.deadline && (
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarClock className="h-4 w-4 text-accent" aria-hidden /> {copy.deadline}
                  </span>
                )}
                {copy.applied && (
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-accent" aria-hidden /> {copy.applied}
                  </span>
                )}
              </p>
            )}
          </div>
        </div>

        {/* Stub — tear line + punched notches (pseudo-elements, decorative by nature) */}
        <div
          className={[
            'relative bg-white p-5 text-ink sm:p-7 lg:flex lg:flex-col lg:justify-center lg:p-9',
            'border-t-2 border-dashed border-ink/15 lg:border-l-2 lg:border-t-0',
            "before:absolute before:-left-3 before:-top-3 before:h-6 before:w-6 before:rounded-full before:bg-white before:content-['']",
            "after:absolute after:-right-3 after:-top-3 after:h-6 after:w-6 after:rounded-full after:bg-white after:content-['']",
            'lg:after:-bottom-3 lg:after:-left-3 lg:after:right-auto lg:after:top-auto',
          ].join(' ')}
        >
          <p className="text-[12px] font-bold uppercase tracking-wide text-brand-700">{b.featured.youReceive}</p>
          {c.payoutPerCreatorFcfa > 0 && (
            <>
              <p className="mt-1 whitespace-nowrap font-display text-[2.5rem] font-extrabold leading-none tracking-tight tabular-nums sm:text-[3rem]">
                {amount}
                <span className="ml-1 text-[0.42em] font-bold text-muted">FCFA</span>
              </p>
              <p className="mt-1 text-[13px] text-muted">{k.perCreator}</p>
            </>
          )}
          <p className="mt-3 flex items-center gap-1.5 text-[13px] font-semibold text-ink">
            <Lock className="h-4 w-4 text-brand" aria-hidden /> {k.escrow}
          </p>

          <PlacesMeter copy={copy} motion="grow" className="mt-4" />

          <div className="mt-5 flex items-center gap-2">
            {full && links.alertHref ? (
              <a href={links.alertHref} className="relative z-10 flex min-h-tap flex-1 items-center justify-center gap-2 rounded-xl border border-line bg-white px-5 text-[15px] font-bold text-ink transition hover:border-brand hover:text-brand">
                <Bell className="h-4 w-4" aria-hidden /> {t.alerts.fullCardLink}
              </a>
            ) : (
              <span aria-hidden className="flex min-h-tap flex-1 items-center justify-center gap-2 rounded-xl bg-brand px-5 text-[15px] font-bold text-white shadow-card transition group-hover:bg-brand-600">
                {k.cta} <ArrowRight className="h-4 w-4" />
              </span>
            )}
            <WhatsAppIconLink href={whatsappHref(shareMessage(t, c, locale, links.shareUrl))} label={fill(t.share.whatsappAria, { title: c.title })} />
          </div>
        </div>
      </div>
    </article>
  );
}
