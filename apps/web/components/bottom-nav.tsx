import Link from 'next/link';
import { Home, Users, Briefcase, LayoutDashboard, ShieldCheck } from 'lucide-react';
import type { Role } from '@/lib/auth/session';

/** Mobile-first bottom nav (hidden ≥ sm, where the header carries navigation). Per-role last tab. */
export function BottomNav({ role }: { role: Role }) {
  const roleTab =
    role === 'super_admin'
      ? { href: '/admin/dashboard', label: 'Modération', Icon: ShieldCheck }
      : role === 'business'
        ? { href: '/business/dashboard', label: 'Campagnes', Icon: LayoutDashboard }
        : { href: `/${role}/dashboard`, label: 'Espace', Icon: LayoutDashboard };

  const items = [
    { href: '/dashboard', label: 'Accueil', Icon: Home },
    { href: '/creators', label: 'Créateurs', Icon: Users },
    { href: '/consultants', label: 'Consultants', Icon: Briefcase },
    roleTab,
  ];

  return (
    <nav className="pb-safe sticky bottom-0 z-30 border-t border-line bg-white/90 backdrop-blur sm:hidden">
      <div className="mx-auto flex max-w-5xl">
        {items.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex min-h-tap flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold text-muted transition hover:text-brand"
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
