import type { Metadata } from 'next';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import { ArrowRight, Lock, Megaphone } from 'lucide-react';
import { getDictionary, type Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { JsonLd } from '@/components/json-ld';
import { RevealRoot } from '@/components/home/reveal-root';
import { CampaignTicket } from '@/components/campaigns/campaign-ticket';
import { CampaignCard, type CardLinks } from '@/components/campaigns/campaign-card';
import { AlertOptIn } from '@/components/campaigns/alert-opt-in';
import { alertOptions } from '@/components/campaigns/alert-props';
import { d } from '@/components/campaigns/card-parts';
import { listCampaignBoard } from '@/lib/data/public-campaigns';
import { getMyAlerts } from '@/lib/data/alerts';
import { getCampaignViewer } from '@/lib/auth/campaign-viewer';
import {
  boardPageCta,
  campaignCardHref,
  campaignShareUrl,
  canSeeAlertOptIn,
  alertsManagePath,
  brandSignupHref,
  type CampaignViewer,
  type BoardPageCta,
} from '@/lib/auth/campaign-ctas';
import { parseRefHandle } from '@/lib/attribution';
import { COUNTRY_CODES, countryLabel, isCountryCode, type CountryCode } from '@/lib/countries';
import { CAMPAIGN_CATEGORIES, categoryValue, parseCategorySlug, type CategorySlug } from '@/lib/campaign-categories';
import { fill, type BoardCampaign } from '@/lib/campaign-board';
import { breadcrumbLd, itemListLd } from '@/lib/seo';

type SP = { country?: string; cat?: string; ref?: string };

const ALERT_ANCHOR = 'alerte';
/** How many offers the board shows (« top 10 »); the count above it reads up to the RPC cap. */
const SHOWN = 10;
const COUNT_CAP = 50;

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  const m = t.campaignBoard.meta;
  return {
    title: m.title,
    description: m.description,
    // Filtered URLs canonicalise to the unfiltered board (design §1.8).
    alternates: { canonical: '/campaigns' },
    openGraph: { type: 'website', title: m.title, description: m.description, url: '/campaigns' },
    twitter: { card: 'summary_large_image', title: m.title, description: m.description },
  };
}

/**
 * Public « Campagnes ouvertes » board (design spec §1). Server-rendered, no client state: filters are
 * links, cards are links, the alert opt-in is a form. Every number comes from public_campaign_board
 * and disappears when zero/unknown — never a placeholder campaign.
 */
