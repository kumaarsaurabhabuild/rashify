import type { Archetype } from '@/lib/astro/chart-types';

export interface ShareCardProps {
  archetype: Archetype;
  slug: string;
  appUrl: string;
}

export function ShareCard({ archetype: a, slug, appUrl }: ShareCardProps) {
  const personalUrl = `${appUrl.replace(/^https?:\/\//, '')}/u/${slug}`;
  return (
    <div
      style={{
        width: 1080, height: 1920,
        background: '#3a0a14', color: '#f1e7d4',
        fontFamily: 'Cormorant Garamond, serif',
        padding: 96, display: 'flex', flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <div style={{ fontSize: 36, letterSpacing: 8, color: '#c9a24a' }}>◆ RASHIFY</div>

      <div>
        <div style={{ fontSize: 36, color: '#c9a24a' }}>✦</div>
        <h1 style={{ fontSize: 96, lineHeight: 1.05, margin: '24px 0' }}>{a.label}</h1>
        <div style={{ fontSize: 48, color: '#c9a24a', fontStyle: 'italic' }}>{a.sanskritLabel}</div>
      </div>

      <div style={{ fontFamily: 'Inter, sans-serif' }}>
        <div style={{ fontSize: 28, letterSpacing: 4, color: '#c9a24a', marginBottom: 16 }}>CORE TRAITS</div>
        {a.coreTraits.map((t) => (
          <div key={t} style={{ fontSize: 40, marginBottom: 12 }}>• <span>{t}</span></div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 96, fontFamily: 'Inter, sans-serif' }}>
        <div>
          <div style={{ fontSize: 24, color: '#c9a24a', letterSpacing: 4 }}>STRENGTH</div>
          <div style={{ fontSize: 36 }}>{a.strengths.join(' · ')}</div>
        </div>
        <div>
          <div style={{ fontSize: 24, color: '#c9a24a', letterSpacing: 4 }}>GROWTH EDGE</div>
          <div style={{ fontSize: 36 }}>{a.growthEdges.join(' · ')}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 96, fontFamily: 'Inter, sans-serif' }}>
        <div>
          <div style={{ fontSize: 24, color: '#c9a24a', letterSpacing: 4 }}>POWER WINDOW</div>
          <div style={{ fontSize: 32 }}>{a.powerWindow}</div>
        </div>
        <div>
          <div style={{ fontSize: 24, color: '#c9a24a', letterSpacing: 4 }}>LUCKY</div>
          <div style={{ fontSize: 32 }}>{a.luckyColor} · {a.luckyNumber}</div>
        </div>
      </div>

      <div style={{ borderTop: '1px solid #c9a24a44', paddingTop: 24, fontFamily: 'Inter, sans-serif' }}>
        <div style={{ fontSize: 20, color: '#c9a24a' }}>
          {a.provenance.system} · {a.provenance.ayanamsa} · {a.provenance.lagna} · {a.provenance.nakshatra} · {a.provenance.currentDasha} dasha
        </div>
        <div style={{ fontSize: 36, marginTop: 16, color: '#f1e7d4' }}>{personalUrl}</div>
      </div>
    </div>
  );
}
