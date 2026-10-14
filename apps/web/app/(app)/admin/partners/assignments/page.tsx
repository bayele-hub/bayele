import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { getDictionary } from '@/i18n/dictionaries';
import { fill } from '@/lib/campaign-board';
import { adminEndRequests, campaignTitles, type EndRequestRow } from '@/lib/data/partner-gov';
import { SectionTip } from '@/components/admin/section-tip';
import { MaskedText } from '@/components/gov/masked-text';
import { HubRail } from '../_components/hub-rail';
import { Chip, age } from '../_components/bits';
import { DismissEndRequest, EndAssignment } from '../_components/row-actions';

export const dynamic = 'force-dynamic';

const STATUSES = ['open', 'accepted', 'dismissed', 'all'] as const;

/** §1.4b « Fins demandées » queue: end the assignment (prefilled reason) or decline with a note. */
export default async function EndRequestsQueue({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const [session, sp, { t }] = await Promise.all([getSession(), searchParams, getDictionary()]);
  if (!session.userId) redirect('/auth?mode=signin');
  const A = t.adminPartners;
  const status = (STATUSES as readonly string[]).includes(sp.status ?? '') ? (sp.status as (typeof STATUSES)[number]) : 'open';
  const rows = await adminEndRequests(status === 'all' ? null : (status as EndRequestRow['status']));
  const titles = await campaignTitles((rows ?? []).map((r) => r.campaign_id ?? ''));

  return (
    <section className="min-w-0 space-y-4">
      <h2 className="flex items-center text-sm font-bold text-ink">{A.endRequests.title}<SectionTip id="ap-ends" label={A.endRequests.title} text={A.tips.endRequests} ariaTemplate={t.admin.briefs.tips.aria} /></h2>
      <HubRail active={2} labels={A.hub} />
      <div className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex min-w-max gap-2">
          {STATUSES.map((s, i) => (
            <li key={s}>
              <Link href={s === 'open' ? '/admin/partners/assignments' : `/admin/partners/assignments?status=${s}`} aria-current={status === s ? 'page' : undefined}
                className={`inline-flex min-h-tap items-center whitespace-nowrap rounded-full border px-3.5 text-xs font-bold ${status === s ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink'}`}>
                {A.endRequests.status[i]}
              </Link>
            </li>
          ))}
        </ul>
      </div>
      {rows === null ? (
        <p className="rounded-2xl border border-line bg-white p-4 text-sm text-muted">{A.unavailable}</p>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-line bg-white p-6 text-center text-sm text-muted">{A.endRequests.empty}</p>
      ) : (
        <ul className="grid min-w-0 gap-3 lg:grid-cols-2">
          {rows.map((r) => (
            <li key={r.id} className="min-w-0">
              <article className="min-w-0 space-y-2 rounded-2xl border border-line bg-white p-4 shadow-card">
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                  <time dateTime={r.created_at}>{age(r.created_at, A)}</time>
                  {r.status !== 'open' && <Chip tone="closed">{(A.endStatus as Record<string, string>)[r.status]}</Chip>}
                </div>
                <p className="min-w-0 text-sm text-ink [overflow-wrap:anywhere]">
                  <Link href={`/admin/partners/${r.partner_id}`} className="font-bold hover:underline">@{r.partner_handle}</Link>
                  {' → '}{r.brand_company ? `${r.brand_company} (@${r.brand_handle})` : `@${r.brand_handle}`}
                </p>
                <p className="truncate text-xs text-muted">{r.campaign_id ? fill(A.scope.campaign, { title: titles.get(r.campaign_id) ?? '…' }) : A.scope.brand}</p>
                <p className="line-clamp-3 text-sm text-ink [overflow-wrap:anywhere]">« <MaskedText text={r.reason} /> »</p>
                {r.decision_note && <p className="text-xs text-muted [overflow-wrap:anywhere]">{fill(A.decisionNote, { note: r.decision_note })}</p>}
                {r.status === 'open' && (
                  <div className="flex flex-wrap items-start justify-between gap-2 border-t border-line pt-3">
                    <DismissEndRequest A={A} requestId={r.id} />
                    {r.assignment_status === 'active' && (
                      <EndAssignment A={A} assignmentId={r.assignment_id} brand={r.brand_company || `@${r.brand_handle}`} partnerId={r.partner_id} primary
                        prefill={fill(A.endRequests.prefill, { reason: r.reason })} />
                    )}
                  </div>
                )}
              </article>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
