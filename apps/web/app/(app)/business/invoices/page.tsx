import { redirect } from 'next/navigation';
import { Receipt, FileText, ExternalLink, CheckCircle2, Clock } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import { fmtFcfa } from '@/lib/data/campaigns';

export const dynamic = 'force-dynamic';

const TYPE_FR: Record<string, string> = {
  match_pass: 'Mise en relation',
  campaign_escrow: 'Financement campagne',
  agency_retainer: 'Rétainer agence',
  pro_subscription: 'Abonnement Pro',
};

const STATUS_FR: Record<string, string> = { paid: 'Payée', sent: 'Envoyée', draft: 'Brouillon', void: 'Annulée' };
const STATUS_CLASS: Record<string, string> = {
  paid: 'bg-emerald-50 text-emerald-700',
  sent: 'bg-accent-soft text-accent',
  draft: 'bg-surface text-muted',
  void: 'bg-surface text-muted',
};

function fmtDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export default async function BusinessInvoices() {
  const session = await getSession();
  if (!session.userId) redirect('/auth?mode=signin');

  const supabase = await createClient();
  // RLS: businesses view their own invoices (business_id = auth.uid()).
  const { data: invoices } = await supabase
    .from('invoices')
    .select('id, invoice_type, amount_fcfa, status, pdf_url, sokoclick_invoice_id, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  const rows = invoices ?? [];
  const totalPaid = rows.filter((i) => i.status === 'paid').reduce((s, i) => s + (i.amount_fcfa ?? 0), 0);

  return (
    <section className="space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <Receipt className="h-5 w-5 text-brand" />
          <h1 className="font-display text-xl font-extrabold text-ink">Factures & reçus</h1>
        </div>
        <p className="mt-0.5 text-xs text-muted">
          Vos factures OHADA générées par SokoClick. Total réglé : <span className="font-bold text-ink">{fmtFcfa(totalPaid)}</span>.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white p-10 text-center text-sm text-muted">
          Aucune facture pour le moment. Elles apparaîtront ici dès votre première campagne ou rétainer.
        </div>
      ) : (
        <ul className="grid gap-3">
          {rows.map((i) => {
            const paid = i.status === 'paid';
            return (
              <li key={i.id} className="rounded-2xl border border-line bg-white p-4 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${paid ? 'bg-emerald-50 text-emerald-600' : 'bg-brand-50 text-brand'}`}>
                      <FileText className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-bold text-ink">{TYPE_FR[i.invoice_type] ?? i.invoice_type}</p>
                      <p className="mt-0.5 text-[11px] text-muted">
                        {i.sokoclick_invoice_id ?? '—'} · {fmtDate(i.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-display font-extrabold text-ink">{fmtFcfa(i.amount_fcfa)}</span>
                    <div className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_CLASS[i.status] ?? 'bg-surface text-muted'}`}>
                      {paid ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                      {STATUS_FR[i.status] ?? i.status}
                    </div>
                  </div>
                </div>
                {i.pdf_url && (
                  <a
                    href={i.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex min-h-tap items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-bold text-brand transition hover:border-brand"
                  >
                    Voir la facture <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
