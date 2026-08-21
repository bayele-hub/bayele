import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Users, FileCheck, Lock } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import { fmtFcfa, CAMPAIGN_STATUS_FR } from '@/lib/data/campaigns';
import { ApplicantRow, type Applicant } from './applicant-row';
import { ProofRow, type ProofItem } from './proof-row';
import { CancelCampaignButton } from './cancel-campaign-button';
import { ShareCampaignButton } from '@/components/share-campaign-button';

export const dynamic = 'force-dynamic';

export default async function CampaignDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session.userId) redirect('/auth?mode=signin');

  const supabase = await createClient();
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, owner_id, title, brief, category, target_country, status, total_budget_fcfa, payout_per_creator_fcfa, creator_count_target')
    .eq('id', id)
    .maybeSingle();

  if (!campaign) notFound();
  // Campaigns are publicly readable once published, so gate the owner console explicitly.
  if (campaign.owner_id !== session.userId && session.primary !== 'super_admin') redirect('/dashboard');

  const { data: ccRows } = await supabase
    .from('campaign_creators')
    .select('id, status, agreed_payout_fcfa, creator:profiles!campaign_creators_creator_id_fkey(display_name, handle, city, country, status)')
    .eq('campaign_id', id)
    .order('created_at', { ascending: true });

  const rows = ccRows ?? [];
  const ccIds = rows.map((r) => r.id);

  const { data: proofRows } = ccIds.length
    ? await supabase
        .from('proof_of_post')
        .select('id, campaign_creator_id, media_storage_path, verification_score, is_valid')
        .in('campaign_creator_id', ccIds)
    : { data: [] as { id: string; campaign_creator_id: string; media_storage_path: string; verification_score: number | null; is_valid: boolean | null }[] };

  const nameByCc = new Map(
    rows.map((r) => {
      const c = r.creator as { display_name: string } | { display_name: string }[] | null;
      const name = Array.isArray(c) ? c[0]?.display_name : c?.display_name;
      return [r.id, name ?? 'Créateur'];
    }),
  );

  type CreatorEmbed = { display_name: string; handle: string; city: string; country: string; status: string };
  const applicants: Applicant[] = rows.map((r) => {
    const c = r.creator as CreatorEmbed | CreatorEmbed[] | null;
    const cr = Array.isArray(c) ? c[0] : c;
    return {
      id: r.id,
      displayName: cr?.display_name ?? 'Créateur',
      handle: cr?.handle ?? '—',
      city: cr?.city ?? '',
      country: cr?.country ?? '',
      payout: r.agreed_payout_fcfa,
      status: r.status,
      verified: cr?.status === 'active',
    };
  });

  const proofs: ProofItem[] = (proofRows ?? []).map((p) => ({
    proofId: p.id,
    creatorName: nameByCc.get(p.campaign_creator_id) ?? 'Créateur',
    url: p.media_storage_path,
    score: p.verification_score,
    isValid: p.is_valid,
  }));

  const pendingApps = applicants.filter((a) => a.status === 'applied').length;
  const openProofs = proofs.filter((p) => p.isValid === null).length;

  return (
    <section className="space-y-6">
      <Link href="/business/dashboard" className="inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-brand">
        <ArrowLeft className="h-3.5 w-3.5" /> Mes campagnes
      </Link>

      <div className="rounded-2xl border border-line bg-white p-4 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold uppercase text-brand-700">{campaign.category}</span>
            <h1 className="mt-1.5 font-display text-xl font-extrabold text-ink">{campaign.title}</h1>
            <p className="mt-0.5 text-xs text-muted">{campaign.brief}</p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-[11px] font-bold text-muted">
            <Lock className="h-3 w-3" /> {CAMPAIGN_STATUS_FR[campaign.status] ?? campaign.status}
          </span>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-xs">
          <span className="text-muted">{campaign.creator_count_target} créateurs · {fmtFcfa(campaign.payout_per_creator_fcfa)} / créateur</span>
          <span className="font-display font-extrabold text-ink">{fmtFcfa(campaign.total_budget_fcfa)}</span>
        </div>
        {(campaign.status === 'draft' || campaign.status === 'pending_funding') && (
          <CancelCampaignButton campaignId={campaign.id} />
        )}
        {(campaign.status === 'published' || campaign.status === 'in_progress') && (
          <ShareCampaignButton campaignId={campaign.id} />
        )}
      </div>

      <div>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-ink">
          <Users className="h-4 w-4 text-brand" /> Candidatures {pendingApps > 0 && <span className="rounded-full bg-accent px-1.5 text-[10px] text-white">{pendingApps}</span>}
        </h2>
        {applicants.length === 0 ? (
          <div className="rounded-2xl border border-line bg-white p-6 text-center text-sm text-muted">Aucune candidature pour l'instant.</div>
        ) : (
          <ul className="grid gap-3">
            {applicants.map((a) => (
              <ApplicantRow key={a.id} a={a} />
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-ink">
          <FileCheck className="h-4 w-4 text-brand" /> Preuves à vérifier {openProofs > 0 && <span className="rounded-full bg-accent px-1.5 text-[10px] text-white">{openProofs}</span>}
        </h2>
        {proofs.length === 0 ? (
          <div className="rounded-2xl border border-line bg-white p-6 text-center text-sm text-muted">Aucune preuve soumise pour l'instant.</div>
        ) : (
          <ul className="grid gap-3">
            {proofs.map((p) => (
              <ProofRow key={p.proofId} p={p} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
