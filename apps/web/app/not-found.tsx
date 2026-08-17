import Link from 'next/link';
import Image from 'next/image';
import { Home, Users, Briefcase } from 'lucide-react';

export const metadata = { title: 'Page introuvable' };

/**
 * Branded 404 — replaces Next's default unstyled page. Rendered under the root layout (which only
 * provides <html>/<body>), so it is self-contained. Mobile-first: single column, 48px tap targets.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-surface px-4 py-16 text-center">
      <Link href="/" className="mb-8 flex items-center gap-2">
        <Image src="/logo.jpeg" alt="Bayele" width={32} height={32} className="h-8 w-8 rounded-lg object-contain" />
        <span className="font-display text-xl font-extrabold text-ink">Bayele<span className="brand-dot">.</span></span>
      </Link>

      <p className="font-display text-6xl font-black text-brand">404</p>
      <h1 className="mt-3 font-display text-xl font-extrabold text-ink">Page introuvable</h1>
      <p className="mt-2 max-w-sm text-sm text-muted">
        Cette page n'existe pas ou a été déplacée. Revenez à l'accueil ou explorez l'annuaire.
      </p>

      <div className="mt-7 flex w-full max-w-sm flex-col gap-2 sm:flex-row sm:justify-center">
        <Link
          href="/"
          className="inline-flex min-h-tap items-center justify-center gap-2 rounded-xl bg-brand px-5 text-sm font-bold text-white transition hover:bg-brand-600 active:scale-95"
        >
          <Home className="h-4 w-4" /> Accueil
        </Link>
        <Link
          href="/creators"
          className="inline-flex min-h-tap items-center justify-center gap-2 rounded-xl border border-line bg-white px-5 text-sm font-semibold text-ink transition hover:border-brand hover:text-brand"
        >
          <Users className="h-4 w-4" /> Créateurs
        </Link>
        <Link
          href="/consultants"
          className="inline-flex min-h-tap items-center justify-center gap-2 rounded-xl border border-line bg-white px-5 text-sm font-semibold text-ink transition hover:border-brand hover:text-brand"
        >
          <Briefcase className="h-4 w-4" /> Consultants
        </Link>
      </div>
    </main>
  );
}
