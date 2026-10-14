import Link from 'next/link';
import { ChevronRight, MapPin, TriangleAlert } from 'lucide-react';
import type { Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { SmartAvatar } from '@/components/smart-avatar';
import { countryName } from '@/lib/countries';
import { fill } from '@/lib/campaign-board';
import { cardWarnings } from '@/lib/member-quality';
import { ageDays } from '@/lib/managed-brief-state';
import { MemberStatusPill } from './member-status-pill';
import { DecisionPanel } from './decision-panel';

export interface MemberCardData {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  city: string;
  country: string;
  status: string;
  roles: string[];
  companyName: string | null;
  createdAt: string;
  resubmittedAt: string | null;
  openCorrection: boolean;
}

const ROLE_ORDER = ['super_admin', 'business', 'consultant', 'creator'] as const;

/**
 * One robust member card for every admin list (design §A.2). Overflow rules: `min-w-0` on every flex
 * child holding user text, `truncate` for identity, `line-clamp` + `[overflow-wrap:anywhere]` for free
 * text, never `shrink-0`/`nowrap` on user text. The name opens the detail page (any role/status).
 */
export function MemberCard({ m, L, locale, back }: { m: MemberCardData; L: Dictionary['admin']['members']; locale: Locale; back: string }) {
  const warnings = cardWarnings({ city: m.city, displayName: m.displayName, roles: m.roles });
  const days = ageDays(m.resubmittedAt ?? m.createdAt);
  const roles = ROLE_ORDER.filter((r) => m.roles.includes(r));
  const href = `/admin/users/${m.id}?from=${encodeURIComponent(back)}`;
  const shown = Array.from(new Set(warnings.map((w) => L.chip[w as keyof typeof L.chip])));

  return (
    <li className="min-w-0">
      <article className="min-w-0 rounded-2xl border border-line bg-white p-4 shadow-card">
        <div className="flex min-w-0 items-start gap-3">
          <SmartAvatar src={m.avatarUrl} name={m.displayName} className="h-10 w-10 shrink-0 text-sm" />
          <div className="min-w-0 flex-1">
            {/* AR-6: 24 px line + py-2.5 = 44 px hit area; the negative margin keeps the layout unchanged. */}
            <Link href={href} className="relative -my-2.5 block truncate py-2.5 font-bold text-ink hover:underline">{m.displayName}</Link>
            <p className="truncate text-xs text-muted">@{m.handle}{m.companyName ? ` · ${m.companyName}` : ''}</p>
          </div>
          <time dateTime={m.resubmittedAt ?? m.createdAt} className="shrink-0 whitespace-nowrap text-[11px] text-muted">
            {days === 0 ? L.ageToday : fill(L.age, { n: days })}
          </time>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {roles.map((r) => (
            <span key={r} className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700">{L.role[r]}</span>
          ))}
          <MemberStatusPill status={m.status} label={L.pill[m.status as keyof typeof L.pill] ?? m.status} />
          {shown.slice(0, 2).map((w) => (
            <span key={w} className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700">
              <TriangleAlert className="h-3 w-3" aria-hidden /> {w}
            </span>
          ))}
          {shown.length > 2 && <span className="text-[11px] font-bold text-muted">{fill(L.chipMore, { n: shown.length - 2 })}</span>}
          {m.openCorrection && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-bold text-ink">{L.requestFix}</span>}
        </div>

        <p className="mt-2 flex min-w-0 items-start gap-1 text-xs text-muted">
          <MapPin className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          <span className="line-clamp-1 min-w-0 [overflow-wrap:anywhere]">{[m.city, countryName(m.country, locale)].filter(Boolean).join(' · ')}</span>
        </p>

        <div className="mt-3 grid items-center gap-2 border-t border-line pt-3 sm:grid-cols-[1fr_auto]">
          <Link href={href} className="inline-flex min-h-tap items-center gap-1 whitespace-nowrap text-xs font-bold text-brand-700 hover:text-brand">
            {L.viewProfile} <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
          <DecisionPanel userId={m.id} name={m.displayName} status={m.status} warnings={warnings.length} L={L} mode="card" />
        </div>
      </article>
    </li>
  );
}
