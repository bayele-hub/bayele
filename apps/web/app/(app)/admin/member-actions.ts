'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getDictionary } from '@/i18n/dictionaries';
import { REVEAL_FIELDS, validateDecision, type DecisionAction, type FixField, type ReasonCode, type RevealField } from '@/lib/admin-members';

export type DecisionResult = { ok: true; action: DecisionAction } | { ok: false; error: string };

/**
 * admin_moderate_member (D4). The same rules are validated here first (lib/admin-members.ts) so a bad
 * submit never reaches the RPC; the RPC re-checks everything (admin, transitions, reason codes) and
 * sends the member ONE in-app notification with the plain-language reason + message.
 */
export async function moderateMemberAction(input: {
  userId: string;
  action: string;
  reasonCode?: string | null;
  message?: string | null;
  note?: string | null;
  fields?: string[] | null;
}): Promise<DecisionResult> {
  const { t } = await getDictionary();
  const E = t.admin.members.errors;
  const bad = validateDecision(input);
  if (bad) return { ok: false, error: E[bad] };
  const action = input.action as DecisionAction;
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_moderate_member', {
    p_user_id: input.userId,
    p_action: action,
    p_reason_code: (input.reasonCode || undefined) as ReasonCode | undefined,
    p_message: input.message?.trim() || undefined,
    p_internal_note: input.note?.trim() || undefined,
    p_fields: action === 'request_changes' ? ((input.fields ?? []) as FixField[]) : undefined,
  });
  if (error) {
    const code = (error.message ?? '').trim() as keyof typeof E;
    return { ok: false, error: E[code] ?? E.generic };
  }
  revalidatePath('/admin/users');
  revalidatePath(`/admin/users/${input.userId}`);
  revalidatePath('/admin/dashboard');
  return { ok: true, action };
}

export type RevealResult = { ok: true; value: string | null } | { ok: false; error: string };

/**
 * admin_reveal_member_field (D2/D3): one value, logged server-side every time with the reason (never
 * the value). The value is returned to this one render only — nothing caches it.
 */
export async function revealMemberFieldAction(userId: string, field: string, reason: string): Promise<RevealResult> {
  const { t } = await getDictionary();
  const L = t.admin.members;
  if (!(REVEAL_FIELDS as string[]).includes(field)) return { ok: false, error: L.revealError };
  const why = reason.trim();
  if (!why) return { ok: false, error: L.revealReason };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_reveal_member_field', { p_user_id: userId, p_field: field as RevealField, p_reason: why.slice(0, 500) });
  if (error) return { ok: false, error: L.revealError };
  return { ok: true, value: data ?? null };
}