export default async function CampaignBoardPage({ searchParams }: { searchParams: Promise<SP> }) {
  const [{ locale, t }, viewer, sp] = await Promise.all([getDictionary(), getCampaignViewer(), searchParams]);
  const b = t.campaignBoard;

  const countryRaw = (sp.country ?? '').trim().toUpperCase();
  const country: CountryCode | null = isCountryCode(countryRaw) ? countryRaw : null;
  const cat = parseCategorySlug(sp.cat);
  const ref = parseRefHandle(sp.ref);
  const filterActive = !!(country || cat);

  const showAlerts = canSeeAlertOptIn(viewer);
  const [rows, mine] = await Promise.all([
    listCampaignBoard({ country, category: categoryValue(cat), limit: COUNT_CAP }),
    showAlerts && viewer.userId ? getMyAlerts() : Promise.resolve(null),
  ]);
  const shown = rows.slice(0, SHOWN);
  const total = rows.length;
  // Below 4 offers, 17 chips would promise a choice that doesn't exist (design §1.3).
  const showFilters = filterActive || total >= 4;
  const pageCta = boardPageCta(viewer, ref);

  const links = (c: BoardCampaign): CardLinks => ({
    href: campaignCardHref(c.id, viewer, ref),
    shareUrl: campaignShareUrl(c.id, viewer),
    alertHref: showAlerts ? `#${ALERT_ANCHOR}` : null,
  });

  const opts = alertOptions(t, locale);
  const alertProps = {
    ...opts,
    guest: !viewer.userId,
    refHandle: ref,
    // Default country: active filter → signed-in profile country → « Tous les pays » (design §4).
    defaults: { country: country ?? (isCountryCode(viewer.country) ? viewer.country : null), cat },
    remaining: mine ? Math.max(0, mine.limit - mine.alerts.length) : null,
    limit: mine?.limit ?? 5,
    manageHref: alertsManagePath(),
  };

  const [first, ...rest] = shown;
  // The RPC caps at 50 rows; at the cap the count reads « 50+ » rather than an untrue exact figure.
  const eyebrow = total >= 1 ? fill(total === 1 ? b.eyebrowOne : b.eyebrowMany, { n: total >= COUNT_CAP ? `${COUNT_CAP}+` : total }) : null;

  return (
    <div className="bg-white">
      <JsonLd
        data={[
          // ItemList only when there is something to list (QA D8).
          ...(shown.length > 0 ? [itemListLd(shown.map((c) => ({ name: c.title, path: `/campaigns/${c.id}` })))] : []),
          breadcrumbLd([
            { name: 'Accueil', path: '/' },
            { name: 'Campagnes', path: '/campaigns' },
          ]),
        ]}
      />
      <SiteHeader current="campaigns" />

      <main>
        {/* ───────── Hero (depth 0 wash lives only here) ───────── */}
        <section id="board-hero" className="relative overflow-hidden" aria-labelledby="board-title">
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10"
            style={{ background: 'radial-gradient(52rem 28rem at 12% -12%, #EAF2FB 0%, transparent 58%), radial-gradient(42rem 26rem at 100% 0%, #FEF1DF 0%, transparent 52%)' }} />
          <div className="mx-auto max-w-6xl px-4 pb-6 pt-8 lg:pb-8 lg:pt-14">
            {eyebrow && (
              <span className="anim-fade inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-[12px] font-semibold text-brand-700">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" /> {eyebrow}
              </span>
            )}
            <h1 id="board-title" className="mt-4 font-headline text-[2.3rem] font-bold leading-[1.04] tracking-[-0.035em] text-ink antialiased sm:text-[2.9rem] lg:text-[3.35rem]">
              <span className="sr-only">{b.title}</span>
              <span aria-hidden>
                {b.titleLines.map((line, i) => (
                  <span key={line} className="line-mask">
                    <span className="line-in" style={{ '--i': i } as CSSProperties}>
                      {line}
                      {i === b.titleLines.length - 1 && <span className="brand-dot">.</span>}
                    </span>
                  </span>
                ))}
              </span>
            </h1>
            <div className="lg:flex lg:items-end lg:justify-between lg:gap-8">
              <p className="anim-rise mt-3 max-w-xl text-[15px] leading-relaxed text-muted sm:text-base" style={d(280)}>{b.subtitle}</p>
              <ul className="anim-fade mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[13px] font-medium text-ink/75 lg:shrink-0" style={d(420)}>
                <li className="flex items-center gap-1.5"><Lock className="h-4 w-4 text-brand" aria-hidden /> {b.trust[0]}</li>
                <li className="flex items-center gap-1.5">
                  <span aria-hidden className="flex -space-x-0.5"><span className="h-2.5 w-2.5 rounded-full bg-momo-mtn ring-2 ring-white" /><span className="h-2.5 w-2.5 rounded-full bg-momo-orange ring-2 ring-white" /><span className="h-2.5 w-2.5 rounded-full bg-momo-wave ring-2 ring-white" /></span>
                  {b.trust[1]}
                </li>
              </ul>
            </div>

            {showFilters && <Filters t={t} locale={locale} country={country} cat={cat} refHandle={ref} />}
          </div>
        </section>

        {/* ───────── List ───────── */}
        <section id="board-list" className="bg-white">
          <div className="mx-auto max-w-6xl px-4 pb-16 pt-2">
            {first ? (
              <ol aria-label={b.listLabel} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
                <li className="col-span-full mb-2">
                  <CampaignTicket c={first} t={t} locale={locale} links={links(first)} />
                </li>
                {rest.map((c, i) => (
                  <li key={c.id}>
                    <CampaignCard c={c} t={t} locale={locale} links={links(c)} style={d(Math.min(i, 5) * 60)} />
                  </li>
                ))}
                {total <= 2 && showAlerts && (
                  <li id={ALERT_ANCHOR} className={total === 2 ? 'sm:col-span-1 lg:col-span-2' : 'col-span-full'}>
                    <ThinPanel t={t}>
                      <AlertOptIn variant="panel" {...alertProps} />
                    </ThinPanel>
                  </li>
                )}
              </ol>
            ) : filterActive ? (
              <EmptyPanel
                title={b.emptyFiltered.title}
                body={null}
                extra={
                  <Link href={ref ? `/campaigns?ref=${ref}` : '/campaigns'} scroll={false} className="mt-3 inline-flex min-h-tap items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand">
                    {b.emptyFiltered.showAll} <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                }
                form={showAlerts ? <AlertOptIn variant="panel" {...alertProps} /> : null}
              />
            ) : (
              <EmptyPanel
                title={b.empty.title}
                body={b.empty.body}
                extra={
                  !viewer.userId ? (
                    <p className="mt-4 text-[14px] text-muted">
                      {b.empty.brandPrefix}{' '}
                      <BrandSignupLink label={b.empty.brandLink} />
                    </p>
                  ) : null
                }
                form={showAlerts ? <AlertOptIn variant="panel" {...alertProps} /> : null}
              />
            )}

            {/* Role-aware « Voir toutes les campagnes » (D5). On an empty unfiltered board only roles
                without the alert form get it — there is nothing more to see. */}
            {(total > 0 || filterActive || !showAlerts) && <PageCta t={t} cta={pageCta} viewer={viewer} />}

            {total >= 3 && showAlerts && (
              <div id={ALERT_ANCHOR} data-reveal="up" className="mt-10 border-t border-line pt-8">
                <AlertOptIn variant="band" heading={t.alerts.title} {...alertProps} />
              </div>
            )}
          </div>
        </section>
      </main>

      <SiteFooter />
      <RevealRoot />
    </div>
  );
}

