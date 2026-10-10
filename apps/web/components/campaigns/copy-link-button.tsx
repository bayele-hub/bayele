'use client';

import { useState } from 'react';
import { Check, Link2 } from 'lucide-react';

/**
 * « Copier le lien » text button (clipboard logic of share-campaign-button.tsx): copies the exact
 * share URL (ref included). If the Clipboard API is blocked, the link is revealed for manual copy.
 */
export function CopyLinkButton({ url, label, copiedLabel }: { url: string; label: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false);
  const [reveal, setReveal] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setReveal(true);
    }
  }

  return (
    <span className="inline-flex flex-col">
      <button type="button" onClick={onCopy}
        className="inline-flex min-h-tap items-center gap-1.5 text-[13px] font-semibold text-brand-700 hover:text-brand">
        {copied ? <Check className="h-4 w-4 text-emerald-600" aria-hidden /> : <Link2 className="h-4 w-4" aria-hidden />}
        <span aria-live="polite">{copied ? copiedLabel : label}</span>
      </button>
      {reveal && (
        <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label={label}
          className="mt-1 w-full min-w-0 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12px] text-muted" />
      )}
    </span>
  );
}
