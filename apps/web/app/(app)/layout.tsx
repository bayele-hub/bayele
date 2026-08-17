import Image from 'next/image';
import { Bell } from 'lucide-react';

// Shared authenticated shell: notif bell (Realtime bus) + role nav. Stub for now.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-30 border-b border-line bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <span className="flex items-center gap-2">
            <Image src="/logo.jpeg" alt="Bayele" width={28} height={28} className="h-7 w-7 rounded-lg object-contain" />
            <span className="font-display font-extrabold text-ink">Bayele<span className="brand-dot">.</span></span>
          </span>
          <button aria-label="Notifications" className="relative grid min-h-tap min-w-tap place-items-center text-muted hover:text-ink">
            <Bell className="h-5 w-5" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-accent" />
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
