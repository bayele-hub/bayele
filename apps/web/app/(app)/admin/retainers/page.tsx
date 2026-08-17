import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Handshake } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import { RetainerAdminRow, type AdminRetainer } from './retainer-admin-row';

export const dynamic = 'force-dynamic';

export default async function AdminRetainers() {
  const session = await getSession();
  if (!session.userId) redirect('/auth?mode=signin');
  if (session.primary !== 'super_admin') redirect('/dashboard');

  const supabase = await createClient();
  const { data: retainers } = await supabase
    .from('agency_retainers')
    .select('id, status, contract_value_fcfa, consultant_fee_fcfa, media_budget_fcfa, kpi_bonus_fcfa, created_at, business:profiles!agency_retainers_business_id_fkey(display_name), consultant:profiles!agency_retainers_consultant_id_fkey(display_name)')
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
  }));

  const toFund = rows.filter((r) => r.status === 'invoiced').length;

  return (
    <section className="space-y-6">
      <Link href="/admin/dashboard" className="inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-brand">
        <ArrowLeft className="h-3.5 w-3.5" /> Modération
      </Link>
      <div className="flex items-center gap-2">
        <Handshake className="h-5 w-5 text-brand" />
        <h1 className="font-display text-2xl font-extrabold text-ink">Rétainers agence</h1>
        {toFund > 0 && <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-white">{toFund} à financer</span>}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-line bg-white p-10 text-center text-sm text-muted">
          Aucun rétainer pour le moment.
        </div>
      ) : (
        <ul className="grid gap-3">
          {rows.map((r) => (
            <RetainerAdminRow key={r.id} r={r} />
          ))}
        </ul>
      )}
    </section>
  );
}
