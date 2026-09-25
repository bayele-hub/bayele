import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Handshake, Clock, CheckCircle2, MessageCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import { fmtFcfa, RETAINER_STATUS_FR } from '@/lib/data/campaigns';
import { DeclineButton } from '../decline-button';

export const dynamic = 'force-dynamic';

export default async function ConsultantRetainers() {
  const session = await getSession();
  if (!session.userId) redirect('/auth?mode=signin');

  const supabase = await createClient();
  const { data: retainers } = await supabase
    .from('agency_retainers')
    .select('id, status, contract_value_fcfa, consultant_fee_fcfa, kpi_bonus_fcfa, created_at, business:profiles!agency_retainers_business_id_fkey(display_name)')
    .order('created_at', { ascending: false });

  const list = retainers ?? [];

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Handshake className="h-5 w-5 text-brand" />
        <h1 className="font-display text-xl font-extrabold text-ink">Mes contrats agence</h1>
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white p-10 text-center text-sm text-muted">
          Aucun contrat pour le moment. Les marques vous proposent des rétainers depuis votre profil public.
        </div>
      ) : (
        <ul className="grid gap-3">
          {list.map((r) => {
            const biz = r.business as { display_name: string } | { display_name: string }[] | null;
            const b = Array.isArray(biz) ? biz[0] : biz;
            const done = r.status === 'completed';
            const canDecline = ['draft', 'invoiced', 'funded'].includes(r.status);
            return (
              <li key={r.id} className="rounded-2xl border border-line bg-white p-4 shadow-card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-ink">{b?.display_name ?? 'Marque'}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      Honoraires {fmtFcfa(r.consultant_fee_fcfa)} · bonus KPI {fmtFcfa(r.kpi_bonus_fcfa)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-display font-extrabold text-ink">{fmtFcfa(r.contract_value_fcfa)}</span>
                    <div className={`mt-1 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${done ? 'bg-emerald-50 text-emerald-700' : 'bg-surface text-muted'}`}>
                      {done ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                      {RETAINER_STATUS_FR[r.status] ?? r.status}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <Link
                    href={`/messages/open?ctx=retainer&id=${r.id}`}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:underline"
                  >
                    <MessageCircle className="h-3.5 w-3.5" /> Contacter la marque
                  </Link>
                  {canDecline && <DeclineButton retainerId={r.id} />}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
