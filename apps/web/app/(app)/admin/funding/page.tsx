import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import { getDictionary } from '@/i18n/dictionaries';
import { isCampaignId } from '@/lib/data/public-campaigns';
import { FundingQueue, type FundingRow } from '../funding-queue';

export const dynamic = 'force-dynamic';

export default async function AdminFunding({ searchParams }: { searchParams: Promise<{ campaign?: string }> }) {
  const [session, sp, { t }] = await Promise.all([getSession(), searchParams, getDictionary()]);
  if (!session.userId) redirect('/auth?mode=signin');
  // Deep link from a managed brief (design §2.10): pin, outline and scroll to that campaign.
  const highlight = isCampaignId(sp.campaign) ? sp.campaign : null;

  const supabase = await createClient();
  const { data: funding } = await supabase
    .from('campaigns')
    .select('id, title, total_budget_fcfa, target_country, is_managed, brand_label, brand_city, owner:profiles!campaigns_owner_id_fkey(display_name)')
    .in('status', ['draft', 'pending_funding'])
    .order('created_at', { ascending: true })
    .limit(200);

  // Managed rows show the public label (never the owning admin's name) and link back to their brief.
  const managedIds = (funding ?? []).filter((c) => c.is_managed).map((c) => c.id);
  const { data: briefs } = managedIds.length
    ? await supabase.from('managed_briefs').select('id, campaign_id').in('campaign_id', managedIds)
    : { data: [] as { id: string; campaign_id: string | null }[] };
  const briefOf = new Map((briefs ?? []).map((b) => [b.campaign_id, b.id]));

  const rows: FundingRow[] = (funding ?? []).map((c) => {
    const owner = c.owner as { display_name: string } | { display_name: string }[] | null;
    const company = Array.isArray(owner) ? owner[0]?.display_name : owner?.display_name;
    const managedLabel = [c.brand_label, c.brand_city].filter(Boolean).join(' · ');
    return {
      id: c.id,
      title: c.title,
      company: c.is_managed ? managedLabel || '—' : (company ?? '—'),
      budget: c.total_budget_fcfa,
      country: c.target_country,
      managed: !!c.is_managed,
      briefId: briefOf.get(c.id) ?? null,
    };
  });
  // Pin the deep-linked campaign first; unknown ids are ignored silently.
  rows.sort((a, b) => Number(b.id === highlight) - Number(a.id === highlight));

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-sm font-bold text-ink">Financement des campagnes</h2>
        <p className="mt-0.5 text-xs text-muted">
          Confirmez le paiement Mobile Money reçu pour activer le séquestre (ADR-001 — Bayele est le
          dépositaire ; SokoClick facture, MoMo transporte les fonds).
        </p>
      </div>
      <FundingQueue rows={rows} highlight={highlight} labels={t.admin.briefs.funding} />
    </section>
  );
}
