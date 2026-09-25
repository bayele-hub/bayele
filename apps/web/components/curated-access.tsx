import Link from 'next/link';
import { ArrowRight, Megaphone, Sparkles, UserPlus } from 'lucide-react';
import type { Dictionary } from '@/i18n/dictionaries';
import type { LandingCtaHrefs } from '@/lib/auth/landing-ctas';

/**
 * Shown at /creators while the creator directory is unlisted (launch gate, lib/launch-gate.ts).
 * Instead of an empty or thin directory, it explains curated access and offers the two doors:
 * brands submit a brief, creators build their profile.
 */
export function CuratedAccess({ t, cta, authed }: { t: Dictionary; cta: LandingCtaHrefs; authed: boolean }) {
  const c = t.curated;
  return (
    <main className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ background: 'radial-gradient(44rem 22rem at 10% -10%, #EAF2FB 0%, transparent 55%), radial-gradient(36rem 20rem at 100% 0%, #FEF1DF 0%, transparent 50%)' }}
      />
      <div className="mx-auto max-w-3xl px-4 pb-6 pt-14 text-center sm:pt-20">
        <span className="inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-[12px] font-semibold text-brand-700">
          <Sparkles className="h-3.5 w-3.5" aria-hidden /> {c.badge}
        </span>
        <h1 className="mx-auto mt-5 max-w-xl text-balance font-display text-[2rem] font-extrabold leading-[1.08] tracking-tight text-ink sm:text-[2.6rem]">
          {c.title}<span className="brand-dot">.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-muted">{c.body}</p>
      </div>

      <div className="mx-auto grid max-w-4xl gap-4 px-4 pb-16 pt-4 sm:grid-cols-2">
        <div className="flex flex-col rounded-3xl border border-line bg-white p-6 shadow-card">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand"><Megaphone className="h-5 w-5" aria-hidden /></span>
          <h2 className="mt-4 font-display text-lg font-bold text-ink">{c.brandTitle}</h2>
          <p className="mt-1 flex-1 text-sm text-muted">{c.brandBody}</p>
          <Link href={cta.brief} className="mt-5 inline-flex min-h-tap items-center justify-center gap-2 rounded-xl bg-brand px-5 text-sm font-bold text-white transition hover:bg-brand-600 active:scale-95">
            {c.brandCta} <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
        <div className="flex flex-col rounded-3xl border border-line bg-ink p-6 text-white shadow-card">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-accent"><UserPlus className="h-5 w-5" aria-hidden /></span>
          <h2 className="mt-4 font-display text-lg font-bold">{c.creatorTitle}</h2>
          <p className="mt-1 flex-1 text-sm text-white/70">{c.creatorBody}</p>
          <Link href={cta.heroSecondary} className="mt-5 inline-flex min-h-tap items-center justify-center gap-2 rounded-xl bg-accent px-5 text-sm font-bold text-ink transition hover:brightness-105 active:scale-95">
            {authed ? t.hero.ctaProfile : c.creatorCta} <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    </main>
  );
}
