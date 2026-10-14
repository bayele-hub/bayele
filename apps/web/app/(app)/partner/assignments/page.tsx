import Link from 'next/link';
import { redirect } from 'next/navigation';
import { MessageCircle } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { getDictionary } from '@/i18n/dictionaries';
import { fill } from '@/lib/campaign-board';
import { amIDelisted, myAssignments } from '@/lib/data/partner-gov';
import { SectionTip } from '@/components/admin/section-tip';
import { MaskedText } from '@/components/gov/masked-text';
import { RequestEnd } from './request-end';

export const dynamic = 'force-dynamic';

/** §3.1 partner introductions: read-only (P3, no accept step) + « Demander la fin ». */
export default async function PartnerAssignments() {
  const [session, { locale, t }] = await Promise.all([getSession(), getDictionary()]);
  if (!session.userId) redirect('/auth?mode=signin');
  if (!session.roles.includes('consultant')) redirect('/dashboard');
  const P = t.partnerAssignments;
  const A = t.adminPartners;
  const [rows, delisted] = await Promise.all([myAssignments(session.userId, 'partner'), amIDelisted(session.userId)]);
  const date = (iso: string | null) => (iso ? new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso)) : '');
  const active = rows.filter((r) => r.status === 'active');
  const ended = rows.filter((r) => r.status !== 'active');
  const origin = (k: string) => (k === 'contact_request' ? A.origin.contact_request : k === 'admin' ? A.origin.admin : A.origin.legacy_retainer);

  return (
    <section className="min-w-0 space-y-4">
      <h1 className="font-display text-2xl font-extrabold text-ink">{P.title}</h1>
      {delisted && <p className="rounded-xl border border-line bg-surface p-3 text-[13px] text-ink">{P.delisted}</p>}

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-line bg-white p-6 text-center shadow-card">
          <p className="flex items-center justify-center text-sm text-muted">
            {P.empty}
            <SectionTip id="pa-how" label={P.title} text={P.tips.howItWorks} ariaTemplate={t.admin.briefs.tips.aria} />
          </p>
        </div>
      ) : (
        <>
          <h2 className="text-sm font-bold text-ink">{P.active}</h2>
          {active.length === 0 ? <p className="text-sm text-muted">{P.empty}</p> : (
            <ul className="grid min-w-0 gap-3 lg:grid-cols-2">
              {active.map((a) => {
                const openReq = a.endRequests.find((e) => e.status === 'open');
                const dismissed = !openReq ? a.endRequests.find((e) => e.status === 'dismissed') : undefined;
                return (
                  <li key={a.id} className="min-w-0 space-y-1.5 rounded-2xl border border-line bg-white p-4 shadow-card">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700">{origin(a.origin)}</span>
                      {openReq && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-bold text-ink">{P.endRequested}</span>}
                    </div>
                    <p className="truncate font-bold text-ink">{a.other?.display_name ?? '—'}{a.other?.city ? ` · ${a.other.city}` : ''}</p>
                    <p className="truncate text-xs text-muted">{a.campaignTitle ? fill(A.scope.campaign, { title: a.campaignTitle }) : A.scope.brand}</p>
                    {a.goal && <p className="line-clamp-3 text-sm text-ink [overflow-wrap:anywhere]">{P.need.split('{goal}')[0]}<MaskedText text={a.goal} />{P.need.split('{goal}')[1]}</p>}
                    {a.note && <p className="text-xs text-ink [overflow-wrap:anywhere]">{fill(P.note, { note: a.note })}</p>}
                    {a.expiresAt && !a.signed && <p className="text-xs text-muted">{fill(P.until, { date: date(a.expiresAt) })}</p>}
                    {a.signed && <p className="text-xs text-muted">{t.businessPartners.contractSigned}</p>}
                    {dismissed?.decision_note && <p className="text-[12px] text-muted [overflow-wrap:anywhere]">{fill(P.endDismissed, { note: dismissed.decision_note })}</p>}
                    <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
                      {a.conversation_id && (
                        <Link href={`/messages/${a.conversation_id}`} className="inline-flex min-h-tap items-center gap-1.5 rounded-xl bg-brand px-4 text-sm font-bold text-white">
                          <MessageCircle className="h-4 w-4" aria-hidden /> {P.openThread}
                        </Link>
                      )}
                      {openReq ? <p className="text-xs text-muted">{fill(P.endRequestedOn, { date: date(openReq.created_at) })}</p> : <RequestEnd P={P} assignmentId={a.id} />}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {ended.length > 0 && (
            <details className="rounded-2xl border border-line bg-white p-4 shadow-card">
              <summary className="min-h-tap cursor-pointer text-sm font-bold text-brand-700">{P.ended} ({ended.length})</summary>
              <ul className="mt-2 space-y-3">
                {ended.map((a) => (
                  <li key={a.id} className="min-w-0 space-y-1 border-t border-line pt-2 text-sm">
                    <p className="truncate font-semibold text-ink">{a.other?.display_name ?? '—'}</p>
                    <p className="truncate text-xs text-muted">{a.campaignTitle ? fill(A.scope.campaign, { title: a.campaignTitle }) : A.scope.brand} · {fill(P.endedOn, { date: date(a.ended_at) })}</p>
                    {a.end_reason && <p className="text-xs text-muted [overflow-wrap:anywhere]">{fill(P.endReason, { reason: a.end_reason === 'window_expired' ? t.messaging.header.expired : a.end_reason })}</p>}
                    {a.conversation_id && <Link href={`/messages/${a.conversation_id}`} className="inline-flex min-h-tap items-center text-xs font-bold text-brand-700">{P.viewMessages}</Link>}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </section>
  );
}
