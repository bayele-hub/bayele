import Link from 'next/link';
import Image from 'next/image';
import { getDictionary } from '@/i18n/dictionaries';

export async function SiteFooter() {
  const { t } = await getDictionary();
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row">
        <div className="flex items-center gap-2">
          <Image src="/logo.jpeg" alt="Bayele" width={24} height={24} className="h-6 w-6 rounded object-contain" />
          <span className="text-sm font-bold text-ink">Bayele<span className="brand-dot">.</span></span>
          <span className="ml-2 text-[12px] text-muted">{t.footer.rights.replace('{year}', String(year))}</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-[13px] text-muted">
          <Link href="/legal#cgu" className="inline-flex min-h-tap items-center hover:text-brand">{t.footer.cgu}</Link>
          <Link href="/legal#privacy" className="inline-flex min-h-tap items-center hover:text-brand">{t.footer.privacy}</Link>
          <Link href="/legal#ohada" className="inline-flex min-h-tap items-center hover:text-brand">{t.footer.ohada}</Link>
        </div>
      </div>
    </footer>
  );
}
