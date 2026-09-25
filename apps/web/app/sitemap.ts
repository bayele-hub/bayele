import type { MetadataRoute } from 'next';
import { listCreators, listConsultants } from '@/lib/data/talent';
import { listPublicCampaignIds } from '@/lib/data/public-campaigns';
import { getCreatorDirectoryGate } from '@/lib/data/launch-gate';

const BASE = 'https://bayele.com';

// Re-generate hourly so newly-approved talent enters the sitemap without a redeploy.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  // Creator profiles are unlisted until the launch milestone (lib/launch-gate.ts).
  const { open: creatorsListed } = await getCreatorDirectoryGate();
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
    ...(creatorsListed ? [{ url: `${BASE}/creators`, lastModified: now, changeFrequency: 'daily' as const, priority: 0.8 }] : []),
    { url: `${BASE}/partners`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE}/pricing`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/legal`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
  ];

  // Each listed profile and each shareable campaign is its own indexable page (directory + JobPosting
  // SEO). Best-effort: if a query fails we still return the static routes rather than a broken sitemap.
  let dynamic: MetadataRoute.Sitemap = [];
  try {
    const [creators, consultants, campaigns] = await Promise.all([
      creatorsListed ? listCreators({ limit: 500 }) : Promise.resolve([]),
      listConsultants({ limit: 500 }),
      listPublicCampaignIds(500),
    ]);
    dynamic = [
      ...creators.map((c) => ({ url: `${BASE}/creators/${c.handle}`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.6 })),
      ...consultants.map((c) => ({ url: `${BASE}/partners/${c.handle}`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.6 })),
      ...campaigns.map((c) => ({ url: `${BASE}/campaigns/${c.id}`, lastModified: new Date(c.createdAt), changeFrequency: 'daily' as const, priority: 0.7 })),
    ];
  } catch {
    dynamic = [];
  }

  return [...staticRoutes, ...dynamic];
}
