import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Bell, CalendarClock, Check, Coins, Lock, MapPin, Megaphone, ShieldCheck, Users } from 'lucide-react';
import { getDictionary, type Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { formatFcfa } from '@/i18n/format';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { JsonLd } from '@/components/json-ld';
import { CampaignApplyCTA } from '@/components/campaign-apply-cta';
import { CampaignBriefDetails } from '@/components/campaign-brief-details';
import { PlatformTiles, WhatsAppTile } from '@/components/campaigns/card-parts';
import { shareMessage } from '@/components/campaigns/campaign-card';
import { CopyLinkButton } from '@/components/campaigns/copy-link-button';
import { getPublicCampaign, getCampaignBriefForMember, getCampaignStats, type PublicCampaign } from '@/lib/data/public-campaigns';
import { getCampaignViewer } from '@/lib/auth/campaign-viewer';
import { alertSignupHref, campaignShareUrl, campaignWallHrefs, sharesWithRef, whatsappHref } from '@/lib/auth/campaign-ctas';
import { parseRefHandle } from '@/lib/attribution';
import { categorySlugOf } from '@/lib/campaign-categories';
import { daysUntil, fill, placesMeter, plural } from '@/lib/campaign-board';
import { jobPostingLd, breadcrumbLd, COUNTRY_NAME, SITE_NAME } from '@/lib/seo';
import { countryFlag, countryIn, countryName } from '@/lib/countries';

/**
 * Teaser description built ONLY from public fields (D1 soft wall): used for <meta name="description">,
 * OpenGraph and the JobPosting JSON-LD, identical for crawlers and visitors. Never the brief.
 */
function teaser(c: PublicCampaign, t: Dictionary, locale: Locale): string {
  return fill(t.campaignBoard.wall.seoTeaser, {
    brand: c.brandName,
    category: c.category,
    countryIn: countryIn(c.country),
    country: countryName(c.country, locale),
    pay: formatFcfa(c.payoutPerCreatorFcfa, locale),
  });
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const [{ id }, { locale, t }] = await Promise.all([params, getDictionary()]);
  const c = await getPublicCampaign(id);
  if (!c) return { title: t.campaignBoard.page.notFound, robots: { index: false } };
  const path = `/campaigns/${c.id}`;
  const title = fill(t.campaignBoard.page.metaTitle, { title: c.title, category: c.category, pay: formatFcfa(c.payoutPerCreatorFcfa, locale) });
  const description = teaser(c, t, locale);
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: 'website', title: `${c.title} · ${SITE_NAME}`, description, url: path },
    twitter: { card: 'summary_large_image', title: `${c.title} · ${SITE_NAME}`, description },
  };
}

