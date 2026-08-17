import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import { FundingQueue, type FundingRow } from '../funding-queue';

export const dynamic = 'force-dynamic';

export default async function AdminFunding() {
  const session = await getSession();
  if (!session.userId) redirect('/auth?mode=signin');

  const supabase = await createClient();
  const { data: funding } = await supabase
    .from('campaigns')
    .select('id, title, total_budget_fcfa, target_country, owner:profiles!campaigns_owner_id_fkey(display_name)')
    .in('status', ['draft', 'pending_funding'])
    .order('created_at', { ascending: true })
    .limit(200);

  const rows: FundingRow[] = (funding ?? []).map((c) => {
    const owner = c.owner as { display_name: string } | { display_name: string }[] | null;
    const company = Array.isArray(owner) ? owner[0]?.display_name : owner?.display_name;
    return { id: c.id, title: c.title, company: company ?? '—', budget: c.total_budget_fcfa, country: c.target_country };
  });

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-sm font-bold text-ink">Financement des campagnes</h2>
        <p className="mt-0.5 text-xs text-muted">
          Confirmez le paiement Mobile Money reçu pour activer le séquestre (ADR-001 — Bayele est le
          dépositaire ; SokoClick facture, MoMo transporte les fonds).
        </p>
      </div>
      <FundingQueue rows={rows} />
    </section>
  );
}
