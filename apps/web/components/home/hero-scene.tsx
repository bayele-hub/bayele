import Image from 'next/image';
import type { CSSProperties } from 'react';
import { BadgeCheck, Check, Handshake, Lock, Send } from 'lucide-react';
import type { Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { formatFcfa } from '@/i18n/format';
import { HOME_PHOTOS } from '@/lib/home-photos';

const d = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties;
const fd = (s: number) => ({ '--fd': `${s}s` }) as CSSProperties;

// Photos (and their credits) live in lib/home-photos.ts — swap them there.
const CREATOR_SRC = HOME_PHOTOS.heroCreator.src;
const BRAND_SRC = HOME_PHOTOS.heroBrand.src;

/**
 * Hero visual — "two sides, one deal". A creator at work (on set, REC) and a brand's leadership
 * (brief sent), joined by the Bayele deal card: brief → escrow → paid. It answers the switch
 * next to it: the section's data-audience ("creator" | "brand") brings the matching scene forward
 * via Tailwind group-data variants — pure CSS, no client state here.
 *
 * Layers (epic-design): 0 backdrop · 1 glow · 3 photo frames · 4 chips · 5 deal card + payout toast.
 * Each moving layer is split into wrappers (entrance → state → float) so the animations never fight
 * over the same transform. Everything but the two photos is decorative (aria-hidden) and every
 * figure is tagged as an example.
 */
export function HeroScene({ t, locale }: { t: Dictionary; locale: Locale }) {
  const s = t.scene;
  const ex = t.orbit.example;
  const pill = (
    <span className="absolute -top-2 right-3 z-10 rounded-full border border-line bg-white px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-muted">{ex}</span>
  );
  const frame = 'relative aspect-[4/5] overflow-hidden rounded-[1.75rem] border-4 border-white bg-brand-50 shadow-cardHover';
  // Active side forward, the other steps back a little.
  const creatorState =
    'z-20 transition duration-500 ease-out [transform:rotate(-3deg)] group-data-[audience=brand]/hero:z-10 group-data-[audience=brand]/hero:opacity-80 group-data-[audience=brand]/hero:[transform:rotate(-5deg)_scale(.93)]';
  const brandState =
    'z-10 opacity-80 transition duration-500 ease-out [transform:rotate(4deg)_scale(.93)] group-data-[audience=brand]/hero:z-20 group-data-[audience=brand]/hero:opacity-100 group-data-[audience=brand]/hero:[transform:rotate(3deg)]';

  return (
    <div data-loop-scope className="relative mx-auto aspect-[1/1.2] w-full max-w-[340px] sm:aspect-[1/1.08] sm:max-w-[460px]">
      {/* depth 0 — backdrop */}
      <div aria-hidden className="anim-fade absolute inset-[4%] rounded-[3rem] bg-gradient-to-br from-brand-50 via-white to-accent-soft" />
      <div aria-hidden className="anim-fade absolute inset-0 rounded-[3.5rem] border border-dashed border-brand-100" style={d(150)} />
      {/* depth 1 — glow */}
      <div aria-hidden className="pointer-events-none absolute -right-6 top-4 -z-10 h-40 w-40 rounded-full bg-accent/25 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-6 left-0 -z-10 hidden h-40 w-40 rounded-full bg-brand/15 blur-3xl sm:block" />

      {/* depth 3 — CREATOR at work */}
      <div className="anim-rise absolute left-[1%] top-[3%] z-20 w-[56%] group-data-[audience=brand]/hero:z-10" style={d(60)}>
        <div className={creatorState}>
          <div className="float-a" style={fd(-2)}>
            <div className={frame}>
              <Image src={CREATOR_SRC} alt={s.creatorAlt} fill priority sizes="(max-width: 640px) 190px, 260px" className="object-cover" />
              <span aria-hidden className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-ink/75 px-2 py-1 text-[10px] font-bold tracking-wide text-white backdrop-blur">
                <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" /> {s.rec}
              </span>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/85 via-ink/30 to-transparent p-3 pt-10">
                <p className="text-[12px] font-bold text-white">{s.creatorTag}</p>
                <p className="text-[11px] text-white/80">{s.creatorMeta}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* depth 3 — BRAND at work */}
      <div className="anim-rise absolute right-[1%] top-[20%] z-10 w-[50%] group-data-[audience=brand]/hero:z-20" style={d(180)}>
        <div className={brandState}>
          <div className="float-c" style={fd(-4)}>
            <div className={frame}>
              <Image src={BRAND_SRC} alt={s.brandAlt} fill priority sizes="(max-width: 640px) 170px, 230px" className="object-cover" />
              <span aria-hidden className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[10px] font-bold text-brand-700 shadow-card">
                <Send className="h-3 w-3" /> {s.briefChip}
              </span>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/85 via-ink/30 to-transparent p-3 pt-10">
                <p className="text-[12px] font-bold text-white">{s.brandTag}</p>
                <p className="text-[11px] text-white/80">{s.brandMeta}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div aria-hidden>
        {/* depth 4 — the handshake between the two scenes */}
        <div className="anim-pop absolute left-[47%] top-[39%] z-30" style={d(420)}>
          <span className="grid h-11 w-11 place-items-center rounded-full border-4 border-white bg-brand text-white shadow-cardHover">
            <Handshake className="h-5 w-5" />
          </span>
        </div>

        {/* depth 5 — payout toast (the creator's win) */}
        <div className="anim-pop absolute right-0 top-[1%] z-30 sm:right-[2%] sm:top-[3%]" style={d(620)}>
          <div className="float-b relative flex items-center gap-2 rounded-2xl border border-line bg-white/95 px-3 py-2 shadow-cardHover backdrop-blur" style={fd(-6)}>
            {pill}
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-50 text-emerald-600"><BadgeCheck className="h-4 w-4" /></span>
            <div>
              <p className="whitespace-nowrap text-[12px] font-bold tabular-nums text-ink">{s.payoutToast} · {formatFcfa(35000, locale)}</p>
              <p className="flex items-center gap-1 text-[10px] text-muted"><span className="h-2 w-2 rounded-full bg-momo-mtn" /> MTN MoMo</p>
            </div>
          </div>
        </div>

        {/* depth 5 — the Bayele deal card: brief → escrow → paid */}
        <div className="anim-pop absolute inset-x-0 bottom-[1%] z-30 mx-auto w-[92%] max-w-[360px]" style={d(520)}>
          <div className="relative rounded-2xl border border-line bg-white/95 p-3.5 shadow-cardHover backdrop-blur">
            {pill}
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[12px] font-bold text-ink">{s.dealTitle}</p>
                <p className="text-[10px] text-muted">{s.dealSub}</p>
              </div>
              <p className="shrink-0 font-display text-[16px] font-extrabold tabular-nums text-ink sm:text-[18px]">{formatFcfa(150000, locale)}</p>
            </div>
            <ol className="mt-2.5 grid grid-cols-3 gap-1.5">
              {s.steps.map((label, i) => {
                const done = i === 0;
                const active = i === 1;
                return (
                  <li key={label} className="flex flex-col gap-1">
                    <span className={`h-1 rounded-full ${done ? 'bg-emerald-500' : active ? 'bg-brand' : 'bg-line'}`} />
                    <span className={`flex items-center gap-1 text-[10px] font-semibold ${done ? 'text-emerald-700' : active ? 'text-brand-700' : 'text-muted'}`}>
                      {done ? <Check className="h-3 w-3" /> : active ? <Lock className="h-3 w-3" /> : <span className="h-3 w-3 rounded-full border border-line" />}
                      {label}
                    </span>
                  </li>
                );
              })}
            </ol>
            <p className="mt-2 text-[10px] text-muted">{s.dealNote}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
