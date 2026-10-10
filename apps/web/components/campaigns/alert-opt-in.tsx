'use client';

import { useActionState } from 'react';
import { Bell, CheckCircle2, Loader2 } from 'lucide-react';
import { subscribeAlertAction } from '@/lib/alerts/actions';
import type { AlertState } from '@/lib/alerts/state';

export interface AlertCopy {
  title: string;
  country: string;
  category: string;
  allCountries: string;
  allCategories: string;
  submit: string;
  guestHint: string;
  inApp: string;
  confirmTitle: string;
  confirm: string;
  success: string;
  successBody: string;
  duplicate: string;
  limit: string;
  limitTitle: string;
  manage: string;
  invalid: string;
  profileRequired: string;
  error: string;
  remainingOne: string;
  remainingMany: string;
}

export interface AlertOptInProps {
  variant: 'panel' | 'band' | 'confirm';
  /** Logged out: submitting sends the visitor to sign-up (nothing is written). */
  guest: boolean;
  /** Validated `?ref` of the page, forwarded into the sign-up link. */
  refHandle?: string | null;
  defaults?: { country?: string | null; cat?: string | null };
  countries: { code: string; label: string }[];
  categories: { slug: string; label: string }[];
  copy: AlertCopy;
  /** Alerts left for a signed-in user (null for guests / unknown). 0 → « limite atteinte ». */
  remaining?: number | null;
  limit: number;
  /** Where « Gérer mes alertes » points. */
  manageHref: string;
  /** Band heading (the panel's heading lives in its parent). */
  heading?: string;
}

const fillN = (s: string, n: number) => s.replace('{n}', String(n));

/**
 * Campaign-alert opt-in (design §4). A real <form> posting to a server action, so it works before
 * (or without) JavaScript; with JS, the confirmation replaces the form in place.
 */
export function AlertOptIn(props: AlertOptInProps) {
  const { variant, guest, copy, countries, categories, defaults, limit } = props;
  const [state, action, pending] = useActionState<AlertState, FormData>(subscribeAlertAction, { status: 'idle' });

  const label = (country: string | null | undefined, cat: string | null | undefined) =>
    `${countries.find((c) => c.code === country)?.label ?? copy.allCountries} · ${categories.find((c) => c.slug === cat)?.label ?? copy.allCategories}`;

  if (state.status === 'ok' || state.status === 'duplicate') {
    const ok = state.status === 'ok';
    return (
      <div role="status" className={`flex items-start gap-3 rounded-2xl border p-4 ${ok ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-line bg-surface text-ink'}`}>
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <div className="text-[14px]">
          <p className="font-bold">{ok ? copy.success : copy.duplicate}</p>
          <p className="mt-0.5">{label(state.country, state.cat)}</p>
          {ok && <p className="mt-1">{copy.successBody}</p>}
          <a href={props.manageHref} className="mt-2 inline-flex min-h-tap items-center font-semibold underline underline-offset-2">
            {copy.manage}
          </a>
        </div>
      </div>
    );
  }

  const remaining = guest ? null : (props.remaining ?? null);
  if (remaining !== null && remaining <= 0) {
    return (
      <div role="status" className="rounded-2xl border border-line bg-surface p-4 text-[14px] text-ink">
        <p className="font-bold">{copy.limitTitle}</p>
        <p className="mt-0.5 text-muted">{fillN(copy.limit, limit)}</p>
        <a href={props.manageHref} className="mt-2 inline-flex min-h-tap items-center font-semibold text-brand-700 hover:text-brand">
          {copy.manage}
        </a>
      </div>
    );
  }

  const error = state.status === 'error' ? (state.error === 'limit' ? fillN(copy.limit, limit) : copy[state.error]) : null;
  const selectCls =
    'mt-1 w-full min-h-tap rounded-xl border border-line bg-white px-3 text-sm text-ink focus:border-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/30';
  const hidden = (
    <>
      {props.refHandle && <input type="hidden" name="ref" value={props.refHandle} />}
    </>
  );
  const footnote = (
    <p className="mt-2 text-[12px] text-muted">
      {guest ? copy.guestHint : copy.inApp}
      {remaining !== null && <> · {remaining === 1 ? copy.remainingOne : fillN(copy.remainingMany, remaining)}</>}
    </p>
  );
  const errorLine = error && (
    <p role="alert" className="mt-2 text-[13px] font-medium text-rose-700">
      {error}
    </p>
  );

  if (variant === 'confirm') {
    return (
      <form action={action} className="rounded-2xl border border-brand-100 bg-brand-50 p-4">
        {hidden}
        <input type="hidden" name="country" value={defaults?.country ?? ''} />
        <input type="hidden" name="cat" value={defaults?.cat ?? ''} />
        <p className="text-sm font-bold text-ink">{copy.confirmTitle}</p>
        <p className="mt-0.5 text-[14px] text-ink">{label(defaults?.country, defaults?.cat)}</p>
        <button type="submit" disabled={pending}
          className="mt-3 inline-flex min-h-tap w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 text-[15px] font-bold text-white shadow-card transition hover:bg-brand-600 active:scale-95 disabled:opacity-60 sm:w-auto">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Bell className="h-4 w-4" aria-hidden />} {copy.confirm}
        </button>
        {footnote}
        {errorLine}
      </form>
    );
  }

  const selects = (
    <>
      <label className="block">
        <span className="text-xs font-semibold text-ink">{copy.country}</span>
        <select name="country" defaultValue={defaults?.country ?? ''} className={selectCls}>
          <option value="">{copy.allCountries}</option>
          {countries.map((c) => (
            <option key={c.code} value={c.code}>{c.label}</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-xs font-semibold text-ink">{copy.category}</span>
        <select name="cat" defaultValue={defaults?.cat ?? ''} className={selectCls}>
          <option value="">{copy.allCategories}</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>{c.label}</option>
          ))}
        </select>
      </label>
    </>
  );

  if (variant === 'band') {
    return (
      <form action={action}>
        {hidden}
        <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto_auto] lg:items-end lg:gap-4">
          {props.heading && <p className="font-display text-lg font-bold text-ink lg:pb-3">{props.heading}</p>}
          {selects}
          <button type="submit" disabled={pending}
            className="inline-flex min-h-tap items-center justify-center gap-2 rounded-xl border border-line bg-white px-5 text-[15px] font-bold text-ink transition hover:border-brand hover:text-brand active:scale-95 disabled:opacity-60">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Bell className="h-4 w-4" aria-hidden />} {copy.submit}
          </button>
        </div>
        {footnote}
        {errorLine}
      </form>
    );
  }

  return (
    <form action={action}>
      {hidden}
      <div className="grid gap-3 sm:grid-cols-2">{selects}</div>
      <button type="submit" disabled={pending}
        className="mt-4 inline-flex min-h-tap w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 text-[15px] font-bold text-white shadow-card transition hover:bg-brand-600 active:scale-95 disabled:opacity-60">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Bell className="h-4 w-4" aria-hidden />} {copy.submit}
      </button>
      {footnote}
      {errorLine}
    </form>
  );
}
