'use client';

import { useEffect } from 'react';

/**
 * Arms the home page's scroll reveals and ambient-loop pausing (see the motion system in
 * app/globals.css). Mounted once per page; renders nothing.
 *
 * Progressive by design: content is fully visible in the server HTML. Only after this mounts do
 * below-the-fold [data-reveal] elements get their hidden start state (they're off-screen, so there
 * is no visible flash); anything already in view is marked revealed immediately. If JavaScript
 * never runs, nothing is ever hidden.
 */
export function RevealRoot() {
  useEffect(() => {
    const root = document.documentElement;
    try {
      const coarse = window.matchMedia('(pointer: coarse)').matches;
      const cores = navigator.hardwareConcurrency ?? 8;
      if (coarse || cores <= 4) root.classList.add('perf-lite');
    } catch {
      /* matchMedia unavailable — keep full motion */
    }

    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('is-in'));
      return;
    }

    const fold = window.innerHeight * 0.9;
    for (const el of els) if (el.getBoundingClientRect().top < fold) el.classList.add('is-in');
    root.classList.add('reveal-ready');

    // A clipped (clip) or zero-width (fill) element has no visible area, so an observer would never
    // report it as intersecting — watch its parent instead and reveal the element through it.
    const byTarget = new Map<Element, HTMLElement[]>();
    for (const el of els) {
      if (el.classList.contains('is-in')) continue;
      const zeroArea = el.dataset.reveal === 'clip' || el.dataset.reveal === 'fill';
      const target = zeroArea ? (el.parentElement ?? el) : el;
      byTarget.set(target, [...(byTarget.get(target) ?? []), el]);
    }
    const reveal = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          byTarget.get(e.target)?.forEach((el) => el.classList.add('is-in'));
          reveal.unobserve(e.target);
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
    );
    byTarget.forEach((_, target) => reveal.observe(target));

    // Pause infinite loops while their section is off-screen (performance rule).
    const loops = new IntersectionObserver((entries) => {
      for (const e of entries) e.target.classList.toggle('is-paused', !e.isIntersecting);
    });
    document.querySelectorAll<HTMLElement>('[data-loop-scope]').forEach((s) => loops.observe(s));

    return () => {
      reveal.disconnect();
      loops.disconnect();
      root.classList.remove('reveal-ready');
    };
  }, []);

  return null;
}
