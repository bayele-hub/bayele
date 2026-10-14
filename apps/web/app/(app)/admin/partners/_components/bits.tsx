import type { ReactNode } from 'react';

export function Chip({ tone, children }: { tone: 'ok' | 'wait' | 'blocked' | 'closed' | 'brand'; children: ReactNode }) {
  const cls = { ok: 'bg-emerald-50 text-emerald-700', wait: 'bg-accent-soft text-ink', blocked: 'bg-rose-50 text-rose-700', closed: 'bg-surface text-muted', brand: 'bg-brand-50 text-brand-700' }[tone];
  return <span className={`inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${cls}`}>{children}</span>;
}

export function Card({ title, tip, children, id }: { title: string; tip?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="min-w-0 rounded-2xl border border-line bg-white p-4 shadow-card">
      <h3 className="flex items-center text-sm font-bold text-ink">{title}{tip}</h3>
      <div className="mt-2 min-w-0 space-y-2 text-sm text-ink">{children}</div>
    </section>
  );
}

export function Muted({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted">{children}</p>;
}

/** Relative age line: à l'instant / il y a {n} h / il y a {n} j. */
export function age(iso: string, L: { ageNow: string; ageHours: string; ageDays: string }, now = Date.now()): string {
  const h = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 3_600_000));
  if (h < 1) return L.ageNow;
  if (h < 48) return L.ageHours.replace('{n}', String(h));
  return L.ageDays.replace('{n}', String(Math.floor(h / 24)));
}
