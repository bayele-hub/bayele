import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Megaphone, MapPin, Coins, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import { fmtFcfa } from '@/lib/data/campaigns';
import { CampaignBriefDetails } from '@/components/campaign-brief-details';
import { ApplyForCreatorForm } from '@/components/representation-forms';
import { formatPct, splitPayout } from '@/lib/founder';

export const dynamic = 'force-dynamic';

const COUNTRY_FR: Record<string, string> = { CM: '🇨🇲 Cameroun', CI: "🇨🇮 Côte d'Ivoire", GA: '🇬🇦 Gabon' };

/**
 * Open campaigns, seen by a partner: apply on behalf of any creator they actively represent
 * (partner_apply_for_creator re-checks the representation server-side).
 */
export default async function PartnerCampaignsPage() {
  const session = await getSession();
  if (!session.userId) redirect('/auth?mode=signin');

  const supabase = await createClient();
  const [{ data: campaigns }, { data: linkRows }, { data: dealRows }] = await Promise.all([
    supabase
      .from('campaigns')
      .select('id, owner_id, title, brief, category, target_country, payout_per_creator_fcfa, status, created_at, platforms, content_type, deliverable_quantity, mandatory_tags, deadline')
      .in('status', ['published', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(100),
    supabase.rpc('my_partner_links'),
    supabase.rpc('partner_deals'),
  ]);

  const roster = (linkRows ?? []).filter((l) => l.my_side === 'partner' && l.status === 'active');
  // Which of my creators are already on which campaign (so they aren't offered twice).
  const taken = new Set((dealRows ?? []).map((d) => `${d.campaign_id}:${d.creator_id}`));
  const open = (campaigns ?? []).filter((c) => c.owner_id !== session.userId);

  return (
    <section className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-brand" />
          <h1 className="font-display text-xl font-extrabold text-ink">Campagnes ouvertes</h1>
        </div>
        <p className="mt-0.5 text-xs text-muted">Postulez pour les créateurs que vous représentez. La marque valide chaque candidature.</p>
      </div>

      {roster.length === 0 && (
        <Link href="/partner/creators" className="flex items-center gap-3 rounded-2xl border border-accent/30 bg-accent-soft p-4 transition hover:border-accent/50">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-accent"><Users className="h-4 w-4" /></span>
          <div>
            <p className="text-sm font-bold text-ink">Constituez d'abord votre portefeuille</p>
            <p className="text-[11px] text-muted">Proposez à des créateurs de les représenter. Dès qu'ils acceptent, vous pouvez postuler pour eux.</p>
          </div>
        </Link>
      )}

      {open.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white p-10 text-center text-sm text-muted">
          Aucune campagne ouverte pour le moment.
        </div>
      ) : (
        <ul className="grid gap-3">
          {open.map((c) => {
            const eligible = roster
              .filter((l) => !taken.has(`${c.id}:${l.counterpart_id}`))
              .map((l) => ({
                id: l.counterpart_id,
                name: `${l.counterpart_name} — votre part ${fmtFcfa(splitPayout(c.payout_per_creator_fcfa, l.commission_rate).partner)} (${formatPct(l.commission_rate, 'fr')})`,
              }));
            return (
              <li key={c.id} className="rounded-2xl border border-line bg-white p-4 shadow-card">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold uppercase text-brand-700">{c.category}</span>
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted">
                    <MapPin className="h-3 w-3" /> {COUNTRY_FR[c.target_country] ?? c.target_country}
                  </span>
                </div>
                <p className="mt-1.5 font-bold text-ink">{c.title}</p>
                <p className="mt-0.5 line-clamp-2 text-xs text-muted">{c.brief}</p>
                <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-bold text-ink">
                  <Coins className="h-4 w-4 text-accent" /> {fmtFcfa(c.payout_per_creator_fcfa)}
                  <span className="text-[11px] font-normal text-muted">/ créateur</span>
                </p>
                <div className="mt-3">
                  <CampaignBriefDetails
                    brief={{
                      platforms: c.platforms ?? [],
                      contentType: c.content_type,
                      deliverableQuantity: c.deliverable_quantity,
                      mandatoryTags: c.mandatory_tags,
                      deadline: c.deadline,
                    }}
                  />
                </div>
                {roster.length > 0 && (
                  <div className="mt-3 border-t border-line pt-3">
                    {eligible.length > 0 ? (
                      <ApplyForCreatorForm campaignId={c.id} creators={eligible} />
                    ) : (
                      <p className="text-[11px] text-muted">Tous vos créateurs sont déjà positionnés sur cette campagne.</p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
