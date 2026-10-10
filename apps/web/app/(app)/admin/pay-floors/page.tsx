import Link from 'next/link';
import { ChevronLeft, CircleDashed } from 'lucide-react';
import { getDictionary } from '@/i18n/dictionaries';
import { listPayFloors } from '@/lib/data/managed-briefs';
import { DELIVERABLE_TYPES } from '@/lib/managed-listing';
import { FloorRow } from './floor-row';

export const dynamic = 'force-dynamic';

/**
 * « Seuils de rémunération » (design §3, K1). Ships EMPTY and says so honestly: no number is
 * suggested anywhere until Finance + Community set floors from real Bayele data (owner decision O1).
 */
export default async function PayFloorsPage() {
  const [{ locale, t }, rows] = await Promise.all([getDictionary(), listPayFloors()]);
  const P = t.payFloors;
  const byType = new Map((rows ?? []).map((r) => [r.deliverableType, r]));
  const anySet = (rows ?? []).some((r) => r.minNetFcfa !== null);

  return (
    <section className="space-y-4">
      <Link href="/admin/briefs" className="inline-flex min-h-[44px] items-center gap-1 text-xs font-semibold text-muted hover:text-ink">
        <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> {P.back}
      </Link>
      <div>
        <h2 className="text-sm font-bold text-ink">{P.title}</h2>
        <p className="mt-1 max-w-2xl text-xs text-muted">{P.body}</p>
      </div>
      {rows === null ? (
        <p className="rounded-2xl border border-line bg-white p-6 text-center text-sm text-muted">{P.unavailable}</p>
      ) : (
        <>
          {!anySet && (
            <p className="flex items-center gap-2 rounded-xl border border-line bg-surface p-3 text-xs text-ink">
              <CircleDashed className="h-4 w-4 text-muted" aria-hidden /> {P.empty}
            </p>
          )}
          <ul className="grid gap-3 sm:grid-cols-2">
            {DELIVERABLE_TYPES.map((d) => {
              const r = byType.get(d.key);
              return (
                <FloorRow key={d.key} type={d.key} label={d[locale]} unit={locale === 'fr' ? d.unitFr : d.unitEn}
                  value={r?.minNetFcfa ?? null} updatedAt={r?.updatedAt ?? null} P={P} locale={locale} />
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
