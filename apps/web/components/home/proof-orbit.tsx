import Image from 'next/image';
import { BadgeCheck, Lock, Sparkles, TrendingUp } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { formatFcfa } from '@/i18n/format';

const d = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties;
const fd = (s: number) => ({ '--fd': `${s}s` }) as CSSProperties;

const BARS = [34, 46, 40, 58, 52, 70, 92];

/**
 * Hero visual — "proof orbit". One hero (the creator portrait, depth 3) with companion proof cards
 * orbiting it, each telling one beat of Bayele's promise: brief matched → budget in escrow →
 * audience growth → Mobile Money payout. The cards are HTML/CSS (no images, ~0 KB) and every one is
 * labelled as an example: the figures are illustrative, never presented as real transactions.
 *
 * Depth map (epic-design): 0 arch · 1 glow · 3 portrait · 4 proof cards · 5 payout card.
 * On phones only the portrait, the escrow card and the payout card show (the story in brief).
 * Entire composition is decorative → aria-hidden; the portrait keeps a real alt via the parent.
 */
export function ProofOrbit({ t, locale }: { t: Dictionary; locale: Locale }) {
  const o = t.orbit;
  // Corner pill on every card: the figures are illustrative, never presented as real.
  const tag = (
    <span className="absolute -top-2 right-3 rounded-full border border-line bg-white px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-muted">{o.example}</span>
  );
  const card = 'relative rounded-2xl border border-line bg-white/95 p-3 shadow-cardHover backdrop-blur';

  return (
    <div data-loop-scope className="relative mx-auto aspect-[4/5] w-full max-w-[330px] sm:max-w-[400px]">
      {/* depth 0 — soft arch + dashed orbit ring */}
      <div aria-hidden className="anim-fade absolute inset-x-[6%] bottom-0 h-[82%] rounded-t-full bg-gradient-to-b from-brand-50 via-brand-50/70 to-white" />
      <div aria-hidden className="anim-fade absolute inset-x-0 bottom-[2%] h-[90%] rounded-t-full border border-dashed border-brand-100" style={d(150)} />
      {/* depth 1 — glow */}
      <div aria-hidden className="pointer-events-none absolute -right-6 top-6 -z-10 h-40 w-40 rounded-full bg-accent/25 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-6 left-0 -z-10 hidden h-40 w-40 rounded-full bg-brand/15 blur-3xl sm:block" />

      {/* depth 3 — the hero: creator portrait (framed photo, background kept per asset audit) */}
      <div className="anim-rise absolute inset-x-0 bottom-[10%] mx-auto w-[72%]" style={d(80)}>
        <div className="float-a" style={fd(-2)}>
          <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] rounded-t-[10rem] border-4 border-white bg-brand-50 shadow-cardHover">
            <Image
              src="https://images.unsplash.com/photo-1610903866883-c280999dcc0e?w=560&q=70&auto=format&fit=crop&crop=faces"
              alt={t.heroVisual.alt}
              fill
              priority
              sizes="(max-width: 640px) 240px, 290px"
              className="object-cover"
            />
            <span className="absolute left-3 top-4 rounded bg-white/85 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-ink">{o.example}</span>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/85 via-ink/30 to-transparent p-3.5 pt-10">
              <p className="flex items-center gap-1.5 font-display text-[15px] font-bold text-white">
                {t.heroVisual.name} <BadgeCheck className="h-4 w-4 text-accent" aria-hidden />
              </p>
              <p className="text-[12px] font-medium text-white/85">{t.heroVisual.role}</p>
            </div>
          </div>
        </div>
      </div>

      <div aria-hidden>
        {/* depth 4 — brief matched (desktop) */}
        <div className="anim-pop absolute -left-[10%] top-[6%] hidden w-[196px] sm:block" style={d(350)}>
          <div className={`${card} float-b`} style={fd(-5)}>
            {tag}
            <span className="flex items-center gap-1.5 text-[12px] font-bold text-ink"><Sparkles className="h-3.5 w-3.5 text-brand" /> {o.briefTitle}</span>
            <p className="mt-1 text-[11px] text-muted">{o.briefMeta}</p>
            <div className="mt-2 flex -space-x-1.5">
              {['bg-brand-100', 'bg-accent-soft', 'bg-emerald-100'].map((c) => (
                <span key={c} className={`h-5 w-5 rounded-full border-2 border-white ${c}`} />
              ))}
            </div>
          </div>
        </div>

        {/* depth 4 — budget in escrow (all sizes) */}
        <div className="anim-pop absolute -right-[3%] top-[2%] w-[168px] sm:-right-[12%] sm:top-[34%] sm:w-[200px]" style={d(450)}>
          <div className={`${card} float-c`} style={fd(-3)}>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[11px] font-bold text-ink sm:text-[12px]">
                <span className="grid h-5 w-5 place-items-center rounded-md bg-brand-50 text-brand"><Lock className="h-3 w-3" /></span>
                {o.escrowTitle}
              </span>
            </div>
            <p className="mt-1.5 font-display text-[16px] font-extrabold tabular-nums text-ink sm:text-[18px]">{formatFcfa(150000, locale)}</p>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-brand-50"><div className="h-full w-full rounded-full bg-brand" /></div>
            <p className="mt-1.5 text-[10px] text-muted">{o.escrowNote}</p>
            {tag}
          </div>
        </div>

        {/* depth 4 — audience growth mini chart (desktop) */}
        <div className="anim-pop absolute -left-[14%] bottom-[16%] hidden w-[176px] sm:block" style={d(550)}>
          <div className={`${card} float-a`} style={fd(-7)}>
            {tag}
            <span className="flex items-center gap-1.5 text-[12px] font-bold text-ink"><TrendingUp className="h-3.5 w-3.5 text-emerald-600" /> {o.growthTitle}</span>
            <div className="mt-2 flex h-12 items-end gap-1">
              {BARS.map((h, i) => (
                <span
                  key={i}
                  className={`bar-grow flex-1 rounded-sm ${i === BARS.length - 1 ? 'bg-brand' : 'bg-brand-100'}`}
                  style={{ height: `${h}%`, ...d(700 + i * 40) }}
                />
              ))}
            </div>
            <p className="mt-1.5 text-[11px] font-semibold text-emerald-700">{o.growthMeta}</p>
          </div>
        </div>

        {/* depth 5 — Mobile Money payout (all sizes) */}
        <div className="anim-pop absolute -bottom-[3%] inset-x-0 mx-auto w-[236px] sm:inset-x-auto sm:-right-[8%] sm:mx-0 sm:w-[236px]" style={d(700)}>
          <div className={`${card} float-b flex items-center gap-2.5`} style={fd(-9)}>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><BadgeCheck className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <p className="whitespace-nowrap text-[12px] font-bold tabular-nums text-ink">{t.card.paid} · {formatFcfa(35000, locale)}</p>
              <p className="flex items-center gap-1 text-[10px] text-muted"><span className="h-2 w-2 rounded-full bg-momo-mtn" /> {o.paidMeta}</p>
            </div>
            {tag}
          </div>
        </div>
      </div>
    </div>
  );
}
