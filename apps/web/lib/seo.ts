// Central SEO constants + schema.org JSON-LD builders. Used by the root layout (Organization +
// WebSite), the directories (ItemList + Breadcrumb) and public profiles (Person + Breadcrumb).
// NOTE: we intentionally do NOT emit aggregateRating — ratings aren't real user reviews yet, and a
// fabricated ratingCount violates Google's rich-results policy and can suppress the whole result.

export const SITE_URL = 'https://bayele.com';
export const SITE_NAME = 'Bayele';
export const SITE_SLOGAN = "L'influence marketing, sécurisée par séquestre.";
export const SITE_DESC =
  "La marketplace d'escrow pour Créateurs WhatsApp, Consultants Médias et Entreprises au Cameroun, en Côte d'Ivoire et au Gabon. Paiements Mobile Money, facturation OHADA.";

export const COUNTRY_NAME: Record<'CM' | 'CI' | 'GA', string> = {
  CM: 'Cameroun',
  CI: "Côte d'Ivoire",
  GA: 'Gabon',
};

type Json = Record<string, unknown>;

const ORG_ID = `${SITE_URL}/#organization`;
const WEBSITE_ID = `${SITE_URL}/#website`;

export function organizationLd(): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ORG_ID,
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/logo.jpeg`,
    image: `${SITE_URL}/opengraph-image`,
    description: SITE_DESC,
    slogan: SITE_SLOGAN,
    areaServed: Object.values(COUNTRY_NAME).map((name) => ({ '@type': 'Country', name })),
    knowsLanguage: ['fr', 'en'],
  };
}

export function websiteLd(): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    url: SITE_URL,
    name: SITE_NAME,
    description: SITE_DESC,
    inLanguage: 'fr-FR',
    publisher: { '@id': ORG_ID },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/creators?cat={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function breadcrumbLd(items: { name: string; path: string }[]): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: `${SITE_URL}${it.path}`,
    })),
  };
}

/** ItemList of directory entries — helps Google understand a directory as a list of profiles. */
export function itemListLd(items: { name: string; path: string }[]): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    numberOfItems: items.length,
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${SITE_URL}${it.path}`,
      name: it.name,
    })),
  };
}

export interface PersonLdInput {
  handle: string;
  displayName: string;
  bio?: string | null;
  avatarUrl?: string | null;
  city?: string;
  country?: 'CM' | 'CI' | 'GA';
  role: 'creator' | 'consultant';
  tags?: string[];
  path: string; // e.g. /creators/awa_beauty
}

// FCFA is two currencies: XOF (West Africa — Côte d'Ivoire) and XAF (Central Africa — Cameroon, Gabon).
export function currencyForCountry(country: 'CM' | 'CI' | 'GA'): 'XOF' | 'XAF' {
  return country === 'CI' ? 'XOF' : 'XAF';
}

export interface JobPostingLdInput {
  id: string;
  title: string;
  description: string;
  datePosted: string; // ISO
  country: 'CM' | 'CI' | 'GA';
  payoutFcfa: number;
  brandName: string;
  path: string; // e.g. /campaigns/<id>
  validThrough?: string | null; // ISO date (campaign posting deadline), optional
}

/**
 * schema.org JobPosting for a public campaign — the same structured data that powers job-listing rich
 * results (as for a LinkedIn job). Paid creator gig → CONTRACTOR, per-project compensation. We omit
 * validThrough (campaigns have no fixed close date; it's optional, only a Search Console warning).
 */
export function jobPostingLd(j: JobPostingLdInput): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    '@id': `${SITE_URL}${j.path}#jobposting`,
    title: j.title,
    description: j.description || j.title,
    datePosted: j.datePosted,
    ...(j.validThrough ? { validThrough: j.validThrough } : {}),
    employmentType: 'CONTRACTOR',
    directApply: true,
    url: `${SITE_URL}${j.path}`,
    hiringOrganization: {
      '@type': 'Organization',
      name: j.brandName,
      memberOf: { '@id': ORG_ID },
    },
    jobLocationType: 'TELECOMMUTE',
    applicantLocationRequirements: { '@type': 'Country', name: COUNTRY_NAME[j.country] },
    baseSalary: {
      '@type': 'MonetaryAmount',
      currency: currencyForCountry(j.country),
      value: {
        '@type': 'QuantitativeValue',
        value: j.payoutFcfa,
        unitText: 'PROJECT',
      },
    },
  };
}

export function personLd(p: PersonLdInput): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': `${SITE_URL}${p.path}#person`,
    url: `${SITE_URL}${p.path}`,
    name: p.displayName,
    alternateName: `@${p.handle}`,
    jobTitle: p.role === 'creator' ? 'Créateur de contenu' : 'Consultant média',
    ...(p.bio ? { description: p.bio } : {}),
    ...(p.avatarUrl ? { image: p.avatarUrl } : {}),
    ...(p.city
      ? {
          address: {
            '@type': 'PostalAddress',
            addressLocality: p.city,
            ...(p.country ? { addressCountry: p.country } : {}),
          },
        }
      : {}),
    ...(p.tags && p.tags.length ? { knowsAbout: p.tags } : {}),
    memberOf: { '@id': ORG_ID },
  };
}
