import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Handshake, MessageCircle } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { getDictionary } from '@/i18n/dictionaries';
import { fill } from '@/lib/campaign-board';
import { myAssignments, myContactRequests } from '@/lib/data/partner-gov';
import { PILL_CLASS, requestTone } from '@/lib/gov/rules';
import { SmartAvatar } from '@/components/smart-avatar';
import { SectionTip } from '@/components/admin/section-tip';
import { MaskedText } from '@/components/gov/masked-text';
import { WithdrawButton } from './withdraw-button';

export const dynamic = 'force-dynamic';

/** §2.3 the brand's partners: assigned (active), under review (pending), history. */
export default async function BusinessPartners({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  const [session, sp, { locale, t }] = await Promise.all([getSession(), searchParams, getDictionary()]);
  if (!session.userId) redirect('/auth?mode=signin');
  if (!session.roles.includes('business') && session.primary !== 'super_admin') redirect('/dashboard');
  const B = t.businessPartners;
  const A = t.adminPartners;
  const [assignments, requests] = await Promise.all([myAssignments(session.userId, 'brand'), myContactRequests(session.userId)]);
  const date = (iso: string | null) => (iso ? new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso)) : '');
  const active = assignments.filter((a) => a.status === 'active');
  const ended = assignments.filter((a) => a.status !== 'active');
  const pending = requests.filter((r) => r.status === 'pending');
  const past = requests.filter((r) => r.status !== 'pending' && r.status !== 'approved');
  const reasons = A.requests.reasons as Record<string, { label: string }>;
  const pill = (tone: keyof typeof PILL_CLASS, label: string) => <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${PILL_CLASS[tone]}`}>{label}</span>;
  const nothing = !active.length && !pending.length && !ended.length && !past.length;
  const historyCount = ended.length + past.length;

  return (
    <section className="min-w-0 space-y-5">
      <h1 className="font-display text-2xl font-extrabold text-ink">{B.title}</h1>
      {sp.sent === '1' && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{t.partnerRequest.sent}</p>}

      {nothing ? (
        <div className="rounded-2xl border border-line bg-white p-6 text-center shadow-card">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-brand"><Handshake className="h-6 w-6" aria-hidden /></span>
          <h2 className="mt-3 font-bold text-ink">{B.empty.title}</h2>
          <p className="mt-1 text-sm text-muted">{B.empty.body}</p>
          <Link href="/business/talent?tab=partners" className="mt-4 inline-flex min-h-tap items-center rounded-xl bg-brand px-4 text-sm font-bold text-white">{B.empty.cta}</Link>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <h2 className="text-sm font-bold text-ink">{B.assigned}</h2>
            {active.length === 0 ? (
              <p className="text-sm text-muted">{B.retainerNone}</p>
            ) : (
              <ul className="grid min-w-0 gap-3 lg:grid-cols-2">
                {active.map((a) => (
                  <li key={a.id} className="min-w-0 space-y-2 rounded-2xl border border-line bg-white p-4 shadow-card">
                    <div className="flex min-w-0 items-start gap-3">
                      <SmartAvatar src={a.other?.avatar_url ?? null} name={a.other?.display_name ?? '?'} className="h-10 w-10 shrink-0 text-sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold text-ink">{a.other?.display_name ?? '—'}</p>
                        <p className="truncate text-xs text-muted">@{a.other?.handle}</p>
                      </div>
                      {pill('ok', B.pill.active)}
                    </div>
                    <p className="text-xs text-muted [overflow-wrap:anywhere]">
                      {a.campaignTitle ? fill(A.scope.campaign, { title: a.campaignTitle }) : A.scope.brand} · {(B.origin as Record<string, string>)[a.origin] ?? A.origin.legacy_retainer}
                    </p>
                    {a.note && <p className="text-xs text-ink [overflow-wrap:anywhere]">{fill(t.partnerAssignments.note, { note: a.note })}</p>}
                    <p className="flex items-center text-xs text-ink">
                      {a.signed ? B.contractSigned : a.expiresAt ? fill(B.windowUntil, { date: date(a.expiresAt) }) : null}
                      {(a.signed || a.expiresAt) && <SectionTip id={`bp-window-${a.id}`} label={B.windowUntil.replace(' {date}', '')} text={B.tips.window} ariaTemplate={t.admin.briefs.tips.aria} />}
                    </p>
                    <div className="flex flex-wrap gap-2 border-t border-line pt-3">
                      {a.conversation_id && (
                        <Link href={`/messages/${a.conversation_id}`} className="inline-flex min-h-tap items-center gap-1.5 rounded-xl bg-brand px-4 text-sm font-bold text-white">
                          <MessageCircle className="h-4 w-4" aria-hidden /> {t.partnerRequest.cta.openThread}
                        </Link>
                      )}
                      <Link href={`/business/retainers/new?partner=${encodeURIComponent(a.other?.handle ?? '')}`} className="inline-flex min-h-tap items-center rounded-xl border border-line bg-white px-4 text-sm font-bold text-ink">
                        {t.partnerRequest.cta.proposeRetainer}
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {pending.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-bold text-ink">{B.pill.review}</h2>
              <p className="text-xs text-muted">{B.reviewIntro}</p>
              <ul className="grid min-w-0 gap-3 lg:grid-cols-2">
                {pending.map((r) => (
                  <li key={r.id} className="min-w-0 space-y-1.5 rounded-2xl border border-line bg-white p-4 shadow-card">
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="min-w-0 flex-1 truncate font-bold text-ink">{r.partner?.display_name ?? '—'}</p>
                      {pill('wait', B.pill.review)}
                    </div>
                    <p className="line-clamp-2 text-sm text-ink [overflow-wrap:anywhere]"><MaskedText text={r.goal} /></p>
                    <p className="text-[11px] text-muted">{fill(B.sentOn, { date: date(r.created_at) })}</p>
                    <WithdrawButton requestId={r.id} L={{ withdraw: B.withdraw, withdrawConfirm: B.withdrawConfirm, withdrawYes: B.withdrawYes, withdrawn: B.withdrawn, cancel: t.adminPartners.cancel }} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {historyCount > 0 && (
            <details className="rounded-2xl border border-line bg-white p-4 shadow-card">
              <summary className="min-h-tap cursor-pointer text-sm font-bold text-brand-700">{fill(B.history, { n: historyCount })}</summary>
              <ul className="mt-2 space-y-3">
                {past.map((r) => (
                  <li key={r.id} className="min-w-0 space-y-1 border-t border-line pt-2 text-sm">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="min-w-0 truncate font-semibold text-ink">{r.partner?.display_name ?? '—'}</span>
                      {pill(requestTone(r.status), (B.pill as Record<string, string>)[r.status === 'declined' ? 'declined' : r.status === 'closed' ? 'ended' : r.status] ?? r.status)}
                    </div>
                    {r.status === 'declined' && r.decision_reason_code && (
                      <p className="text-xs text-muted [overflow-wrap:anywhere]">{fill(B.declinedReason, { label: reasons[r.decision_reason_code]?.label ?? '', message: r.decision_message ?? '' })}</p>
                    )}
                    {r.status === 'expired' && (
                      <p className="text-xs text-muted">{B.expired} {r.partner && <Link href={`/business/partners/request?partner=${encodeURIComponent(r.partner.handle)}`} className="font-bold text-brand-700 underline">{B.requestAgain}</Link>}</p>
                    )}
                  </li>
                ))}
                {ended.map((a) => (
                  <li key={a.id} className="min-w-0 space-y-1 border-t border-line pt-2 text-sm">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="min-w-0 truncate font-semibold text-ink">{a.other?.display_name ?? '—'}</span>
                      {pill('closed', a.end_reason === 'window_expired' ? B.pill.expired : B.pill.ended)}
                    </div>
                    <p className="text-xs text-muted">{fill(B.endedOn, { date: date(a.ended_at) })}</p>
                    {a.end_reason === 'window_expired' && a.other && (
                      <p className="text-xs text-muted">{B.expired} <Link href={`/business/partners/request?partner=${encodeURIComponent(a.other.handle)}`} className="font-bold text-brand-700 underline">{B.requestAgain}</Link></p>
                    )}
                    {a.conversation_id && <Link href={`/messages/${a.conversation_id}`} className="inline-flex min-h-tap items-center text-xs font-bold text-brand-700">{t.partnerAssignments.viewMessages}</Link>}
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
