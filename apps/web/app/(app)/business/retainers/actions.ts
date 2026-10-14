'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { SokoClickEngine, type Country } from '@bayele/sokoclick-sdk';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import { getDictionary } from '@/i18n/dictionaries';
import { fmtFcfa } from '@/lib/data/campaigns';
import { retainerSplit, splitIsBalanced } from '@/lib/retainers';
import { currentConsentRecorded } from '@/lib/gov/consent-check';
import { consentErrorMessage } from '@/lib/gov/rules';

export type RetainerState = { error: string | null; ok?: boolean; notAssigned?: boolean };

export type ConsultantLookup = { name: string | null; found: boolean };

/**
 * Resolve a consultant handle → display name for the retainer form, so the business sees who they're
 * about to commission before submitting. Only matches an ACTIVE consultant (same filter the directory
 * uses); RLS keeps the public directory readable. Returns found:false for anything else.
 */
export async function lookupConsultantAction(handleRaw: string): Promise<ConsultantLookup> {
  const handle = handleRaw.trim().replace(/^@/, '');
  if (!handle) return { name: null, found: false };

  const supabase = await createClient();
  const { data } = await supabase
    .from('profiles')
    .select('display_name, user_roles!inner(role)')
    .eq('handle', handle)
    .eq('user_roles.role', 'consultant')
    .eq('status', 'active')
    .maybeSingle();

  return { name: data?.display_name ?? null, found: Boolean(data) };
}

type RErrors = Record<string, string>;

async function retainerErrors(): Promise<RErrors> {
  const { t } = await getDictionary();
  return t.retainers.errors as RErrors;
}

/**
 * O7 step 1 — the brand proposes the retainer (draft). Bayele's cut is fixed server-side at 25 %
 * (propose_retainer ignores p_bayele_cut); fee + media must equal contract − floor(contract × 25 %).
 * The invoice is attached later, only once the partner has accepted (invoiceRetainerAction).
 */
export async function createRetainerAction(_prev: RetainerState, formData: FormData): Promise<RetainerState> {
  const session = await getSession();
  if (!session.userId) redirect('/auth?mode=signin');
  const E = await retainerErrors();

  const handle = String(formData.get('consultant') ?? '').trim().replace(/^@/, '');
  const contract = Math.round(Number(formData.get('contract') ?? 0));
  const fee = Math.round(Number(formData.get('fee') ?? 0));
  const media = Math.round(Number(formData.get('media') ?? 0));
  const kpi = Math.round(Number(formData.get('kpi') ?? 0));
  const split = retainerSplit(contract);

  if (!handle) return { error: 'Indiquez le partenaire (son identifiant @).' };
  if (!split) return { error: 'La valeur du contrat doit être positive.' };
  if (!splitIsBalanced(contract, fee, media)) return { error: E.invalid_split!.replace('{expected}', fmtFcfa(split.net)) };

  // PG-6: brands must have recorded the current non-circumvention version (my_consents); admins exempt.
  if (session.primary !== 'super_admin' && !(await currentConsentRecorded())) return { error: (await getDictionary()).t.consent.requiredError };

  const supabase = await createClient();
  const { data: consultant } = await supabase.from('profiles').select('id').eq('handle', handle).maybeSingle();
  if (!consultant) return { error: 'Partenaire introuvable. Vérifiez son identifiant.' };

  const { error: proposeErr } = await supabase.rpc('propose_retainer', {
    p_consultant_id: consultant.id,
    p_contract_value: contract,
    p_bayele_cut: split.cut, // ignored by the server (fixed 25 %); sent for the unchanged signature
    p_consultant_fee: fee,
    p_media_budget: media,
    p_kpi_bonus: kpi,
  });

  if (proposeErr) {
    const msg = (proposeErr.message ?? '').trim();
    if (msg === 'not_a_business') return { error: 'Seules les marques peuvent lancer un rétainer.' };
    if (msg === 'profile_not_active') return { error: 'Votre profil doit être validé.' };
    if (msg === 'consultant_not_found') return { error: "Ce partenaire n'est pas disponible." };
    if (msg === 'invalid_split') return { error: E.invalid_split!.replace('{expected}', proposeErr.details ? fmtFcfa(Number(proposeErr.details) || split.net) : fmtFcfa(split.net)) };
    if (msg === 'cannot_retain_self') return { error: 'Vous ne pouvez pas vous engager vous-même.' };
    // G3 (0040): retainers only to partners Bayele has introduced to this brand.
    if (msg === 'partner_not_assigned') return { error: (await getDictionary()).t.businessPartners.retainerNone, notAssigned: true };
    // PG-12 (0040): whose non-circumvention acknowledgement is missing ('brand' | 'partner').
    if (msg === 'consent_required') {
      const C = (await getDictionary()).t.consent;
      return { error: consentErrorMessage(msg, proposeErr.details, C) ?? C.requiredError };
    }
    return { error: E.generic! };
  }

  revalidatePath('/business/retainers');
  return { error: null, ok: true };
}

export type InvoiceState = { error: string | null; ok?: boolean; paymentUrl?: string | null; mode?: 'sokoclick' | 'manual' };

/**
 * O7 step 2 — after the partner accepted, the brand generates the invoice. SokoClick when configured
 * (ADR-001), else a MANUAL reference the admin funding bridge confirms. attach_retainer_invoice
 * refuses with `partner_not_accepted` before acceptance and `invoice_already_used` for a reused ref.
 */
export async function invoiceRetainerAction(_prev: InvoiceState, formData: FormData): Promise<InvoiceState> {
  const session = await getSession();
  if (!session.userId) redirect('/auth?mode=signin');
  const E = await retainerErrors();
  const retainerId = String(formData.get('retainer') ?? '');
  if (!retainerId) return { error: E.generic! };

  const supabase = await createClient();
  const { data: r } = await supabase
    .from('agency_retainers')
    .select('id, contract_value_fcfa, consultant:profiles!agency_retainers_consultant_id_fkey(handle)')
    .eq('id', retainerId)
    .maybeSingle();
  if (!r) return { error: E.generic! };
  const cons = r.consultant as { handle: string } | { handle: string }[] | null;
  const handle = (Array.isArray(cons) ? cons[0]?.handle : cons?.handle) ?? '';

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
        items: [{ description: `Rétainer agence — @${handle}`, unitPriceFcfa: r.contract_value_fcfa, quantity: 1 }],
        metadata: { retainerId, businessId: session.userId, invoiceType: 'agency_retainer' },
      });
      invoiceRef = invoice.id;
      paymentUrl = invoice.payment_url;
      mode = 'sokoclick';
    } catch {
      invoiceRef = `MANUAL-${retainerId}`;
      mode = 'manual';
    }
  }

  const { error } = await supabase.rpc('attach_retainer_invoice', { p_retainer_id: retainerId, p_sokoclick_invoice_id: invoiceRef });
  if (error) {
    const code = (error.message ?? '').trim();
    return { error: E[code] ?? E.generic! };
  }
  revalidatePath('/business/retainers');
  return { error: null, ok: true, paymentUrl, mode };
}
