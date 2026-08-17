import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { DirectoryView } from '@/components/directory-view';
import { getDictionary } from '@/i18n/dictionaries';
import { listCreators, type CountryCode } from '@/lib/data/talent';

export async function generateMetadata() {
  const { t } = await getDictionary();
  return { title: t.directoryPage.creatorsTitle, description: t.directoryPage.creatorsLede };
}

const COUNTRIES: CountryCode[] = ['CM', 'CI', 'GA'];

export default async function CreatorsPage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string; cat?: string }>;
}) {
  const sp = await searchParams;
  const country = COUNTRIES.includes(sp.country as CountryCode) ? (sp.country as CountryCode) : undefined;
  const category = sp.cat || undefined;

  const [{ locale, t }, people] = await Promise.all([
    getDictionary(),
    listCreators({ country, category, limit: 48 }),
  ]);

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      <DirectoryView role="creator" basePath="/creators" title={t.directoryPage.creatorsTitle} lede={t.directoryPage.creatorsLede}
        people={people} t={t} locale={locale} activeCountry={country} activeCategory={category} />
      <SiteFooter />
    </div>
  );
}
