'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getDictionary } from '@/i18n/dictionaries';

export type RetainerActionState = { error: string | null; ok?: boolean; accepted?: boolean };

/**
 * O7 — the partner accepts or declines a proposed retainer (respond_retainer, 0035). The brand can't
 * invoice before acceptance; declining terminates it. Authorization (the caller is the retainer's
 * partner, the partner is active, the retainer awaits an answer) lives in the RPC; idempotent.
 */
export async function respondRetainerAction(_prev: RetainerActionState, formData: FormData): Promise<RetainerActionState> {
  const { t } = await getDictionary();
  const E = t.retainers.errors as Record<string, string>;
  const id = String(formData.get('retainer') ?? '');
  const accept = String(formData.get('accept') ?? '') === 'true';
  if (!id) return { error: E.generic! };

  const supabase = await createClient();
  const { error } = await supabase.rpc('respond_retainer', { p_retainer_id: id, p_accept: accept });
  if (error) {
    const code = (error.message ?? '').trim();
    return { error: E[code] ?? E.generic! };
  }

  revalidatePath('/partner/retainers');
  revalidatePath('/partner/dashboard');
  return { error: null, ok: true, accepted: accept };
}
