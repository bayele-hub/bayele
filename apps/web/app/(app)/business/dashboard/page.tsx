import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Building2, Megaphone, Lock, Users, Handshake, Plus, ArrowRight, BadgeCheck, Clock } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import { fmtFcfa, CAMPAIGN_STATUS_FR } from '@/lib/data/campaigns';

export const dynamic = 'force-dynamic';

export default async function BusinessDashboard() {
  const session = await getSession();
  if (!session.userId) redirect('/auth?mode=signin');

  const supabase = await createClient();
  const [{ data: campaigns }, { data: retainers }, { data: bp }] = await Promise.all([
    supabase
      .from('campaigns')
      .select('id, title, status, total_budget_fcfa, payout_per_creator_fcfa, creator_count_target, target_country, created_at')
      .order('created_at', { ascending: false }),
    supabase.from('agency_retainers').select('status'),
    supabase.from('business_profiles').select('company_name, is_verified').eq('user_id', session.userId).maybeSingle(),
  ]);

  const list = campaigns ?? [];
  const myIds = list.map((c) => c.id);
  const engagedRes = myIds.length
    ? await supabase
        .from('campaign_creators')
        .select('*', { count: 'exact', head: true })
        .in('campaign_id', myIds)
        .in('status', ['approved', 'content_submitted', 'verified', 'paid'])
    : { count: 0 };

  const activeCampaigns = list.filter((c) => c.status === 'published' || c.status === 'in_progress').length;
  const inEscrow = list
    .filter((c) => c.status === 'published' || c.status === 'in_progress')
    .reduce((s, c) => s + (c.total_budget_fcfa ?? 0), 0);
  const draftCount = list.filter((c) => c.status === 'draft' || c.status === 'pending_funding').length;
  const engaged = engagedRes.count ?? 0;
  const retainersActive = (retainers ?? []).filter((r) => r.status === 'active' || r.status === 'funded').length;

  const companyName = bp?.company_name ?? session.profile?.display_name ?? 'votre marque';
  const recent = list.slice(0, 3);

  return (
    <section className="space-y-6">
      {/* Hero */}
      <div className="rounded-2xl border border-line bg-gradient-to-br from-brand-50 via-white to-accent-soft p-4 shadow-card">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-brand" />
          <h1 className="font-display text-xl font-extrabold text-ink">{companyName}</h1>
          {bp?.is_verified && (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700">
              <BadgeCheck className="h-3 w-3" /> Vérifiée
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-muted">
          {draftCount > 0
            ? `${draftCount} campagne${draftCount > 1 ? 's' : ''} en attente de financement.`
            : 'Lancez une campagne ou confiez la gestion à un consultant.'}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/business/campaigns/new"
            className="inline-flex min-h-tap items-center gap-1.5 rounded-xl bg-brand px-4 text-sm font-bold text-white transition hover:bg-brand-600 active:scale-95"
          >
            <Plus className="h-4 w-4" /> Nouvelle campagne
          </Link>
          <Link
            href="/business/retainers"
            className="inline-flex min-h-tap items-center gap-1.5 rounded-xl border border-line bg-white px-4 text-sm font-bold text-ink transition hover:border-brand hover:text-brand"
          >
            <Handshake className="h-4 w-4" /> Confier à un consultant
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={Megaphone} label="Campagnes actives" value={String(activeCampaigns)} />
        <Stat icon={Lock} label="En séquestre" value={fmtFcfa(inEscrow)} money />
        <Stat icon={Users} label="Créateurs engagés" value={String(engaged)} />
        <Stat icon={Handshake} label="Rétainers actifs" value={String(retainersActive)} />
      </div>

      {/* Recent campaigns */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-ink">Campagnes récentes</h2>
          <Link href="/business/campaigns" className="inline-flex items-center gap-1 text-xs font-bold text-brand hover:underline">
            Tout voir <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {recent.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-white p-10 text-center">
            <p className="text-sm text-muted">Aucune campagne pour le moment.</p>
            <Link href="/business/campaigns/new" className="mt-3 inline-block text-sm font-bold text-brand hover:underline">
              Lancer votre première campagne →
            </Link>
          </div>
        ) : (
          <ul className="grid gap-3">
            {recent.map((c) => {
              const held = c.status === 'published' || c.status === 'in_progress' || c.status === 'completed';
              return (
                <li key={c.id}>
                  <Link
                    href={`/business/campaigns/${c.id}`}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-white p-4 shadow-card transition hover:border-brand-100"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-bold text-ink">{c.title}</p>
                      <p className="mt-0.5 text-xs text-muted">{c.creator_count_target} créateurs · {c.target_country}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-display font-extrabold text-ink">{fmtFcfa(c.total_budget_fcfa)}</span>
                      <div className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${held ? 'bg-emerald-50 text-emerald-700' : 'bg-accent-soft text-accent'}`}>
                        {held ? <Lock className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                        {CAMPAIGN_STATUS_FR[c.status] ?? c.status}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

function Stat({ icon: Icon, label, value, money }: { icon: typeof Megaphone; label: string; value: string; money?: boolean }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4 shadow-card">
      <Icon className={`h-4 w-4 ${money ? 'text-accent' : 'text-brand'}`} />
      <div className={`mt-2 font-display font-extrabold text-ink ${money ? 'text-base leading-tight' : 'text-2xl'}`}>{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}
