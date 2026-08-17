import Link from 'next/link';
import { SlidersHorizontal } from 'lucide-react';
import type { TalentSummary, CountryCode, Role } from '@/lib/data/talent';
import type { Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { CreatorCard, ConsultantCard } from '@/components/talent-cards';

const COUNTRIES: CountryCode[] = ['CM', 'CI', 'GA'];

function buildHref(base: string, params: { country?: string; cat?: string }): string {
  const sp = new URLSearchParams();
  if (params.country) sp.set('country', params.country);
  if (params.cat) sp.set('cat', params.cat);
  const qs = sp.toString();
  return qs ? `${base}?${qs}` : base;
}

const chip = (active: boolean) =>
  `whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition ${
    active ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink hover:border-brand hover:text-brand'
  }`;

export function DirectoryView({
  role, basePath, title, lede, people, t, locale, activeCountry, activeCategory,
}: {
  role: Role;
  basePath: string;
  title: string;
  lede: string;
  people: TalentSummary[];
  t: Dictionary;
  locale: Locale;
  activeCountry?: CountryCode;
  activeCategory?: string;
}) {
  const countLabel = (role === 'creator' ? t.directoryPage.creatorsCount : t.directoryPage.consultantsCount)
    .replace('{n}', String(people.length));
  const showCategories = role === 'creator';

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      {/* Header band */}
      <div className="rounded-3xl border border-line bg-surface px-6 py-8 sm:px-10">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          {title}<span className="brand-dot">.</span>
        </h1>
        <p className="mt-2 max-w-lg text-sm text-muted sm:text-base">{lede}</p>
      </div>

      {/* Filter bar */}
      <div className="mt-6 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 inline-flex items-center gap-1.5 text-[12px] font-semibold text-muted">
            <SlidersHorizontal className="h-3.5 w-3.5" /> {t.directoryPage.country}
          </span>
          <Link href={buildHref(basePath, { cat: activeCategory })} className={chip(!activeCountry)}>
            {t.directoryPage.allCountries}
          </Link>
          {COUNTRIES.map((c) => (
            <Link key={c} href={buildHref(basePath, { country: c, cat: activeCategory })} className={chip(activeCountry === c)}>
              {t.countries[c]}
            </Link>
          ))}
        </div>

        {showCategories && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-[12px] font-semibold text-muted">{t.directoryPage.category}</span>
            <Link href={buildHref(basePath, { country: activeCountry })} className={chip(!activeCategory)}>
              {t.directoryPage.allCategories}
            </Link>
            {t.categories.map((cat) => (
              <Link key={cat} href={buildHref(basePath, { country: activeCountry, cat })} className={chip(activeCategory === cat)}>
                {cat}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Count + reset */}
      <div className="mt-6 flex items-center justify-between">
        <p className="text-sm font-semibold text-ink">{countLabel}</p>
        {(activeCountry || activeCategory) && (
          <Link href={basePath} className="text-[13px] font-semibold text-brand hover:text-brand-600">
            {t.directoryPage.reset}
          </Link>
        )}
      </div>

      {/* Grid */}
      {people.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-line bg-surface px-4 py-16 text-center text-sm text-muted">
          {t.directoryPage.noResults}
        </div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {people.map((p) =>
            role === 'creator'
              ? <CreatorCard key={p.id} p={p} t={t} locale={locale} />
              : <ConsultantCard key={p.id} p={p} t={t} />,
          )}
        </div>
      )}
    </main>
  );
}
