'use client';

import { useState } from 'react';
import { Copy } from 'lucide-react';
import type { Locale } from '@/i18n/config';
import { WhatsAppTile } from '@/components/campaigns/card-parts';
import { waMeHref } from '@/lib/whatsapp';

export interface OrderLabels {
  lang: string;
  view: string;
  copy: string;
  copied: string;
  openWhatsapp: string;
}

/**
 * Order form (design §2.9): FR/EN toggle (the brand's language), read-only text, « Copier » and
 * « Ouvrir dans WhatsApp » (contact number only). Disabled until checklist items 1–14 are green.
 */
export function OrderFormCopy({ texts, contactWhatsapp, enabled, missing, labels, lang, onLang }: {
  texts: Record<Locale, string>;
  contactWhatsapp: string;
  enabled: boolean;
  missing: string | null;
  labels: OrderLabels;
  lang: Locale;
  onLang: (l: Locale) => void;
}) {
  const [copied, setCopied] = useState(false);
  const text = texts[lang];
  const wa = waMeHref(contactWhatsapp, text);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: the admin can select the text in the <pre> */
    }
  };
  const seg = (l: Locale) => (
    <button key={l} type="button" onClick={() => onLang(l)} aria-pressed={lang === l}
      className={`min-h-tap min-w-[3rem] rounded-lg px-3 text-xs font-bold ${lang === l ? 'bg-brand text-white' : 'bg-white text-ink'}`}>
      {l.toUpperCase()}
    </button>
  );
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-ink">
        {labels.lang}
        <span className="inline-flex gap-1 rounded-xl border border-line bg-surface p-1">{(['fr', 'en'] as const).map(seg)}</span>
      </div>
      <details className="rounded-xl border border-line">
        <summary className="flex min-h-tap cursor-pointer items-center px-3 text-xs font-semibold text-brand-700">{labels.view}</summary>
        <pre className="whitespace-pre-wrap rounded-b-xl bg-surface p-3 font-sans text-[12px] text-ink">{text}</pre>
      </details>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={copy} disabled={!enabled}
          className="inline-flex min-h-tap items-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-bold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50">
          <Copy className="h-3.5 w-3.5" aria-hidden /> {labels.copy}
        </button>
        {wa && enabled && (
          <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-tap items-center gap-1.5 rounded-lg border border-line bg-white px-3 text-xs font-bold text-ink hover:border-[#25D366]">
            <WhatsAppTile className="h-5 w-5" /> {labels.openWhatsapp}
          </a>
        )}
      </div>
      {!enabled && missing && <p className="text-[11px] text-muted">{missing}</p>}
      <p role="status" className="text-[11px] text-emerald-700">{copied ? labels.copied : ''}</p>
    </div>
  );
}
