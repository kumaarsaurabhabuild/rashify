import { ShareCard } from '@/components/ShareCard';
import { BrandMark } from '@/components/BrandMark';
import type { Archetype } from '@/lib/astro/chart-types';

const demoArchetype: Archetype = {
  label: 'The Saturn-Mercury Strategist',
  sanskritLabel: 'Karma-Yoga Tantri',
  coreTraits: [
    'Patient architect of slow ambition',
    'Quiet authority in groups',
    'Long arc thinking, short window of action',
  ],
  strengths: ['Strategy', 'Patience', 'Discipline'],
  growthEdges: ['Letting go', 'Spontaneity'],
  luckyColor: 'indigo',
  luckyNumber: 7,
  powerWindow: '10:30 PM - 2 AM',
  oneLiner: 'A patient architect of slow ambition.',
  provenance: {
    ayanamsa: 'Lahiri',
    system: 'Vedic sidereal',
    nakshatra: 'Anuradha',
    lagna: 'Vrishabha',
    currentDasha: 'Saturn-Venus',
  },
};

export default function PreviewCard() {
  return (
    <main className="min-h-screen flex flex-col">
      <header className="px-8 sm:px-14 py-8 flex items-center justify-between">
        <BrandMark size="md" />
        <a href="/" className="eyebrow" style={{ color: 'var(--parchment-fade)', textDecoration: 'none' }}>
          ← Back
        </a>
      </header>

      <article className="flex-1 flex flex-col items-center px-8 sm:px-14 pb-20" style={{ paddingTop: 12 }}>
        <span className="eyebrow">Internal preview</span>
        <h1
          className="font-display"
          style={{ fontSize: 56, marginTop: 16, color: 'var(--parchment)', fontWeight: 400 }}
        >
          Share card preview
        </h1>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontStyle: 'italic',
            fontSize: 16,
            color: 'var(--parchment-fade)',
            marginTop: 8,
            textAlign: 'center',
          }}
        >
          Renders at full 1080×1920. Scaled to 0.4 for screen. Same JSX powers <code>/api/og</code>.
        </p>

        <div
          style={{
            marginTop: 48,
            transform: 'scale(0.4)',
            transformOrigin: 'top center',
            height: 1920 * 0.4,
            width: 1080,
          }}
        >
          <ShareCard archetype={demoArchetype} slug="saurabh-x7k2" appUrl="https://rashify.in" />
        </div>
      </article>
    </main>
  );
}
