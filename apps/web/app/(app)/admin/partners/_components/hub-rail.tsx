import Link from 'next/link';
import { hubCounts } from '@/lib/data/partner-gov';

const HREFS = ['/admin/partners', '/admin/partners/requests', '/admin/partners/assignments', '/admin/partners/flags'] as const;

/** §0.2 hub sub-navigation: Partenaires · Demandes (n) · Fins demandées (n) · Signalements (n); 0 hidden. */
export async function HubRail({ active, labels }: { active: 0 | 1 | 2 | 3; labels: string[] }) {
  const c = await hubCounts();
  const counts = [0, c.requests, c.ends, c.flags];
  return (
    <nav aria-label={labels[0]} className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1 rounded-xl border border-line bg-white p-1">
        {HREFS.map((href, i) => (
          <li key={href}>
            <Link href={href} aria-current={i === active ? 'page' : undefined}
              className={`inline-flex min-h-tap items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-xs font-bold ${i === active ? 'bg-brand text-white' : 'text-ink hover:bg-surface'}`}>
              {labels[i]}
              {counts[i]! > 0 && <span className={`rounded-full px-1.5 text-[11px] tabular-nums ${i === active ? 'bg-white/20' : 'bg-accent-soft text-ink'}`}>{counts[i]}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
