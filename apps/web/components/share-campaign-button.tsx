'use client';

import { useState } from 'react';
import { Share2, Check, Copy } from 'lucide-react';

/**
 * Copy the public, shareable campaign link (/campaigns/<id>) so a brand can post it anywhere —
 * WhatsApp, socials, a job board — the way a LinkedIn job link is shared. Anyone can open it;
 * applying requires a creator account. Uses the Clipboard API with a manual-select fallback.
 */
export function ShareCampaignButton({ campaignId }: { campaignId: string }) {
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState('');

  async function onShare() {
    const link = `${window.location.origin}/campaigns/${campaignId}`;
    setUrl(link);
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard blocked (older mobile browsers) — reveal the link for manual copy.
      setCopied(false);
    }
  }

  return (
    <div className="mt-3 border-t border-line pt-3">
      <button
        type="button"
        onClick={onShare}
        className="inline-flex min-h-tap items-center gap-1.5 rounded-xl border border-line bg-white px-3 text-xs font-bold text-ink transition hover:border-brand hover:text-brand active:scale-95"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Share2 className="h-3.5 w-3.5" />}
        {copied ? 'Lien copié' : 'Partager la campagne'}
      </button>
      {url && !copied && (
        <div className="mt-2 flex items-center gap-2">
          <input
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[11px] text-muted"
          />
          <Copy className="h-3.5 w-3.5 shrink-0 text-muted" />
        </div>
      )}
      <p className="mt-1.5 text-[11px] text-muted">Lien public : tout le monde peut le voir, seuls les créateurs peuvent postuler.</p>
    </div>
  );
}
