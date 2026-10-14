import { createClient } from '@/lib/supabase/server';
import { NON_CIRCUMVENTION_VERSION } from '@/lib/legal';
import { hasCurrentConsent } from '@/lib/gov/rules';

/**
 * PG-6: server-side check that the caller recorded the CURRENT non-circumvention version, via the
 * contract's my_consents() RPC. Fails closed: an unreadable result counts as « not recorded ».
 */
export async function currentConsentRecorded(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('my_consents');
    if (error || !data) return false;
    return hasCurrentConsent(data, NON_CIRCUMVENTION_VERSION);
  } catch {
    return false;
  }
}
