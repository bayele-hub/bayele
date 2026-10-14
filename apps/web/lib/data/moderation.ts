import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { parseModerationStatus, type MyModerationStatus } from '@/lib/moderation-status';

/** The signed-in member's own moderation view (my_moderation_status). null = unavailable. */
export async function getMyModerationStatus(): Promise<MyModerationStatus | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('my_moderation_status');
    if (error || !data) return null;
    return parseModerationStatus(data);
  } catch {
    return null;
  }
}

/** Own phone + account email (get_my_contact, 0035): profiles.phone_e164 is no longer selectable. */
export async function getMyContact(): Promise<{ phone: string | null; email: string | null }> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.rpc('get_my_contact');
    const row = data?.[0];
    return { phone: row?.phone_e164 ?? null, email: row?.email ?? null };
  } catch {
    return { phone: null, email: null };
  }
}
