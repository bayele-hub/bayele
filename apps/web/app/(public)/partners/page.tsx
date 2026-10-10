import type { Metadata } from 'next';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { DirectoryView } from '@/components/directory-view';
import { JsonLd } from '@/components/json-ld';
import { getDictionary } from '@/i18n/dictionaries';
import { listConsultants } from '@/lib/data/talent';
import { isCountryCode } from '@/lib/countries';
import { itemListLd, breadcrumbLd, COUNTRY_NAME, SITE_NAME } from '@/lib/seo';


export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ country?: string }>;
}): Promise<Metadata> {
  const [{ t }, sp] = await Promise.all([getDictionary(), searchParams]);
  const country = isCountryCode(sp.country) ? sp.country : undefined;
  const title = country ? `Consultants · ${COUNTRY_NAME[country]}` : t.directoryPage.consultantsTitle;
  const description = t.directoryPage.consultantsLede;
  return {
    title,
    description,
    alternates: { canonical: '/partners' },
    openGraph: { type: 'website', title: `${title} · ${SITE_NAME}`, description, url: '/partners' },
  };
}

export default async function ConsultantsPage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string }>;
}) {
  const sp = await searchParams;
  const country = isCountryCode(sp.country) ? sp.country : undefined;

  const [{ locale, t }, people] = await Promise.all([
    getDictionary(),
    listConsultants({ country, limit: 48 }),
  ]);

  return (
    <div className="min-h-screen bg-white">
      <JsonLd
        data={[
          itemListLd(people.map((p) => ({ name: p.displayName, path: `/partners/${p.handle}` }))),
          breadcrumbLd([
            { name: 'Accueil', path: '/' },
            { name: 'Partenaires', path: '/partners' },
          ]),
        ]}
      />
      <SiteHeader />
      <DirectoryView role="consultant" basePath="/partners" title={t.directoryPage.consultantsTitle} lede={t.directoryPage.consultantsLede}
        people={people} t={t} locale={locale} activeCountry={country} />
      <SiteFooter />
    </div>
  );
}
