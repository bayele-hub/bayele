'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getDictionary } from '@/i18n/dictionaries';
import { managedErrorMessage } from '@/lib/managed-errors';
import { isDeliverableType } from '@/lib/managed-listing';

export type FloorResult = { ok: true } | { ok: false; error: string };

/** K1: admin sets / clears a pay floor (min creator NET per unit). Auth + validation in the RPCs. */
export async function setPayFloorAction(type: string, value: number): Promise<FloorResult> {
  const { locale } = await getDictionary();
  if (!isDeliverableType(type)) return { ok: false, error: managedErrorMessage({ message: 'missing_fields' }, locale) };
  const amount = Math.floor(Number(value));
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: managedErrorMessage({ message: 'invalid_amount' }, locale) };
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_set_pay_floor', { p_deliverable_type: type, p_min_net_fcfa: amount });
  if (error) return { ok: false, error: managedErrorMessage(error, locale) };
  revalidatePath('/admin/pay-floors');
  revalidatePath('/admin/briefs');
  return { ok: true };
}

export async function clearPayFloorAction(type: string): Promise<FloorResult> {
  const { locale } = await getDictionary();
  if (!isDeliverableType(type)) return { ok: false, error: managedErrorMessage({ message: 'missing_fields' }, locale) };
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_clear_pay_floor', { p_deliverable_type: type });
  if (error) return { ok: false, error: managedErrorMessage(error, locale) };
  revalidatePath('/admin/pay-floors');
  revalidatePath('/admin/briefs');
  return { ok: true };
}
