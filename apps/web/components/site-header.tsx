import Link from 'next/link';
import Image from 'next/image';
import { LayoutDashboard } from 'lucide-react';
import { getDictionary } from '@/i18n/dictionaries';
import { getSession } from '@/lib/auth/session';
import { landingCtaHrefs } from '@/lib/auth/landing-ctas';
import { LanguageSwitcher } from '@/components/language-switcher';

/** Shared public site header: logo, nav, language switcher, and auth-aware CTAs. */
export async function SiteHeader() {
  const [{ locale, t }, session] = await Promise.all([getDictionary(), getSession()]);
  const authed = !!session.userId;
  // Auth-dependent hrefs resolve centrally so a logged-in visitor is never offered signin/signup.
  const cta = landingCtaHrefs(authed);
  return (
    <header className="pt-safe sticky top-0 z-40 border-b border-line bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logo.jpeg" alt="Bayele" width={32} height={32} className="h-8 w-8 rounded-lg object-contain" priority />
          <span className="font-display text-xl font-extrabold tracking-tight text-ink">Bayele<span className="brand-dot">.</span></span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm font-medium text-muted md:flex">
          <Link href="/creators" className="hover:text-ink">{t.nav.creators}</Link>
          <Link href="/consultants" className="hover:text-ink">{t.nav.consultants}</Link>
          <Link href="/#escrow" className="hover:text-ink">{t.nav.security}</Link>
          <Link href="/legal#ohada" className="hover:text-ink">{t.nav.billing}</Link>
        </nav>
        <div className="flex items-center gap-2">
          <LanguageSwitcher locale={locale} />
          {authed ? (
            <Link href={cta.headerPrimary} className="inline-flex min-h-tap items-center gap-1.5 rounded-lg bg-brand px-4 text-sm font-bold text-white shadow-sm transition hover:bg-brand-600 active:scale-95">
              <LayoutDashboard className="h-4 w-4" /> {t.nav.dashboard}
            </Link>
          ) : (
            <>
              {cta.headerSignin && (
                <Link href={cta.headerSignin} className="hidden min-h-tap place-items-center rounded-lg px-3 text-sm font-semibold text-ink hover:text-brand sm:grid">{t.nav.login}</Link>
              )}
              <Link href={cta.headerPrimary} className="grid min-h-tap place-items-center rounded-lg bg-brand px-4 text-sm font-bold text-white shadow-sm transition hover:bg-brand-600 active:scale-95">{t.nav.start}</Link>
            </>
          )}
        </div>
      </div>

      {/* Mobile nav — the primary nav above is md:flex only. Without this, phone users (≈95% of
          traffic) have no header path to the directories, security, billing, or sign-in. Scrollable,
          no JS (payload budget), 48px tap targets. */}
      <div className="no-scrollbar overflow-x-auto border-t border-line md:hidden">
        <nav className="mx-auto flex max-w-6xl items-center gap-0.5 px-2 text-xs font-semibold text-muted">
          <Link href="/creators" className="inline-flex min-h-tap items-center whitespace-nowrap rounded-lg px-2.5 hover:bg-brand-50 hover:text-brand">{t.nav.creators}</Link>
          <Link href="/consultants" className="inline-flex min-h-tap items-center whitespace-nowrap rounded-lg px-2.5 hover:bg-brand-50 hover:text-brand">{t.nav.consultants}</Link>
          <Link href="/#escrow" className="inline-flex min-h-tap items-center whitespace-nowrap rounded-lg px-2.5 hover:bg-brand-50 hover:text-brand">{t.nav.security}</Link>
          <Link href="/legal#ohada" className="inline-flex min-h-tap items-center whitespace-nowrap rounded-lg px-2.5 hover:bg-brand-50 hover:text-brand">{t.nav.billing}</Link>
          {authed ? (
            <Link href={cta.headerPrimary} className="ml-auto inline-flex min-h-tap items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 font-bold text-brand hover:bg-brand-50">
              <LayoutDashboard className="h-4 w-4" /> {t.nav.dashboard}
            </Link>
          ) : cta.headerSignin ? (
            <Link href={cta.headerSignin} className="ml-auto inline-flex min-h-tap items-center whitespace-nowrap rounded-lg px-2.5 font-bold text-brand hover:bg-brand-50">{t.nav.login}</Link>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
