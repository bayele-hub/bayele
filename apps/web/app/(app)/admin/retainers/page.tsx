import { redirect } from 'next/navigation';
import { Handshake } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import { RetainerAdminRow, type AdminRetainer } from './retainer-admin-row';
import { SettlementQueue, type SettlementRow } from './settlement-queue';
import { getDictionary } from '@/i18n/dictionaries';
import { providerLabel } from '@/lib/data/campaigns';

export const dynamic = 'force-dynamic';

export default async function AdminRetainers() {
  const session = await getSession();
  if (!session.userId) redirect('/auth?mode=signin');
  if (session.primary !== 'super_admin') redirect('/dashboard');

  const supabase = await createClient();
  const { data: retainers } = await supabase
    .from('agency_retainers')
    .select('id, status, partner_accepted_at, partner_declined_at, contract_value_fcfa, consultant_fee_fcfa, media_budget_fcfa, kpi_bonus_fcfa, created_at, business:profiles!agency_retainers_business_id_fkey(display_name), consultant:profiles!agency_retainers_consultant_id_fkey(display_name)')
    .order('created_at', { ascending: false })
    .limit(200);

  const pick = (v: unknown): string => {
    const o = v as { display_name: string } | { display_name: string }[] | null;
    const one = Array.isArray(o) ? o[0] : o;
    return one?.display_name ?? '—';
  };

  const rows: AdminRetainer[] = (retainers ?? []).map((r) => ({
    id: r.id,
    business: pick(r.business),
    consultant: pick(r.consultant),
    contract: r.contract_value_fcfa,
    consultantFee: r.consultant_fee_fcfa,
    mediaBudget: r.media_budget_fcfa,
    kpiBonus: r.kpi_bonus_fcfa,
    status: r.status,
    partnerAcceptedAt: r.partner_accepted_at ?? null,
    partnerDeclinedAt: r.partner_declined_at ?? null,
  }));

  // O7 settlements awaiting the admin's transfer confirmation.
  const { t } = await getDictionary();
  const { data: pendingSettlements } = await supabase.rpc('admin_retainer_settlements');
  const settlements: SettlementRow[] = (pendingSettlements ?? []).map((x) => ({
    id: x.id, kind: x.kind, amount: x.amount_fcfa, kept: x.bayele_fee_kept_fcfa, recipientName: x.recipient_name, recipientHandle: x.recipient_handle,
    phone: x.payout_phone, provider: x.payout_provider ? providerLabel(x.payout_provider) : null, providerId: x.payout_provider ?? null, contract: x.contract_value_fcfa, reason: x.reason,
  }));

  const toFund = rows.filter((r) => r.status === 'invoiced' && r.partnerAcceptedAt).length;

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Handshake className="h-5 w-5 text-brand" />
        <h2 className="text-sm font-bold text-ink">Rétainers agence</h2>
        {toFund > 0 && <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-white">{toFund} à financer</span>}
      </div>

      <SettlementQueue rows={settlements} S={t.admin.queues.settlements} />

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-line bg-white p-10 text-center text-sm text-muted">
          Aucun rétainer pour le moment.
        </div>
      ) : (
        <ul className="grid gap-3">
          {rows.map((r) => (
            <RetainerAdminRow key={r.id} r={r} R={t.retainers} Q={t.admin.queues} />
          ))}
        </ul>
      )}
    </section>
  );
}
