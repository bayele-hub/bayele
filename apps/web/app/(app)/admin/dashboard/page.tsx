import { redirect } from 'next/navigation';
import { ShieldCheck, Clock, Users, Wallet, Send } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import { ModerationQueue, type PendingRow } from '../moderation-queue';
import { FundingQueue, type FundingRow } from '../funding-queue';
import { PayoutQueue, type PayoutRow } from '../payout-queue';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  const session = await getSession();
  if (!session.userId) redirect('/auth?mode=signin');
  // Admin-only. RLS would block the data anyway, but bounce non-admins out of the UI too.
  if (session.primary !== 'super_admin') redirect('/dashboard');

  const supabase = await createClient();

  const [{ data: pending }, { data: funding }, { data: payouts }, pendingCount, activeCount] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, handle, display_name, city, country, created_at, user_roles(role)')
      .eq('status', 'pending_review')
      .order('created_at', { ascending: true })
      .limit(100),
    supabase
      .from('campaigns')
      .select('id, title, total_budget_fcfa, target_country, owner:profiles!campaigns_owner_id_fkey(display_name)')
      .in('status', ['draft', 'pending_funding'])
      .order('created_at', { ascending: true })
      .limit(100),
    supabase
      .from('escrow_transactions')
      .select('amount_fcfa, campaign_creator_id, campaign:campaigns!escrow_transactions_campaign_id_fkey(title), cc:campaign_creators!escrow_transactions_campaign_creator_id_fkey(creator:profiles!campaign_creators_creator_id_fkey(display_name))')
      .eq('direction', 'outbound')
      .eq('status', 'releasable')
      .order('updated_at', { ascending: true })
      .limit(100),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'pending_review'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'active'),
  ]);

  const rows: PendingRow[] = (pending ?? []).map((p) => ({
    id: p.id,
    handle: p.handle,
    displayName: p.display_name,
    city: p.city,
    country: p.country,
    role: (p.user_roles?.[0]?.role as string) ?? '—',
    createdAt: p.created_at,
  }));

  const fundingRows: FundingRow[] = (funding ?? []).map((c) => {
    const owner = c.owner as { display_name: string } | { display_name: string }[] | null;
    const company = Array.isArray(owner) ? owner[0]?.display_name : owner?.display_name;
    return { id: c.id, title: c.title, company: company ?? '—', budget: c.total_budget_fcfa, country: c.target_country };
  });

  const payoutRows: PayoutRow[] = (payouts ?? [])
    .filter((p) => Boolean(p.campaign_creator_id))
    .map((p) => {
      const camp = p.campaign as { title: string } | { title: string }[] | null;
      const title = Array.isArray(camp) ? camp[0]?.title : camp?.title;
      const cc = p.cc as { creator: { display_name: string } | { display_name: string }[] } | { creator: { display_name: string } | { display_name: string }[] }[] | null;
      const ccObj = Array.isArray(cc) ? cc[0] : cc;
      const creator = ccObj?.creator;
      const creatorName = Array.isArray(creator) ? creator[0]?.display_name : creator?.display_name;
      return { id: p.campaign_creator_id as string, creatorName: creatorName ?? 'Créateur', campaignTitle: title ?? 'Campagne', amount: p.amount_fcfa };
    });

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-brand" />
        <h1 className="font-display text-2xl font-extrabold text-ink">Modération</h1>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={Clock} label="En attente" value={pendingCount.count ?? 0} accent />
        <Stat icon={Users} label="Actifs" value={activeCount.count ?? 0} />
        <Stat icon={Wallet} label="À financer" value={fundingRows.length} />
        <Stat icon={Send} label="À payer" value={payoutRows.length} accent />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-bold text-ink">File d'attente — profils à valider</h2>
        <ModerationQueue rows={rows} />
      </div>

      <div>
        <h2 className="mb-1 text-sm font-bold text-ink">Financement des campagnes</h2>
        <p className="mb-3 text-xs text-muted">
          Confirmez le paiement Mobile Money reçu pour activer le séquestre (ADR-001 — Bayele est le
          dépositaire ; SokoClick facture, MoMo transporte les fonds).
        </p>
        <FundingQueue rows={fundingRows} />
      </div>

      <div>
        <h2 className="mb-1 text-sm font-bold text-ink">Paiements créateurs</h2>
        <p className="mb-3 text-xs text-muted">
          Confirmez le décaissement Mobile Money vers le créateur pour les preuves validées (ADR-001 —
          les fonds quittent le séquestre une fois le paiement envoyé).
        </p>
        <PayoutQueue rows={payoutRows} />
      </div>
    </section>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Clock;
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4 shadow-card">
      <Icon className={`h-4 w-4 ${accent ? 'text-accent' : 'text-brand'}`} />
      <div className="mt-2 font-display text-2xl font-extrabold text-ink">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}
