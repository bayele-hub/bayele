'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@bayele/database';
import { getDictionary } from '@/i18n/dictionaries';
import { fmtFcfa, parseProvider } from '@/lib/data/campaigns';

type RetainerStatus = Database['public']['Enums']['retainer_status'];

export type AdminRetainerState = { error: string | null; ok?: boolean };

const TRANSITIONS: RetainerStatus[] = ['active', 'completed', 'terminated'];

// Codes added by 0035 (O7/O8/A3) → copy. Older codes keep their existing French text.
async function mapError(code: string): Promise<string> {
  const { t } = await getDictionary();
  const Q = t.admin.queues;
  const R = t.retainers.errors as Record<string, string>;
  switch (code) {
    case 'not_authorized':
      return "Vous n'êtes pas autorisé.";
    case 'not_invoiced':
      return "Ce rétainer n'a pas encore de facture.";
    case 'partner_not_accepted':
      return R.partner_not_accepted!;
    case 'owner_not_active':
      return Q.ownerNotActive;
    case 'invoice_already_used':
      return R.invoice_already_used!;
    case 'funding_not_recorded':
      return 'Le financement n’a pas été enregistré : le rétainer n’est pas financé. Vérifiez la référence et réessayez.';
    case 'retainer_terminated':
      return 'Ce rétainer est annulé.';
    case 'retainer_funded_use_settlement':
      return R.retainer_funded_use_settlement!;
    case 'illegal_retainer_transition':
      return 'Transition non permise depuis cet état.';
    default:
      return "L'action a échoué. Réessayez.";
  }
}

function revalidate() {
  revalidatePath('/admin/retainers');
  revalidatePath('/admin/payouts');
  revalidatePath('/admin/ledger');
}

/** Admin confirms the retainer invoice was paid (MoMo bridge) → funded. Idempotent in the RPC. */
export async function fundRetainerAction(_prev: AdminRetainerState, formData: FormData): Promise<AdminRetainerState> {
  const id = String(formData.get('retainer') ?? '');
  const receipt = String(formData.get('receipt') ?? '').trim() || undefined;
  if (!id) return { error: 'Rétainer manquant.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_confirm_retainer_funding', { p_retainer_id: id, p_sokoclick_receipt_id: receipt });
  if (error) return { error: await mapError((error.message ?? '').trim()) };
  revalidate();
  return { error: null, ok: true };
}

/** funded→active, active→completed (completion creates the partner payout settlement), draft/invoiced→terminated. */
export async function retainerTransitionAction(_prev: AdminRetainerState, formData: FormData): Promise<AdminRetainerState> {
  const id = String(formData.get('retainer') ?? '');
  const to = String(formData.get('to') ?? '') as RetainerStatus;
  if (!id) return { error: 'Rétainer manquant.' };
  if (!TRANSITIONS.includes(to)) return { error: 'Transition invalide.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('transition_retainer', { p_retainer_id: id, p_to_status: to });
  if (error) return { error: await mapError((error.message ?? '').trim()) };
  revalidate();
  return { error: null, ok: true };
}

/**
 * O7 early end of a funded/active retainer: admin_terminate_retainer creates the settlement(s) —
 * partner payout p (0 ≤ p ≤ net) and the brand refund contract − p − floor(cut × p / net).
 */
export async function terminateRetainerAction(_prev: AdminRetainerState, formData: FormData): Promise<AdminRetainerState> {
  const { t } = await getDictionary();
  const E = t.admin.queues.terminate.errors;
  const id = String(formData.get('retainer') ?? '');
  const payout = Math.floor(Number(String(formData.get('payout') ?? '').replace(/\s/g, '')));
  const reason = String(formData.get('reason') ?? '').trim();
  const net = Number(formData.get('net') ?? 0);
  if (!id) return { error: E.generic };
  if (!reason) return { error: E.reason_required };
  if (reason.length > 500) return { error: E.reason_too_long };
  if (!Number.isFinite(payout) || payout < 0 || (net > 0 && payout > net)) return { error: E.invalid_amount.replace('{net}', fmtFcfa(net)) };
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_terminate_retainer', { p_retainer_id: id, p_partner_payout_fcfa: payout, p_reason: reason });
  if (error) {
    const code = (error.message ?? '').trim() as keyof typeof E;
    return { error: code === 'invalid_amount' ? E.invalid_amount.replace('{net}', fmtFcfa(net)) : (E[code] ?? E.generic) };
  }
  revalidate();
  return { error: null, ok: true };
}

/** Confirms one settlement (partner payout or brand refund) with the exact transfer reference. Idempotent. */
export async function confirmSettlementAction(_prev: AdminRetainerState, formData: FormData): Promise<AdminRetainerState> {
  const { t } = await getDictionary();
  const E = t.admin.queues.settlements.errors;
  const id = String(formData.get('settlement') ?? '');
  const ref = String(formData.get('ref') ?? '').trim();
  const providerRaw = formData.get('provider');
  if (!id) return { error: E.generic };
  if (!ref) return { error: E.ref_required };
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_confirm_retainer_settlement', {
    p_settlement_id: id,
    p_provider: providerRaw ? parseProvider(providerRaw) : undefined,
    p_disbursement_ref: ref,
  });
  if (error) {
    const code = (error.message ?? '').trim() as keyof typeof E;
    return { error: E[code] ?? E.generic };
  }
  revalidate();
  return { error: null, ok: true };
}
