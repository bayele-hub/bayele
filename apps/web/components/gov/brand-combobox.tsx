'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { SmartAvatar } from '@/components/smart-avatar';
import { searchBrandsAction } from '@/app/(app)/admin/partners/actions';
import type { BrandSearchRow } from '@/lib/data/partner-gov';

export interface BrandComboLabels { brand: string; searchHint: string; searching: string; noBrand: string; activeCount: string }

/**
 * « Mettre en relation » brand picker (§1.4): WAI-ARIA combobox on admin_search_brands, from 2 letters,
 * debounced 300 ms, approved brands only (server-side).
 */
export function BrandCombobox({ L, value, onChange }: { L: BrandComboLabels; value: BrandSearchRow | null; onChange: (b: BrandSearchRow | null) => void }) {
  const id = useId();
  const [q, setQ] = useState(value ? value.company_name || value.display_name : '');
  const [rows, setRows] = useState<BrandSearchRow[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(-1);
  const seq = useRef(0);

  useEffect(() => {
    if (value && q === (value.company_name || value.display_name)) return;
    const query = q.trim();
    if (query.length < 2) { setRows([]); setBusy(false); return; }
    const n = ++seq.current;
    setBusy(true);
    const t = setTimeout(async () => {
      const res = await searchBrandsAction(query);
      if (n !== seq.current) return;
      setBusy(false);
      setRows(res.ok ? res.data : []);
      setActive(-1);
    }, 300);
    return () => clearTimeout(t);
  }, [q, value]);

  function pick(b: BrandSearchRow) {
    onChange(b);
    setQ(b.company_name || b.display_name);
    setOpen(false);
  }

  return (
    <div className="relative min-w-0">
      <label htmlFor={`${id}-in`} className="block text-xs font-semibold text-ink">{L.brand}</label>
      <input
        id={`${id}-in`}
        role="combobox"
        aria-expanded={open && q.trim().length >= 2}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${id}-o${active}` : undefined}
        autoComplete="off"
        value={q}
        onChange={(e) => { setQ(e.target.value); onChange(null); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(rows.length - 1, a + 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
          else if (e.key === 'Enter' && open && active >= 0 && rows[active]) { e.preventDefault(); pick(rows[active]!); }
          else if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); }
        }}
        className="mt-1 min-h-tap w-full rounded-xl border border-line bg-white px-3 text-[16px] text-ink focus:border-brand focus:outline-none sm:text-sm"
      />
      {q.trim().length < 2 && <p className="mt-0.5 text-[11px] text-muted">{L.searchHint}</p>}
      {open && q.trim().length >= 2 && (
        <ul id={`${id}-list`} role="listbox" className="absolute left-0 right-0 z-20 mt-1 max-h-60 overflow-y-auto rounded-xl border border-line bg-white py-1 shadow-lg">
          {busy && <li className="flex items-center gap-2 px-3 py-2 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {L.searching}</li>}
          {!busy && rows.length === 0 && <li className="px-3 py-2 text-sm text-muted">{L.noBrand}</li>}
          {rows.map((b, i) => (
            <li key={b.id} id={`${id}-o${i}`} role="option" aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); pick(b); }}
              className={`flex min-h-tap min-w-0 cursor-pointer items-center gap-2 px-3 py-1.5 ${i === active ? 'bg-brand-50' : 'hover:bg-surface'}`}>
              <SmartAvatar src={b.avatar_url} name={b.company_name || b.display_name} className="h-8 w-8 shrink-0 text-xs" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-ink">{b.company_name || b.display_name}</span>
                <span className="block truncate text-[11px] text-muted">@{b.handle}{b.city ? ` · ${b.city}` : ''}{b.active_assignments > 0 ? ` · ${L.activeCount.replace('{n}', String(b.active_assignments))}` : ''}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
