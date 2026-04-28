import { ShareCardA } from '@/components/prototypes/ShareCardA';
import { ShareCardC } from '@/components/prototypes/ShareCardC';
import { ShareCard } from '@/components/ShareCard';
import type { Archetype } from '@/lib/astro/chart-types';

const demo: Archetype = {
  label: 'Steady Strategist',
  sanskritLabel: 'Dhairya Yojaka',
  coreTraits: ['Patient builder', 'Methodical thinker', 'Resilient under pressure'],
  strengths: ['Long-term focus', 'Strong work ethic', 'Calculated risk-taking'],
  growthEdges: ['Avoid stubbornness', 'Balance caution with spontaneity'],
  luckyColor: 'Emerald',
  luckyNumber: 4,
  powerWindow: 'Saturday evenings',
  oneLiner: 'You climb patiently, then leap ahead when least expected.',
  provenance: {
    ayanamsa: 'Lahiri', system: 'Vedic sidereal',
    nakshatra: 'Purva Ashadha', lagna: 'Vrishabha',
    currentDasha: 'Venus-Sun',
  },
};

const demoFire: Archetype = { ...demo, provenance: { ...demo.provenance, lagna: 'Simha' } };
const demoAir: Archetype = { ...demo, provenance: { ...demo.provenance, lagna: 'Tula' } };
const demoWater: Archetype = { ...demo, provenance: { ...demo.provenance, lagna: 'Karka' } };

function Frame({ title, children, scale = 0.32 }: { title: string; children: React.ReactNode; scale?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <div style={{
        fontFamily: 'system-ui, sans-serif', fontSize: 14, fontWeight: 600,
        letterSpacing: 2, textTransform: 'uppercase', color: 'var(--ink)',
      }}>{title}</div>
      <div style={{
        width: 1080 * scale, height: 1920 * scale,
        overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export default function CardsPreview() {
  return (
    <main style={{ padding: 40, background: '#f4ede0', minHeight: '100vh' }}>
      <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 36, marginBottom: 8 }}>
        Share-card prototypes
      </h1>
      <p style={{ marginBottom: 32, fontSize: 14, color: '#666' }}>
        Same archetype data. A = Spotify-Wrapped style with element palettes. C = BuzzFeed quiz style. Current = production card.
      </p>

      <h2 style={{ marginTop: 24, marginBottom: 16, fontSize: 20 }}>A — Spotify-Wrapped (4 element variants)</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 32, marginBottom: 64 }}>
        <Frame title="Earth (Vrishabha)"><ShareCardA archetype={demo} /></Frame>
        <Frame title="Fire (Simha)"><ShareCardA archetype={demoFire} /></Frame>
        <Frame title="Air (Tula)"><ShareCardA archetype={demoAir} /></Frame>
        <Frame title="Water (Karka)"><ShareCardA archetype={demoWater} /></Frame>
      </div>

      <h2 style={{ marginTop: 24, marginBottom: 16, fontSize: 20 }}>C — BuzzFeed quiz style</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 32, marginBottom: 64 }}>
        <Frame title="Default palette"><ShareCardC archetype={demo} /></Frame>
      </div>

      <h2 style={{ marginTop: 24, marginBottom: 16, fontSize: 20 }}>Current (production)</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 32 }}>
        <Frame title="Live"><ShareCard archetype={demo} slug="demo-x7k2" appUrl="https://rashify.app" /></Frame>
      </div>
    </main>
  );
}
