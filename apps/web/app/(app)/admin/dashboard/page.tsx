import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Clock, Users, Megaphone, Lock, Coins, Wallet, Send, Handshake, ArrowRight, TrendingUp } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import { fmtFcfa } from '@/lib/data/campaigns';

export const dynamic = 'force-dynamic';

export default async function AdminOverview() {
  const session = await getSession();
  if (!session.userId) redirect('/auth?mode=signin');

  const supabase = await createClient();

  // Admin RLS (private.is_admin) lets these read the whole tables. At current scale we pull rows and
  // aggregate in-process; move to SQL aggregates / a materialized view when volume warrants it.
  const [{ data: profiles }, { data: campaigns }, { data: escrow }, { data: retainers }] = await Promise.all([
    supabase.from('profiles').select('status, user_roles(role)').limit(2000),
    supabase.from('campaigns').select('status').limit(2000),
    supabase.from('escrow_transactions').select('status, direction, amount_fcfa, fee_fcfa, net_amount_fcfa').limit(5000),
    supabase.from('agency_retainers').select('status').limit(2000),
  ]);

  const P = profiles ?? [];
  const roleCount = (r: string) => P.filter((p) => (p.user_roles ?? []).some((x) => x.role === r)).length;
  const pending = P.filter((p) => p.status === 'pending_review').length;
  const active = P.filter((p) => p.status === 'active').length;
  const suspended = P.filter((p) => p.status === 'suspended').length;
  const roles = {
    creator: roleCount('creator'),
    consultant: roleCount('consultant'),
    business: roleCount('business'),
    super_admin: roleCount('super_admin'),
  };
  const roleTotal = Math.max(1, roles.creator + roles.consultant + roles.business + roles.super_admin);

  const C = campaigns ?? [];
  const liveCampaigns = C.filter((c) => c.status === 'published' || c.status === 'in_progress').length;
  const toFund = C.filter((c) => c.status === 'draft' || c.status === 'pending_funding').length;
  const completedCampaigns = C.filter((c) => c.status === 'completed').length;

  const E = escrow ?? [];
  const sum = (rows: typeof E, field: 'amount_fcfa' | 'fee_fcfa' | 'net_amount_fcfa') =>
    rows.reduce((t, r) => t + (r[field] ?? 0), 0);
  const heldEscrow = sum(E.filter((r) => r.direction === 'inbound' && r.status === 'held'), 'net_amount_fcfa');
  const releasedToCreators = sum(E.filter((r) => r.direction === 'outbound' && r.status === 'paid_out'), 'net_amount_fcfa');
  const feesEarned = sum(E.filter((r) => r.direction === 'inbound'), 'fee_fcfa');
  const toPay = E.filter((r) => r.direction === 'outbound' && r.status === 'releasable').length;

  const R = retainers ?? [];
  const retainersActive = R.filter((r) => r.status === 'active' || r.status === 'funded').length;
  const retainersToFund = R.filter((r) => r.status === 'invoiced').length;

  const attention = pending + toFund + toPay + retainersToFund;

  return (
    <section className="space-y-6">
      {/* Money row — the numbers that matter for escrow oversight. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Money icon={Lock} label="Sous séquestre" value={heldEscrow} tone="brand" hint="Fonds de campagne détenus" />
        <Money icon={Coins} label="Décaissé aux créateurs" value={releasedToCreators} tone="emerald" hint="Payouts confirmés" />
        <Money icon={TrendingUp} label="Commission encaissée" value={feesEarned} tone="accent" hint="Part Bayele" />
      </div>

      {/* Count KPIs. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={Clock} label="Profils en attente" value={pending} accent={pending > 0} />
        <Stat icon={Users} label="Membres actifs" value={active} />
        <Stat icon={Megaphone} label="Campagnes en cours" value={liveCampaigns} />
        <Stat icon={Handshake} label="Rétainers actifs" value={retainersActive} />
      </div>

      {/* Needs-action queue links. */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-ink">
          À traiter
          {attention > 0 && <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-white">{attention}</span>}
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ActionCard href="/admin/moderation" icon={Clock} title="Profils à valider" count={pending} sub="Approuver / rejeter les inscriptions" />
          <ActionCard href="/admin/funding" icon={Wallet} title="Campagnes à financer" count={toFund} sub="Confirmer le paiement Mobile Money" />
          <ActionCard href="/admin/payouts" icon={Send} title="Paiements créateurs" count={toPay} sub="Décaisser les preuves validées" />
          <ActionCard href="/admin/retainers" icon={Handshake} title="Rétainers à financer" count={retainersToFund} sub="Confirmer le règlement du contrat" />
        </div>
      </div>

      {/* Membership breakdown — pure CSS bars, no chart lib. */}
      <div className="rounded-2xl border border-line bg-white p-4 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-ink">Répartition des membres</h2>
          <Link href="/admin/users" className="inline-flex items-center gap-1 text-xs font-bold text-brand hover:underline">
            Gérer <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="space-y-2.5">
          <Bar label="Créateurs" value={roles.creator} total={roleTotal} className="bg-brand" />
          <Bar label="Consultants" value={roles.consultant} total={roleTotal} className="bg-accent" />
          <Bar label="Marques" value={roles.business} total={roleTotal} className="bg-emerald-500" />
          <Bar label="Admins" value={roles.super_admin} total={roleTotal} className="bg-ink" />
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-[11px] text-muted">
          <span>{active} actifs · {pending} en attente · {suspended} suspendus</span>
          <span>{completedCampaigns} campagnes terminées</span>
        </div>
      </div>
    </section>
  );
}

function Money({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: typeof Lock;
  label: string;
  value: number;
  hint: string;
  tone: 'brand' | 'emerald' | 'accent';
}) {
  const toneClass = tone === 'emerald' ? 'text-emerald-600' : tone === 'accent' ? 'text-accent' : 'text-brand';
  return (
    <div className="rounded-2xl border border-line bg-white p-4 shadow-card">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${toneClass}`} />
        <span className="text-xs font-semibold text-muted">{label}</span>
      </div>
      <div className="mt-2 font-display text-2xl font-extrabold text-ink">{fmtFcfa(value)}</div>
      <div className="mt-0.5 text-[11px] text-muted">{hint}</div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, accent }: { icon: typeof Clock; label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4 shadow-card">
      <Icon className={`h-4 w-4 ${accent ? 'text-accent' : 'text-brand'}`} />
      <div className="mt-2 font-display text-2xl font-extrabold text-ink">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}

function ActionCard({
  href,
  icon: Icon,
  title,
  sub,
  count,
}: {
  href: string;
  icon: typeof Clock;
  title: string;
  sub: string;
  count: number;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-2xl border border-line bg-white p-4 shadow-card transition hover:border-brand-100"
    >
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${count > 0 ? 'bg-accent-soft text-accent' : 'bg-surface text-muted'}`}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 font-bold text-ink">
          {title}
          {count > 0 && <span className="rounded-full bg-accent px-1.5 text-[10px] font-bold text-white">{count}</span>}
        </p>
        <p className="truncate text-xs text-muted">{sub}</p>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-brand" />
    </Link>
  );
}

function Bar({ label, value, total, className }: { label: string; value: number; total: number; className: string }) {
  const pct = Math.round((value / total) * 100);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="font-semibold text-ink">{label}</span>
        <span className="text-muted">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface">
        <div className={`h-full rounded-full ${className}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
