import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { getDictionary } from '@/i18n/dictionaries';
import { publicFloorMap } from '@/lib/data/managed-briefs';
import { doualaToday } from '@/lib/campaign-board';
import { CampaignForm } from './campaign-form';

export default async function NewCampaignPage() {
  const session = await getSession();
  if (!session.userId) redirect('/auth?mode=signin');
  if (!session.roles.includes('business') && session.primary !== 'super_admin') redirect('/dashboard');
  // R5: server-fetched floors (pay_floors_public) for the warning.
  const [{ locale, t }, floors] = await Promise.all([getDictionary(), publicFloorMap()]);
  const F = t.brandForm;

  return (
    <section className="mx-auto max-w-lg">
      <Link href="/business/dashboard" className="mb-4 inline-flex min-h-[44px] items-center gap-1 text-xs font-semibold text-muted hover:text-ink">
        <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> {F.back}
      </Link>
      <h1 className="font-display text-2xl font-extrabold text-ink">{F.title}</h1>
      <p className="mb-5 mt-1 text-sm text-muted">{F.subtitle}</p>
      <CampaignForm F={F} W={t.publishWhatsapp} locale={locale} floors={floors} categoryLabels={t.categories} today={doualaToday()} />
    </section>
  );
}
