import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { CountryCode } from '@/lib/countries';

export interface MyAlert {
  id: string;
  country: CountryCode | null;
  category: string | null;
  createdAt: string;
}

/** Fallback only if campaign_alert_limit() can't be read; the server enforces its own cap (C5 = 5). */
const DEFAULT_ALERT_LIMIT = 5;

/** The signed-in user's alerts + the per-user cap. Null when it can't be read (render no list). */
export async function getMyAlerts(): Promise<{ alerts: MyAlert[]; limit: number } | null> {
  try {
    const supabase = await createClient();
    const [{ data, error }, { data: limit }] = await Promise.all([supabase.rpc('my_campaign_alerts'), supabase.rpc('campaign_alert_limit')]);
    if (error || !data) return null;
    return {
      alerts: data.map((a) => ({ id: a.id, country: a.country ?? null, category: a.category ?? null, createdAt: a.created_at })),
      limit: typeof limit === 'number' && limit > 0 ? limit : DEFAULT_ALERT_LIMIT,
    };
  } catch {
    return null;
  }
}

/** How many sign-ups name the caller as referrer (C3: a count only). 0 on any error. */
export async function getMyReferralCount(): Promise<number> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('my_referral_count');
    return !error && typeof data === 'number' ? data : 0;
  } catch {
    return 0;
  }
}
