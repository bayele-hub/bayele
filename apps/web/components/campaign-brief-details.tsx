import { Package, Tags, CalendarClock } from 'lucide-react';
import { SocialIcon, SOCIAL_META, type Platform } from '@/components/social-icons';

export interface CampaignBrief {
  platforms: string[];
  contentType: string | null;
  deliverableQuantity: number | null;
  mandatoryTags: string | null;
  deadline: string | null; // YYYY-MM-DD
}

const KNOWN: Platform[] = ['whatsapp', 'facebook', 'instagram', 'tiktok', 'youtube', 'x', 'linkedin', 'snapchat', 'telegram'];

function fmtDeadline(d: string | null): string | null {
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const [y, m, day] = d.split('-').map(Number);
  // Build a label without Date parsing surprises; month names in French.
  const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  if (!y || !m || !day || m < 1 || m > 12) return null;
  return `${day} ${MONTHS[m - 1]} ${y}`;
}

/**
 * Presentational: the structured expectations for a campaign (platforms, deliverable, mandatory
 * elements, deadline). Shared by the public campaign page, the creator's campaign list, and the
 * brand's own campaign detail so "what's expected" reads identically everywhere.
 */
export function CampaignBriefDetails({ brief }: { brief: CampaignBrief }) {
  const platforms = (brief.platforms ?? []).filter((p): p is Platform => (KNOWN as string[]).includes(p));
  const deadline = fmtDeadline(brief.deadline);
  const qty = brief.deliverableQuantity && brief.deliverableQuantity > 0 ? brief.deliverableQuantity : null;
  const deliverable = [qty ? `${qty} ×` : null, brief.contentType].filter(Boolean).join(' ');

  const hasAny = platforms.length || deliverable || brief.mandatoryTags || deadline;
  if (!hasAny) return null;

  return (
    <div className="grid gap-2.5 rounded-2xl border border-line bg-surface p-4">
      <p className="text-xs font-bold text-ink">Ce qui est attendu</p>

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
          <Package className="h-4 w-4 shrink-0 text-brand" /> <span className="font-semibold">Livrable :</span> {deliverable}
        </p>
      )}

      {brief.mandatoryTags && (
        <p className="flex items-start gap-2 text-[13px] text-ink">
          <Tags className="mt-0.5 h-4 w-4 shrink-0 text-brand" /> <span><span className="font-semibold">Obligatoire :</span> {brief.mandatoryTags}</span>
        </p>
      )}

      {deadline && (
        <p className="flex items-center gap-2 text-[13px] text-ink">
          <CalendarClock className="h-4 w-4 shrink-0 text-brand" /> <span className="font-semibold">À publier avant le :</span> {deadline}
        </p>
      )}
    </div>
  );
}
