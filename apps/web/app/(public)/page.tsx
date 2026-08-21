import Link from 'next/link';
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

          {/* Signature visual — a live escrow campaign card */}
          <div className="relative">
            <div className="mx-auto max-w-sm rounded-3xl border border-line bg-white p-5 shadow-cardHover">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand"><Megaphone className="h-4 w-4" /></span>
                  <div>
                    <p className="text-sm font-bold text-ink">{t.card.title}</p>
                    <p className="text-[11px] text-muted">{t.card.meta}</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-bold text-accent">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" /> {t.card.inProgress}
                </span>
              </div>
              <div className="mt-4 rounded-2xl bg-surface p-4">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="flex items-center gap-1.5 font-semibold text-ink"><Lock className="h-3.5 w-3.5 text-brand" /> {t.card.escrow}</span>
                  <span className="font-bold text-ink">{formatFcfa(450000, locale)}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-brand-100"><div className="h-full w-2/3 rounded-full bg-brand" /></div>
                <p className="mt-2 text-[11px] text-muted">{t.card.progressNote}</p>
              </div>
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between rounded-xl border border-line px-3 py-2">
                  <div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-full bg-brand text-[10px] font-bold text-white">AN</span><span className="text-[12px] font-semibold text-ink">@awa_beauty</span></div>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600"><BadgeCheck className="h-3.5 w-3.5" /> {t.card.paid} · {formatFcfa(35000, locale)}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-line px-3 py-2">
                  <div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-full bg-ink text-[10px] font-bold text-white">YK</span><span className="text-[12px] font-semibold text-ink">@yao_tech</span></div>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-accent"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" /> {t.card.reviewing}</span>
                </div>
              </div>
            </div>
            <div aria-hidden className="absolute -right-3 -top-3 -z-10 h-24 w-24 rounded-full bg-accent/20 blur-2xl" />
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
