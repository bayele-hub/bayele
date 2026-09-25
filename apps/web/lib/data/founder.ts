import 'server-only';
import { unstable_cache } from 'next/cache';
import { createServiceClient } from '@bayele/database/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Founder places left (public, cached for an hour like the launch gate). Uses the service client
 * because unstable_cache can't read cookies; the RPC itself is anon-callable and returns only two
 * integers. Returns null on any failure so the UI never shows an invented number.
 */
export const getFounderRemaining = unstable_cache(
  async (): Promise<number | null> => {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
    try {
      const supabase = createServiceClient();
      const { data, error } = await supabase.rpc('founder_badge_stats').maybeSingle();
      if (error || !data) return null;
      return data.remaining;
    } catch {
      return null;
    }
  },
  ['founder-badge-remaining'],
  { revalidate: 3600 },
);

/** The signed-in (or any visible) creator's founder number, or null. RLS decides visibility. */
export async function getFounderNumber(userId: string): Promise<number | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.from('founder_creators').select('founder_number').eq('user_id', userId).maybeSingle();
    return data?.founder_number ?? null;
  } catch {
    return null;
  }
}
