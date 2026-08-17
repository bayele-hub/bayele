'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, MapPin, Star, Users } from 'lucide-react';

export interface TalentItem {
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  city: string;
  country: string;
  tags: string[];
  ratingAvg: number;
  audienceSize?: number;
}

const FLAG: Record<string, string> = { CM: '🇨🇲', CI: '🇨🇮', GA: '🇬🇦' };

function compactAudience(n?: number): string | null {
  if (!n) return null;
  if (n >= 1000) return `${Math.round(n / 100) / 10}k`;
  return String(n);
}

export function TalentGrid({ creators }: { creators: TalentItem[] }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');

  const categories = useMemo(() => {
    const set = new Set<string>();
    creators.forEach((c) => c.tags.forEach((t) => set.add(t)));
    return ['all', ...Array.from(set).sort()];
  }, [creators]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return creators.filter((c) => {
      if (cat !== 'all' && !c.tags.includes(cat)) return false;
      if (needle && !`${c.displayName} ${c.handle} ${c.tags.join(' ')}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [creators, q, cat]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nom, catégorie…"
          className="w-full rounded-xl border border-line bg-white py-2.5 pl-9 pr-3 text-sm text-ink placeholder-muted/60 focus:border-brand focus:outline-none"
        />
      </div>

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCat(c)}
            className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-bold transition ${
              cat === c ? 'border-brand bg-brand text-white' : 'border-line bg-white text-muted hover:border-brand hover:text-brand'
            }`}
          >
            {c === 'all' ? 'Toutes catégories' : c}
          </button>
        ))}
      </div>

      <p className="text-xs text-muted">{filtered.length} créateur{filtered.length > 1 ? 's' : ''}</p>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-line bg-white p-10 text-center text-sm text-muted">
          Aucun créateur ne correspond à cette recherche.
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {filtered.map((c) => {
            const aud = compactAudience(c.audienceSize);
            return (
              <li key={c.handle}>
                <Link
                  href={`/creators/${c.handle}`}
                  className="flex items-center gap-3 rounded-2xl border border-line bg-white p-4 shadow-card transition hover:border-brand-100 active:scale-[0.99]"
                >
                  {c.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.avatarUrl}
                      alt={c.displayName}
                      loading="lazy"
                      className="h-12 w-12 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-50 font-display font-extrabold text-brand">
                      {c.displayName.slice(0, 1)}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-ink">{c.displayName}</p>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted">
                      <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {c.city} {FLAG[c.country] ?? ''}</span>
                      <span className="inline-flex items-center gap-1"><Star className="h-3 w-3 fill-accent text-accent" /> {c.ratingAvg.toFixed(1)}</span>
                      {aud && <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> {aud}</span>}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {c.tags.slice(0, 3).map((t) => (
                        <span key={t} className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700">{t}</span>
                      ))}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
