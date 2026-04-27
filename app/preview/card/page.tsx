import { ShareCard } from '@/components/ShareCard';
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
    <main className="min-h-screen flex flex-col items-center px-6 py-12 gap-8" style={{ background: '#f1e7d4' }}>
      <div className="max-w-md text-center">
        <a href="/" className="underline text-sm">← back to form</a>
        <h2 className="text-2xl font-serif mt-4" style={{ color: '#3a0a14' }}>
          ShareCard preview
        </h2>
        <p className="text-xs mt-1 opacity-60">
          Renders at full 1080×1920. Scaled here for screen. The same JSX powers <code>/api/og</code>.
        </p>
      </div>

      <div
        style={{
          transform: 'scale(0.4)',
          transformOrigin: 'top center',
          height: 1920 * 0.4,
          width: 1080,
        }}
      >
        <ShareCard archetype={demoArchetype} slug="saurabh-x7k2" appUrl="https://rashify.in" />
      </div>

      <div className="max-w-md text-center text-sm" style={{ color: '#3a0a14' }}>
        <p className="font-semibold">{demoArchetype.label}</p>
        <p className="italic opacity-80">{demoArchetype.sanskritLabel}</p>
        <p className="mt-2">{demoArchetype.oneLiner}</p>
      </div>
    </main>
  );
}
