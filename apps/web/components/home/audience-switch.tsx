'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { ArrowRight, Lock, UserPlus, Megaphone } from 'lucide-react';

export type Audience = 'creator' | 'brand';

interface Panel {
  title: string;
  body: string;
  cta: string;
  micro: string;
  href: string;
}

/**
 * Hero audience switch for logged-out visitors: ONE dominant action at a time (the council's
 * main fix — two equal cards split attention). Creators first by default (the 10K sign-up goal);
 * brand links can open the brand side with ?for=brand. Accessible WAI-ARIA tabs with arrow keys.
 */
export function AudienceSwitch({
  initial,
  sceneId,
  label,
  tabs,
  panels,
}: {
  initial: Audience;
  /** id of the element whose data-audience drives the hero visual (brings that side forward). */
  sceneId?: string;
  label: string;
  tabs: Record<Audience, string>;
  panels: Record<Audience, Panel>;
}) {
  const [active, setActive] = useState<Audience>(initial);
  const id = useId();
  const refs = { creator: useRef<HTMLButtonElement>(null), brand: useRef<HTMLButtonElement>(null) };
  const order: Audience[] = ['creator', 'brand'];

  useEffect(() => {
    if (sceneId) document.getElementById(sceneId)?.setAttribute('data-audience', active);
  }, [active, sceneId]);

  function onKey(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = active === 'creator' ? 'brand' : 'creator';
    setActive(next);
    refs[next].current?.focus();
  }

  const p = panels[active];
  const Icon = active === 'creator' ? UserPlus : Megaphone;

  return (
    <div className="rounded-3xl border border-line bg-white p-2 shadow-cardHover">
      <div role="tablist" aria-label={label} className="grid grid-cols-2 gap-1 rounded-2xl bg-surface p-1">
        {order.map((a) => {
          const selected = a === active;
          return (
            <button
              key={a}
              ref={refs[a]}
              id={`${id}-tab-${a}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`${id}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(a)}
              onKeyDown={onKey}
              className={`min-h-tap rounded-xl px-2 text-[13px] font-bold sm:px-3 sm:text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                selected ? 'bg-white text-ink shadow-card' : 'text-muted hover:text-ink'
              }`}
            >
              {tabs[a]}
            </button>
          );
        })}
      </div>

      <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${active}`} className="px-4 pb-4 pt-5 sm:px-5">
        {/* key forces a soft re-entrance when switching sides */}
        <div key={active} className="anim-fade">
          <p className="flex items-center gap-2 font-display text-xl font-extrabold leading-tight text-ink sm:text-[1.35rem]">
            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${active === 'creator' ? 'bg-accent-soft text-[#9A5A05]' : 'bg-brand-50 text-brand'}`}>
              <Icon className="h-4 w-4" aria-hidden />
            </span>
            {p.title}
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">{p.body}</p>
          <Link
            href={p.href}
            className={`mt-4 flex min-h-tap w-full items-center justify-center gap-2 rounded-xl px-6 text-[15px] font-bold shadow-card transition active:scale-[.98] sm:w-auto sm:justify-start ${
              active === 'creator' ? 'bg-accent text-ink hover:brightness-105' : 'bg-brand text-white hover:bg-brand-600'
            }`}
          >
            {p.cta} <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <p className="mt-2.5 flex items-center gap-1.5 text-[13px] text-muted">
            <Lock className="h-3.5 w-3.5 shrink-0 text-brand" aria-hidden /> {p.micro}
          </p>
        </div>
      </div>
    </div>
  );
}
