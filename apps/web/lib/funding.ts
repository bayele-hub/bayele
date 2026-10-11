// Funding confirmation core (F2/F3, FINEX incident 2026-10-11) — kept out of the 'use server' file so
// it can be unit-tested with a mocked Supabase client.
//   F2: `invoice_already_used` (ref already used by ANOTHER campaign, migration 0034) → its own error.
//   F3: « no error » is not proof: after the RPC, re-read the campaign status with the same client and
//       report success ONLY when it is published / in_progress.

export interface FundingErrors {
  invoiceAlreadyUsed: string;
  notPublished: string;
  missing: string;
  refRequired: string;
  notAuthorized: string;
  alreadyFunded: string;
  generic: string;
}

export type FundResult = { error: string | null; ok?: boolean; field?: 'invoice' | null };

type RpcError = { message?: string | null } | null;

/** The slice of the Supabase client this needs (rpc + one select), so tests can pass a fake. */
export interface FundingClient {
  rpc(fn: 'admin_confirm_campaign_funding', args: { p_campaign_id: string; p_sokoclick_invoice_id: string; p_provider: string }): PromiseLike<{ error: RpcError }>;
  from(table: 'campaigns'): {
    select(cols: 'status'): { eq(col: 'id', v: string): { maybeSingle(): PromiseLike<{ data: { status: string } | null; error: RpcError }> } };
  };
}

export const FUNDED_STATUSES = ['published', 'in_progress'] as const;

export function mapFundingError(err: RpcError, e: FundingErrors): FundResult {
  const msg = (err?.message ?? '').trim();
  if (msg === 'invoice_already_used') return { error: e.invoiceAlreadyUsed, field: 'invoice' };
  if (msg === 'not_authorized') return { error: e.notAuthorized };
  if (msg === 'campaign_not_fundable') return { error: e.alreadyFunded };
  return { error: e.generic };
}

export async function confirmFunding(
  client: FundingClient,
  input: { campaign: string; invoice: string; provider: string },
  e: FundingErrors,
): Promise<FundResult> {
  if (!input.campaign) return { error: e.missing };
  if (!input.invoice) return { error: e.refRequired, field: 'invoice' };
  const { error } = await client.rpc('admin_confirm_campaign_funding', {
    p_campaign_id: input.campaign,
    p_sokoclick_invoice_id: input.invoice,
    p_provider: input.provider,
  });
  if (error) return mapFundingError(error, e);
  // F3: re-read with the same (admin) client; anything but published / in_progress is a failure.
  const { data, error: readError } = await client.from('campaigns').select('status').eq('id', input.campaign).maybeSingle();
  if (readError || !data || !(FUNDED_STATUSES as readonly string[]).includes(data.status)) return { error: e.notPublished, field: 'invoice' };
  return { error: null, ok: true };
}
