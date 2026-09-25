import Link from 'next/link';
import Image from 'next/image';
import {
  ShieldCheck, Smartphone, BadgeCheck, ArrowRight, Zap, Megaphone, Check, Lock, Users, UserPlus, Link2, Handshake,
} from 'lucide-react';
import { getDictionary, formatFcfa } from '@/i18n/dictionaries';
import { getSession } from '@/lib/auth/session';
import { landingCtaHrefs } from '@/lib/auth/landing-ctas';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';

const STAT_ICONS = [Lock, Zap, Smartphone, Users] as const;

/**
 * Home landing page. Creator profiles are intentionally NOT shown here: until the launch milestone
 * (lib/launch-gate.ts) brands get creators through Bayele by submitting a brief, and creators are
 * invited to build their profile. The two hero doors carry that split.
 */
export default async function HomePage() {
  const [{ locale, t }, session] = await Promise.all([getDictionary(), getSession()]);
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
            <h1 className="mt-5 text-balance font-display text-[2.5rem] font-extrabold leading-[1.04] tracking-tight text-ink sm:text-[3.3rem]">
              {t.hero.title}<span className="brand-dot">.</span>
            </h1>
            <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-muted sm:text-base">{t.hero.subtitle}</p>

            {/* Two doors: brands submit a brief, creators build their profile. */}
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col rounded-2xl border border-line bg-white p-4 shadow-card">
                <span className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-brand-700">
                  <Megaphone className="h-4 w-4" aria-hidden /> {t.howItWorks.brandsTitle}
                </span>
                <p className="mt-2 font-display text-[15px] font-bold leading-snug text-ink">{t.hero.brandDoorTitle}</p>
                <p className="mt-1 flex-1 text-[13px] text-muted">{t.hero.brandDoorBody}</p>
                <Link href={authed ? cta.heroPrimary : cta.brief} className="mt-4 flex min-h-tap items-center justify-center gap-2 rounded-xl bg-brand px-5 text-sm font-bold text-white shadow-card transition hover:bg-brand-600 active:scale-95">
                  {authed ? t.hero.ctaDashboard : t.hero.brandDoorCta} <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
              <div className="flex flex-col rounded-2xl border border-line bg-white p-4 shadow-card">
                <span className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-accent">
                  <UserPlus className="h-4 w-4" aria-hidden /> {t.howItWorks.creatorsTitle}
                </span>
                <p className="mt-2 font-display text-[15px] font-bold leading-snug text-ink">{t.hero.creatorDoorTitle}</p>
                <p className="mt-1 flex-1 text-[13px] text-muted">{t.hero.creatorDoorBody}</p>
                <Link href={cta.heroSecondary} className="mt-4 flex min-h-tap items-center justify-center gap-2 rounded-xl border border-line bg-white px-5 text-sm font-bold text-ink transition hover:border-brand hover:text-brand active:scale-95">
                  {authed ? t.hero.ctaProfile : t.hero.creatorDoorCta} <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
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
                  <Image src="https://images.unsplash.com/photo-1645736353780-e70a7d508088?w=400&q=80&auto=format&fit=crop&crop=faces" alt="" fill sizes="128px" className="object-cover" />
                </div>
              </div>
              <div aria-hidden className="absolute -right-8 top-6 hidden w-36 rotate-6 overflow-hidden rounded-3xl border border-line bg-white shadow-card sm:block">
                <div className="relative aspect-[3/4]">
                  <Image src="https://images.unsplash.com/photo-1631831830728-7d33ce562387?w=400&q=80&auto=format&fit=crop&crop=faces" alt="" fill sizes="144px" className="object-cover" />
                </div>
              </div>

              {/* Foreground: the lead creator */}
              <div className="relative z-10 overflow-hidden rounded-[1.75rem] border border-line bg-white shadow-cardHover">
                <div className="relative aspect-[4/5]">
                  <Image
                    src="https://images.unsplash.com/photo-1610903866883-c280999dcc0e?w=640&q=80&auto=format&fit=crop&crop=faces"
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

      {/* Categories — informational while the directory is unlisted (no links into it). */}
      <section className="mx-auto max-w-6xl px-4 pt-12">
        <h2 className="font-display text-lg font-bold text-ink">{t.categoriesHeading}</h2>
        <ul className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1">
          {t.categories.map((c) => (
            <li key={c} className="inline-flex min-h-tap shrink-0 items-center whitespace-nowrap rounded-full border border-line bg-white px-4 text-sm font-medium text-ink">{c}</li>
          ))}
        </ul>
      </section>

      {/* How it works — one real sequence per side, so the steps are numbered. */}
      <section className="mx-auto max-w-6xl px-4 pt-14">
        <h2 className="font-display text-2xl font-bold tracking-tight text-ink">{t.howItWorks.heading}</h2>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="flex flex-col rounded-3xl border border-line bg-white p-6 shadow-card sm:p-7">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand"><Megaphone className="h-5 w-5" aria-hidden /></span>
            <h3 className="mt-4 font-display text-xl font-bold text-ink">{t.howItWorks.brandsTitle}</h3>
            <ol className="mt-4 flex-1 space-y-4">
              {t.howItWorks.brandsSteps.map((s, i) => (
                <li key={s.title} className="flex gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand-50 font-display text-sm font-extrabold text-brand">{i + 1}</span>
                  <div>
                    <p className="text-sm font-bold text-ink">{s.title}</p>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <Link href={cta.brief} className="mt-6 inline-flex min-h-tap items-center gap-2 self-start rounded-xl bg-brand px-5 text-sm font-bold text-white transition hover:bg-brand-600 active:scale-95">
              {t.howItWorks.brandsCta} <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
          <div className="flex flex-col rounded-3xl border border-line bg-ink p-6 text-white shadow-card sm:p-7">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-accent"><UserPlus className="h-5 w-5" aria-hidden /></span>
            <h3 className="mt-4 font-display text-xl font-bold">{t.howItWorks.creatorsTitle}</h3>
            <ol className="mt-4 flex-1 space-y-4">
              {t.howItWorks.creatorsSteps.map((s, i) => (
                <li key={s.title} className="flex gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/10 font-display text-sm font-extrabold text-accent">{i + 1}</span>
                  <div>
                    <p className="text-sm font-bold">{s.title}</p>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-white/70">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <Link href={cta.heroSecondary} className="mt-6 inline-flex min-h-tap items-center gap-2 self-start rounded-xl bg-accent px-5 text-sm font-bold text-ink transition hover:brightness-105 active:scale-95">
              {authed ? t.hero.ctaProfile : t.howItWorks.creatorsCta} <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      {/* Profile = media kit — the reason creators keep building their profile. */}
      <section className="mx-auto max-w-6xl px-4 pt-14">
        <div className="grid items-center gap-8 rounded-3xl border border-line bg-surface p-6 sm:p-10 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-ink">{t.profileKit.heading}</h2>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted">{t.profileKit.body}</p>
            <ul className="mt-5 space-y-2 text-sm text-ink">
              {t.profileKit.bullets.map((b) => (
                <li key={b} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden /> {b}</li>
              ))}
            </ul>
            <Link href={cta.heroSecondary} className="mt-6 inline-flex min-h-tap items-center gap-2 rounded-xl bg-ink px-5 text-sm font-bold text-white transition hover:bg-ink/90 active:scale-95">
              {authed ? t.hero.ctaProfile : t.profileKit.cta} <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
          {/* Illustrative share card — not a real profile. */}
          <div aria-hidden className="mx-auto w-full max-w-sm rounded-2xl border border-line bg-white p-4 shadow-cardHover">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-brand-50 font-display text-base font-extrabold text-brand-700">{t.profileKit.sampleName.slice(0, 2).toUpperCase()}</span>
              <div className="min-w-0">
                <p className="flex items-center gap-1 font-display text-sm font-bold text-ink">{t.profileKit.sampleName} <BadgeCheck className="h-4 w-4 text-brand" /></p>
                <p className="text-[12px] text-muted">{t.profileKit.sampleMeta}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              {['TikTok', 'Instagram', 'WhatsApp'].map((n) => (
                <div key={n} className="rounded-xl bg-surface px-2 py-3">
                  <p className="text-[11px] font-semibold text-muted">{n}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-dashed border-line px-3 py-2.5 text-[12px] font-semibold text-brand-700">
              <Link2 className="h-4 w-4 shrink-0" /> bayele.com/creators/{t.profileKit.sampleSlug}
            </div>
          </div>
        </div>
      </section>

      {/* How escrow works */}
      <section id="escrow" className="mx-auto max-w-6xl px-4 py-14">
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

      {/* Partner program — Bayele builds the infrastructure, partners build talent portfolios on it. */}
      <section id="partners" className="mx-auto max-w-6xl px-4 pb-4">
        <div className="relative overflow-hidden rounded-3xl bg-ink p-6 text-white sm:p-10">
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand/40 blur-3xl" />
          <div className="relative grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-center">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[12px] font-semibold text-accent">
                <Handshake className="h-3.5 w-3.5" aria-hidden /> {t.partner.badge}
              </span>
              <h2 className="mt-4 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">{t.partner.heading}</h2>
              <p className="mt-2 max-w-lg text-sm leading-relaxed text-white/75">{t.partner.body}</p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link href={cta.partnerJoin} className="flex min-h-tap items-center justify-center gap-2 rounded-xl bg-accent px-6 text-sm font-bold text-ink transition hover:brightness-105 active:scale-95">
                  {authed ? t.hero.ctaDashboard : t.partner.cta} <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link href="/partners" className="flex min-h-tap items-center justify-center rounded-xl border border-white/25 px-6 text-sm font-semibold text-white transition hover:bg-white/10">
                  {t.partner.secondary}
                </Link>
              </div>
            </div>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              {t.partner.bullets.map((b) => (
                <li key={b} className="flex items-center gap-2 rounded-xl bg-white/5 px-4 py-3 text-sm">
                  <Check className="h-4 w-4 shrink-0 text-accent" aria-hidden /> {b}
                </li>
              ))}
            </ul>
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
              {authed ? t.hero.ctaDashboard : t.finalCta.primary} <ArrowRight className="h-4 w-4" aria-hidden />
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
