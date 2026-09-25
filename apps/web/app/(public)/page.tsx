import Link from 'next/link';
import type { CSSProperties } from 'react';
import {
  ShieldCheck, Smartphone, BadgeCheck, ArrowRight, Lock, MapPin, Receipt, Megaphone, UserPlus, Link2, Handshake,
  Users, Wallet, Check,
} from 'lucide-react';
import { getDictionary } from '@/i18n/dictionaries';
import { getSession } from '@/lib/auth/session';
import { landingCtaHrefs, homeContinueCtas, type HomeRole } from '@/lib/auth/landing-ctas';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { AudienceSwitch, type Audience } from '@/components/home/audience-switch';
import { HeroScene } from '@/components/home/hero-scene';
import { RevealRoot } from '@/components/home/reveal-root';

const STAT_ICONS = [Lock, MapPin, Smartphone, Receipt] as const;
const ESCROW_ICONS = [Lock, Megaphone, Wallet] as const;
const PARTNER_ICONS = [Megaphone, Users, Lock, Receipt] as const;

/** Stagger helper for [data-reveal] / .anim-* delays. */
const d = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties;

/**
 * Home landing page.
 *
 * Creator profiles are intentionally NOT shown here: until the launch milestone (lib/launch-gate.ts)
 * brands get creators through Bayele by submitting a brief, and creators are invited to build their
 * profile. The hero follows the design council's review: one dominant action at a time (an audience
 * switch, creators first), a role-aware "continue" card for signed-in visitors, and only verifiable
 * proof. Motion follows the epic-design system adapted to CSS (see app/globals.css).
 */
