import { ImageResponse } from 'next/og';
import { getPublicCampaign } from '@/lib/data/public-campaigns';
import { fmtFcfa } from '@/lib/data/campaigns';
import { COUNTRY_NAME } from '@/lib/seo';

// Per-campaign social share card (WhatsApp / X / LinkedIn previews). System fonts only, no external
// fetch, so it renders deterministically. Next wires this to OpenGraph + Twitter for the route.
export const alt = 'Campagne — Bayele';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const FLAG: Record<string, string> = { CM: '🇨🇲', CI: '🇨🇮', GA: '🇬🇦' };

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await getPublicCampaign(id).catch(() => null);
  const title = (c?.title ?? 'Campagne créateurs').slice(0, 90);
  const brand = c?.brandName ?? 'Une marque';
  const category = c?.category ?? '';
  const country = c?.country ?? '';
  const payout = c ? fmtFcfa(c.payoutPerCreatorFcfa) : '';
  const countryName = country ? COUNTRY_NAME[country as 'CM' | 'CI' | 'GA'] : '';

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px',
          background: 'linear-gradient(135deg, #0B1B2B 0%, #12406E 55%, #1268B8 100%)',
          color: 'white',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '52px', height: '52px', borderRadius: '14px', background: 'white', color: '#1268B8', fontSize: '32px', fontWeight: 800 }}>b</div>
            <div style={{ display: 'flex', fontSize: '32px', fontWeight: 800, letterSpacing: '-1px' }}>Bayele<span style={{ color: '#F5A524' }}>.</span></div>
          </div>
          {category ? (
            <div style={{ display: 'flex', padding: '10px 22px', borderRadius: '999px', background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.22)', fontSize: '24px', fontWeight: 700, textTransform: 'uppercase' }}>{category}</div>
          ) : (
            <div style={{ display: 'flex' }} />
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', maxWidth: '1050px' }}>
          <div style={{ display: 'flex', fontSize: '30px', color: 'rgba(255,255,255,0.82)' }}>{brand}{countryName ? ` · ${countryName} ${FLAG[country] ?? ''}` : ''}</div>
          <div style={{ display: 'flex', fontSize: '62px', fontWeight: 800, letterSpacing: '-2px', lineHeight: 1.05 }}>{title}</div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {payout ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '34px', fontWeight: 800 }}>
              <span style={{ color: '#F5A524' }}>◆</span> {payout} <span style={{ fontSize: '24px', fontWeight: 600, color: 'rgba(255,255,255,0.75)' }}>/ créateur</span>
            </div>
          ) : (
            <div style={{ display: 'flex' }} />
          )}
          <div style={{ display: 'flex', padding: '12px 24px', borderRadius: '999px', background: '#F5A524', color: '#0B1B2B', fontSize: '24px', fontWeight: 800 }}>Paiement sous séquestre</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
