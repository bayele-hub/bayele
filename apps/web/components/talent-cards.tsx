import Link from 'next/link';
import { ChevronRight, Star, Users } from 'lucide-react';
import type { TalentSummary } from '@/lib/data/talent';
import type { Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { formatFollowers } from '@/i18n/format';
import { SmartAvatar } from '@/components/smart-avatar';

function Avatar({ p }: { p: TalentSummary }) {
  return <SmartAvatar src={p.avatarUrl} name={p.displayName} className="h-12 w-12 shrink-0 text-sm" />;
}

function CardHead({ p }: { p: TalentSummary }) {
  return (
    <div className="flex items-start gap-3">
      <Avatar p={p} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <h3 className="truncate text-sm font-bold text-ink">{p.displayName}</h3>
          <span className="rounded border border-line px-1.5 py-0.5 text-[10px] font-bold text-muted">{p.country}</span>
        </div>
        <p className="text-[13px] text-muted">@{p.handle}</p>
        <p className="mt-0.5 text-[11px] text-muted/80">{p.city}</p>
      </div>
      <span className="inline-flex items-center gap-1 text-[12px] font-bold text-ink">
        <Star className="h-3.5 w-3.5 fill-accent text-accent" /> {p.ratingAvg.toFixed(1)}
      </span>
    </div>
  );
}

function Tags({ p }: { p: TalentSummary }) {
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {p.tags.slice(0, 3).map((tag) => (
        <span key={tag} className="rounded-md bg-surface px-2 py-0.5 text-[11px] font-medium text-ink/70">{tag}</span>
      ))}
    </div>
  );
}

const CARD =
  'group flex flex-col justify-between rounded-2xl border border-line bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:border-brand-100 hover:shadow-cardHover';

export function CreatorCard({ p, t, locale }: { p: TalentSummary; t: Dictionary; locale: Locale }) {
  return (
    <article className={CARD}>
      <CardHead p={p} />
      <Tags p={p} />
      <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
        <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-ink">
          <Users className="h-4 w-4 text-brand" />
          {formatFollowers(p.audienceSize ?? 0, locale)}
          <span className="font-medium text-muted">{t.directory.followers}</span>
        </span>
        <Link href={`/creators/${p.handle}`} className="inline-flex items-center gap-1 text-sm font-bold text-brand hover:text-brand-600">
          {t.directory.view} <ChevronRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
        </Link>
      </div>
    </article>
  );
}

export function ConsultantCard({ p, t }: { p: TalentSummary; t: Dictionary }) {
  return (
    <article className={CARD}>
      <CardHead p={p} />
      <Tags p={p} />
      <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
        <span className="text-[12px] font-medium text-muted">{t.directory.roleConsultant}</span>
        <Link href={`/consultants/${p.handle}`} className="inline-flex items-center gap-1 text-sm font-bold text-brand hover:text-brand-600">
          {t.directory.view} <ChevronRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
        </Link>
      </div>
    </article>
  );
}
