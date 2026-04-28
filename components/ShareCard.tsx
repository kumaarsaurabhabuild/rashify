import type { Archetype } from '@/lib/astro/chart-types';

export interface ShareCardProps {
  archetype: Archetype;
  slug: string;
  appUrl: string;
}

const COLORS = {
  bg: '#3a0a14',     // deep maroon
  text: '#f1e7d4',   // ivory
  gold: '#c9a24a',   // antique gold
  goldDim: '#c9a24a44',
};

// Note: Satori (Vercel OG) requires explicit `display: flex` on every multi-child
// div, and can't dynamically download Google fonts on Vercel without an explicit
// `fonts: [...]` option to ImageResponse. We use system fonts to keep OG portable.
export function ShareCard({ archetype: a }: ShareCardProps) {
  return (
    <div
      style={{
        width: 1080,
        height: 1920,
        background: COLORS.bg,
        color: COLORS.text,
        padding: 96,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <div style={{ display: 'flex', fontSize: 36, letterSpacing: 8, color: COLORS.gold }}>
        ◆ RASHIFY
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', fontSize: 36, color: COLORS.gold }}>✦</div>
        <div style={{ display: 'flex', fontSize: 96, lineHeight: 1.05 }}>{a.label}</div>
        <div style={{ display: 'flex', fontSize: 48, color: COLORS.gold, fontStyle: 'italic' }}>
          {a.sanskritLabel}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', fontSize: 28, letterSpacing: 4, color: COLORS.gold }}>
          CORE TRAITS
        </div>
        {a.coreTraits.map((t) => (
          <div key={t} style={{ display: 'flex', gap: 16, fontSize: 40 }}>
            <span>•</span>
            <span>{t}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 96 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 24, color: COLORS.gold, letterSpacing: 4 }}>STRENGTH</span>
          <span style={{ fontSize: 36 }}>{a.strengths.join(' · ')}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 24, color: COLORS.gold, letterSpacing: 4 }}>GROWTH EDGE</span>
          <span style={{ fontSize: 36 }}>{a.growthEdges.join(' · ')}</span>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          borderTop: `1px solid ${COLORS.goldDim}`,
          paddingTop: 24,
        }}
      >
        <div style={{ display: 'flex', fontSize: 20, color: COLORS.gold }}>
          {a.provenance.system} · {a.provenance.ayanamsa} · {a.provenance.lagna} ·{' '}
          {a.provenance.nakshatra} · {a.provenance.currentDasha} dasha
        </div>
      </div>
    </div>
  );
}
