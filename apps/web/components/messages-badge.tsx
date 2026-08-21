'use client';

import Link from 'next/link';
import { MessagesSquare } from 'lucide-react';
import { useUnreadCount } from '@/components/unread-messages-provider';

/** Header Messages entry with a live unread badge. */
export function MessagesBadge() {
  const count = useUnreadCount();
  return (
    <Link href="/messages" aria-label="Messages" className="relative grid min-h-tap min-w-tap place-items-center text-muted hover:text-ink">
      <MessagesSquare className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </Link>
  );
}
