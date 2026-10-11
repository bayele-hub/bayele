'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CircleHelp } from 'lucide-react';

const OPEN_EVENT = 'section-tip:open';

/**
 * « ? » section tooltip for the internal creation flow (design §13.1). No library, CSS-only motion.
 * Hover (mouse, 120 ms in / 200 ms out), keyboard focus and tap open it; Esc and any tap other than on
 * the trigger close it; one tip open at a time. The bubble never intercepts taps (pointer-events-none),
 * and `placement="top"` opens it away from a form row below the heading (funding card). The bubble is always in the DOM but `invisible` when closed, so screen
 * readers never read a closed tip. Listeners are attached only while open.
 */
export function SectionTip({ id, label, text, ariaTemplate, placement = 'bottom' }: { id: string; label: string; text: string; ariaTemplate: string; placement?: 'bottom' | 'top' }) {
  const tipId = `tip-${id}`;
  const [open, setOpen] = useState(false);
  // Horizontal offset (px, relative to the root) computed on open so the bubble always fits the viewport
  // with 16 px gutters. null = never opened: anchored to the root's right edge, growing leftwards, so a
  // closed (invisible) bubble can never widen the page.
  const [left, setLeft] = useState<number | null>(null);
  const root = useRef<HTMLSpanElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const show = useCallback(() => {
    clear();
    const r = root.current?.getBoundingClientRect();
    if (r) {
      const vw = document.documentElement.clientWidth;
      const width = Math.min(288, vw - 32);
      // Edge rule (§13.1): right half → align the bubble's right edge with the root; then clamp to the gutters.
      let x = r.right > vw / 2 ? r.right - width : r.left;
      x = Math.max(16, Math.min(x, vw - 16 - width));
      setLeft(Math.round(x - r.left));
    }
    setOpen(true);
    window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: tipId }));
  }, [tipId]);
  const hide = useCallback(() => {
    clear();
    setOpen(false);
  }, []);

  // One tip at a time.
  useEffect(() => {
    const onOther = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== tipId) hide();
    };
    window.addEventListener(OPEN_EVENT, onOther);
    return () => window.removeEventListener(OPEN_EVENT, onOther);
  }, [tipId, hide]);

  // Esc + outside tap, only while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const hadFocus = document.activeElement === btn.current;
      hide();
      if (hadFocus) btn.current?.focus();
    };
    // QA D2: any pointerdown except on the trigger closes the tip. The bubble itself is
    // pointer-events-none, so a tap "on" it reaches the control underneath on the first try.
    const onDown = (e: PointerEvent) => {
      if (!(e.target instanceof Node) || !btn.current?.contains(e.target)) hide();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open, hide]);

  useEffect(() => clear, []);

  const enter = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return; // a tap must not open-then-close
    clear();
    if (!open) timer.current = setTimeout(show, 120);
  };
  const leave = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    clear();
    timer.current = setTimeout(hide, 200);
  };

  return (
    <span ref={root} data-tip-root className="relative inline-flex align-middle" onPointerEnter={enter} onPointerLeave={leave}>
      <button
        ref={btn}
        type="button"
        aria-label={ariaTemplate.replace('{section}', label)}
        aria-expanded={open}
        aria-controls={tipId}
        aria-describedby={open ? tipId : undefined}
        onClick={() => (open ? hide() : show())}
        onFocus={(e) => {
          if (e.currentTarget.matches(':focus-visible')) show();
        }}
        onBlur={hide}
        className="relative ml-1.5 inline-grid h-5 w-5 shrink-0 place-items-center rounded-full text-muted transition-colors before:absolute before:-inset-3 before:content-[''] hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 aria-expanded:text-brand-700"
      >
        <CircleHelp className="h-5 w-5" aria-hidden />
      </button>
      <span
        id={tipId}
        role="tooltip"
        data-open={open}
        data-align={left !== null && left < 0 ? 'end' : 'start'}
        style={left === null ? { right: 0 } : { left }}
        className={`pointer-events-none absolute z-30 w-[min(18rem,calc(100vw-2rem))] rounded-xl bg-ink px-3 py-2.5 text-left text-[12px] font-normal normal-case leading-relaxed tracking-normal text-white shadow-cardHover ring-1 ring-white/15 invisible -translate-y-1 opacity-0 transition-[opacity,transform,visibility] duration-150 ease-out data-[open=true]:visible data-[open=true]:translate-y-0 data-[open=true]:opacity-100 motion-reduce:transition-none ${placement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'}`}
      >
        {text}
      </span>
    </span>
  );
}
