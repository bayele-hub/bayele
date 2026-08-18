import { ImageResponse } from 'next/og';
import { getCreator } from '@/lib/data/talent';

// Per-creator social share card (WhatsApp / X / LinkedIn previews). Next wires this to OpenGraph +
// Twitter for this route. System fonts only + initials (no external image fetch), so it renders
// deterministically even when the creator has no photo.
export const alt = 'Profil créateur — Bayele';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const FLAG: Record<string, string> = { CM: '🇨🇲', CI: '🇨🇮', GA: '🇬🇦' };

export default async function Image({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const creator = await getCreator(handle).catch(() => null);
  const name = creator?.displayName ?? 'Créateur';
  const at = creator?.handle ?? handle;
  const city = creator?.city ?? '';
  const country = creator?.country ?? '';
  const tags = (creator?.tags ?? []).slice(0, 3);
  const rating = (creator?.ratingAvg ?? 5).toFixed(1);
  const initials = name.replace(/[^\p{L} ]/gu, '').trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || 'B';

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '52px', height: '52px', borderRadius: '14px', background: 'white', color: '#1268B8', fontSize: '32px', fontWeight: 800 }}>b</div>
          <div style={{ display: 'flex', fontSize: '32px', fontWeight: 800, letterSpacing: '-1px' }}>Bayele<span style={{ color: '#F5A524' }}>.</span></div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '168px', height: '168px', borderRadius: '84px', background: 'rgba(255,255,255,0.12)', border: '3px solid rgba(255,255,255,0.35)', fontSize: '68px', fontWeight: 800 }}>{initials}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '760px' }}>
            <div style={{ display: 'flex', fontSize: '64px', fontWeight: 800, letterSpacing: '-2px', lineHeight: 1.05 }}>{name}</div>
            <div style={{ display: 'flex', fontSize: '30px', color: 'rgba(255,255,255,0.82)' }}>@{at}{city ? ` · ${city} ${FLAG[country] ?? ''}` : ''}</div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              {tags.map((tag) => (
                <div key={tag} style={{ display: 'flex', padding: '8px 18px', borderRadius: '999px', background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.22)', fontSize: '24px', fontWeight: 600 }}>{tag}</div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '26px', fontWeight: 700 }}>
            <span style={{ color: '#F5A524' }}>★</span> {rating} · Créateur vérifié
          </div>
          <div style={{ display: 'flex', padding: '12px 24px', borderRadius: '999px', background: '#F5A524', color: '#0B1B2B', fontSize: '24px', fontWeight: 800 }}>Collaboration sous séquestre</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
