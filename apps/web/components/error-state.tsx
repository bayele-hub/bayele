'use client';

import Link from 'next/link';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

/**
 * Shared branded error UI for route-level error.tsx boundaries. Keeping the boundary files thin and
 * the markup here means every workspace fails the same way: a readable, mobile-first card with a
 * retry (calls the boundary's `reset`) and a safe escape hatch — never a white screen.
 */
export function ErrorState({
  reset,
  title = 'Une erreur est survenue',
  message = "Quelque chose s'est mal passé de notre côté. Réessayez — si le problème persiste, revenez à l'accueil.",
  home = '/',
}: {
  reset?: () => void;
  title?: string;
  message?: string;
  home?: string;
}) {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-16 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-rose-50 text-rose-500">
        <AlertTriangle className="h-7 w-7" />
      </span>
      <h1 className="mt-5 font-display text-xl font-extrabold text-ink">{title}</h1>
      <p className="mt-2 max-w-sm text-sm text-muted">{message}</p>
      <div className="mt-7 flex w-full max-w-xs flex-col gap-2 sm:flex-row sm:justify-center">
        {reset && (
          <button
            onClick={reset}
            className="inline-flex min-h-tap items-center justify-center gap-2 rounded-xl bg-brand px-5 text-sm font-bold text-white transition hover:bg-brand-600 active:scale-95"
          >
            <RotateCcw className="h-4 w-4" /> Réessayer
          </button>
        )}
        <Link
          href={home}
          className="inline-flex min-h-tap items-center justify-center gap-2 rounded-xl border border-line bg-white px-5 text-sm font-semibold text-ink transition hover:border-brand hover:text-brand"
        >
          <Home className="h-4 w-4" /> Accueil
        </Link>
      </div>
    </main>
  );
}
