import Link from 'next/link';
import { Flag } from 'lucide-react';
import type { Dictionary } from '@/i18n/dictionaries';
import { fill } from '@/lib/campaign-board';
import type { ContactRequestRow } from '@/lib/data/partner-gov';
import { hoursSince } from '@/lib/gov/rules';
import { MaskedText } from '@/components/gov/masked-text';
import { Chip, age } from './bits';
import { RequestDecision } from './request-decision';

export function RequestCard({ r, A, date }: { r: ContactRequestRow; A: Dictionary['adminPartners']; date: (iso: string) => string }) {
  return (
    <li className="min-w-0">
      <article className="min-w-0 space-y-2 rounded-2xl border border-line bg-white p-4 shadow-card">
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
          <time dateTime={r.created_at}>{age(r.created_at, A)}</time>
          {r.status === 'pending' && hoursSince(r.created_at) > 24 && <Chip tone="blocked">{A.requests.overdue}</Chip>}
          {r.status !== 'pending' && <Chip tone="closed">{(A.requestStatus as Record<string, string>)[r.status]}</Chip>}
          {r.self_dealing && (
            <Link href={`/admin/partners/flags?tab=self&partner=${r.partner_id}`}>
              <Chip tone="blocked"><Flag className="h-3 w-3" aria-hidden /> {A.requests.selfDealing}</Chip>
            </Link>
          )}
        </div>
        <p className="flex min-w-0 flex-wrap items-center gap-1.5 text-sm">
          <span className="min-w-0 truncate font-bold text-ink">{r.brand_company || r.brand_handle} (@{r.brand_handle})</span>
          <Chip tone={r.brand_status === 'active' ? 'ok' : 'blocked'}>{r.brand_status === 'active' ? A.requests.brandApproved : A.requests.brandNotApproved}</Chip>
        </p>
        <p className="min-w-0 truncate text-sm text-ink">→ <Link href={`/admin/partners/${r.partner_id}`} className="font-semibold hover:underline">{r.partner_name} (@{r.partner_handle})</Link></p>
        <p className="line-clamp-3 text-sm text-ink [overflow-wrap:anywhere]">« <MaskedText text={r.goal} /> »</p>
        {r.masked_kinds && r.masked_kinds.length > 0 && <p className="text-[11px] text-muted">{A.requests.masked}</p>}
        <p className="text-xs text-muted [overflow-wrap:anywhere]">
          {r.budget_range ? fill(A.requests.budget, { value: r.budget_range }) : A.requests.budgetNone}
          {r.deadline ? ` · ${fill(A.requests.deadline, { date: date(r.deadline) })}` : ''}
        </p>
        {r.status === 'pending' && <div className="border-t border-line pt-3"><RequestDecision A={A} requestId={r.id} /></div>}
      </article>
    </li>
  );
}
