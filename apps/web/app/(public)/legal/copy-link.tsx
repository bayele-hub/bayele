'use client';

import { useState } from 'react';

/** « # » copy-link button for a /legal sub-section (§8). */
export function CopyLink({ anchor, label, done }: { anchor: string; label: string; done: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button type="button" aria-label={label} title={copied ? done : label}
      onClick={() => {
        const url = `${window.location.origin}/legal#${anchor}`;
        void navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
      }}
      className="inline-flex min-h-tap min-w-tap items-center justify-center rounded-lg text-sm font-bold text-muted hover:bg-surface hover:text-brand">
      #<span role="status" className="sr-only">{copied ? done : ''}</span>
    </button>
  );
}
