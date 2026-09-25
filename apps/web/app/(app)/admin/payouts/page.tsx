import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import { PayoutQueue, type PayoutRow } from '../payout-queue';
import { CommissionQueue, type CommissionRow } from '../commission-queue';
import { splitPayout } from '@/lib/founder';

export const dynamic = 'force-dynamic';

export default async function AdminPayouts() {
  const session = await getSession();
  if (!session.userId) redirect('/auth?mode=signin');

  const supabase = await createClient();
  const { data: payouts } = await supabase
    .from('escrow_transactions')
    .select(
      'amount_fcfa, campaign_creator_id, campaign:campaigns!escrow_transactions_campaign_id_fkey(title), cc:campaign_creators!escrow_transactions_campaign_creator_id_fkey(partner_commission_rate, creator:profiles!campaign_creators_creator_id_fkey(display_name), partner:profiles!campaign_creators_partner_id_fkey(display_name))',
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
      type Named = { display_name: string } | { display_name: string }[] | null;
      type CcEmbed = { partner_commission_rate: number | null; creator: Named; partner: Named };
      const cc = p.cc as CcEmbed | CcEmbed[] | null;
      const ccObj = Array.isArray(cc) ? cc[0] : cc;
      const name = (v: Named | undefined) => (Array.isArray(v) ? v[0]?.display_name : v?.display_name);
      // Managed deal: send the creator their net; the partner's share is booked for a separate payout.
      const split = splitPayout(p.amount_fcfa, ccObj?.partner_commission_rate);
      return {
        id: p.campaign_creator_id as string,
        creatorName: name(ccObj?.creator) ?? 'Créateur',
        campaignTitle: title ?? 'Campagne',
        amount: split.creator,
        gross: p.amount_fcfa,
        partnerName: split.partner > 0 ? (name(ccObj?.partner) ?? 'Partenaire') : undefined,
        partnerCommission: split.partner,
      };
    });

  const { data: commissions } = await supabase
    .from('partner_commissions')
    .select('id, commission_fcfa, commission_rate, gross_payout_fcfa, created_at, partner:profiles!partner_commissions_partner_id_fkey(display_name, phone_e164), creator:profiles!partner_commissions_creator_id_fkey(display_name), cc:campaign_creators!partner_commissions_campaign_creator_id_fkey(campaign:campaigns!campaign_creators_campaign_id_fkey(title))')
    .eq('status', 'owed')
    .order('created_at', { ascending: true })
    .limit(200);
  const one = <T,>(v: T | T[] | null | undefined): T | undefined => (Array.isArray(v) ? v[0] : (v ?? undefined));
  const commissionRows: CommissionRow[] = (commissions ?? []).map((c) => {
    const partner = one(c.partner as { display_name: string; phone_e164: string | null } | null);
    const cc = one(c.cc as { campaign: { title: string } | { title: string }[] | null } | null);
    return {
      id: c.id,
      partnerName: partner?.display_name ?? 'Partenaire',
      partnerPhone: partner?.phone_e164 ?? null,
      creatorName: one(c.creator as { display_name: string } | null)?.display_name ?? 'Créateur',
      campaignTitle: one(cc?.campaign)?.title ?? 'Campagne',
      amount: c.commission_fcfa,
      rate: c.commission_rate,
      gross: c.gross_payout_fcfa,
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

      <div className="pt-4">
        <h2 className="text-sm font-bold text-ink">Commissions partenaires</h2>
        <p className="mt-0.5 text-xs text-muted">
          Part des partenaires sur les missions de créateurs représentés, enregistrée au paiement du créateur.
          Envoyez le montant, puis confirmez avec la référence.
        </p>
      </div>
      <CommissionQueue rows={commissionRows} />
    </section>
  );
}
