import 'server-only';
import { createClient } from '@/lib/supabase/server';

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
