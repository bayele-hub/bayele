import { redirect } from 'next/navigation';
import { Megaphone, MapPin, Coins, Clock } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import { fmtFcfa } from '@/lib/data/campaigns';
import { CampaignBriefDetails } from '@/components/campaign-brief-details';
import { ApplyButton } from './apply-button';
import { countryLabel } from '@/lib/countries';
import { AlertsSection } from './alerts-section';
import { getDictionary } from '@/i18n/dictionaries';
import { SectionTip } from '@/components/admin/section-tip';

export const dynamic = 'force-dynamic';


type SP = { alert_country?: string; alert_cat?: string; alerts_msg?: string };

export default async function CreatorCampaigns({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
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
    supabase
      .from('campaign_creators')
      .select('campaign_id, status, created_at, campaign:campaigns!campaign_creators_campaign_id_fkey(title, payout_per_creator_fcfa)')
      .eq('creator_id', session.userId)
      .order('created_at', { ascending: false }),
  ]);
  const { t } = await getDictionary();
  const U = t.creatorUx;
  const T = t.creatorTips;
  const pendingProfile = session.profile?.status === 'pending_review';
  type Mine = { campaign_id: string; status: string; created_at: string; campaign: { title: string; payout_per_creator_fcfa: number } | { title: string; payout_per_creator_fcfa: number }[] | null };
  const applications = ((mine ?? []) as Mine[]).map((m) => ({ ...m, campaign: Array.isArray(m.campaign) ? m.campaign[0] : m.campaign }));

  const appliedTo = new Set(applications.map((m) => m.campaign_id));
  const open = (campaigns ?? []).filter((c) => !appliedTo.has(c.id));

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-2">
        <Megaphone className="h-5 w-5 text-brand" />
        <h1 className="font-display text-2xl font-extrabold text-ink">Campagnes ouvertes</h1>
      </div>

      {/* pending_review creators can already browse, apply and set alerts (migration 0021). Copy reused
          from the campaign apply CTA. */}
      {pendingProfile && (
        <p role="status" className="flex items-start gap-2 rounded-2xl border border-accent/30 bg-accent-soft px-3 py-2.5 text-[13px] text-ink">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
          <span>{U.pendingBanner}</span>
        </p>
      )}

      {/* « Mes candidatures » (D8): a pending creator keeps sight of what they applied to. */}
      {applications.length > 0 && (
        <section aria-labelledby="my-applications" className="rounded-2xl border border-line bg-white p-4 shadow-card">
          <h2 id="my-applications" className="flex items-center text-sm font-bold text-ink">
            {U.applicationsTitle}
            <SectionTip id="creator-applications" label={U.applicationsTitle} text={T.applications} ariaTemplate={T.aria} />
          </h2>
          <ul className="mt-2 divide-y divide-line">
            {applications.map((a) => (
              <li key={a.campaign_id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{a.campaign?.title ?? '—'}</p>
                  <p className="text-[11px] text-muted">
                    {a.campaign ? `${fmtFcfa(a.campaign.payout_per_creator_fcfa)} · ` : ''}
                    {new Date(a.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </p>
                  {pendingProfile && a.status === 'applied' && <p className="mt-0.5 text-[11px] font-semibold text-ink">{U.applicationsPending}</p>}
                </div>
                <span className="shrink-0 rounded-full bg-surface px-2.5 py-0.5 text-[11px] font-bold text-ink">
                  {t.applyCta.status[a.status as keyof typeof t.applyCta.status] ?? a.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <AlertsSection alertCountry={sp.alert_country} alertCat={sp.alert_cat} msg={sp.alerts_msg} defaultCountry={session.profile?.country ?? null} />

      {open.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white p-10 text-center text-sm text-muted">
          {U.campaignsEmpty}
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
                      <MapPin className="h-3 w-3" /> {countryLabel(c.target_country)}
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
