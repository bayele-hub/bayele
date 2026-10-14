'use server';

import { createClient } from '@/lib/supabase/server';
import { NON_CIRCUMVENTION_VERSION } from '@/lib/legal';

/** G7 one-time acknowledgement: record_consent('cgu_non_circumvention', current version). */
export async function recordNonCircumventionAction(): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('record_consent', { p_kind: 'cgu_non_circumvention', p_version: NON_CIRCUMVENTION_VERSION });
  return { ok: !error };
}