/** Country + category chip rails (links, SSR, no client state). Each chip keeps the other param. */
function Filters({ t, locale, country, cat, refHandle }: { t: Dictionary; locale: Locale; country: CountryCode | null; cat: CategorySlug | null; refHandle: string | null }) {
  const f = t.campaignBoard.filters;
  const href = (next: { country?: CountryCode | null; cat?: CategorySlug | null }) => {
    const q = new URLSearchParams();
    const c = next.country === undefined ? country : next.country;
    const k = next.cat === undefined ? cat : next.cat;
    if (c) q.set('country', c);
    if (k) q.set('cat', k);
    if (refHandle) q.set('ref', refHandle);
    const s = q.toString();
    return s ? `/campaigns?${s}` : '/campaigns';
  };
  const chip = 'inline-flex min-h-tap shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-4 text-sm font-medium transition';
  const on = 'border-ink bg-ink text-white';
  const off = 'border-line bg-white text-ink hover:border-brand hover:text-brand';
  const rail = 'no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 [mask-image:linear-gradient(90deg,#000_88%,transparent)] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:[mask-image:none]';

  return (
    <div className="anim-fade mt-6 space-y-2" style={d(480)}>
      <nav aria-label={f.country}>
        <ul className={rail}>
          <li><Link scroll={false} href={href({ country: null })} aria-current={!country ? 'true' : undefined} className={`${chip} ${!country ? on : off}`}>{f.allCountries}</Link></li>
          {COUNTRY_CODES.map((c) => (
            <li key={c}>
              <Link scroll={false} href={href({ country: c })} aria-current={country === c ? 'true' : undefined} className={`${chip} ${country === c ? on : off}`}>{countryLabel(c, locale)}</Link>
            </li>
          ))}
        </ul>
      </nav>
      <nav aria-label={f.category}>
        <ul className={rail}>
          <li><Link scroll={false} href={href({ cat: null })} aria-current={!cat ? 'true' : undefined} className={`${chip} ${!cat ? on : off}`}>{f.allCategories}</Link></li>
          {CAMPAIGN_CATEGORIES.map((c, i) => (
            <li key={c.slug}>
              <Link scroll={false} href={href({ cat: c.slug })} aria-current={cat === c.slug ? 'true' : undefined} className={`${chip} ${cat === c.slug ? on : off}`}>
                {locale === 'en' ? (t.categories[i] ?? c.fr) : c.fr}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {(country || cat) && (
        <Link scroll={false} href={refHandle ? `/campaigns?ref=${refHandle}` : '/campaigns'} className="inline-flex min-h-tap items-center text-sm font-semibold text-brand-700 hover:text-brand">
          {f.reset}
        </Link>
      )}
    </div>
  );
}

function ThinPanel({ t, children }: { t: Dictionary; children: React.ReactNode }) {
  const th = t.campaignBoard.thin;
  return (
    <div data-reveal="up" className="h-full rounded-3xl border border-line bg-surface p-6 sm:p-8">
      <h2 className="font-display text-xl font-bold text-ink sm:text-2xl">{th.title}</h2>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">{th.body}</p>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function EmptyPanel({ title, body, extra, form }: { title: string; body: string | null; extra: React.ReactNode; form: React.ReactNode }) {
  return (
    <div id={form ? ALERT_ANCHOR : undefined} data-reveal="up" className="rounded-3xl border border-line bg-white p-6 shadow-card sm:p-10 lg:grid lg:grid-cols-[1fr_1.1fr] lg:items-center lg:gap-10">
      <div>
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand"><Megaphone className="h-6 w-6" aria-hidden /></span>
        <h2 className="mt-4 font-display text-xl font-bold text-ink sm:text-2xl">{title}</h2>
        {body && <p className="mt-2 text-[15px] leading-relaxed text-muted">{body}</p>}
        {extra}
      </div>
      {form && <div className="mt-6 lg:mt-0">{form}</div>}
    </div>
  );
}

function BrandSignupLink({ label }: { label: string }) {
  return <Link href={brandSignupHref()} className="inline-flex min-h-[44px] items-center font-semibold text-brand-700 hover:text-brand">{label}</Link>;
}

function PageCta({ t, cta, viewer }: { t: Dictionary; cta: BoardPageCta; viewer: CampaignViewer }) {
  const c = t.campaignBoard.cta[cta.key];
  const guest = t.campaignBoard.cta.guest;
  return (
    <div data-reveal="up" className="mt-10 rounded-3xl border border-line bg-surface p-6 text-center sm:p-10">
      <h2 className="font-display text-xl font-bold text-ink sm:text-2xl">{c.heading}</h2>
      <p className="mx-auto mt-2 max-w-md text-[15px] text-muted">{c.helper}</p>
      <Link href={cta.href} className="mt-5 inline-flex min-h-tap w-full items-center justify-center gap-2 rounded-xl bg-brand px-6 text-[15px] font-bold text-white shadow-card transition hover:bg-brand-600 active:scale-95 sm:w-auto">
        {c.label} <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
      {!viewer.userId && cta.signinHref && (
        <p className="mt-3 text-[13px] text-muted">
          {guest.signinPrefix}{' '}
          <Link href={cta.signinHref} className="font-semibold text-brand-700 hover:text-brand">{guest.signin}</Link>
        </p>
      )}
    </div>
  );
}
