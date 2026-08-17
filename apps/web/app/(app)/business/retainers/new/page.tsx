import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Handshake } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import { RetainerForm } from '../retainer-form';

export const dynamic = 'force-dynamic';

export default async function NewRetainer({ searchParams }: { searchParams: Promise<{ consultant?: string }> }) {
  const session = await getSession();
  if (!session.userId) redirect('/auth?mode=signin');
  if (!session.roles.includes('business') && session.primary !== 'super_admin') redirect('/dashboard');

  const { consultant: handleRaw } = await searchParams;
  const handle = (handleRaw ?? '').replace(/^@/, '');

  let consultantName: string | undefined;
  if (handle) {
    const supabase = await createClient();
    const { data } = await supabase.from('profiles').select('display_name').eq('handle', handle).maybeSingle();
    consultantName = data?.display_name ?? undefined;
  }

  return (
    <section className="space-y-5">
      <Link href="/business/retainers" className="inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-brand">
        <ArrowLeft className="h-3.5 w-3.5" /> Mes rétainers
      </Link>
      <div className="flex items-center gap-2">
        <Handshake className="h-5 w-5 text-brand" />
        <h1 className="font-display text-2xl font-extrabold text-ink">Nouveau rétainer agence</h1>
      </div>
      <RetainerForm consultantHandle={handle} consultantName={consultantName} />
    </section>
  );
}
