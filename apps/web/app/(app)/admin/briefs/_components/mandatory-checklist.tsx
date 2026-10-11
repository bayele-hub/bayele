import type { ReactNode } from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
import { CHECKLIST_FIELD, CHECKLIST_KEYS, type ChecklistKey } from '@/lib/managed-listing';

/**
 * « Avant publication » (design §2.8): 15 items; 1–14 mirror the publish RPC's checks so the UI never
 * offers a button the server will refuse. Unmet items link to their field.
 */
export function MandatoryChecklist({ checks, title, items, doneLabel, todoLabel, id, tip }: { checks: Record<ChecklistKey, boolean>; title: string; items: string[]; doneLabel: string; todoLabel: string; id?: string; tip?: ReactNode }) {
  const done = CHECKLIST_KEYS.filter((k) => checks[k]).length;
  return (
    <div id={id} className="rounded-2xl border border-line bg-white p-4 shadow-card">
      <p className="flex items-center justify-between text-sm font-bold text-ink">
        <span className="flex items-center">{title}{tip}</span> <span className="tabular-nums text-muted">{done}/{CHECKLIST_KEYS.length}</span>
      </p>
      <ul className="mt-2 grid gap-0.5">
        {CHECKLIST_KEYS.map((k, i) => (
          <li key={k}>
            {checks[k] ? (
              <span className="flex min-h-[32px] items-center gap-2 text-[13px] text-ink">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden /> {items[i]} <span className="sr-only">— {doneLabel}</span>
              </span>
            ) : (
              <a href={`#${CHECKLIST_FIELD[k]}`} className="flex min-h-[32px] items-center gap-2 text-[13px] text-muted hover:text-brand">
                <Circle className="h-4 w-4 shrink-0" aria-hidden /> {items[i]} <span className="sr-only">— {todoLabel}</span>
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
