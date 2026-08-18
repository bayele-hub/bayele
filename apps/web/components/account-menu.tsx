'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { LogOut, UserCog, ChevronDown } from 'lucide-react';
import { signOutAction } from '@/lib/auth/actions';

/**
 * Header account menu: an avatar button that opens a dropdown with the user's identity and a
 * sign-out control. Sign-out posts to a server action so the Supabase session cookies clear
 * server-side. Mounted in the shared (app) shell, so every role — admin included — can log out.
 */
export function AccountMenu({
  displayName,
  email,
  roleLabel,
}: {
  displayName: string | null;
  email: string | null;
  roleLabel: string | null;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const initial = (displayName ?? email ?? '?').trim().slice(0, 1).toUpperCase() || '?';

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        aria-label="Compte"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-tap items-center gap-1 rounded-full pl-0.5 pr-1.5 text-muted transition hover:text-ink"
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand text-xs font-bold text-white">
          {initial}
        </span>
        <ChevronDown className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-12 z-40 w-64 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-line bg-white shadow-cardHover"
        >
          <div className="border-b border-line px-4 py-3">
            <p className="truncate text-sm font-bold text-ink">{displayName ?? 'Mon compte'}</p>
            {email && <p className="mt-0.5 truncate text-xs text-muted">{email}</p>}
            {roleLabel && (
              <span className="mt-1.5 inline-block rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold uppercase text-brand-700">
                {roleLabel}
              </span>
            )}
          </div>

          <div className="p-1.5">
            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              role="menuitem"
              className="flex min-h-tap items-center gap-2 rounded-lg px-3 text-sm font-semibold text-ink transition hover:bg-surface"
            >
              <UserCog className="h-4 w-4 text-muted" /> Mon profil
            </Link>
            <form action={signOutAction}>
              <button
                type="submit"
                role="menuitem"
                className="flex min-h-tap w-full items-center gap-2 rounded-lg px-3 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
              >
                <LogOut className="h-4 w-4" /> Se déconnecter
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
