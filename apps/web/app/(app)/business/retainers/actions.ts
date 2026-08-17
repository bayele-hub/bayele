'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { SokoClickEngine, type Country } from '@bayele/sokoclick-sdk';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';

export type RetainerState = { error: string | null; ok?: boolean; paymentUrl?: string | null; mode?: 'sokoclick' | 'manual' };

/**
 * A business commissions a consultant with an agency retainer. Two DB hops, both RLS-safe:
 *   1) propose_retainer — self-scoped to the business (auth.uid()), validates the money split.
 *   2) attach_retainer_invoice — records the invoice id and flips draft → invoiced.
 * In between, per ADR-001, we ask SokoClick to generate the OHADA invoice (their infra). If SokoClick
 * isn't configured yet (no API key) or the call fails, we attach a MANUAL reference so the flow still
 * completes and the admin bridge / webhook can fund it — the launch pattern used across M6–M8.
 */
export async function createRetainerAction(_prev: RetainerState, formData: FormData): Promise<RetainerState> {
  const session = await getSession();
  if (!session.userId) redirect('/auth?mode=signin');

  const handle = String(formData.get('consultant') ?? '').trim().replace(/^@/, '');
  const contract = Math.round(Number(formData.get('contract') ?? 0));
  const cut = Math.round(Number(formData.get('cut') ?? 0));
  const fee = Math.round(Number(formData.get('fee') ?? 0));
  const media = Math.round(Number(formData.get('media') ?? 0));
  const kpi = Math.round(Number(formData.get('kpi') ?? 0));

  if (!handle) return { error: 'Indiquez le consultant (son identifiant @).' };
  if (contract <= 0) return { error: 'La valeur du contrat doit être positive.' };
  if (cut + fee + media !== contract) return { error: 'La répartition doit être égale à la valeur du contrat (commission + honoraires + média).' };

  const supabase = await createClient();

  // Resolve the consultant handle → id (public directory is readable under RLS).
  const { data: consultant } = await supabase.from('profiles').select('id').eq('handle', handle).maybeSingle();
  if (!consultant) return { error: 'Consultant introuvable. Vérifiez son identifiant.' };

  const { data: retainerId, error: proposeErr } = await supabase.rpc('propose_retainer', {
    p_consultant_id: consultant.id,
    p_contract_value: contract,
    p_bayele_cut: cut,
    p_consultant_fee: fee,
    p_media_budget: media,
    p_kpi_bonus: kpi,
  });

  if (proposeErr) {
    const msg = (proposeErr.message ?? '').trim();
    if (msg === 'not_a_business') return { error: 'Seules les marques peuvent lancer un rétainer.' };
    if (msg === 'profile_not_active') return { error: 'Votre profil doit être validé.' };
    if (msg === 'consultant_not_found') return { error: "Ce consultant n'est pas disponible." };
    if (msg === 'invalid_split') return { error: 'La répartition ne correspond pas à la valeur du contrat.' };
    if (msg === 'cannot_retain_self') return { error: 'Vous ne pouvez pas vous engager vous-même.' };
    return { error: 'La création a échoué. Réessayez.' };
  }

  // Generate the SokoClick invoice (their invoicing/bookkeeping infra). Graceful manual fallback.
  const [{ data: bizProfile }] = await Promise.all([
    supabase.from('business_profiles').select('company_name, billing_email, tax_id').eq('user_id', session.userId).maybeSingle(),
  ]);
  const country = (session.profile?.country ?? 'CM') as Country;

  let invoiceRef = `MANUAL-${retainerId}`;
  let paymentUrl: string | null = null;
  let mode: 'sokoclick' | 'manual' = 'manual';

  if (process.env.SOKOCLICK_API_KEY) {
    try {
      const soko = new SokoClickEngine();
      const invoice = await soko.createInvoice({
        business: {
          id: session.userId,
          companyName: bizProfile?.company_name ?? session.profile?.display_name ?? 'Bayele Business',
          email: bizProfile?.billing_email ?? session.email ?? '',
          taxId: bizProfile?.tax_id ?? undefined,
          country,
        },
        invoiceType: 'agency_retainer',
        items: [{ description: `Rétainer agence — @${handle}`, unitPriceFcfa: contract, quantity: 1 }],
        metadata: { retainerId, businessId: session.userId, invoiceType: 'agency_retainer' },
      });
      invoiceRef = invoice.id;
      paymentUrl = invoice.payment_url;
      mode = 'sokoclick';
    } catch {
      // Fall through to the manual reference — never block the business on a provider outage.
      invoiceRef = `MANUAL-${retainerId}`;
      mode = 'manual';
    }
  }

  const { error: attachErr } = await supabase.rpc('attach_retainer_invoice', {
    p_retainer_id: retainerId as string,
    p_sokoclick_invoice_id: invoiceRef,
  });
  if (attachErr) {
    // The retainer exists as a draft; surface a soft error but keep it recoverable from the list.
    revalidatePath('/business/retainers');
    return { error: "Le rétainer est créé, mais la facture n'a pas pu être attachée. Réessayez depuis la liste." };
  }

  revalidatePath('/business/retainers');
  return { error: null, ok: true, paymentUrl, mode };
}
