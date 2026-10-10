import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { listCampaignBoard } from '@/lib/data/public-campaigns';
import { getCampaignViewer } from '@/lib/auth/campaign-viewer';
import { campaignCardHref, campaignShareUrl } from '@/lib/auth/campaign-ctas';
import { CampaignCard } from './campaign-card';
import { d } from './card-parts';

/**
 * Home « Campagnes ouvertes » strip (design §5.1): top 3 of the board, hidden entirely when there is
 * none (no heading, no empty state on the home page). Snap rail on phones, 3 columns from `sm`.
 */
export async function HomeCampaignsStrip({ t, locale }: { t: Dictionary; locale: Locale }) {
  const [rows, viewer] = await Promise.all([listCampaignBoard({ limit: 3 }), getCampaignViewer()]);
  if (rows.length === 0) return null;
  const h = t.campaignBoard.home;
  const single = rows.length === 1;

  return (
    <section className="mx-auto max-w-6xl px-4 pt-14" aria-labelledby="home-campaigns">
      <div className="flex items-end justify-between gap-3">
        <h2 id="home-campaigns" data-reveal="up" className="font-headline text-2xl font-bold tracking-[-0.02em] text-ink">{h.heading}</h2>
        <Link href="/campaigns" className="inline-flex min-h-tap items-center gap-1 text-sm font-bold text-brand-700 hover:text-brand">
          {h.seeAll} <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
      <ul
        aria-label={h.heading}
        className={
          single
            ? 'mt-4 grid sm:grid-cols-3'
            : 'no-scrollbar -mx-4 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0'
        }
      >
        {rows.map((c, i) => (
          <li key={c.id} className={single ? '' : 'w-[84%] max-w-[340px] shrink-0 snap-start sm:w-auto sm:max-w-none'}>
            <CampaignCard
              c={c}
              t={t}
              locale={locale}
              style={d(80 + i * 60)}
              links={{ href: campaignCardHref(c.id, viewer), shareUrl: campaignShareUrl(c.id, viewer), alertHref: '/campaigns#alerte' }}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
