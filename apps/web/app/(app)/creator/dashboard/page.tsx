import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Coins, Clock, CheckCircle2, Megaphone, Wallet, BadgeCheck, ArrowRight } from 'lucide-react';
import { SmartAvatar } from '@/components/smart-avatar';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import { fmtFcfa, CREATOR_STATUS_FR } from '@/lib/data/campaigns';
import { ProofForm } from './proof-form';

export const dynamic = 'force-dynamic';

const COUNTRY_FR: Record<string, string> = { CM: '🇨🇲', CI: '🇨🇮', GA: '🇬🇦' };

export default async function CreatorDashboard() {
  const session = await getSession();
  if (!session.userId) redirect('/auth?mode=signin');

  const supabase = await createClient();
  const [{ data: assignments }, { data: creatorProfile }] = await Promise.all([
    supabase
      .from('campaign_creators')
      .select('id, status, agreed_payout_fcfa, created_at, campaign:campaigns(id, title, category, target_country, status)')
      .eq('creator_id', session.userId)
      .order('created_at', { ascending: false }),
    // payout settings via the definer RPC (is_pro + own momo — momo columns are not directly selectable, 0018).
    supabase.rpc('get_my_payout_settings').maybeSingle(),
  ]);
  const payoutConfigured = !!creatorProfile?.momo_payout_phone_e164;

  const list = assignments ?? [];
  const earned = list.filter((a) => a.status === 'paid').reduce((s, a) => s + (a.agreed_payout_fcfa ?? 0), 0);
  const pendingPay = list.filter((a) => a.status === 'verified').reduce((s, a) => s + (a.agreed_payout_fcfa ?? 0), 0);
  const activeCount = list.filter((a) => ['applied', 'approved', 'content_submitted', 'verified'].includes(a.status)).length;
  const toDo = list.filter((a) => a.status === 'approved').length;
  const firstName = (session.profile?.display_name ?? '').split(' ')[0] || 'créateur';

  return (
    <section className="space-y-6">
      {/* Hero */}
      <div className="rounded-2xl border border-line bg-gradient-to-br from-brand-50 via-white to-accent-soft p-4 shadow-card">
        <div className="flex items-center gap-2">
          <SmartAvatar src={session.profile?.avatar_url} name={firstName} className="h-9 w-9 shrink-0 text-sm" />
          <h1 className="font-display text-xl font-extrabold text-ink">Bonjour, {firstName} 👋</h1>
          {creatorProfile?.is_pro && (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700">
              <BadgeCheck className="h-3 w-3" /> PRO
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-muted">
          {toDo > 0
            ? `Vous avez ${toDo} mission${toDo > 1 ? 's' : ''} à publier — soumettez votre preuve pour être payé.`
            : 'Découvrez de nouvelles campagnes et postulez en un tap.'}
        </p>
        <Link
          href={toDo > 0 ? '#missions' : '/creator/campaigns'}
          className="mt-3 inline-flex min-h-tap items-center gap-1.5 rounded-xl bg-brand px-4 text-sm font-bold text-white transition hover:bg-brand-600 active:scale-95"
        >
          {toDo > 0 ? 'Mes missions' : (<>Voir les campagnes <ArrowRight className="h-3.5 w-3.5" /></>)}
        </Link>
      </div>

      {/* Payout nudge — a creator who hasn't set a Mobile Money number can't be paid. */}
      {!payoutConfigured && (
        <Link
          href="/profile"
          className="flex items-center justify-between gap-3 rounded-2xl border border-accent/30 bg-accent-soft p-4 transition hover:border-accent/50"
        >
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-accent">
              <Wallet className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-bold text-ink">Ajoutez votre numéro Mobile Money</p>
              <p className="text-[11px] text-muted">Sans numéro de paiement, vos gains ne peuvent pas être versés.</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-accent" />
        </Link>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat icon={Coins} label="Gains encaissés" value={fmtFcfa(earned)} tone="accent" />
        <Stat icon={Wallet} label="En attente" value={fmtFcfa(pendingPay)} tone="brand" />
        <Stat icon={Clock} label="Missions actives" value={String(activeCount)} tone="brand" />
      </div>

      {/* Missions */}
      <div id="missions" className="scroll-mt-24">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-ink">Mes missions</h2>
          <Link href="/creator/campaigns" className="inline-flex items-center gap-1 text-xs font-bold text-brand hover:underline">
            <Megaphone className="h-3.5 w-3.5" /> Postuler
          </Link>
        </div>
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
                      Preuve validée 🎉 Paiement Mobile Money en préparation.
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

function Stat({ icon: Icon, label, value, tone }: { icon: typeof Coins; label: string; value: string; tone: 'brand' | 'accent' }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-3 shadow-card">
      <Icon className={`h-4 w-4 ${tone === 'accent' ? 'text-accent' : 'text-brand'}`} />
      <div className="mt-2 truncate font-display text-base font-extrabold leading-tight tabular-nums text-ink" title={value}>{value}</div>
      <div className="text-[11px] text-muted">{label}</div>
    </div>
  );
}
