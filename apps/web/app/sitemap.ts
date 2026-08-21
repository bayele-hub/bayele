import type { MetadataRoute } from 'next';
import { listCreators, listConsultants } from '@/lib/data/talent';
import { listPublicCampaignIds } from '@/lib/data/public-campaigns';

const BASE = 'https://bayele.com';

// Re-generate hourly so newly-approved talent enters the sitemap without a redeploy.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${BASE}/creators`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE}/consultants`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE}/legal`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
  ];

  // Each active profile and each shareable campaign is its own indexable page (directory + JobPosting
  // SEO). Best-effort: if a query fails we still return the static routes rather than a broken sitemap.
  let dynamic: MetadataRoute.Sitemap = [];
  try {
    const [creators, consultants, campaigns] = await Promise.all([
      listCreators({ limit: 500 }),
      listConsultants({ limit: 500 }),
      listPublicCampaignIds(500),
    ]);
    dynamic = [
      ...creators.map((c) => ({ url: `${BASE}/creators/${c.handle}`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.6 })),
      ...consultants.map((c) => ({ url: `${BASE}/consultants/${c.handle}`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.6 })),
      ...campaigns.map((c) => ({ url: `${BASE}/campaigns/${c.id}`, lastModified: new Date(c.createdAt), changeFrequency: 'daily' as const, priority: 0.7 })),
    ];
  } catch {
    dynamic = [];
  }

  return [...staticRoutes, ...dynamic];
}
