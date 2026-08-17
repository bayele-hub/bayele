'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Handshake, Users, UserCircle } from 'lucide-react';

const TABS = [
  { href: '/consultant/dashboard', label: 'Accueil', Icon: Home },
  { href: '/consultant/retainers', label: 'Rétainers', Icon: Handshake },
  { href: '/consultant/talent-search', label: 'Créateurs', Icon: Users },
  { href: '/profile', label: 'Profil', Icon: UserCircle },
] as const;

export function ConsultantNav() {
  const pathname = usePathname();
  return (
    <nav className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max items-center gap-2">
        {TABS.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex min-h-tap items-center gap-1.5 whitespace-nowrap rounded-xl border px-3 text-xs font-bold transition ${
                  active ? 'border-brand bg-brand text-white shadow-sm' : 'border-line bg-white text-ink hover:border-brand hover:text-brand'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