export default async function HomePage({ searchParams }: { searchParams: Promise<{ for?: string; pour?: string }> }) {
  const [{ locale, t }, session, sp] = await Promise.all([getDictionary(), getSession(), searchParams]);
  const authed = !!session.userId;
  // All auth-dependent hrefs resolve here so a logged-in visitor is never sent into the signup funnel.
  const cta = landingCtaHrefs(authed);
  const initialAudience: Audience = sp.for === 'brand' || sp.pour === 'marque' ? 'brand' : 'creator';
  const cont = homeContinueCtas((session.primary as HomeRole | null) ?? null);
  const firstName = (session.profile?.display_name ?? '').trim().split(/\s+/)[0] ?? '';
  const h = t.hero;
  const contCopy = h.continue[cont.key];
  // Which scene the hero visual brings forward: the switch updates this attribute client-side;
  // signed-in brands see their own side.
  const heroAudience: Audience = authed ? (cont.key === 'business' ? 'brand' : 'creator') : initialAudience;

  return (
    <div className="bg-white">
      {/* Announcement bar — hidden on phones to keep the primary action above the fold */}
      <div className="hidden bg-ink text-white sm:block">
        <div className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-4 py-2 text-center text-[12px]">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
          <span className="text-white/85">{t.announce}</span>
        </div>
      </div>

      <SiteHeader />

      <main>
        {/* ───────── Hero ───────── */}
        <section id="home-hero" data-audience={heroAudience} className="group/hero relative overflow-hidden" aria-labelledby="home-title">
          {/* depth 0 — atmosphere */}
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10"
            style={{ background: 'radial-gradient(52rem 28rem at 12% -12%, #EAF2FB 0%, transparent 58%), radial-gradient(42rem 26rem at 100% 0%, #FEF1DF 0%, transparent 52%)' }} />
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-8 sm:pt-12 lg:grid-cols-[1.25fr_1fr] lg:gap-10 lg:pb-24 lg:pt-16">
            <div>
              <span className="anim-fade inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-[12px] font-semibold text-brand-700">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" /> {h.badge}
              </span>

              {/* Masked line reveal; the real heading text is in the sr-only span */}
              <h1 id="home-title" className="mt-4 font-display text-[2.15rem] font-extrabold leading-[1.05] tracking-tight text-ink sm:text-[2.7rem] lg:text-[clamp(2.5rem,3.25vw,3rem)]">
                <span className="sr-only">{h.title}</span>
                <span aria-hidden>
                  {h.titleLines.map((line, i) => (
                    <span key={line} className="line-mask">
                      <span className="line-in text-balance" style={{ '--i': i } as CSSProperties}>
                        {line}
                        {i === h.titleLines.length - 1 && <span className="brand-dot">.</span>}
                      </span>
                    </span>
                  ))}
                </span>
              </h1>

              <p className="anim-rise mt-4 max-w-xl text-[15px] leading-relaxed text-muted sm:text-base" style={d(280)}>{h.subtitle}</p>

              <div className="anim-rise mt-6 max-w-xl" style={d(380)}>
                {authed ? (
                  <div className="rounded-3xl border border-line bg-white p-5 shadow-cardHover">
                    {firstName && <p className="text-[12px] font-bold uppercase tracking-wide text-brand-700">{h.welcome.replace('{name}', firstName)}</p>}
                    <p className="mt-1 font-display text-xl font-extrabold text-ink">{contCopy.title}</p>
                    <p className="mt-1 text-[15px] text-muted">{contCopy.body}</p>
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <Link href={cont.primary} className="flex min-h-tap items-center justify-center gap-2 rounded-xl bg-brand px-6 text-[15px] font-bold text-white shadow-card transition hover:bg-brand-600 active:scale-[.98]">
                        {contCopy.primary} <ArrowRight className="h-4 w-4" aria-hidden />
                      </Link>
                      <Link href={cont.secondary} className="flex min-h-tap items-center justify-center rounded-xl border border-line bg-white px-6 text-[15px] font-semibold text-ink transition hover:border-brand hover:text-brand">
                        {contCopy.secondary}
                      </Link>
                    </div>
                  </div>
                ) : (
                  <>
                    <AudienceSwitch
                      initial={initialAudience}
                      sceneId="home-hero"
                      label={h.tabsLabel}
                      tabs={{ creator: h.tabCreator, brand: h.tabBrand }}
                      panels={{
                        creator: { ...h.creator, href: cta.heroSecondary },
                        brand: { ...h.brand, href: cta.brief },
                      }}
                    />
                    <Link href={cta.partnerJoin} className="mt-3 inline-flex min-h-tap items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand">
                      <Handshake className="h-4 w-4" aria-hidden /> {h.partnerLink} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                    </Link>
                  </>
                )}
              </div>

              {/* Trust line — product facts only */}
              <ul className="anim-fade mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] font-medium text-ink/75" style={d(520)}>
                <li className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-brand" aria-hidden /> {h.trust[0]}</li>
                <li className="flex items-center gap-1.5">
                  <span aria-hidden className="flex -space-x-0.5"><span className="h-2.5 w-2.5 rounded-full bg-momo-mtn ring-2 ring-white" /><span className="h-2.5 w-2.5 rounded-full bg-momo-orange ring-2 ring-white" /><span className="h-2.5 w-2.5 rounded-full bg-momo-wave ring-2 ring-white" /></span>
                  {h.trust[1]}
                </li>
                <li className="flex items-center gap-1.5"><Receipt className="h-4 w-4 text-brand" aria-hidden /> {h.trust[2]}</li>
              </ul>
            </div>

            <HeroScene t={t} locale={locale} />
          </div>
        </section>

        {/* ───────── Proof strip (floats over the hero edge) ───────── */}
        <section aria-label={t.escrow.heading} className="relative z-10 mx-auto -mt-10 max-w-6xl px-4">
          <div data-reveal="up" className="grid grid-cols-2 divide-line overflow-hidden rounded-3xl border border-line bg-white shadow-cardHover sm:grid-cols-4 sm:divide-x">
            {t.stats.map((s, i) => {
              const Icon = STAT_ICONS[i] ?? Lock;
              return (
                <div key={s.label} className="flex flex-col items-start gap-1 border-line px-5 py-5 [&:nth-child(-n+2)]:border-b sm:[&:nth-child(-n+2)]:border-b-0">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-brand"><Icon className="h-4 w-4" aria-hidden /></span>
                  <span className="mt-1 font-display text-xl font-extrabold text-ink sm:text-2xl">{s.k}</span>
                  <span className="text-[13px] leading-snug text-muted">{s.label}</span>
                </div>
              );
            })}
          </div>
        </section>

        {/* ───────── Categories marquee ───────── */}
        <section className="mx-auto max-w-6xl px-4 pt-14" aria-labelledby="home-cats">
          <h2 id="home-cats" data-reveal="up" className="font-display text-lg font-bold text-ink">{t.categoriesHeading}</h2>
          <div data-loop-scope className="marquee mt-4" data-reveal="up" style={d(80)}>
            <div className="marquee-track gap-2 pr-2">
              {[...t.categories, ...t.categories].map((c, i) => (
                <span key={`${c}-${i}`} aria-hidden={i >= t.categories.length || undefined}
                  className="inline-flex min-h-tap shrink-0 items-center whitespace-nowrap rounded-full border border-line bg-white px-4 text-sm font-medium text-ink">
                  {c}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ───────── How it works ───────── */}
        <section className="mx-auto max-w-6xl px-4 pt-16" aria-labelledby="home-how">
          <h2 id="home-how" data-reveal="up" className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">{t.howItWorks.heading}</h2>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div data-reveal="left" className="flex flex-col rounded-3xl border border-line bg-white p-6 shadow-card sm:p-7">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand"><Megaphone className="h-5 w-5" aria-hidden /></span>
              <h3 className="mt-4 font-display text-xl font-bold text-ink">{t.howItWorks.brandsTitle}</h3>
              <ol className="relative mt-5 flex-1 space-y-5">
                <span aria-hidden className="absolute bottom-3 left-[13px] top-3 w-0.5 rounded-full bg-brand-100" />
                {t.howItWorks.brandsSteps.map((s, i) => (
                  <li key={s.title} data-reveal="up" style={d(120 + i * 90)} className="relative flex gap-3">
                    <span className="relative grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand font-display text-sm font-extrabold text-white">{i + 1}</span>
                    <div>
                      <p className="text-sm font-bold text-ink">{s.title}</p>
                      <p className="mt-0.5 text-[14px] leading-relaxed text-muted">{s.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <Link href={cta.brief} className="mt-6 inline-flex min-h-tap items-center gap-2 self-start rounded-xl bg-brand px-5 text-sm font-bold text-white transition hover:bg-brand-600 active:scale-95">
                {h.brand.cta} <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
            <div data-reveal="right" className="flex flex-col rounded-3xl border border-line bg-ink p-6 text-white shadow-card sm:p-7">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-accent"><UserPlus className="h-5 w-5" aria-hidden /></span>
              <h3 className="mt-4 font-display text-xl font-bold">{t.howItWorks.creatorsTitle}</h3>
              <ol className="relative mt-5 flex-1 space-y-5">
                <span aria-hidden className="absolute bottom-3 left-[13px] top-3 w-0.5 rounded-full bg-white/15" />
                {t.howItWorks.creatorsSteps.map((s, i) => (
                  <li key={s.title} data-reveal="up" style={d(120 + i * 90)} className="relative flex gap-3">
                    <span className="relative grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-accent font-display text-sm font-extrabold text-ink">{i + 1}</span>
                    <div>
                      <p className="text-sm font-bold">{s.title}</p>
                      <p className="mt-0.5 text-[14px] leading-relaxed text-white/75">{s.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <Link href={cta.heroSecondary} className="mt-6 inline-flex min-h-tap items-center gap-2 self-start rounded-xl bg-accent px-5 text-sm font-bold text-ink transition hover:brightness-105 active:scale-95">
                {authed ? h.ctaProfile : h.creator.cta} <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>
        </section>

        {/* ───────── Profile = media kit ───────── */}
        <section className="mx-auto max-w-6xl px-4 pt-16" aria-labelledby="home-kit">
          <div className="grid items-center gap-10 overflow-hidden rounded-3xl border border-line bg-surface p-6 sm:p-10 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <h2 id="home-kit" data-reveal="up" className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">{t.profileKit.heading}</h2>
              <p data-reveal="up" style={d(80)} className="mt-2 max-w-lg text-[15px] leading-relaxed text-muted">{t.profileKit.body}</p>
              <ul className="mt-5 space-y-2.5 text-[15px] text-ink">
                {t.profileKit.bullets.map((b, i) => (
                  <li key={b} data-reveal="up" style={d(140 + i * 70)} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden /> {b}</li>
                ))}
              </ul>
              <Link href={cta.heroSecondary} className="mt-6 inline-flex min-h-tap items-center gap-2 rounded-xl bg-ink px-5 text-sm font-bold text-white transition hover:bg-ink/90 active:scale-95">
                {authed ? h.ctaProfile : t.profileKit.cta} <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
            {/* Illustrative phone frame — not a real profile (depth: 2 tilted card · 3 phone · 4 chip) */}
            <div aria-hidden className="relative mx-auto w-full max-w-[290px]" data-reveal="scale">
              <div className="absolute inset-x-6 -bottom-3 top-6 -rotate-6 rounded-[2.25rem] bg-brand-100" />
              <div className="relative rounded-[2.25rem] border-[6px] border-ink bg-white p-4 shadow-cardHover">
                <div className="mx-auto mb-4 h-1.5 w-16 rounded-full bg-line" />
                <div className="flex items-center gap-3">
                  <span className="grid h-12 w-12 place-items-center rounded-full bg-brand-50 font-display text-base font-extrabold text-brand-700">{t.profileKit.sampleName.slice(0, 2).toUpperCase()}</span>
                  <div className="min-w-0">
                    <p className="flex items-center gap-1 font-display text-sm font-bold text-ink">{t.profileKit.sampleName} <BadgeCheck className="h-4 w-4 text-brand" /></p>
                    <p className="text-[12px] text-muted">{t.profileKit.sampleMeta}</p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  {['TikTok', 'Instagram', 'WhatsApp'].map((n, i) => (
                    <div key={n} className="rounded-xl bg-surface px-1 py-2.5">
                      <p className="font-display text-sm font-extrabold text-ink">{t.profileKit.sampleFollowers[i]}</p>
                      <p className="text-[10px] font-semibold text-muted">{n}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-dashed border-line px-3 py-2.5 text-[12px] font-semibold text-brand-700">
                  <Link2 className="h-4 w-4 shrink-0" /> bayele.com/creators/{t.profileKit.sampleSlug}
                </div>
                <p className="mt-3 text-center text-[10px] font-semibold uppercase tracking-wide text-muted">{t.orbit.example}</p>
              </div>
              <span className="absolute -right-4 top-10 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1.5 text-[12px] font-bold text-emerald-700 shadow-card ring-1 ring-emerald-100">
                <ShieldCheck className="h-3.5 w-3.5" /> {t.profile.verified}
              </span>
            </div>
          </div>
        </section>

        {/* ───────── How escrow works — the money rail ───────── */}
        <section id="escrow" className="mx-auto max-w-6xl px-4 py-16" aria-labelledby="home-escrow">
          <div className="rounded-3xl border border-line bg-white p-6 shadow-card sm:p-10">
            <p data-reveal="up" className="text-[12px] font-bold uppercase tracking-wide text-brand-700">{t.escrow.railLabel}</p>
            <h2 id="home-escrow" data-reveal="up" style={d(60)} className="mt-1 font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">{t.escrow.heading}</h2>
            <ol className="relative mt-8 grid gap-6 sm:grid-cols-3 sm:gap-5">
              <span aria-hidden className="absolute left-[16.6%] right-[16.6%] top-7 hidden h-0.5 overflow-hidden rounded-full bg-brand-100 sm:block">
                <span data-reveal="fill" style={d(250)} className="block h-full w-full bg-brand" />
              </span>
              {t.escrow.steps.map((s, i) => {
                const Icon = ESCROW_ICONS[i] ?? Lock;
                const vault = i === 0;
                return (
                  <li key={s.title} data-reveal="up" style={d(150 + i * 140)} className="relative flex gap-4 sm:flex-col sm:items-center sm:text-center">
                    <span className={`relative grid h-14 w-14 shrink-0 place-items-center rounded-2xl shadow-card ${vault ? 'bg-brand text-white' : 'border border-line bg-white text-brand'}`}>
                      <Icon className="h-6 w-6" aria-hidden />
                      <span className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-accent font-display text-[11px] font-extrabold text-ink">{i + 1}</span>
                    </span>
                    <div>
                      <h3 className="text-[15px] font-bold text-ink">{s.title}</h3>
                      <p className="mt-1 text-[14px] leading-relaxed text-muted">{s.body}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        {/* ───────── Partner program ───────── */}
        <section id="partners" className="mx-auto max-w-6xl px-4 pb-4" aria-labelledby="home-partners">
          <div data-reveal="up" className="relative overflow-hidden rounded-3xl bg-ink p-6 text-white sm:p-10">
            <div aria-hidden className="pointer-events-none absolute inset-0 opacity-40"
              style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,.12) 1px, transparent 1px)', backgroundSize: '18px 18px' }} />
            <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand/40 blur-3xl" />
            <div className="relative grid gap-8 lg:grid-cols-[1.15fr_1fr] lg:items-center">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[12px] font-semibold text-accent">
                  <Handshake className="h-3.5 w-3.5" aria-hidden /> {t.partner.badge}
                </span>
                <h2 id="home-partners" className="mt-4 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">{t.partner.heading}</h2>
                <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-white/75">{t.partner.body}</p>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <Link href={cta.partnerJoin} className="flex min-h-tap items-center justify-center gap-2 rounded-xl bg-accent px-6 text-sm font-bold text-ink transition hover:brightness-105 active:scale-95">
                    {authed ? h.ctaDashboard : t.partner.cta} <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                  <Link href="/partners" className="flex min-h-tap items-center justify-center rounded-xl border border-white/25 px-6 text-sm font-semibold text-white transition hover:bg-white/10">
                    {t.partner.secondary}
                  </Link>
                </div>
              </div>
              <ul className="grid gap-3 sm:grid-cols-2">
                {t.partner.bullets.map((b, i) => {
                  const Icon = PARTNER_ICONS[i] ?? Check;
                  return (
                    <li key={b} data-reveal="up" style={d(200 + i * 80)} className="rounded-2xl bg-white/[.06] p-4 ring-1 ring-white/10 transition hover:-translate-y-0.5 hover:bg-white/10">
                      <Icon className="h-5 w-5 text-accent" aria-hidden />
                      <p className="mt-2 text-sm font-semibold leading-snug">{b}</p>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </section>

        {/* ───────── Final CTA ───────── */}
        <section className="mx-auto max-w-6xl px-4 py-16" aria-labelledby="home-final">
          <div data-reveal="scale" className="relative overflow-hidden rounded-3xl bg-brand px-6 py-14 text-center text-white sm:py-20">
            <span aria-hidden className="pointer-events-none absolute inset-x-0 -bottom-[0.18em] select-none text-center font-display text-[26vw] font-extrabold leading-none text-white/[.07] lg:text-[15rem]">
              Bayele.
            </span>
            <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-accent/30 blur-2xl" />
            <div className="relative">
              <h2 id="home-final" className="mx-auto max-w-xl text-balance font-display text-2xl font-extrabold sm:text-4xl">{t.finalCta.title}</h2>
              <p className="mx-auto mt-3 max-w-md text-[15px] text-white/85">{t.finalCta.subtitle}</p>
              <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link href={cta.finalPrimary} className="flex min-h-tap items-center justify-center gap-2 rounded-xl bg-white px-6 text-sm font-bold text-brand-700 transition hover:bg-white/90 active:scale-95">
                  {authed ? h.ctaDashboard : t.finalCta.primary} <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link href="/legal#escrow" className="flex min-h-tap items-center justify-center rounded-xl border border-white/30 px-6 text-sm font-semibold text-white transition hover:bg-white/10">
                  {t.finalCta.secondary}
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
      <RevealRoot />
    </div>
  );
}
