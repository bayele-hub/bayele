import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Wallet, Coins, Clock, Smartphone, CheckCircle2, ArrowUpRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import { fmtFcfa, ESCROW_STATUS_FR } from '@/lib/data/campaigns';

export const dynamic = 'force-dynamic';

const PROVIDER_FR: Record<string, string> = {
  mtn_momo: 'MTN MoMo',
  orange_money: 'Orange Money',
  wave: 'Wave',
  airtel_money: 'Airtel Money',
  bank_wire: 'Virement',
};
const STATUS_CLASS: Record<string, string> = {
  paid_out: 'bg-emerald-50 text-emerald-700',
  releasable: 'bg-brand-50 text-brand-700',
  proof_pending: 'bg-accent-soft text-accent',
  held: 'bg-surface text-muted',
  pending: 'bg-surface text-muted',
  disputed: 'bg-rose-50 text-rose-600',
};

export default async function CreatorWallet() {
  const session = await getSession();
  if (!session.userId) redirect('/auth?mode=signin');

  const supabase = await createClient();
  const [{ data: txns }, { data: profile }] = await Promise.all([
    supabase
      .from('escrow_transactions')
      .select('id, status, amount_fcfa, net_amount_fcfa, provider, created_at, campaign:campaigns!escrow_transactions_campaign_id_fkey(title)')
      .eq('recipient_profile_id', session.userId)
      .eq('direction', 'outbound')
      .order('created_at', { ascending: false })
      .limit(200),
    // momo payout columns are not directly selectable (PII lockdown, migration 0018) — read own via the definer RPC.
    supabase.rpc('get_my_payout_settings').maybeSingle(),
  ]);

  const rows = txns ?? [];
  const paidOut = rows.filter((t) => t.status === 'paid_out').reduce((s, t) => s + (t.net_amount_fcfa ?? 0), 0);
  const releasable = rows.filter((t) => t.status === 'releasable').reduce((s, t) => s + (t.net_amount_fcfa ?? 0), 0);
  const inFlight = rows.filter((t) => t.status === 'proof_pending' || t.status === 'held').reduce((s, t) => s + (t.net_amount_fcfa ?? 0), 0);
  const momo = profile?.momo_payout_phone_e164;

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-2">
        <Wallet className="h-5 w-5 text-brand" />
        <h1 className="font-display text-xl font-extrabold text-ink">Portefeuille</h1>
      </div>

      {/* Balance hero */}
      <div className="rounded-2xl border border-line bg-gradient-to-br from-brand-50 via-white to-accent-soft p-5 shadow-card">
        <p className="text-xs font-semibold text-muted">Total encaissé</p>
        <p className="mt-1 font-display text-3xl font-extrabold text-ink">{fmtFcfa(paidOut)}</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Mini icon={CheckCircle2} label="Prêt à décaisser" value={fmtFcfa(releasable)} />
          <Mini icon={Clock} label="En cours" value={fmtFcfa(inFlight)} />
        </div>
      </div>

      {/* MoMo payout destination */}
      <div className="rounded-2xl border border-line bg-white p-4 shadow-card">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand">
              <Smartphone className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-semibold text-muted">Numéro Mobile Money</p>
              {momo ? (
                <p className="font-bold text-ink">{momo} · {PROVIDER_FR[profile?.momo_provider ?? 'mtn_momo'] ?? 'MoMo'}</p>
              ) : (
                <p className="text-sm font-semibold text-accent">Non configuré</p>
              )}
            </div>
          </div>
          <Link href="/profile" className="inline-flex min-h-tap items-center rounded-xl border border-line px-3 text-xs font-bold text-ink transition hover:border-brand hover:text-brand">
            {momo ? 'Modifier' : 'Ajouter'}
          </Link>
        </div>
        {!momo && (
          <p className="mt-2 rounded-lg bg-accent-soft/60 px-3 py-2 text-[11px] text-accent">
            Ajoutez votre numéro Mobile Money pour recevoir vos paiements.
          </p>
        )}
      </div>

      {/* History */}
      <div>
        <h2 className="mb-3 text-sm font-bold text-ink">Historique des paiements</h2>
        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-white p-10 text-center text-sm text-muted">
            Aucun paiement pour le moment. Terminez une mission pour être payé.
          </div>
        ) : (
          <ul className="grid gap-3">
            {rows.map((t) => {
              const camp = t.campaign as { title: string } | { title: string }[] | null;
              const title = Array.isArray(camp) ? camp[0]?.title : camp?.title;
              const done = t.status === 'paid_out';
              return (
                <li key={t.id} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-white p-4 shadow-card">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${done ? 'bg-emerald-50 text-emerald-600' : 'bg-surface text-muted'}`}>
                      {done ? <ArrowUpRight className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-bold text-ink">{title ?? 'Campagne'}</p>
                      <p className="text-[11px] text-muted">{PROVIDER_FR[t.provider] ?? t.provider}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-display font-extrabold text-ink">{fmtFcfa(t.net_amount_fcfa)}</span>
                    <div className={`mt-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_CLASS[t.status] ?? 'bg-surface text-muted'}`}>
                      {ESCROW_STATUS_FR[t.status] ?? t.status}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

function Mini({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-white/70 p-3">
      <Icon className="h-4 w-4 text-brand" />
      <div className="mt-1 font-display text-sm font-extrabold text-ink">{value}</div>
      <div className="text-[10px] text-muted">{label}</div>
    </div>
  );
}
