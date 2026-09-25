import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Handshake, ShieldCheck, Info, ArrowRight } from 'lucide-react';
import { SmartAvatar } from '@/components/smart-avatar';
import { RespondButtons, EndRepresentationButton } from '@/components/representation-forms';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import { fmtFcfa } from '@/lib/data/campaigns';
import { formatPct, splitPayout } from '@/lib/founder';

export const dynamic = 'force-dynamic';

const STATUS_FR: Record<string, string> = { pending: 'En attente', active: 'Active', declined: 'Refusée', ended: 'Terminée' };

/**
 * Creator side of the managed-creator model: offers to answer, the current partner, history.
 * The creator is always in control — nobody represents them without an explicit "Accepter".
 */
export default async function CreatorPartnerPage() {
  const session = await getSession();
  if (!session.userId) redirect('/auth?mode=signin');

  const supabase = await createClient();
  const { data } = await supabase.rpc('my_partner_links');
  const links = (data ?? []).filter((l) => l.my_side === 'creator');
  const pending = links.filter((l) => l.status === 'pending');
  const active = links.find((l) => l.status === 'active') ?? null;
  const past = links.filter((l) => l.status === 'declined' || l.status === 'ended');
  const example = 100_000;

  return (
    <section className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Handshake className="h-5 w-5 text-brand" />
          <h1 className="font-display text-xl font-extrabold text-ink">Mon partenaire</h1>
        </div>
        <p className="mt-0.5 text-xs text-muted">
          Un partenaire (talent manager, agence) peut vous représenter : il postule aux campagnes pour vous et
          touche une commission sur vos gains. Vous pouvez aussi rester indépendant.
        </p>
      </div>

      {/* Current representation */}
      {active ? (
        <div className="rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50 via-white to-white p-4 shadow-card">
          <p className="text-[11px] font-bold uppercase tracking-wide text-brand-700">Vous êtes représenté</p>
          <div className="mt-2 flex items-center gap-3">
            <SmartAvatar src={active.counterpart_avatar} name={active.counterpart_name} className="h-11 w-11 shrink-0 text-sm" />
            <div className="min-w-0">
              <p className="truncate font-bold text-ink">{active.counterpart_name}</p>
              <p className="text-xs text-muted">@{active.counterpart_handle} · commission {formatPct(active.commission_rate, 'fr')}</p>
            </div>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-xl bg-white p-2 ring-1 ring-line">
              <dt className="text-[11px] text-muted">Missions en cours</dt>
              <dd className="font-display text-lg font-extrabold text-ink">{active.deals_in_flight}</dd>
            </div>
            <div className="rounded-xl bg-white p-2 ring-1 ring-line">
              <dt className="text-[11px] text-muted">Missions payées</dt>
              <dd className="font-display text-lg font-extrabold text-ink">{active.deals_paid}</dd>
            </div>
          </dl>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-muted">Les missions déjà acceptées gardent leurs conditions si vous arrêtez.</p>
            <EndRepresentationButton linkId={active.id} label="Mettre fin à la représentation" />
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-line bg-white p-4 shadow-card">
          <p className="flex items-center gap-2 font-bold text-ink">
            <ShieldCheck className="h-4 w-4 text-brand" /> Vous êtes indépendant
          </p>
          <p className="mt-1 text-xs text-muted">
            Vous gardez 100 % du montant de vos missions. Bayele se rémunère côté marque.
          </p>
          <Link href="/creator/campaigns" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-brand hover:underline">
            Voir les campagnes <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}

      {/* Offers */}
      <div>
        <h2 className="mb-3 text-sm font-bold text-ink">Propositions reçues</h2>
        {pending.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-white p-8 text-center text-sm text-muted">
            Aucune proposition en attente.
          </div>
        ) : (
          <ul className="grid gap-3">
            {pending.map((l) => {
              const s = splitPayout(example, l.commission_rate);
              return (
                <li key={l.id} className="rounded-2xl border border-line bg-white p-4 shadow-card">
                  <div className="flex items-center gap-3">
                    <SmartAvatar src={l.counterpart_avatar} name={l.counterpart_name} className="h-10 w-10 shrink-0 text-sm" />
                    <div className="min-w-0">
                      <p className="truncate font-bold text-ink">{l.counterpart_name}</p>
                      <Link href={`/partners/${l.counterpart_handle}`} className="text-xs text-brand hover:underline">@{l.counterpart_handle}</Link>
                    </div>
                    <span className="ml-auto shrink-0 rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-bold text-[#9A5A05]">
                      {formatPct(l.commission_rate, 'fr')}
                    </span>
                  </div>
                  {l.message && <p className="mt-3 rounded-xl bg-surface px-3 py-2 text-sm text-ink/80">« {l.message} »</p>}
                  <div className="mt-3 rounded-xl border border-line p-3 text-xs text-muted">
                    <p className="flex items-center gap-1.5 font-semibold text-ink"><Info className="h-3.5 w-3.5 text-brand" /> Ce que cela signifie</p>
                    <ul className="mt-1.5 list-disc space-y-1 pl-5">
                      <li>
                        Sur une mission de {fmtFcfa(example)}, vous recevez {fmtFcfa(s.creator)} et votre partenaire {fmtFcfa(s.partner)}.
                        <span className="ml-1 rounded bg-surface px-1 text-[10px] font-semibold uppercase">Exemple</span>
                      </li>
                      <li>La commission s'applique aux missions acceptées pendant la représentation.</li>
                      <li>Un seul partenaire à la fois. Accepter décline les autres propositions.</li>
                      <li>Vous pouvez y mettre fin à tout moment.</li>
                    </ul>
                  </div>
                  <RespondButtons linkId={l.id} />
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {past.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-bold text-ink">Historique</h2>
          <ul className="grid gap-2">
            {past.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-white px-3 py-2 text-sm">
                <span className="truncate text-ink">{l.counterpart_name}</span>
                <span className="shrink-0 text-[11px] text-muted">{formatPct(l.commission_rate, 'fr')} · {STATUS_FR[l.status] ?? l.status}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
