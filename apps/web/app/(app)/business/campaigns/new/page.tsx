import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { CampaignForm } from './campaign-form';

export default async function NewCampaignPage() {
  const session = await getSession();
  if (!session.userId) redirect('/auth?mode=signin');
  if (!session.roles.includes('business') && session.primary !== 'super_admin') redirect('/dashboard');

  return (
    <section className="mx-auto max-w-lg">
      <Link href="/business/dashboard" className="mb-4 inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-ink">
        <ChevronLeft className="h-3.5 w-3.5" /> Mes campagnes
      </Link>
      <h1 className="font-display text-2xl font-extrabold text-ink">Nouvelle campagne</h1>
      <p className="mb-5 mt-1 text-sm text-muted">
        La formule fixe la commission Bayele à la création (invariant §9), lue au moment du financement.
      </p>
      <CampaignForm />
    </section>
  );
}
