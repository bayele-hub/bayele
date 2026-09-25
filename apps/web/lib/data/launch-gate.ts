import 'server-only';
import { unstable_cache } from 'next/cache';
import { createServiceClient } from '@bayele/database/server';
import {
  CREATOR_DIRECTORY_THRESHOLD,
  isCreatorDirectoryOpen,
  parseDirectoryOverride,
} from '@/lib/launch-gate';

/**
 * Registered creators = every account holding the `creator` role, whatever its moderation status
 * (the milestone counts sign-ups, not only approved profiles). Counted with the service role
 * because `user_roles` isn't readable by anonymous visitors under RLS. Cached for an hour so the
 * home page and directory never hit the database on every request. Returns null on any failure.
 */
const countRegisteredCreators = unstable_cache(
  async (): Promise<number | null> => {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
    try {
      const supabase = createServiceClient();
      const { count, error } = await supabase
        .from('user_roles')
        .select('user_id', { count: 'exact', head: true })
        .eq('role', 'creator');
      return error ? null : (count ?? 0);
    } catch {
      return null;
    }
  },
  ['registered-creator-count'],
  { revalidate: 3600 },
);

export interface CreatorDirectoryGate {
  open: boolean;
  count: number | null;
  threshold: number;
}

export async function getCreatorDirectoryGate(): Promise<CreatorDirectoryGate> {
  const override = parseDirectoryOverride(process.env.BAYELE_CREATOR_DIRECTORY);
  // Skip the query entirely when the directory is forced one way.
  const count = override ? null : await countRegisteredCreators();
  return {
    open: isCreatorDirectoryOpen(count, CREATOR_DIRECTORY_THRESHOLD, override),
    count,
    threshold: CREATOR_DIRECTORY_THRESHOLD,
  };
}
