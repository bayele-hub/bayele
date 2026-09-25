import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Users, Coins, Clock, Megaphone, ArrowRight, CheckCircle2 } from 'lucide-react';
import { SmartAvatar } from '@/components/smart-avatar';
import { InviteCreatorForm, EndRepresentationButton } from '@/components/representation-forms';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import { fmtFcfa, CREATOR_STATUS_FR } from '@/lib/data/campaigns';
import { formatPct } from '@/lib/founder';

export const dynamic = 'force-dynamic';

const COMMISSION_FR: Record<string, string> = { estimated: 'Estimée', owed: 'À verser', paid: 'Versée' };

/**
 * Partner portfolio — the managed-creator model (Brand → Bayele → Partner → Creator).
 * Invite creators (they must accept), follow their deals, and see commissions owed and paid.
 */
export default async function PartnerCreatorsPage() {
  const session = await getSession();
  if (!session.userId) redirect('/auth?mode=signin');

  const supabase = await createClient();
  const [{ data: linkRows }, { data: dealRows }] = await Promise.all([
    supabase.rpc('my_partner_links'),
    supabase.rpc('partner_deals'),
  ]);
  const links = (linkRows ?? []).filter((l) => l.my_side === 'partner');
  const active = links.filter((l) => l.status === 'active');
  const pending = links.filter((l) => l.status === 'pending');
  const deals = dealRows ?? [];

  const owed = deals.filter((d) => d.commission_status === 'owed').reduce((s, d) => s + d.commission_fcfa, 0);
  const paid = deals.filter((d) => d.commission_status === 'paid').reduce((s, d) => s + d.commission_fcfa, 0);
  const pipeline = deals
    .filter((d) => d.commission_status === 'estimated' && !['rejected', 'disputed'].includes(d.status))
    .reduce((s, d) => s + d.commission_fcfa, 0);

  return (
    <section className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-brand" />
          <h1 className="font-display text-xl font-extrabold text-ink">Mon portefeuille</h1>
        </div>
        <p className="mt-0.5 text-xs text-muted">
          Les créateurs que vous représentez. Vous postulez aux campagnes pour eux ; votre commission est calculée à chaque paiement.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={Users} label="Créateurs représentés" value={String(active.length)} />
        <Stat icon={Clock} label="Commissions en cours" value={fmtFcfa(pipeline)} />
        <Stat icon={Coins} label="À verser par Bayele" value={fmtFcfa(owed)} accent />
        <Stat icon={CheckCircle2} label="Commissions versées" value={fmtFcfa(paid)} />
      </div>

      <InviteCreatorForm />

      {/* Portfolio */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-ink">Créateurs représentés</h2>
          <Link href="/partner/campaigns" className="inline-flex items-center gap-1 text-xs font-bold text-brand hover:underline">
            <Megaphone className="h-3.5 w-3.5" /> Postuler pour eux
          </Link>
        </div>
        {active.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-white p-8 text-center text-sm text-muted">
            Aucun créateur pour le moment. Envoyez une proposition ci-dessus : dès qu'un créateur accepte, il apparaît ici.
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {active.map((l) => (
              <li key={l.id} className="rounded-2xl border border-line bg-white p-4 shadow-card">
                <div className="flex items-center gap-3">
                  <SmartAvatar src={l.counterpart_avatar} name={l.counterpart_name} className="h-10 w-10 shrink-0 text-sm" />
                  <div className="min-w-0">
                    <p className="truncate font-bold text-ink">{l.counterpart_name}</p>
                    <p className="truncate text-xs text-muted">
                      @{l.counterpart_handle} · {formatPct(l.commission_rate, 'fr')}
                      {l.counterpart_status !== 'active' && <span className="ml-1 text-accent">· profil en validation</span>}
                    </p>
                  </div>
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <Mini label="En cours" value={String(l.deals_in_flight)} />
                  <Mini label="Payées" value={String(l.deals_paid)} />
                  <Mini label="À verser" value={fmtFcfa(l.commission_owed_fcfa)} />
                </dl>
                <div className="mt-3 flex justify-end">
                  <EndRepresentationButton linkId={l.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {pending.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-bold text-ink">Propositions envoyées</h2>
          <ul className="grid gap-2">
            {pending.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{l.counterpart_name}</p>
                  <p className="text-[11px] text-muted">{formatPct(l.commission_rate, 'fr')} · en attente de réponse</p>
                </div>
                <EndRepresentationButton linkId={l.id} label="Retirer" confirmLabel="Retirer la proposition" />
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Deal pipeline */}
      <div>
        <h2 className="mb-3 text-sm font-bold text-ink">Missions de vos créateurs</h2>
        {deals.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-white p-8 text-center text-sm text-muted">
            Aucune mission pour le moment.
          </div>
        ) : (
          <ul className="grid gap-2">
            {deals.map((d) => (
              <li key={d.campaign_creator_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-ink">{d.campaign_title}</p>
                  <p className="text-[11px] text-muted">
                    {d.creator_name} · {CREATOR_STATUS_FR[d.status] ?? d.status}
                    {d.applied_by_me && ' · proposé par vous'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-sm font-extrabold tabular-nums text-ink">{fmtFcfa(d.commission_fcfa)}</p>
                  <p className="text-[10px] text-muted">
                    {d.commission_rate ? formatPct(d.commission_rate, 'fr') : '—'} de {fmtFcfa(d.agreed_payout_fcfa)} · {COMMISSION_FR[d.commission_status] ?? d.commission_status}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-[11px] text-muted">
          « Estimée » : la mission n'est pas encore payée. La commission devient « À verser » au paiement du créateur.
        </p>
      </div>

      <Link href="/partner/campaigns" className="flex items-center justify-between rounded-2xl border border-line bg-white p-4 shadow-card transition hover:border-brand-100">
        <span className="text-sm font-bold text-ink">Voir les campagnes ouvertes</span>
        <ArrowRight className="h-4 w-4 text-brand" />
      </Link>
    </section>
  );
}

function Stat({ icon: Icon, label, value, accent }: { icon: typeof Coins; label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-3 shadow-card">
      <Icon className={`h-4 w-4 ${accent ? 'text-accent' : 'text-brand'}`} />
      <div className="mt-2 truncate font-display text-base font-extrabold leading-tight tabular-nums text-ink" title={value}>{value}</div>
      <div className="text-[11px] text-muted">{label}</div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface p-2">
      <dt className="text-[10px] text-muted">{label}</dt>
      <dd className="truncate text-sm font-extrabold tabular-nums text-ink" title={value}>{value}</dd>
    </div>
  );
}
