import Link from 'next/link';
import Image from 'next/image';
import {
  ShieldCheck, Smartphone, BadgeCheck, ArrowRight, Zap, Megaphone, Wallet, Check, Lock, Users,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { getFeaturedTalent, type TalentSummary } from '@/lib/data/talent';
import { getDictionary, formatFcfa } from '@/i18n/dictionaries';
import { getSession } from '@/lib/auth/session';
import { landingCtaHrefs } from '@/lib/auth/landing-ctas';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { CreatorCard, ConsultantCard } from '@/components/talent-cards';

const STAT_ICONS = [Lock, Zap, Smartphone, Users] as const;

export default async function HomePage() {
  const [{ locale, t }, talent, session] = await Promise.all([getDictionary(), getFeaturedTalent(), getSession()]);
  const authed = !!session.userId;
  // All auth-dependent hrefs resolve here so a logged-in visitor is never sent into the signup funnel.
  const cta = landingCtaHrefs(authed);

  return (
    <div className="bg-white">
      {/* Announcement bar */}
      <div className="bg-ink text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-4 py-2 text-center text-[12px]">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
          <span className="text-white/85">{t.announce}</span>
        </div>
      </div>

      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10"
          style={{ background: 'radial-gradient(48rem 26rem at 15% -8%, #EAF2FB 0%, transparent 55%), radial-gradient(40rem 24rem at 100% 0%, #FEF1DF 0%, transparent 50%)' }} />
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-14 pt-12 lg:grid-cols-2 lg:pt-20">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-[12px] font-semibold text-brand-700">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" /> {t.hero.badge}
            </span>
            <h1 className="mt-5 font-display text-[2.6rem] font-extrabold leading-[1.04] tracking-tight text-ink sm:text-[3.4rem]">
              {t.hero.titleLine1}
              <br />
              {t.hero.titleLead}<span className="text-brand">{t.hero.titleHighlight}</span><span className="brand-dot">.</span>
            </h1>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-muted sm:text-base">{t.hero.subtitle}</p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link href={cta.heroPrimary} className="flex min-h-tap items-center justify-center gap-2 rounded-xl bg-brand px-6 text-sm font-bold text-white shadow-card transition hover:bg-brand-600 active:scale-95">
                {authed ? t.hero.ctaDashboard : t.hero.ctaBrand} <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href={cta.heroSecondary} className="flex min-h-tap items-center justify-center rounded-xl border border-line bg-white px-6 text-sm font-semibold text-ink transition hover:border-brand hover:text-brand">
                {authed ? t.hero.ctaBrowse : t.hero.ctaCreator}
              </Link>
            </div>
            <div className="mt-7 flex items-center gap-3">
              <div className="flex -space-x-2">
                {talent.creators.slice(0, 4).map((c) => (
                  <span key={c.id} className="grid h-8 w-8 place-items-center rounded-full border-2 border-white bg-brand-50 text-[10px] font-bold text-brand-700">
                    {c.displayName.slice(0, 2).toUpperCase()}
                  </span>
                ))}
              </div>
              <p className="max-w-[16rem] text-[12px] leading-snug text-muted">{t.hero.socialProof}</p>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] font-medium text-muted">
              <span className="text-ink/70">{t.hero.payoutsLabel}</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-momo-mtn" /> MTN MoMo</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-momo-orange" /> Orange Money</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-momo-wave" /> Wave</span>
            </div>
          </div>

          {/* Signature visual — creators, led by a human face (benchmarked against Fiverr Pro).
              The two floating chips keep Bayele's differentiator concrete: a secured escrow lock and
              a real payout proof. Portraits are illustrative — swap for licensed brand photography of
              Cameroonian / Ivorian / Gabonese creators (change the three src URLs). */}
          <div className="relative">
            <div aria-hidden className="pointer-events-none absolute -right-6 -top-10 -z-10 h-44 w-44 rounded-full bg-accent/25 blur-3xl" />
            <div aria-hidden className="pointer-events-none absolute -bottom-8 left-2 -z-10 h-40 w-40 rounded-full bg-brand/15 blur-3xl" />

            <div className="relative mx-auto w-full max-w-xs sm:max-w-sm">
              {/* Depth: two creator portraits peeking behind (decorative; hidden on the smallest screens) */}
              <div aria-hidden className="absolute -left-8 top-10 hidden w-32 -rotate-6 overflow-hidden rounded-3xl border border-line bg-white shadow-card sm:block">
                <div className="relative aspect-[3/4]">
                  <Image src="https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=400&q=80&auto=format&fit=crop&crop=faces" alt="" fill sizes="128px" className="object-cover" />
                </div>
              </div>
              <div aria-hidden className="absolute -right-8 top-6 hidden w-36 rotate-6 overflow-hidden rounded-3xl border border-line bg-white shadow-card sm:block">
                <div className="relative aspect-[3/4]">
                  <Image src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&q=80&auto=format&fit=crop&crop=faces" alt="" fill sizes="144px" className="object-cover" />
                </div>
              </div>

              {/* Foreground: the lead creator */}
              <div className="relative z-10 overflow-hidden rounded-[1.75rem] border border-line bg-white shadow-cardHover">
                <div className="relative aspect-[4/5]">
                  <Image
                    src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=640&q=80&auto=format&fit=crop&crop=faces"
                    alt={t.heroVisual.alt}
                    fill
                    priority
                    sizes="(max-width: 1024px) 80vw, 320px"
                    className="object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/85 via-ink/25 to-transparent p-4 pt-12">
                    <div className="flex items-center gap-1.5">
                      <p className="font-display text-base font-bold text-white">{t.heroVisual.name}</p>
                      <BadgeCheck className="h-4 w-4 text-accent" />
                    </div>
                    <p className="text-[12px] font-medium text-white/85">{t.heroVisual.role}</p>
                  </div>
                </div>
              </div>

              {/* Floating escrow chip (top) */}
              <div className="absolute -top-3 left-5 z-20 inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 shadow-card">
                <Lock className="h-3.5 w-3.5 text-brand" />
                <span className="text-[11px] font-semibold text-ink">{t.heroVisual.escrowChip}</span>
              </div>

              {/* Floating payout-proof chip (bottom-right) — the value prop, made concrete */}
              <div className="absolute -bottom-4 -right-3 z-20 flex items-center gap-2 rounded-2xl border border-line bg-white px-3 py-2 shadow-cardHover sm:-right-5">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><BadgeCheck className="h-4 w-4" /></span>
                <div>
                  <p className="text-[12px] font-bold text-ink">{t.card.paid} · {formatFcfa(35000, locale)}</p>
                  <p className="text-[10px] text-muted">{t.heroVisual.payoutNote}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stat band */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px px-4 py-2 sm:grid-cols-4">
          {t.stats.map((s, i) => {
            const Icon = STAT_ICONS[i] ?? Lock;
            return (
              <div key={s.label} className="flex flex-col items-start gap-1 px-2 py-5">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-white text-brand shadow-sm"><Icon className="h-4 w-4" /></span>
                <span className="mt-1 font-display text-2xl font-extrabold text-ink">{s.k}</span>
                <span className="text-[12px] leading-snug text-muted">{s.label}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Category chips */}
      <section className="mx-auto max-w-6xl px-4 pt-12">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-ink">{t.categoriesHeading}</h2>
          <Link href="/creators" className="inline-flex min-h-tap shrink-0 items-center text-sm font-semibold text-brand hover:text-brand-600">{t.viewAll}</Link>
        </div>
        <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1">
          {t.categories.map((c) => (
            <Link key={c} href={`/creators?cat=${encodeURIComponent(c)}`} className="inline-flex min-h-tap items-center whitespace-nowrap rounded-full border border-line bg-white px-4 text-sm font-medium text-ink transition hover:border-brand hover:bg-brand-50 hover:text-brand-700">{c}</Link>
          ))}
        </div>
      </section>

      {/* Directory — Creators */}
      <DirectorySection title={t.directory.creatorsTitle} subtitle={t.directory.creatorsSubtitle} live={t.directory.live}
        href="/creators" viewAll={t.viewAll} empty={t.directory.emptyCreators} people={talent.creators}
        render={(p) => <CreatorCard key={p.id} p={p} t={t} locale={locale} />} />

      {/* Directory — Consultants */}
      <DirectorySection title={t.directory.consultantsTitle} subtitle={t.directory.consultantsSubtitle} live={t.directory.live}
        href="/consultants" viewAll={t.viewAll} empty={t.directory.emptyConsultants} people={talent.consultants}
        render={(p) => <ConsultantCard key={p.id} p={p} t={t} />} />

      {/* How escrow works */}
      <section id="escrow" className="mx-auto max-w-6xl px-4 py-16">
        <div className="rounded-3xl border border-line bg-surface p-6 sm:p-10">
          <div className="mb-8 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-brand" />
            <h2 className="font-display text-2xl font-bold tracking-tight text-ink">{t.escrow.heading}</h2>
          </div>
          <ol className="grid gap-5 sm:grid-cols-3">
            {t.escrow.steps.map((s, i) => (
              <li key={s.title} className="relative rounded-2xl border border-line bg-white p-5">
                <div className="mb-3 flex items-center gap-2">
                  <span className="font-display text-lg font-black text-brand">{String(i + 1).padStart(2, '0')}</span>
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                </div>
                <h3 className="text-sm font-bold text-ink">{s.title}</h3>
                <p className="mt-1 text-[13px] leading-relaxed text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Split: brands / creators */}
      <section className="mx-auto max-w-6xl px-4 pb-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-3xl border border-line bg-white p-7 shadow-card">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand"><Megaphone className="h-5 w-5" /></span>
            <h3 className="mt-4 font-display text-xl font-bold text-ink">{t.split.brandsTitle}</h3>
            <p className="mt-1 text-sm text-muted">{t.split.brandsDesc}</p>
            <ul className="mt-4 space-y-2 text-sm text-ink">
              {t.split.brandsBullets.map((li) => (<li key={li} className="flex items-center gap-2"><Check className="h-4 w-4 text-brand" /> {li}</li>))}
            </ul>
            <Link href={cta.splitBrand} className="mt-5 inline-flex min-h-tap items-center gap-2 rounded-xl bg-brand px-5 text-sm font-bold text-white transition hover:bg-brand-600 active:scale-95">
              {authed ? t.hero.ctaDashboard : t.split.brandsCta} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="rounded-3xl border border-line bg-ink p-7 text-white shadow-card">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-accent"><Wallet className="h-5 w-5" /></span>
            <h3 className="mt-4 font-display text-xl font-bold">{t.split.creatorsTitle}</h3>
            <p className="mt-1 text-sm text-white/70">{t.split.creatorsDesc}</p>
            <ul className="mt-4 space-y-2 text-sm">
              {t.split.creatorsBullets.map((li) => (<li key={li} className="flex items-center gap-2"><Check className="h-4 w-4 text-accent" /> {li}</li>))}
            </ul>
            <Link href={cta.splitCreator} className="mt-5 inline-flex min-h-tap items-center gap-2 rounded-xl bg-accent px-5 text-sm font-bold text-ink transition hover:brightness-105 active:scale-95">
              {authed ? t.hero.ctaDashboard : t.split.creatorsCta} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="relative overflow-hidden rounded-3xl bg-brand px-6 py-12 text-center text-white sm:py-16">
          <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accent/30 blur-2xl" />
          <h2 className="font-display text-2xl font-extrabold sm:text-3xl">{t.finalCta.title}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-white/80">{t.finalCta.subtitle}</p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href={cta.finalPrimary} className="flex min-h-tap items-center justify-center gap-2 rounded-xl bg-white px-6 text-sm font-bold text-brand-700 transition hover:bg-white/90 active:scale-95">
              {authed ? t.hero.ctaDashboard : t.finalCta.primary} <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/legal#escrow" className="flex min-h-tap items-center justify-center rounded-xl border border-white/30 px-6 text-sm font-semibold text-white transition hover:bg-white/10">
              {t.finalCta.secondary}
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

function DirectorySection({
  title, subtitle, live, href, viewAll, empty, people, render,
}: {
  title: string; subtitle: string; live: string; href: string; viewAll: string;
  empty: string; people: TalentSummary[]; render: (p: TalentSummary) => ReactNode;
}) {
  return (
    <section className="mx-auto max-w-6xl px-4 pt-10">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xl font-bold tracking-tight text-ink">{title}</h2>
            <span className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-2 py-0.5 text-[11px] font-semibold text-ink">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" /> {live}
            </span>
          </div>
          <p className="text-sm text-muted">{subtitle}</p>
        </div>
        <Link href={href} className="shrink-0 text-sm font-semibold text-brand hover:text-brand-600">{viewAll}</Link>
      </div>
      {people.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-surface px-4 py-14 text-center text-sm text-muted">{empty}</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{people.map(render)}</div>
      )}
    </section>
  );
}
