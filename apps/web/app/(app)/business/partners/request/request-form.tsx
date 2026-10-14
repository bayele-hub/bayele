'use client';

import { useActionState, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Loader2, ShieldCheck } from 'lucide-react';
import type { Dictionary } from '@/i18n/dictionaries';
import { SectionTip } from '@/components/admin/section-tip';
import { detectContacts } from '@/lib/gov/contact-detect';
import { BUDGET_MAX, GOAL_MAX, todayIso } from '@/lib/gov/contact-request';
import { requestPartnerAction, type RequestState } from '../actions';

/** §2.2 contact-request form: goal (1–280), budget (≤ 60), deadline (≥ today), consent tick (G7). */
export function RequestForm({ partnerId, R, consentLabel, readClause, aria }: { partnerId: string; R: Dictionary['partnerRequest']; consentLabel: string; readClause: string; aria: string }) {
  const [state, action, pending] = useActionState<RequestState, FormData>(requestPartnerAction, { error: null });
  const [goal, setGoal] = useState(state.values?.goal ?? '');
  const [budget, setBudget] = useState(state.values?.budget ?? '');
  const [debounced, setDebounced] = useState('');
  const consentRef = useRef<HTMLInputElement>(null);
  const goalRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { const t = setTimeout(() => setDebounced(`${goal} ${budget}`), 300); return () => clearTimeout(t); }, [goal, budget]);
  const willMask = useMemo(() => detectContacts(debounced).length > 0, [debounced]);
  useEffect(() => {
    if (state.field === 'consent') consentRef.current?.focus();
    else if (state.field === 'goal') goalRef.current?.focus();
  }, [state]);
  const err = (f: RequestState['field']) => (state.field === f ? state.error : null);
  const goalLen = goal.replace(/\s+/g, ' ').trim().length;

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="partner_id" value={partnerId} />
      <p className="flex items-start gap-2 rounded-xl border border-brand-100 bg-brand-50 p-3 text-[12px] text-ink">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" aria-hidden /> {R.notice}
      </p>

      <div>
        <label htmlFor="rq-goal" className="flex items-center text-xs font-semibold text-ink">
          {R.goal} <span aria-hidden className="ml-0.5 text-rose-700">*</span>
          <SectionTip id="rq-goal-tip" label={R.goal} text={R.tips.goal} ariaTemplate={aria} />
        </label>
        <textarea ref={goalRef} id="rq-goal" name="goal" rows={3} required value={goal} onChange={(e) => setGoal(e.target.value)} placeholder={R.goalPlaceholder}
          aria-invalid={!!err('goal')} aria-describedby={`rq-goal-count${err('goal') ? ' rq-goal-err' : ''}`}
          className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-[16px] text-ink focus:border-brand focus:outline-none sm:text-sm" />
        <p id="rq-goal-count" className={`text-right text-[11px] tabular-nums ${goalLen > GOAL_MAX ? 'font-bold text-rose-700' : 'text-muted'}`}>{R.goalCounter.replace('{n}', String(goalLen))}</p>
        {err('goal') && <p id="rq-goal-err" role="alert" className="text-xs font-semibold text-rose-700">{err('goal')}</p>}
      </div>

      <div>
        <label htmlFor="rq-budget" className="block text-xs font-semibold text-ink">{R.budget}</label>
        <input id="rq-budget" name="budget" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder={R.budgetPlaceholder}
          aria-invalid={!!err('budget')} aria-describedby="rq-budget-count"
          className="mt-1 min-h-tap w-full rounded-xl border border-line bg-white px-3 text-[16px] text-ink focus:border-brand focus:outline-none sm:text-sm" />
        <p id="rq-budget-count" className={`text-right text-[11px] tabular-nums ${budget.trim().length > BUDGET_MAX ? 'font-bold text-rose-700' : 'text-muted'}`}>{budget.trim().length}/{BUDGET_MAX}</p>
        {err('budget') && <p role="alert" className="text-xs font-semibold text-rose-700">{err('budget')}</p>}
      </div>

      {willMask && (
        <p aria-live="polite" className="flex items-start gap-2 rounded-xl border border-brand-100 bg-brand-50 p-3 text-[12px] text-ink">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" aria-hidden /> {R.maskNotice}
        </p>
      )}

      <div>
        <label htmlFor="rq-deadline" className="block text-xs font-semibold text-ink">{R.deadline}</label>
        <input id="rq-deadline" name="deadline" type="date" min={todayIso()} defaultValue={state.values?.deadline ?? ''} aria-invalid={!!err('deadline')}
          className="mt-1 min-h-tap w-full rounded-xl border border-line bg-white px-3 text-[16px] text-ink focus:border-brand focus:outline-none sm:w-60 sm:text-sm" />
        {err('deadline') && <p role="alert" className="text-xs font-semibold text-rose-700">{err('deadline')}</p>}
      </div>

      <div>
        <label className="flex min-h-tap items-start gap-2 text-[13px] text-ink">
          <input ref={consentRef} type="checkbox" name="consent" className="mt-1 h-5 w-5 shrink-0 accent-brand" aria-invalid={!!err('consent')} aria-describedby={err('consent') ? 'rq-consent-err' : undefined} />
          <span>{consentLabel} <span aria-hidden className="text-rose-700">*</span></span>
        </label>
        <Link href="/legal#non-contournement" target="_blank" className="ml-7 inline-flex min-h-[44px] items-center text-xs font-bold text-brand-700 underline">{readClause}</Link>
        {err('consent') && <p id="rq-consent-err" role="alert" className="ml-7 text-xs font-semibold text-rose-700">{err('consent')}</p>}
      </div>

      {state.error && !state.field && (
        <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
          {state.error}{' '}
          {state.code === 'request_already_open' && <Link href="/business/partners" className="font-bold underline">{R.alreadyOpenLink}</Link>}
        </p>
      )}

      <button type="submit" disabled={pending} className="inline-flex min-h-tap w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-bold text-white disabled:opacity-60 sm:w-auto">
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} {R.submit}
      </button>
      <p className="text-[12px] text-muted">{R.footnote}</p>
    </form>
  );
}
