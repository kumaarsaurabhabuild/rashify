import type { Archetype } from '@/lib/astro/chart-types';

export interface ShareCardProps {
  archetype: Archetype;
  slug: string;
  appUrl: string;
}

/* Element-driven palette: lagna sign → fire / earth / air / water gradient.
   12 lagna signs map to 4 visual families so 108 archetypes share 4 backgrounds.
   Distinct enough to spark "ooh which one are YOU" curiosity in WA threads.
   Note: no Unicode glyphs — Satori (Vercel OG) bundled font has no emoji/symbols. */
const ELEMENT: Record<string, { from: string; to: string; ink: string; accent: string; element: string }> = {
  Mesha:    { from: '#ff7847', to: '#e63946', ink: '#fff7ed', accent: '#ffd166', element: 'FIRE' },
  Simha:    { from: '#ff7847', to: '#e63946', ink: '#fff7ed', accent: '#ffd166', element: 'FIRE' },
  Dhanu:    { from: '#ff7847', to: '#e63946', ink: '#fff7ed', accent: '#ffd166', element: 'FIRE' },
  Vrishabha:{ from: '#1f4d3a', to: '#3a8e6a', ink: '#f0fff4', accent: '#d4af37', element: 'EARTH' },
  Kanya:    { from: '#1f4d3a', to: '#3a8e6a', ink: '#f0fff4', accent: '#d4af37', element: 'EARTH' },
  Makara:   { from: '#1f4d3a', to: '#3a8e6a', ink: '#f0fff4', accent: '#d4af37', element: 'EARTH' },
  Mithuna:  { from: '#5b3c8a', to: '#a06ad9', ink: '#fdf4ff', accent: '#fbcfe8', element: 'AIR' },
  Tula:     { from: '#5b3c8a', to: '#a06ad9', ink: '#fdf4ff', accent: '#fbcfe8', element: 'AIR' },
  Kumbha:   { from: '#5b3c8a', to: '#a06ad9', ink: '#fdf4ff', accent: '#fbcfe8', element: 'AIR' },
  Karka:    { from: '#0a3a5e', to: '#3a7ca5', ink: '#f0f9ff', accent: '#67e8f9', element: 'WATER' },
  Vrischika:{ from: '#0a3a5e', to: '#3a7ca5', ink: '#f0f9ff', accent: '#67e8f9', element: 'WATER' },
  Meena:    { from: '#0a3a5e', to: '#3a7ca5', ink: '#f0f9ff', accent: '#67e8f9', element: 'WATER' },
};

const FALLBACK = { from: '#3a0a14', to: '#7d1d2e', ink: '#f1e7d4', accent: '#c9a24a', element: 'COSMOS' };

// Note: Satori (Vercel OG) requires explicit `display: flex` on every multi-child
// div, and can't dynamically download Google fonts on Vercel without an explicit
// `fonts: [...]` option to ImageResponse. We use system fonts to keep OG portable.
export function ShareCard({ archetype: a }: ShareCardProps) {
  const palette = ELEMENT[a.provenance.lagna] ?? FALLBACK;

  return (
    <div
      style={{
        width: 1080, height: 1920,
        background: `linear-gradient(150deg, ${palette.from} 0%, ${palette.to} 100%)`,
        color: palette.ink,
        padding: 80,
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        position: 'relative', overflow: 'hidden',
      }}
    >
      <div style={{
        position: 'absolute', top: -200, right: -200, width: 700, height: 700,
        background: `radial-gradient(circle, ${palette.accent}33 0%, transparent 60%)`,
        display: 'flex',
      }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <span style={{
            fontFamily: 'system-ui, sans-serif',
            fontSize: 22, letterSpacing: 6, fontWeight: 700,
            color: palette.from, background: palette.accent,
            padding: '8px 14px',
            display: 'flex',
          }}>{palette.element}</span>
          <span style={{
            fontFamily: 'system-ui, sans-serif',
            fontSize: 22, letterSpacing: 8, fontWeight: 600,
            textTransform: 'uppercase', color: palette.accent, display: 'flex',
          }}>RASHIFY · VEDIC ARCHETYPE</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 60 }}>
          <span style={{
            fontFamily: 'system-ui, sans-serif',
            fontSize: 152, lineHeight: 0.9, fontWeight: 900,
            letterSpacing: -4, color: palette.ink, display: 'flex',
          }}>{a.label}</span>
          <span style={{
            fontFamily: 'Georgia, serif',
            fontSize: 56, fontStyle: 'italic',
            color: palette.accent, marginTop: 12, display: 'flex',
          }}>{a.sanskritLabel}</span>
        </div>
      </div>

      <div style={{
        background: '#ffffff',
        color: '#1a1a1a',
        padding: '56px 64px',
        borderRadius: 6,
        display: 'flex', flexDirection: 'column', gap: 20,
        boxShadow: '0 30px 80px rgba(0,0,0,0.25)',
        zIndex: 1,
      }}>
        <span style={{
          fontFamily: 'system-ui, sans-serif',
          fontSize: 18, letterSpacing: 5, fontWeight: 700,
          textTransform: 'uppercase', color: palette.from, display: 'flex',
        }}>The truth about you</span>
        <span style={{
          fontFamily: 'Georgia, serif',
          fontSize: 64, lineHeight: 1.15, fontStyle: 'italic',
          color: '#1a1a1a', display: 'flex',
        }}>&ldquo;{a.oneLiner}&rdquo;</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, zIndex: 1 }}>
        {a.coreTraits.map((t, i) => (
          <div key={t} style={{
            display: 'flex', alignItems: 'center', gap: 24,
            background: 'rgba(255,255,255,0.12)',
            border: `1.5px solid ${palette.accent}88`,
            padding: '22px 32px',
            borderRadius: 999,
          }}>
            <span style={{
              fontFamily: 'system-ui, sans-serif',
              fontSize: 24, fontWeight: 800, letterSpacing: 2,
              color: palette.accent, minWidth: 30, display: 'flex',
            }}>0{i + 1}</span>
            <span style={{
              fontFamily: 'system-ui, sans-serif',
              fontSize: 34, fontWeight: 500,
              color: palette.ink, display: 'flex',
            }}>{t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
