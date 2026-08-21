import { redirect } from 'next/navigation';
import { Megaphone, MapPin, Coins } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import { fmtFcfa } from '@/lib/data/campaigns';
import { CampaignBriefDetails } from '@/components/campaign-brief-details';
import { ApplyButton } from './apply-button';

export const dynamic = 'force-dynamic';

const COUNTRY_FR: Record<string, string> = { CM: '🇨🇲 Cameroun', CI: "🇨🇮 Côte d'Ivoire", GA: '🇬🇦 Gabon' };

export default async function CreatorCampaigns() {
  const session = await getSession();
  if (!session.userId) redirect('/auth?mode=signin');
  if (!session.roles.includes('creator') && session.primary !== 'super_admin') redirect('/dashboard');

  const supabase = await createClient();

  // Open campaigns (RLS exposes published/in_progress/completed) + the ids I've already applied to.
  const [{ data: campaigns }, { data: mine }] = await Promise.all([
    supabase
      .from('campaigns')
      .select('id, title, brief, category, target_country, payout_per_creator_fcfa, creator_count_target, status, created_at, platforms, content_type, deliverable_quantity, mandatory_tags, deadline')
      .in('status', ['published', 'in_progress'])
      .order('created_at', { ascending: false }),
    supabase.from('campaign_creators').select('campaign_id').eq('creator_id', session.userId),
  ]);

  const appliedTo = new Set((mine ?? []).map((m) => m.campaign_id));
  const open = (campaigns ?? []).filter((c) => !appliedTo.has(c.id));

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-2">
        <Megaphone className="h-5 w-5 text-brand" />
        <h1 className="font-display text-2xl font-extrabold text-ink">Campagnes ouvertes</h1>
      </div>

      {open.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white p-10 text-center text-sm text-muted">
          Aucune nouvelle campagne pour le moment. Revenez bientôt — les marques publient régulièrement.
        </div>
      ) : (
        <ul className="grid gap-3">
          {open.map((c) => (
            <li key={c.id} className="rounded-2xl border border-line bg-white p-4 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
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
                </div>
                <ApplyButton campaignId={c.id} />
              </div>
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
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
