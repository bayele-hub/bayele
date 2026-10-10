import { Bell, Share2, X } from 'lucide-react';
import { getDictionary } from '@/i18n/dictionaries';
import { AlertOptIn } from '@/components/campaigns/alert-opt-in';
import { alertOptions } from '@/components/campaigns/alert-props';
import { removeAlertAction } from '@/lib/alerts/actions';
import { getMyAlerts, getMyReferralCount } from '@/lib/data/alerts';
import { parseAlertFilters } from '@/lib/alerts/state';
import { alertsManagePath } from '@/lib/auth/campaign-ctas';
import { categorySlugOf } from '@/lib/campaign-categories';
import { fill, plural } from '@/lib/campaign-board';

/**
 * « Mes alertes » (design §4) — right under the H1 of /creator/campaigns, where creators look for
 * work. Lists alerts as removable chips (server-action forms, no JS needed), shows how many are left
 * out of campaign_alert_limit() (C5), and offers the one-tap confirm card when the creator comes
 * back from the guest opt-in (?alert_country=…&alert_cat=…). Also the referral count (C3: count only).
 */
export async function AlertsSection({ alertCountry, alertCat, msg, defaultCountry }: { alertCountry?: string; alertCat?: string; msg?: string; defaultCountry?: string | null }) {
  const [{ locale, t }, mine, referrals] = await Promise.all([getDictionary(), getMyAlerts(), getMyReferralCount()]);
  const a = t.alerts;
  const opts = alertOptions(t, locale);
  if (!mine) return null;

  const { alerts, limit } = mine;
  const remaining = Math.max(0, limit - alerts.length);
  const labelOf = (country: string | null, category: string | null) => {
    const c = opts.countries.find((x) => x.code === country)?.label ?? a.allCountries;
    const slug = categorySlugOf(category);
    const k = opts.categories.find((x) => x.slug === slug)?.label ?? (category || a.allCategories);
    return `${c} · ${k}`;
  };

  // Return from the guest opt-in: confirm in one tap (no write on GET).
  const pending = alertCountry !== undefined || alertCat !== undefined ? parseAlertFilters(alertCountry ?? '', alertCat ?? '') : null;
  const base = { ...opts, guest: false, limit, remaining, manageHref: alertsManagePath() };

  return (
    <section id="alertes" aria-labelledby="alertes-title" className="scroll-mt-24 space-y-3 rounded-2xl border border-line bg-white p-4 shadow-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="alertes-title" className="flex items-center gap-1.5 text-sm font-bold text-ink">
          <Bell className="h-4 w-4 text-brand" aria-hidden /> {a.listTitle}
        </h2>
        <p className="text-[12px] text-muted">
          {remaining > 0 ? plural(remaining, a.remainingOne, a.remainingMany) : <span className="font-semibold text-ink">{a.limitTitle}</span>}
        </p>
      </div>

      {msg === 'removed' && <p role="status" className="text-[13px] text-emerald-700">{a.removed}</p>}
      {msg === 'remove_error' && <p role="alert" className="text-[13px] text-rose-700">{a.removeError}</p>}

      {pending?.ok && <AlertOptIn variant="confirm" defaults={{ country: pending.country, cat: pending.cat }} {...base} />}

      {alerts.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {alerts.map((al) => {
            const label = labelOf(al.country, al.category);
            return (
              <li key={al.id} className="inline-flex min-h-tap items-center gap-2 rounded-full border border-line bg-white pl-4 pr-1 text-sm text-ink">
                {label}
                <form action={removeAlertAction}>
                  <input type="hidden" name="alert" value={al.id} />
                  <button type="submit" aria-label={fill(a.remove, { label })} className="grid h-10 w-10 place-items-center rounded-full text-muted transition hover:bg-surface hover:text-ink">
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-[13px] text-muted">{a.listEmpty}</p>
      )}

      {alerts.length === 0 && !pending?.ok ? (
        <AlertOptIn variant="panel" defaults={{ country: defaultCountry ?? null }} {...base} />
      ) : remaining > 0 ? (
        <details className="group">
          <summary className="inline-flex min-h-tap cursor-pointer list-none items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand">
            + {a.add}
          </summary>
          <div className="mt-2">
            <AlertOptIn variant="band" {...base} />
          </div>
        </details>
      ) : (
        <p role="status" className="text-[13px] text-muted">{fill(a.limit, { n: limit })}</p>
      )}

      {referrals > 0 && (
        <p className="flex items-center gap-1.5 border-t border-line pt-3 text-[12px] text-muted">
          <Share2 className="h-3.5 w-3.5 text-brand" aria-hidden /> {plural(referrals, t.share.referralCountOne, t.share.referralCountMany)}
        </p>
      )}
    </section>
  );
}
