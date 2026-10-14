import { redirect } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import { RefundQueue, type RefundRow } from '../refund-queue';
import { LeftoverQueue, type LeftoverRow } from '../leftover-queue';
import { getDictionary } from '@/i18n/dictionaries';

export const dynamic = 'force-dynamic';

type OwnerRel = { display_name: string } | { display_name: string }[] | null;
type CampRel =
  | { id: string; title: string; target_country: string; status: string; owner: OwnerRel }
  | { id: string; title: string; target_country: string; status: string; owner: OwnerRel }[]
  | null;

function one<T>(v: T | T[] | null): T | undefined {
  return Array.isArray(v) ? v[0] : (v ?? undefined);
}

export default async function AdminDisputes() {
  const session = await getSession();
  if (!session.userId) redirect('/auth?mode=signin');

  const supabase = await createClient();

  // The campaign pool (inbound escrow) still held or disputed → eligible to refund to the business.
  const { data: inbound } = await supabase
    .from('escrow_transactions')
    .select(
      'campaign_id, status, amount_fcfa, campaign:campaigns!escrow_transactions_campaign_id_fkey(id, title, target_country, status, owner:profiles!campaigns_owner_id_fkey(display_name))',
    )
    .eq('direction', 'inbound')
    .in('status', ['held', 'disputed'])
    .order('created_at', { ascending: true })
    .limit(200);

  // A campaign with any completed disbursement can't be fully refunded (v2 handles partials) → exclude.
  const { data: paid } = await supabase
    .from('escrow_transactions')
    .select('campaign_id')
    .eq('direction', 'outbound')
    .eq('status', 'paid_out')
    .limit(1000);
  const paidSet = new Set((paid ?? []).map((p) => p.campaign_id));

  // D9: pending leftover refunds of completed campaigns (confirmed through the same refund action).
  const { t } = await getDictionary();
  const { data: leftovers } = await supabase.rpc('admin_pending_leftover_refunds');
  const leftoverRows: LeftoverRow[] = (leftovers ?? []).map((l) => ({
    campaignId: l.campaign_id, title: l.campaign_title, owner: l.owner_name, managed: l.is_managed,
    used: l.used_net_fcfa, unused: l.unused_net_fcfa, feeBack: l.fee_returned_fcfa, refund: l.refund_fcfa,
  }));
  const leftoverIds = new Set(leftoverRows.map((l) => l.campaignId));

  const rows: RefundRow[] = (inbound ?? [])
    .filter((t) => !paidSet.has(t.campaign_id) && !leftoverIds.has(t.campaign_id))
    .map((t) => {
      const c = one(t.campaign as CampRel);
      const owner = one(c?.owner ?? null);
      return {
        id: t.campaign_id,
        title: c?.title ?? 'Campagne',
        company: owner?.display_name ?? '—',
        budget: t.amount_fcfa,
        country: c?.target_country ?? '',
        escrowStatus: t.status,
      };
    });

  return (
    <section className="space-y-4">
      <LeftoverQueue rows={leftoverRows} Q={t.admin.queues.leftover} />

      <div>
        <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
          <ShieldAlert className="h-4 w-4 text-brand" /> Litiges & remboursements
        </h2>
        <p className="mt-0.5 text-xs text-muted">
          Rembourser le séquestre d&apos;une campagne financée à la marque et l&apos;annuler (non-livraison,
          litige tranché en faveur de la marque). Indisponible si un créateur a déjà été payé.
        </p>
      </div>
      <RefundQueue rows={rows} />
    </section>
  );
}
