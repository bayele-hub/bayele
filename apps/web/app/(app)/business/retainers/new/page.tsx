import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Handshake } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { RetainerForm } from '../retainer-form';
import { getDictionary } from '@/i18n/dictionaries';
import { myAssignments } from '@/lib/data/partner-gov';

export const dynamic = 'force-dynamic';

export default async function NewRetainer({ searchParams }: { searchParams: Promise<{ partner?: string; consultant?: string }> }) {
  const session = await getSession();
  if (!session.userId) redirect('/auth?mode=signin');
  if (!session.roles.includes('business') && session.primary !== 'super_admin') redirect('/dashboard');

  // ?partner=@handle (legacy links used ?consultant=).
  const sp = await searchParams;
  const handleRaw = sp.partner ?? sp.consultant;
  const handle = (handleRaw ?? '').replace(/^@/, '');

  // G3: only partners with an ACTIVE assignment for this brand (one entry per partner).
  const assignments = await myAssignments(session.userId, 'brand');
  const seen = new Set<string>();
  const partners = assignments
    .filter((a) => a.status === 'active' && a.other && !seen.has(a.partner_id) && seen.add(a.partner_id))
    .map((a) => ({ handle: a.other!.handle, name: a.other!.display_name }));

  const { t } = await getDictionary();
  return (
    <section className="space-y-5">
      <Link href="/business/retainers" className="inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-brand">
        <ArrowLeft className="h-3.5 w-3.5" /> Mes rétainers
      </Link>
      <div className="flex items-center gap-2">
        <Handshake className="h-5 w-5 text-brand" />
        <h1 className="font-display text-2xl font-extrabold text-ink">Nouveau rétainer partenaire</h1>
      </div>
      {partners.length === 0 ? (
        <div className="rounded-2xl border border-line bg-white p-5 text-center shadow-card">
          <p className="text-sm text-ink">{t.businessPartners.retainerNone}</p>
          <Link href="/business/talent?tab=partners" className="mt-3 inline-flex min-h-tap items-center rounded-xl bg-brand px-4 text-sm font-bold text-white">{t.businessPartners.empty.cta}</Link>
        </div>
      ) : (
        <RetainerForm partners={partners} selected={handle} R={t.retainers} B={t.businessPartners} />
      )}
    </section>
  );
}
