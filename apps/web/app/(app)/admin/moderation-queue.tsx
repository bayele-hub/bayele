'use client';

import { useActionState } from 'react';
import { Check, X, Loader2, MapPin } from 'lucide-react';
import { moderateAction, type ModerateState } from './actions';

export interface PendingRow {
  id: string;
  handle: string;
  displayName: string;
  city: string;
  country: string;
  role: string;
  createdAt: string;
}

export function ModerationQueue({ rows }: { rows: PendingRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-white p-10 text-center text-sm text-muted">
        Aucun profil en attente de validation. 🎉
      </div>
    );
  }
  return (
    <ul className="grid gap-3">
      {rows.map((r) => (
        <ModerationCard key={r.id} row={r} />
      ))}
    </ul>
  );
}

function ModerationCard({ row }: { row: PendingRow }) {
  const [state, action, pending] = useActionState<ModerateState, FormData>(moderateAction, { error: null });

  return (
    <li className="rounded-2xl border border-line bg-white p-4 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate font-bold text-ink">{row.displayName}</span>
            <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold uppercase text-brand-700">{row.role}</span>
          </div>
          <div className="mt-0.5 flex min-w-0 items-center gap-2 text-xs text-muted">
            <span className="truncate">@{row.handle}</span>
            <span className="inline-flex shrink-0 items-center gap-1">
              <MapPin className="h-3 w-3" /> {row.city} · {row.country}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <form action={action}>
            <input type="hidden" name="target" value={row.id} />
            <input type="hidden" name="status" value="rejected" />
            <button
              type="submit"
              disabled={pending}
              className="inline-flex min-h-tap items-center gap-1.5 rounded-xl border border-line px-3 text-xs font-bold text-muted transition hover:border-rose-200 hover:text-rose-600 disabled:opacity-50"
            >
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />} Rejeter
            </button>
          </form>
          <form action={action}>
            <input type="hidden" name="target" value={row.id} />
            <input type="hidden" name="status" value="active" />
            <button
              type="submit"
              disabled={pending}
              className="inline-flex min-h-tap items-center gap-1.5 rounded-xl bg-brand px-3 text-xs font-bold text-white transition hover:bg-brand-600 active:scale-95 disabled:opacity-50"
            >
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Approuver
            </button>
          </form>
        </div>
      </div>
      {state.error && <p className="mt-2 text-xs text-rose-600">{state.error}</p>}
    </li>
  );
}
