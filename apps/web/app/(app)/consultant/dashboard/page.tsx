import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Coins, Clock, Handshake, Users, KeyRound, ArrowRight, CheckCircle2 } from 'lucide-react';
import { SmartAvatar } from '@/components/smart-avatar';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import { fmtFcfa, RETAINER_STATUS_FR } from '@/lib/data/campaigns';

export const dynamic = 'force-dynamic';

export default async function ConsultantDashboard() {
  const session = await getSession();
  if (!session.userId) redirect('/auth?mode=signin');

  const supabase = await createClient();
  const [{ data: retainers }, { data: profile }] = await Promise.all([
    supabase
      .from('agency_retainers')
      .select('id, status, contract_value_fcfa, consultant_fee_fcfa, kpi_bonus_fcfa, created_at, business:profiles!agency_retainers_business_id_fkey(display_name)')
      .order('created_at', { ascending: false }),
    supabase.from('consultant_profiles').select('agency_access').eq('user_id', session.userId).maybeSingle(),
  ]);

  const list = retainers ?? [];
  const earned = list.filter((r) => r.status === 'completed').reduce((s, r) => s + (r.consultant_fee_fcfa ?? 0) + (r.kpi_bonus_fcfa ?? 0), 0);
  const activeCount = list.filter((r) => r.status === 'active' || r.status === 'funded').length;
  const pendingCount = list.filter((r) => r.status === 'draft' || r.status === 'invoiced').length;
  const firstName = (session.profile?.display_name ?? '').split(' ')[0] || 'consultant';
  const recent = list.slice(0, 3);

  return (
    <section className="space-y-6">
      {/* Hero */}
      <div className="rounded-2xl border border-line bg-gradient-to-br from-brand-50 via-white to-accent-soft p-4 shadow-card">
        <div className="flex items-center gap-2">
          <SmartAvatar src={session.profile?.avatar_url} name={firstName} className="h-9 w-9 shrink-0 text-sm" />
          <h1 className="font-display text-xl font-extrabold text-ink">Bonjour, {firstName} 👋</h1>
          {profile?.agency_access && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-bold text-accent">
              <KeyRound className="h-3 w-3" /> Agence
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-muted">
          {pendingCount > 0
            ? `${pendingCount} contrat${pendingCount > 1 ? 's' : ''} en attente. Suivez vos rétainers et vos honoraires.`
            : 'Gérez vos contrats agence et trouvez des créateurs pour vos campagnes.'}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat icon={Coins} label="Honoraires encaissés" value={fmtFcfa(earned)} tone="accent" />
        <Stat icon={Handshake} label="Contrats actifs" value={String(activeCount)} tone="brand" />
        <Stat icon={Clock} label="En attente" value={String(pendingCount)} tone="brand" />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/consultant/retainers" className="group flex items-center gap-3 rounded-2xl border border-line bg-white p-4 shadow-card transition hover:border-brand-100">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand"><Handshake className="h-5 w-5" /></span>
          <div className="min-w-0"><p className="font-bold text-ink">Mes rétainers</p><p className="truncate text-[11px] text-muted">Contrats & honoraires</p></div>
        </Link>
        <Link href="/consultant/talent-search" className="group flex items-center gap-3 rounded-2xl border border-line bg-white p-4 shadow-card transition hover:border-brand-100">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent"><Users className="h-5 w-5" /></span>
          <div className="min-w-0"><p className="font-bold text-ink">Trouver des créateurs</p><p className="truncate text-[11px] text-muted">Annuaire talents</p></div>
        </Link>
      </div>

      {/* Recent contracts */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-ink">Contrats récents</h2>
          <Link href="/consultant/retainers" className="inline-flex items-center gap-1 text-xs font-bold text-brand hover:underline">
            Tout voir <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {recent.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-white p-10 text-center text-sm text-muted">
            Aucun contrat pour le moment. Les marques vous proposent des rétainers depuis votre profil public.
          </div>
        ) : (
          <ul className="grid gap-3">
            {recent.map((r) => {
              const biz = r.business as { display_name: string } | { display_name: string }[] | null;
              const b = Array.isArray(biz) ? biz[0] : biz;
              const done = r.status === 'completed';
              return (
                <li key={r.id} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-white p-4 shadow-card">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-ink">{b?.display_name ?? 'Marque'}</p>
                    <p className="text-[11px] text-muted">Honoraires {fmtFcfa(r.consultant_fee_fcfa)}</p>
                  </div>
                  <div className="text-right">
                    <span className="font-display font-extrabold text-ink">{fmtFcfa(r.contract_value_fcfa)}</span>
                    <div className={`mt-1 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${done ? 'bg-emerald-50 text-emerald-700' : 'bg-surface text-muted'}`}>
                      {done && <CheckCircle2 className="h-3 w-3" />}
                      {RETAINER_STATUS_FR[r.status] ?? r.status}
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

function Stat({ icon: Icon, label, value, tone }: { icon: typeof Coins; label: string; value: string; tone: 'brand' | 'accent' }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-3 shadow-card">
      <Icon className={`h-4 w-4 ${tone === 'accent' ? 'text-accent' : 'text-brand'}`} />
      <div className="mt-2 truncate font-display text-base font-extrabold leading-tight tabular-nums text-ink" title={value}>{value}</div>
      <div className="text-[11px] text-muted">{label}</div>
    </div>
  );
}
