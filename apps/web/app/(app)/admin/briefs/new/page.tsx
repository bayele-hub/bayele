import { getDictionary } from '@/i18n/dictionaries';
import { floorMap, listPayFloors } from '@/lib/data/managed-briefs';
import { doualaToday } from '@/lib/campaign-board';
import { BriefEditor } from '../_components/brief-editor';

export const dynamic = 'force-dynamic';

/** « Nouveau brief géré » (design §2). Access: the admin layout gates /admin/* to super_admins. */
export default async function NewManagedBriefPage() {
  const [{ locale, t }, floors] = await Promise.all([getDictionary(), listPayFloors()]);
  return (
    <BriefEditor
      row={null}
      campaignStatus={null}
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
