import { ImageResponse } from 'next/og';

// Root share image (WhatsApp / social link previews). Next wires this to OpenGraph + Twitter for the
// whole site via the file convention — no per-page image needed. System fonts only (no fetch), so it
// renders deterministically at build/runtime.
export const alt = 'Bayele — influence marketing sous séquestre';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '64px',
              height: '64px',
              borderRadius: '18px',
              background: 'white',
              color: '#1268B8',
              fontSize: '40px',
              fontWeight: 800,
            }}
          >
            b
          </div>
          <div style={{ display: 'flex', fontSize: '40px', fontWeight: 800, letterSpacing: '-1px' }}>
            Bayele<span style={{ color: '#F5A524' }}>.</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', fontSize: '68px', fontWeight: 800, lineHeight: 1.05, letterSpacing: '-2px', maxWidth: '900px' }}>
            L'influence marketing, sécurisée par séquestre.
          </div>
          <div style={{ display: 'flex', fontSize: '30px', color: 'rgba(255,255,255,0.82)', maxWidth: '820px' }}>
            Marques, créateurs & consultants — Cameroun · Côte d'Ivoire · Gabon. Paiements Mobile Money.
          </div>
        </div>

        <div style={{ display: 'flex', gap: '14px' }}>
          {['Séquestre', 'MTN MoMo', 'Orange Money', 'Wave', 'Facturation OHADA'].map((chip) => (
            <div
              key={chip}
              style={{
                display: 'flex',
                padding: '10px 20px',
                borderRadius: '999px',
                background: 'rgba(255,255,255,0.12)',
                border: '1px solid rgba(255,255,255,0.22)',
                fontSize: '24px',
                fontWeight: 600,
              }}
            >
              {chip}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
