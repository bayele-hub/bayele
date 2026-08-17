import Link from 'next/link';
import Image from 'next/image';
import { getDictionary } from '@/i18n/dictionaries';
import { LanguageSwitcher } from '@/components/language-switcher';

/** Shared public site header: logo, nav, language switcher, auth CTAs. */
export async function SiteHeader() {
  const { locale, t } = await getDictionary();
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/85 backdrop-blur-md">
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
          <Link href="/auth?mode=signin" className="hidden min-h-tap place-items-center rounded-lg px-3 text-sm font-semibold text-ink hover:text-brand sm:grid">{t.nav.login}</Link>
          <Link href="/auth?mode=signup" className="grid min-h-tap place-items-center rounded-lg bg-brand px-4 text-sm font-bold text-white shadow-sm transition hover:bg-brand-600 active:scale-95">{t.nav.start}</Link>
        </div>
      </div>
    </header>
  );
}
