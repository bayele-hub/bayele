import { Package, Tags, CalendarClock } from 'lucide-react';
import { SocialIcon, SOCIAL_META, type Platform } from '@/components/social-icons';
import type { Locale } from '@/i18n/config';
import { contentTypeLabel } from '@/lib/managed-listing';

export interface CampaignBrief {
  platforms: string[];
  contentType: string | null;
  deliverableQuantity: number | null;
  mandatoryTags: string | null;
  deadline: string | null; // YYYY-MM-DD
}

const KNOWN: Platform[] = ['whatsapp', 'facebook', 'instagram', 'tiktok', 'youtube', 'x', 'linkedin', 'snapchat', 'telegram'];

/** Labels (dictionary `briefDetails.*`). French defaults keep the signed-in app pages unchanged. */
export interface BriefDetailsLabels {
  title: string;
  deliverable: string;
  mandatory: string;
  deadline: string;
}

const FR_LABELS: BriefDetailsLabels = {
  title: 'Ce qui est attendu',
  deliverable: 'Livrable\u00a0:',
  mandatory: 'Obligatoire\u00a0:',
  deadline: 'À publier avant le\u00a0:',
};

/** YYYY-MM-DD → « 28 oct. 2026 » / « Oct 28, 2026 » in the page locale (UTC: no day shift). */
export function fmtDeadline(d: string | null, locale: Locale = 'fr'): string | null {
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const t = Date.parse(`${d}T00:00:00Z`);
  if (Number.isNaN(t)) return null;
  return new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(t);
}

/**
 * Presentational: the structured expectations for a campaign (platforms, deliverable, mandatory
 * elements, deadline). Shared by the public campaign page, the creator's campaign list, and the
 * brand's own campaign detail so "what's expected" reads identically everywhere.
 */
export function CampaignBriefDetails({ brief, locale = 'fr', labels = FR_LABELS }: { brief: CampaignBrief; locale?: Locale; labels?: BriefDetailsLabels }) {
  const platforms = (brief.platforms ?? []).filter((p): p is Platform => (KNOWN as string[]).includes(p));
  const deadline = fmtDeadline(brief.deadline, locale);
  const qty = brief.deliverableQuantity && brief.deliverableQuantity > 0 ? brief.deliverableQuantity : null;
  const deliverable = [qty ? `${qty} ×` : null, brief.contentType ? contentTypeLabel(brief.contentType, locale) : null].filter(Boolean).join(' ');

  const hasAny = platforms.length || deliverable || brief.mandatoryTags || deadline;
  if (!hasAny) return null;

  return (
    <div className="grid gap-2.5 rounded-2xl border border-line bg-surface p-4">
      <p className="text-xs font-bold text-ink">{labels.title}</p>

      {platforms.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {platforms.map((p) => (
            <span key={p} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-1 text-[11px] font-semibold text-ink">
              <span className="grid h-4 w-4 place-items-center rounded text-white" style={{ backgroundColor: SOCIAL_META[p].brand }}>
                <SocialIcon platform={p} className="h-2.5 w-2.5" />
              </span>
              {SOCIAL_META[p].label}
            </span>
          ))}
        </div>
      )}

      {deliverable && (
        <p className="flex items-center gap-2 text-[13px] text-ink">
          <Package className="h-4 w-4 shrink-0 text-brand" /> <span className="font-semibold">{labels.deliverable}</span> {deliverable}
        </p>
      )}

      {brief.mandatoryTags && (
        <p className="flex items-start gap-2 text-[13px] text-ink">
          <Tags className="mt-0.5 h-4 w-4 shrink-0 text-brand" /> <span><span className="font-semibold">{labels.mandatory}</span> {brief.mandatoryTags}</span>
        </p>
      )}

      {deadline && (
        <p className="flex items-center gap-2 text-[13px] text-ink">
          <CalendarClock className="h-4 w-4 shrink-0 text-brand" /> <span className="font-semibold">{labels.deadline}</span> {deadline}
        </p>
      )}
    </div>
  );
}
