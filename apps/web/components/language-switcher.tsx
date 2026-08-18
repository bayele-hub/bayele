'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import type { Locale } from '@/i18n/config';

const LABELS: Record<Locale, string> = { fr: 'FR', en: 'EN' };

/** Cookie-based locale toggle. Sets NEXT_LOCALE and re-renders the server tree. */
export function LanguageSwitcher({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function choose(next: Locale) {
    if (next === locale) return;
    document.cookie = `NEXT_LOCALE=${next};path=/;max-age=31536000;samesite=lax`;
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex items-center rounded-lg border border-line bg-white p-0.5 text-[11px] font-bold" role="group" aria-label="Language">
      {(['fr', 'en'] as Locale[]).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => choose(l)}
          disabled={pending}
          aria-pressed={locale === l}
          className={`grid min-h-tap min-w-[40px] place-items-center rounded-md px-1 transition ${
            locale === l ? 'bg-brand text-white' : 'text-muted hover:text-ink'
          }`}
        >
          {LABELS[l]}
        </button>
      ))}
    </div>
  );
}