export default async function PublicCampaignPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ref?: string }> }) {
  const [{ id }, sp, { locale, t }, viewer] = await Promise.all([params, searchParams, getDictionary(), getCampaignViewer()]);
  const c = await getPublicCampaign(id);
  if (!c) notFound();

  const signedIn = !!viewer.userId;
  // D1: the brief is fetched only with a session, so it can never reach logged-out HTML.
  const [stats, member] = await Promise.all([getCampaignStats(c.id), signedIn ? getCampaignBriefForMember(c.id) : Promise.resolve(null)]);

  const b = t.campaignBoard;
  const k = b.card;
  const pg = b.page;
  const [byBefore, byAfter = ''] = pg.proposedBy.split('{brand}');
  const ref = signedIn ? null : parseRefHandle(sp.ref);
  const meter = stats ? placesMeter(stats.placesLeft, c.creatorCountTarget) : null;
  const full = meter?.kind === 'full';
  const days = daysUntil(c.deadline);
  const deadline = days === null ? null : days === 0 ? k.closesToday : days === 1 ? k.closesTomorrow : fill(k.closesIn, { n: days });
  const applied = stats && stats.appliedCount > 0 ? plural(stats.appliedCount, k.appliedOne, k.appliedMany) : null;
  const shareUrl = campaignShareUrl(c.id, viewer);
  const wall = campaignWallHrefs(c.id, ref);

  return (
    <div className="min-h-screen bg-white">
      <JsonLd
        data={[
          jobPostingLd({
            id: c.id,
            title: c.title,
            description: teaser(c, t, locale),
            datePosted: c.createdAt,
            country: c.country,
            payoutFcfa: c.payoutPerCreatorFcfa,
            brandName: c.brandName,
            path: `/campaigns/${c.id}`,
            validThrough: c.deadline,
          }),
          breadcrumbLd([
            { name: pg.breadcrumbHome, path: '/' },
            { name: pg.breadcrumbCampaigns, path: '/campaigns' },
            { name: c.title, path: `/campaigns/${c.id}` },
          ]),
        ]}
      />
      <SiteHeader current="campaigns" />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Link href={ref ? `/campaigns?ref=${ref}` : '/campaigns'} className="inline-flex min-h-tap items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" aria-hidden /> {b.wall.back}
        </Link>

        <section className="mt-4 overflow-hidden rounded-3xl border border-line bg-white shadow-card">
          <div className="h-20 bg-gradient-to-r from-brand-50 via-white to-accent-soft" />
          <div className="px-5 pb-6 sm:px-8">
            <div className="-mt-8 flex items-center gap-3">
              <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border-4 border-white bg-brand text-white shadow-sm">
                <Megaphone className="h-7 w-7" aria-hidden />
              </span>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-bold uppercase text-brand-700">{c.category}</span>
              <span className="inline-flex items-center gap-1 text-[12px] text-muted">
                <MapPin className="h-3.5 w-3.5" aria-hidden /> {COUNTRY_NAME[c.country]} <span aria-hidden>{countryFlag(c.country)}</span>
              </span>
              {full && <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-bold text-muted">{k.pillFull}</span>}
            </div>

            <h1 className="mt-2 font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{c.title}</h1>
            <p className="mt-1 text-sm text-muted">
              {byBefore}<span className="font-semibold text-ink">{c.brandName}</span>{byAfter}
            </p>

            {/* Public facts (D1): pay, places, deadline, applied, platforms. */}
            <div className="mt-5 grid grid-cols-2 gap-3 sm:max-w-md">
              <div className="rounded-2xl border border-line bg-surface px-4 py-4">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted"><Coins className="h-3.5 w-3.5 text-accent" aria-hidden /> {pg.pay}</div>
                {/* Currency as a smaller suffix so « 1 500 000 FCFA » fits the half-width tile at 360 px. */}
                <div className="mt-1 whitespace-nowrap font-display text-lg font-extrabold tabular-nums text-ink">
                  {formatFcfa(c.payoutPerCreatorFcfa, locale).replace(/\u00a0FCFA$/, '')}
                  <span className="ml-1 text-[0.65em] font-bold text-muted">FCFA</span>
                </div>
                <div className="text-[11px] text-muted">{k.perCreator}</div>
              </div>
              <div className="rounded-2xl border border-line bg-surface px-4 py-4">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted"><Users className="h-3.5 w-3.5 text-brand" aria-hidden /> {pg.wanted}</div>
                {meter?.kind === 'bar' ? (
                  <>
                    <div className="mt-1 font-display text-lg font-extrabold text-ink">{plural(meter.left, k.placesLeftOne, k.placesLeftMany)}</div>
                    <div className="text-[11px] text-muted">{fill(k.placesOf, { total: meter.target })}</div>
                  </>
                ) : full ? (
                  <>
                    <div className="mt-1 font-display text-lg font-extrabold text-ink">{k.pillFull}</div>
                    <div className="text-[11px] text-muted">{fill(k.placesTotal, { n: c.creatorCountTarget })}</div>
                  </>
                ) : (
                  <>
                    <div className="mt-1 font-display text-lg font-extrabold text-ink">{c.creatorCountTarget}</div>
                    <div className="text-[11px] text-muted">{pg.placesUnit}</div>
                  </>
                )}
              </div>
            </div>

            {(deadline || applied || c.platforms.length > 0) && (
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-muted">
                {deadline && (
                  <span className="inline-flex items-center gap-1.5"><CalendarClock className="h-4 w-4 text-brand" aria-hidden /> {deadline}</span>
                )}
                {applied && (
                  <span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4 text-brand" aria-hidden /> {applied}</span>
                )}
                <PlatformTiles platforms={c.platforms} label={k.platforms} />
              </div>
            )}

            <div className="mt-5 flex items-center gap-1.5 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-[12px] font-medium text-emerald-700">
              <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden /> {pg.guarantee}
            </div>

            {signedIn ? (
              <>
                {member?.brief && <p className="mt-5 max-w-2xl whitespace-pre-line text-sm leading-relaxed text-ink/80">{member.brief}</p>}
                <div className="mt-5 sm:max-w-md">
                  <CampaignBriefDetails
                    brief={{
                      platforms: c.platforms,
                      contentType: c.contentType,
                      deliverableQuantity: c.deliverableQuantity,
                      mandatoryTags: member?.mandatoryTags ?? null,
                      deadline: c.deadline,
                    }}
                  />
                </div>
                <div className="mt-5">
                  <CampaignApplyCTA campaignId={c.id} full={full} fullLabel={k.fullApply} />
                </div>
              </>
            ) : (
              <LockedBrief
                t={t}
                signup={full ? alertSignupHref({ country: c.country, cat: categorySlugOf(c.category), ref, source: 'campaign_page' }) : wall.signup}
                signupLabel={full ? t.alerts.title : b.wall.cta}
                signin={wall.signin}
                full={full}
              />
            )}

            {/* WhatsApp share (design §3): plain link, no client JS. */}
            <a
              href={whatsappHref(shareMessage(t, c, locale, shareUrl))}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex min-h-tap w-full items-center justify-center gap-2 rounded-xl border border-line bg-white px-5 text-[15px] font-bold text-ink transition hover:border-[#25D366] sm:w-auto sm:inline-flex"
            >
              <WhatsAppTile /> {t.share.whatsapp}
            </a>
            {sharesWithRef(viewer) && (
              <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                <p className="text-[12px] text-muted">{t.share.refNote}</p>
                <CopyLinkButton url={shareUrl} label={t.share.copy} copiedLabel={t.share.copied} />
              </div>
            )}
          </div>
        </section>

        <p className="mt-6 text-center text-xs text-muted">
          {pg.footer}{' '}
          <Link href="/" className="inline-flex min-h-[44px] items-center font-semibold text-brand hover:underline">{pg.learnMore}</Link>
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}

/**
 * Locked brief panel (design §2.2). Pure decoration + generic product nouns: no brief text, no
 * deliverables, no tags anywhere in the logged-out HTML.
 */
function LockedBrief({ t, signup, signupLabel, signin, full }: { t: Dictionary; signup: string; signupLabel: string; signin: string; full: boolean }) {
  const w = t.campaignBoard.wall;
  return (
    <section aria-labelledby="wall-title" className="relative mt-5 overflow-hidden rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <div aria-hidden className="select-none space-y-2.5 blur-[2px]">
        {['92%', '100%', '78%', '96%', '54%'].map((w) => (
          <div key={w} className="h-2.5 rounded-full bg-ink/10" style={{ width: w }} />
        ))}
      </div>
      <div aria-hidden className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-transparent to-surface" />
      <div className="relative -mt-6 text-center">
        <span aria-hidden className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-white shadow-card">
          <Lock className="h-5 w-5 text-brand" />
        </span>
        <h2 id="wall-title" className="mt-3 font-display text-lg font-bold text-ink">{w.title}</h2>
        <p className="mt-1 text-[14px] text-muted">{w.body}</p>
        <ul className="mt-3 inline-flex flex-col gap-1.5 text-left text-[13px] font-medium text-ink">
          {w.items.map((it) => (
            <li key={it} className="flex items-center gap-2"><Check className="h-4 w-4 text-brand" aria-hidden /> {it}</li>
          ))}
        </ul>
        <Link
          href={signup}
          className="mt-5 flex min-h-tap w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-center text-[15px] font-bold leading-snug text-white shadow-card transition hover:bg-brand-600 active:scale-95 sm:mx-auto sm:w-fit"
        >
          {full && <Bell className="h-4 w-4" aria-hidden />} {signupLabel}
        </Link>
        <p className="mt-2 text-[13px] text-muted">
          {w.signinPrefix}{' '}
          <Link href={signin} className="font-semibold text-brand-700 hover:text-brand">{w.signin}</Link>
        </p>
      </div>
    </section>
  );
}
