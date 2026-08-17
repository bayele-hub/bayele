import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { DirectoryView } from '@/components/directory-view';
import { getDictionary } from '@/i18n/dictionaries';
import { listConsultants, type CountryCode } from '@/lib/data/talent';

export async function generateMetadata() {
  const { t } = await getDictionary();
  return { title: t.directoryPage.consultantsTitle, description: t.directoryPage.consultantsLede };
}

const COUNTRIES: CountryCode[] = ['CM', 'CI', 'GA'];

export default async function ConsultantsPage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string }>;
}) {
  const sp = await searchParams;
  const country = COUNTRIES.includes(sp.country as CountryCode) ? (sp.country as CountryCode) : undefined;

  const [{ locale, t }, people] = await Promise.all([
    getDictionary(),
    listConsultants({ country, limit: 48 }),
  ]);

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      <DirectoryView role="consultant" basePath="/consultants" title={t.directoryPage.consultantsTitle} lede={t.directoryPage.consultantsLede}
        people={people} t={t} locale={locale} activeCountry={country} />
      <SiteFooter />
    </div>
  );
}
