import type { Metadata } from 'next';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { DirectoryView } from '@/components/directory-view';
import { CuratedAccess } from '@/components/curated-access';
import { JsonLd } from '@/components/json-ld';
import { getDictionary } from '@/i18n/dictionaries';
import { getSession } from '@/lib/auth/session';
import { landingCtaHrefs } from '@/lib/auth/landing-ctas';
import { getCreatorDirectoryGate } from '@/lib/data/launch-gate';
import { listCreators, type CountryCode } from '@/lib/data/talent';
import { itemListLd, breadcrumbLd, COUNTRY_NAME, SITE_NAME } from '@/lib/seo';

const COUNTRIES: CountryCode[] = ['CM', 'CI', 'GA'];

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ country?: string; cat?: string }>;
}): Promise<Metadata> {
  const [{ t }, sp, gate] = await Promise.all([getDictionary(), searchParams, getCreatorDirectoryGate()]);
  // Until launch the directory is unlisted: a curated-access page that must not be indexed.
  if (!gate.open) {
    return {
      title: t.curated.title,
      description: t.curated.body,
      alternates: { canonical: '/creators' },
      robots: { index: false, follow: true },
    };
  }
  const country = COUNTRIES.includes(sp.country as CountryCode) ? (sp.country as CountryCode) : undefined;
  const parts = [sp.cat, country ? COUNTRY_NAME[country] : undefined].filter(Boolean);
  // Filter-tuned title for relevance; canonical consolidates to the base directory.
  const title = parts.length ? `Créateurs ${parts.join(' · ')}` : t.directoryPage.creatorsTitle;
  const description = t.directoryPage.creatorsLede;
  return {
    title,
    description,
    alternates: { canonical: '/creators' },
    openGraph: { type: 'website', title: `${title} · ${SITE_NAME}`, description, url: '/creators' },
  };
}

export default async function CreatorsPage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string; cat?: string }>;
}) {
  const [sp, gate] = await Promise.all([searchParams, getCreatorDirectoryGate()]);

  if (!gate.open) {
    const [{ t }, session] = await Promise.all([getDictionary(), getSession()]);
    const authed = !!session.userId;
    return (
      <div className="min-h-screen bg-white">
        <SiteHeader />
        <CuratedAccess t={t} cta={landingCtaHrefs(authed)} authed={authed} />
        <SiteFooter />
      </div>
    );
  }

  const country = COUNTRIES.includes(sp.country as CountryCode) ? (sp.country as CountryCode) : undefined;
  const category = sp.cat || undefined;

  const [{ locale, t }, people] = await Promise.all([
    getDictionary(),
    listCreators({ country, category, limit: 48 }),
  ]);

  return (
    <div className="min-h-screen bg-white">
      <JsonLd
        data={[
          itemListLd(people.map((p) => ({ name: p.displayName, path: `/creators/${p.handle}` }))),
          breadcrumbLd([
            { name: 'Accueil', path: '/' },
            { name: 'Créateurs', path: '/creators' },
          ]),
        ]}
      />
      <SiteHeader />
      <DirectoryView role="creator" basePath="/creators" title={t.directoryPage.creatorsTitle} lede={t.directoryPage.creatorsLede}
        people={people} t={t} locale={locale} activeCountry={country} activeCategory={category} />
      <SiteFooter />
    </div>
  );
}
