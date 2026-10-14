import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { getDictionary } from '@/i18n/dictionaries';
import { adminContactRequests, type ContactRequestRow } from '@/lib/data/partner-gov';
import { SectionTip } from '@/components/admin/section-tip';
import { HubRail } from '../_components/hub-rail';
import { RequestCard } from '../_components/request-card';

export const dynamic = 'force-dynamic';

const STATUSES = ['pending', 'approved', 'declined', 'withdrawn', 'expired', 'all'] as const;

/** §1.9 contact-request queue (24 h target), oldest first; status chips in the URL. */
export default async function RequestsQueue({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const [session, sp, { locale, t }] = await Promise.all([getSession(), searchParams, getDictionary()]);
  if (!session.userId) redirect('/auth?mode=signin');
  const A = t.adminPartners;
  const status = (STATUSES as readonly string[]).includes(sp.status ?? '') ? (sp.status as (typeof STATUSES)[number]) : 'pending';
  const rows = await adminContactRequests(status === 'all' ? null : (status as ContactRequestRow['status']));
  const date = (iso: string) => new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
  const labels = A.requests.status;

  return (
    <section className="min-w-0 space-y-4">
      <h2 className="flex items-center text-sm font-bold text-ink">{A.hub[1]}<SectionTip id="ap-requests" label={A.hub[1]!} text={A.tips.requests} ariaTemplate={t.admin.briefs.tips.aria} /></h2>
      <HubRail active={1} labels={A.hub} />
      <div className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex min-w-max gap-2">
          {STATUSES.map((s, i) => (
            <li key={s}>
              <Link href={s === 'pending' ? '/admin/partners/requests' : `/admin/partners/requests?status=${s}`} aria-current={status === s ? 'page' : undefined}
                className={`inline-flex min-h-tap items-center whitespace-nowrap rounded-full border px-3.5 text-xs font-bold ${status === s ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink'}`}>
                {labels[i]}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {rows === null ? (
        <p className="rounded-2xl border border-line bg-white p-4 text-sm text-muted">{A.unavailable}</p>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-line bg-white p-6 text-center text-sm text-muted">{A.requests.empty}</p>
      ) : (
        <ul className="grid min-w-0 gap-3 lg:grid-cols-2">
          {rows.map((r) => <RequestCard key={r.id} r={r} A={A} date={date} />)}
        </ul>
      )}
    </section>
  );
}
