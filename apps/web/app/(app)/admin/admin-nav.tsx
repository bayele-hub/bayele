'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { LayoutDashboard, ShieldCheck, Users, Wallet, Send, Handshake, Receipt, ShieldAlert, ClipboardList } from 'lucide-react';

const TABS = [
  { href: '/admin/dashboard', label: "Vue d'ensemble", short: 'Vue', Icon: LayoutDashboard },
  // « Profils » = the members list filtered on « À valider » (one list, one card — design §A.2).
  { href: '/admin/users?status=pending_review', label: 'Profils', short: 'Profils', Icon: ShieldCheck },
  { href: '/admin/users', label: 'Utilisateurs', short: 'Utilisateurs', Icon: Users },
  // Partner governance hub (G2): list, contact requests, end requests, flags.
  { href: '/admin/partners', label: 'Partenaires', short: 'Partenaires', Icon: Handshake },
  // Managed campaigns: placed before « Campagnes » so the tabs follow the money (brief → funding → payout).
  { href: '/admin/briefs', label: 'Briefs gérés', short: 'Briefs', Icon: ClipboardList },
  { href: '/admin/funding', label: 'Campagnes', short: 'Campagnes', Icon: Wallet },
  { href: '/admin/payouts', label: 'Paiements', short: 'Paiements', Icon: Send },
  { href: '/admin/retainers', label: 'Rétainers', short: 'Rétainers', Icon: Handshake },
  { href: '/admin/disputes', label: 'Litiges', short: 'Litiges', Icon: ShieldAlert },
  { href: '/admin/ledger', label: 'Séquestre', short: 'Séquestre', Icon: Receipt },
] as const;

/** Mobile-first admin section nav: a horizontally-scrollable pill row that collapses to icons+labels. */
export function AdminNav() {
  const pathname = usePathname();
  const status = useSearchParams().get('status');

  return (
    <nav className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max items-center gap-2">
        {TABS.map(({ href, label, Icon }) => {
          const [path, query] = href.split('?');
          const pendingTab = query === 'status=pending_review';
          const onUsers = pathname === '/admin/users';
          const active = pendingTab
            ? onUsers && status === 'pending_review'
            : path === '/admin/users'
              ? (onUsers && status !== 'pending_review') || pathname.startsWith('/admin/users/')
              : pathname === path || pathname.startsWith(path + '/');
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex min-h-tap items-center gap-1.5 whitespace-nowrap rounded-xl border px-3 text-xs font-bold transition ${
                  active
                    ? 'border-brand bg-brand text-white shadow-sm'
                    : 'border-line bg-white text-ink hover:border-brand hover:text-brand'
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
