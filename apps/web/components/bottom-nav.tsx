import Link from 'next/link';
import { Home, Users, MessagesSquare, LayoutDashboard, ShieldCheck } from 'lucide-react';
import type { Role } from '@/lib/auth/session';

/** Mobile-first bottom nav (hidden ≥ sm, where the header carries navigation). Per-role last tab. */
export function BottomNav({ role, unreadMessages = 0 }: { role: Role; unreadMessages?: number }) {
  const roleTab =
    role === 'super_admin'
      ? { href: '/admin/dashboard', label: 'Modération', Icon: ShieldCheck, badge: 0 }
      : role === 'business'
        ? { href: '/business/dashboard', label: 'Campagnes', Icon: LayoutDashboard, badge: 0 }
        : { href: `/${role}/dashboard`, label: 'Espace', Icon: LayoutDashboard, badge: 0 };

  const items = [
    { href: '/dashboard', label: 'Accueil', Icon: Home, badge: 0 },
    { href: '/creators', label: 'Créateurs', Icon: Users, badge: 0 },
    { href: '/messages', label: 'Messages', Icon: MessagesSquare, badge: unreadMessages },
    roleTab,
  ];

  return (
    <nav className="pb-safe sticky bottom-0 z-30 border-t border-line bg-white/90 backdrop-blur sm:hidden">
      <div className="mx-auto flex max-w-5xl">
        {items.map(({ href, label, Icon, badge }) => (
          <Link
            key={href}
            href={href}
            className="relative flex min-h-tap flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold text-muted transition hover:text-brand"
          >
            <span className="relative">
              <Icon className="h-5 w-5" />
              {badge > 0 && (
                <span className="absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[9px] font-bold text-white">
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </span>
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
