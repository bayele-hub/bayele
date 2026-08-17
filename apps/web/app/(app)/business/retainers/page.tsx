import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Handshake, Plus, Clock, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import { fmtFcfa, RETAINER_STATUS_FR } from '@/lib/data/campaigns';

export const dynamic = 'force-dynamic';

export default async function BusinessRetainers() {
  const session = await getSession();
  if (!session.userId) redirect('/auth?mode=signin');
  if (!session.roles.includes('business') && session.primary !== 'super_admin') redirect('/dashboard');

  const supabase = await createClient();
  const { data: retainers } = await supabase
    .from('agency_retainers')
    .select('id, status, contract_value_fcfa, consultant_fee_fcfa, media_budget_fcfa, kpi_bonus_fcfa, created_at, consultant:profiles!agency_retainers_consultant_id_fkey(display_name, handle)')
    .order('created_at', { ascending: false });

  const list = retainers ?? [];

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Handshake className="h-5 w-5 text-brand" />
          <h1 className="font-display text-2xl font-extrabold text-ink">Rétainers agence</h1>
        </div>
        <Link
          href="/business/retainers/new"
          className="inline-flex min-h-tap items-center gap-1.5 rounded-xl bg-brand px-4 text-sm font-bold text-white transition hover:bg-brand-600 active:scale-95"
        >
          <Plus className="h-4 w-4" /> Nouveau
        </Link>
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white p-10 text-center">
          <p className="text-sm text-muted">Aucun rétainer pour le moment.</p>
          <Link href="/consultants" className="mt-3 inline-block text-sm font-bold text-brand hover:underline">
            Trouver un consultant dans l'annuaire →
          </Link>
        </div>
      ) : (
        <ul className="grid gap-3">
          {list.map((r) => {
            const cons = r.consultant as { display_name: string; handle: string } | { display_name: string; handle: string }[] | null;
            const c = Array.isArray(cons) ? cons[0] : cons;
            const done = r.status === 'completed';
            const invoiced = r.status === 'invoiced';
            return (
              <li key={r.id} className="rounded-2xl border border-line bg-white p-4 shadow-card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-ink">{c?.display_name ?? 'Consultant'}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      @{c?.handle} · honoraires {fmtFcfa(r.consultant_fee_fcfa)} · média {fmtFcfa(r.media_budget_fcfa)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-display font-extrabold text-ink">{fmtFcfa(r.contract_value_fcfa)}</span>
                    <div
                      className={`mt-1 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                        done ? 'bg-emerald-50 text-emerald-700' : invoiced ? 'bg-accent-soft text-accent' : 'bg-surface text-muted'
                      }`}
                    >
                      {done ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                      {RETAINER_STATUS_FR[r.status] ?? r.status}
                    </div>
                  </div>
                </div>
                {invoiced && (
                  <p className="mt-2 rounded-lg bg-accent-soft/60 px-3 py-2 text-[11px] text-accent">
                    Facture générée. Réglez le contrat par Mobile Money — le contrat s'active dès la confirmation.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
