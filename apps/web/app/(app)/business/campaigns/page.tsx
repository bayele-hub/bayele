import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Plus, Lock, Clock, Megaphone } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import { fmtFcfa, CAMPAIGN_STATUS_FR } from '@/lib/data/campaigns';

export const dynamic = 'force-dynamic';

export default async function BusinessCampaigns() {
  const session = await getSession();
  if (!session.userId) redirect('/auth?mode=signin');

  const supabase = await createClient();
  const { data: campaigns } = await supabase
    .from('campaigns')
    // Own campaigns only — the SELECT policy also exposes every published campaign to creators, so
    // "Mes campagnes" must filter by owner or it would list other brands' campaigns too.
    .select('id, title, status, total_budget_fcfa, payout_per_creator_fcfa, creator_count_target, target_country, created_at')
    .eq('owner_id', session.userId)
    .order('created_at', { ascending: false });

  const list = campaigns ?? [];

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-brand" />
          <h1 className="font-display text-xl font-extrabold text-ink">Mes campagnes</h1>
        </div>
        <Link
          href="/business/campaigns/new"
          className="inline-flex min-h-tap items-center gap-1.5 rounded-xl bg-brand px-4 text-sm font-bold text-white transition hover:bg-brand-600 active:scale-95"
        >
          <Plus className="h-4 w-4" /> Nouvelle
        </Link>
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white p-10 text-center">
          <p className="text-sm text-muted">Aucune campagne pour le moment.</p>
          <Link href="/business/campaigns/new" className="mt-3 inline-block text-sm font-bold text-brand hover:underline">
            Lancer votre première campagne →
          </Link>
        </div>
      ) : (
        <ul className="grid gap-3">
          {list.map((c) => {
            const held = c.status === 'published' || c.status === 'in_progress' || c.status === 'completed';
            const draft = c.status === 'draft' || c.status === 'pending_funding';
            return (
              <li key={c.id}>
                <Link
                  href={`/business/campaigns/${c.id}`}
                  className="block rounded-2xl border border-line bg-white p-4 shadow-card transition hover:border-brand-100"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-ink">{c.title}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {c.creator_count_target} créateurs · {fmtFcfa(c.payout_per_creator_fcfa)} / créateur · {c.target_country}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                        held ? 'bg-emerald-50 text-emerald-700' : draft ? 'bg-accent-soft text-accent' : 'bg-surface text-muted'
                      }`}
                    >
                      {held ? <Lock className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                      {CAMPAIGN_STATUS_FR[c.status] ?? c.status}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
                    <span className="text-xs text-muted">Budget total</span>
                    <span className="font-display font-extrabold text-ink">{fmtFcfa(c.total_budget_fcfa)}</span>
                  </div>

                  {draft && (
                    <p className="mt-2 rounded-lg bg-accent-soft/60 px-3 py-2 text-[11px] text-accent">
                      En attente de paiement Mobile Money. Le séquestre s'active dès la confirmation par notre équipe.
                    </p>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
