import Link from 'next/link';
import { getDictionary } from '@/i18n/dictionaries';
import { campaignStatuses, floorMap, getManagedBrief, listPayFloors } from '@/lib/data/managed-briefs';
import { doualaToday } from '@/lib/campaign-board';
import { BriefEditor } from '../_components/brief-editor';

export const dynamic = 'force-dynamic';

/** Existing managed brief (design §2). Listing fields lock once its campaign exists (E5). */
export default async function ManagedBriefPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, { locale, t }] = await Promise.all([params, getDictionary()]);
  const [row, floors] = await Promise.all([getManagedBrief(id), listPayFloors()]);
  if (!row) {
    return (
      <div className="rounded-2xl border border-line bg-white p-6 text-center text-sm text-muted">
        {t.admin.briefs.editor.notFound}{' '}
        <Link href="/admin/briefs" className="inline-flex min-h-[44px] items-center font-semibold text-brand-700">{t.admin.briefs.editor.back}</Link>
      </div>
    );
  }
  const statuses = row.campaign_id ? await campaignStatuses([row.campaign_id]) : {};
  return (
    <BriefEditor
      row={row}
      campaignStatus={row.campaign_id ? (statuses[row.campaign_id] ?? null) : null}
      floors={floorMap(floors)}
      floorsAvailable={floors !== null}
      L={t.admin.briefs}
      badge={t.managed.badge}
      categoryLabels={t.categories}
      locale={locale}
      today={doualaToday()}
    />
  );
}
