'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Megaphone, Wallet, Handshake, UserCircle } from 'lucide-react';
import type { CreatorTab } from '@/lib/auth/creator-gate';

const ICONS = { home: Home, megaphone: Megaphone, wallet: Wallet, handshake: Handshake, user: UserCircle } as const;

/**
 * Creator workspace tabs. Tabs the viewer can't use yet (pending_review creators: everything but
 * Campagnes and Profil) are shown disabled rather than as links that would bounce them.
 */
export function CreatorNav({ tabs }: { tabs: CreatorTab[] }) {
  const pathname = usePathname();
  return (
    <nav className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max items-center gap-2">
        {tabs.map(({ href, label, icon, disabled }) => {
          const Icon = ICONS[icon];
          const active = pathname === href || pathname.startsWith(href + '/');
          const base = 'inline-flex min-h-tap items-center gap-1.5 whitespace-nowrap rounded-xl border px-3 text-xs font-bold transition';
          return (
            <li key={href}>
              {disabled ? (
                <span aria-disabled="true" title="Disponible après la validation de votre profil" className={`${base} cursor-not-allowed border-line bg-surface text-muted/60`}>
                  <Icon className="h-4 w-4" aria-hidden />
                  {label}
                </span>
              ) : (
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={`${base} ${active ? 'border-brand bg-brand text-white shadow-sm' : 'border-line bg-white text-ink hover:border-brand hover:text-brand'}`}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {label}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
