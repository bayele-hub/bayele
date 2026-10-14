'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getDictionary } from '@/i18n/dictionaries';
import { mapCode } from '@/lib/gov/rules';

/** P3 « Demander la fin » (partner → admin): reason 1–300, one open request per assignment. */
export async function requestAssignmentEndAction(assignmentId: string, reason: string): Promise<{ ok: boolean; error?: string }> {
  const { t } = await getDictionary();
  const E = t.partnerAssignments.errors as Record<string, string>;
  const why = (reason ?? '').trim();
  if (!why) return { ok: false, error: E.reason_required };
  if (why.length > 300) return { ok: false, error: E.reason_too_long };
  const supabase = await createClient();
  const { error } = await supabase.rpc('request_assignment_end', { p_assignment_id: assignmentId, p_reason: why });
  if (error) return { ok: false, error: mapCode(E, error.message, E.generic!) };
  revalidatePath('/partner/assignments');
  return { ok: true };
}
