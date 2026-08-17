import type { MetadataRoute } from 'next';
import { listCreators, listConsultants } from '@/lib/data/talent';

const BASE = 'https://bayele.com';

// Re-generate hourly so newly-approved talent enters the sitemap without a redeploy.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${BASE}/creators`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE}/consultants`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE}/legal`, changeFrequency: 'monthly', priority: 0.3 },
  ];

  // Each active creator/consultant profile is its own indexable page (directory SEO). Best-effort:
  // if the directory query fails we still return the static routes rather than a broken sitemap.
  let profiles: MetadataRoute.Sitemap = [];
  try {
    const [creators, consultants] = await Promise.all([
      listCreators({ limit: 500 }),
      listConsultants({ limit: 500 }),
    ]);
    profiles = [
      ...creators.map((c) => ({ url: `${BASE}/creators/${c.handle}`, changeFrequency: 'weekly' as const, priority: 0.6 })),
      ...consultants.map((c) => ({ url: `${BASE}/consultants/${c.handle}`, changeFrequency: 'weekly' as const, priority: 0.6 })),
    ];
  } catch {
    profiles = [];
  }

  return [...staticRoutes, ...profiles];
}
