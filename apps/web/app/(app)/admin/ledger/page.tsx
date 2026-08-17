import { redirect } from 'next/navigation';
import { ArrowDownLeft, ArrowUpRight, Receipt } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import { fmtFcfa, ESCROW_STATUS_FR } from '@/lib/data/campaigns';

export const dynamic = 'force-dynamic';

const STATUS_CLASS: Record<string, string> = {
  held: 'bg-brand-50 text-brand-700',
  releasable: 'bg-accent-soft text-accent',
  paid_out: 'bg-emerald-50 text-emerald-700',
  proof_pending: 'bg-surface text-muted',
  pending: 'bg-surface text-muted',
  disputed: 'bg-rose-50 text-rose-600',
  refunding: 'bg-rose-50 text-rose-600',
  refunded: 'bg-surface text-muted',
};

const PROVIDER_FR: Record<string, string> = {
  mtn_momo: 'MTN MoMo',
  orange_money: 'Orange Money',
  wave: 'Wave',
  airtel_money: 'Airtel Money',
  bank_wire: 'Virement',
};

export default async function AdminLedger() {
  const session = await getSession();
  if (!session.userId) redirect('/auth?mode=signin');

  const supabase = await createClient();
  const { data: txns } = await supabase
    .from('escrow_transactions')
    .select(
      'id, direction, status, amount_fcfa, fee_fcfa, net_amount_fcfa, provider, provider_ref, created_at, campaign:campaigns!escrow_transactions_campaign_id_fkey(title), recipient:profiles!escrow_transactions_recipient_profile_id_fkey(display_name)',
    )
    .order('created_at', { ascending: false })
    .limit(300);

  const rows = txns ?? [];

  return (
    <section className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
          <Receipt className="h-4 w-4 text-brand" /> Registre du séquestre
        </h2>
        <p className="mt-0.5 text-xs text-muted">
          Chaque mouvement de fonds, en lecture seule. Les entrées (financement) et sorties (paiements)
          transitent par le séquestre Bayele (ADR-001).
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-line bg-white p-10 text-center text-sm text-muted">
          Aucun mouvement pour le moment.
        </div>
      ) : (
        <ul className="grid gap-3">
          {rows.map((t) => {
            const inbound = t.direction === 'inbound';
            const camp = t.campaign as { title: string } | { title: string }[] | null;
            const title = Array.isArray(camp) ? camp[0]?.title : camp?.title;
            const rec = t.recipient as { display_name: string } | { display_name: string }[] | null;
            const recipient = Array.isArray(rec) ? rec[0]?.display_name : rec?.display_name;
            return (
              <li key={t.id} className="rounded-2xl border border-line bg-white p-4 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                        inbound ? 'bg-brand-50 text-brand' : 'bg-emerald-50 text-emerald-600'
                      }`}
                    >
                      {inbound ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-bold text-ink">{title ?? 'Campagne'}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {inbound ? 'Financement' : `Paiement → ${recipient ?? 'créateur'}`} · {PROVIDER_FR[t.provider] ?? t.provider}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-display font-extrabold text-ink">{fmtFcfa(t.amount_fcfa)}</span>
                    <div className={`mt-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_CLASS[t.status] ?? 'bg-surface text-muted'}`}>
                      {ESCROW_STATUS_FR[t.status] ?? t.status}
                    </div>
                  </div>
                </div>
                {inbound && t.fee_fcfa > 0 && (
                  <div className="mt-3 flex items-center justify-between border-t border-line pt-2 text-[11px] text-muted">
                    <span>Commission {fmtFcfa(t.fee_fcfa)}</span>
                    <span>Net séquestre {fmtFcfa(t.net_amount_fcfa)}</span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
