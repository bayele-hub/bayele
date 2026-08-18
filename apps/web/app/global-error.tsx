'use client';

import { useEffect } from 'react';
import './globals.css';

/**
 * Last-resort boundary: catches errors thrown by the ROOT layout itself (where a normal error.tsx
 * cannot reach). It replaces the whole document, so it must render its own <html>/<body>. Kept
 * dependency-free and self-styled so it renders even if the layout/data layer is what failed.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[global] fatal error', error);
  }, [error]);
  return (
    <html lang="fr">
      <body className="bg-surface text-ink antialiased">
        <main className="flex min-h-screen flex-col items-center justify-center px-4 py-16 text-center">
          <span className="font-display text-2xl font-extrabold">
            Bayele<span className="brand-dot">.</span>
          </span>
          <h1 className="mt-6 font-display text-xl font-extrabold">Service momentanément indisponible</h1>
          <p className="mt-2 max-w-sm text-sm text-muted">
            Une erreur inattendue est survenue. Réessayez dans un instant.
          </p>
          <button
            onClick={reset}
            className="mt-7 inline-flex min-h-tap items-center justify-center gap-2 rounded-xl bg-brand px-6 text-sm font-bold text-white transition hover:bg-brand-600 active:scale-95"
          >
            Réessayer
          </button>
        </main>
      </body>
    </html>
  );
}
