import 'server-only';
import { getSession } from '@/lib/auth/session';
import type { CampaignViewer, ViewerRole } from '@/lib/auth/campaign-ctas';

/** The current request's viewer, in the shape campaign-ctas expects. */
export async function getCampaignViewer(): Promise<CampaignViewer> {
  const s = await getSession();
  return {
    userId: s.userId,
    primary: (s.primary as ViewerRole | null) ?? null,
    handle: s.profile?.handle ?? null,
    status: s.profile?.status ?? null,
    country: s.profile?.country ?? null,
  };
}
