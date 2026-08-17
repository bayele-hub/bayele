import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, UserCircle, BadgeCheck, Phone } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import { ProfileForm, type ProfileInitial } from './profile-form';

export const dynamic = 'force-dynamic';

const STATUS_FR: Record<string, string> = {
  active: 'Actif',
  pending_review: 'En attente de validation',
  suspended: 'Suspendu',
  rejected: 'Non validé',
};

export default async function ProfilePage() {
  const session = await getSession();
  if (!session.userId) redirect('/auth?mode=signin');
  const profile = session.profile;
  if (!profile) redirect('/onboarding');

  const isCreator = session.roles.includes('creator');
  const isConsultant = session.roles.includes('consultant');

  const supabase = await createClient();
  const [creatorRes, consultantRes] = await Promise.all([
    isCreator
      ? supabase.from('creator_profiles').select('categories, audience_size, momo_payout_phone_e164, momo_provider').eq('user_id', session.userId).maybeSingle()
      : Promise.resolve({ data: null }),
    isConsultant
      ? supabase.from('consultant_profiles').select('specialties, years_experience').eq('user_id', session.userId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const cp = creatorRes.data as { categories: string[]; audience_size: number; momo_payout_phone_e164: string | null; momo_provider: string | null } | null;
  const kp = consultantRes.data as { specialties: string[]; years_experience: number } | null;

  const backHref = isCreator ? '/creator/dashboard' : isConsultant ? '/consultant/dashboard' : '/dashboard';

  const initial: ProfileInitial = {
    displayName: profile.display_name,
    city: profile.city,
    bio: profile.bio ?? '',
    isCreator,
    isConsultant,
    categories: (cp?.categories ?? []).join(', '),
    audienceSize: cp?.audience_size ?? 0,
    momoPhone: cp?.momo_payout_phone_e164 ?? '',
    momoProvider: cp?.momo_provider ?? 'mtn_momo',
    specialties: (kp?.specialties ?? []).join(', '),
    yearsExperience: kp?.years_experience ?? 0,
  };

  return (
    <section className="space-y-5">
      <Link href={backHref} className="inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-brand">
        <ArrowLeft className="h-3.5 w-3.5" /> Retour
      </Link>

      <div className="flex items-center gap-2">
        <UserCircle className="h-5 w-5 text-brand" />
        <h1 className="font-display text-xl font-extrabold text-ink">Mon profil</h1>
      </div>

      {/* Identity summary (read-only) */}
      <div className="rounded-2xl border border-line bg-white p-4 shadow-card">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-bold text-ink">@{profile.handle}</p>
            <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted">
              <Phone className="h-3 w-3" /> {profile.phone_e164 ?? 'Téléphone non renseigné'}
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${
              profile.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-accent-soft text-accent'
            }`}
          >
            {profile.status === 'active' && <BadgeCheck className="h-3 w-3" />}
            {STATUS_FR[profile.status] ?? profile.status}
          </span>
        </div>
      </div>

      <ProfileForm initial={initial} />
    </section>
  );
}
