import { LoadingState } from '@/components/loading-state';
import { getDictionary } from '@/i18n/dictionaries';

export default async function Loading() {
  const { t } = await getDictionary();
  return <LoadingState label={t.common.loading} />;
}
