import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Sparkles, Megaphone, Clock, CheckCircle2, Coins } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import { fmtFcfa, CREATOR_STATUS_FR } from '@/lib/data/campaigns';
import { ProofForm } from './proof-form';

export const dynamic = 'force-dynamic';

const COUNTRY_FR: Record<string, string> = { CM: '🇨🇲', CI: '🇨🇮', GA: '🇬🇦' };

export default async function CreatorDashboard() {
  const session = await getSession();
  if (!session.userId) redirect('/auth?mode=signin');
  if (!session.roles.includes('creator') && session.primary !== 'super_admin') redirect('/dashboard');

  const supabase = await createClient();
  const { data: assignments } = await supabase
    .from('campaign_creators')
    .select('id, status, agreed_payout_fcfa, created_at, campaign:campaigns(id, title, category, target_country, status)')
    .eq('creator_id', session.userId)
    .order('created_at', { ascending: false });

  const list = assignments ?? [];
  const earned = list
    .filter((a) => a.status === 'paid')
    .reduce((sum, a) => sum + (a.agreed_payout_fcfa ?? 0), 0);
  const active = list.filter((a) => ['applied', 'approved', 'content_submitted', 'verified'].includes(a.status)).length;

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-brand" />
          <h1 className="font-display text-2xl font-extrabold text-ink">Mon espace créateur</h1>
        </div>
        <Link
          href="/creator/campaigns"
          className="inline-flex min-h-tap items-center gap-1.5 rounded-xl bg-brand px-4 text-sm font-bold text-white transition hover:bg-brand-600 active:scale-95"
        >
          <Megaphone className="h-4 w-4" /> Campagnes
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-line bg-white p-4 shadow-card">
          <Coins className="h-4 w-4 text-accent" />
          <div className="mt-2 font-display text-2xl font-extrabold text-ink">{fmtFcfa(earned)}</div>
          <div className="text-xs text-muted">Gains encaissés</div>
        </div>
        <div className="rounded-2xl border border-line bg-white p-4 shadow-card">
          <Clock className="h-4 w-4 text-brand" />
          <div className="mt-2 font-display text-2xl font-extrabold text-ink">{active}</div>
          <div className="text-xs text-muted">Missions en cours</div>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-bold text-ink">Mes missions</h2>
        {list.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-white p-10 text-center">
            <p className="text-sm text-muted">Vous n'avez pas encore de mission.</p>
            <Link href="/creator/campaigns" className="mt-3 inline-block text-sm font-bold text-brand hover:underline">
              Découvrir les campagnes ouvertes →
            </Link>
          </div>
        ) : (
          <ul className="grid gap-3">
            {list.map((a) => {
              const camp = a.campaign as { title: string; category: string; target_country: string } | null;
              const paid = a.status === 'paid';
              const verified = a.status === 'verified';
              return (
                <li key={a.id} className="rounded-2xl border border-line bg-white p-4 shadow-card">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-ink">{camp?.title ?? 'Campagne'}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {camp?.category} · {COUNTRY_FR[camp?.target_country ?? ''] ?? camp?.target_country}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-display font-extrabold text-ink">{fmtFcfa(a.agreed_payout_fcfa)}</span>
                      <div
                        className={`mt-1 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                          paid
                            ? 'bg-emerald-50 text-emerald-700'
                            : verified
                              ? 'bg-brand-50 text-brand-700'
                              : a.status === 'rejected'
                                ? 'bg-surface text-muted'
                                : 'bg-accent-soft text-accent'
                        }`}
                      >
                        {paid && <CheckCircle2 className="h-3 w-3" />}
                        {CREATOR_STATUS_FR[a.status] ?? a.status}
                      </div>
                    </div>
                  </div>

                  {a.status === 'approved' && <ProofForm cc={a.id} />}
                  {a.status === 'content_submitted' && (
                    <p className="mt-3 rounded-lg bg-accent-soft/60 px-3 py-2 text-[11px] text-accent">
                      Votre preuve est en cours de vérification par la marque.
                    </p>
                  )}
                  {verified && (
                    <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-[11px] text-brand-700">
                      Preuve validée 🎉 Votre paiement Mobile Money est en préparation.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
