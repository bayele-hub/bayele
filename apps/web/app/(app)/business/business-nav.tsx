'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Megaphone, Users, Handshake, Receipt, UserCircle } from 'lucide-react';

const TABS = [
  { href: '/business/dashboard', label: 'Accueil', Icon: Home },
  { href: '/business/campaigns', label: 'Campagnes', Icon: Megaphone },
  { href: '/business/talent', label: 'Créateurs', Icon: Users },
  { href: '/business/retainers', label: 'Rétainers', Icon: Handshake },
  { href: '/business/invoices', label: 'Factures', Icon: Receipt },
  { href: '/profile', label: 'Profil', Icon: UserCircle },
] as const;

export function BusinessNav() {
  const pathname = usePathname();
  return (
    <nav className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max items-center gap-2">
        {TABS.map(({ href, label, Icon }) => {
          // /business/campaigns must not light up on /business/campaigns/new — that's still Campagnes,
          // so prefix match is fine; the dashboard tab uses exact + subpath.
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
