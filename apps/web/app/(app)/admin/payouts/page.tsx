import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import { PayoutQueue, type PayoutRow } from '../payout-queue';

export const dynamic = 'force-dynamic';

export default async function AdminPayouts() {
  const session = await getSession();
  if (!session.userId) redirect('/auth?mode=signin');

  const supabase = await createClient();
  const { data: payouts } = await supabase
    .from('escrow_transactions')
    .select(
      'amount_fcfa, campaign_creator_id, campaign:campaigns!escrow_transactions_campaign_id_fkey(title), cc:campaign_creators!escrow_transactions_campaign_creator_id_fkey(creator:profiles!campaign_creators_creator_id_fkey(display_name))',
    )
    .eq('direction', 'outbound')
    .eq('status', 'releasable')
    .order('updated_at', { ascending: true })
    .limit(200);

  const rows: PayoutRow[] = (payouts ?? [])
    .filter((p) => Boolean(p.campaign_creator_id))
    .map((p) => {
      const camp = p.campaign as { title: string } | { title: string }[] | null;
      const title = Array.isArray(camp) ? camp[0]?.title : camp?.title;
      const cc = p.cc as
        | { creator: { display_name: string } | { display_name: string }[] }
        | { creator: { display_name: string } | { display_name: string }[] }[]
        | null;
      const ccObj = Array.isArray(cc) ? cc[0] : cc;
      const creator = ccObj?.creator;
      const creatorName = Array.isArray(creator) ? creator[0]?.display_name : creator?.display_name;
      return {
        id: p.campaign_creator_id as string,
        creatorName: creatorName ?? 'Créateur',
        campaignTitle: title ?? 'Campagne',
        amount: p.amount_fcfa,
      };
    });

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-sm font-bold text-ink">Paiements créateurs</h2>
        <p className="mt-0.5 text-xs text-muted">
          Confirmez le décaissement Mobile Money vers le créateur pour les preuves validées (ADR-001 —
          les fonds quittent le séquestre une fois le paiement envoyé).
        </p>
      </div>
      <PayoutQueue rows={rows} />
    </section>
  );
}
