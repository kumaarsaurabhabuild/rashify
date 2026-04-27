import type { Chart, Archetype } from '@/lib/astro/chart-types';

// Real Prokerala spellings (Lahiri ayanamsa)
const ELEMENT_BY_SIGN: Record<string, 'fire' | 'earth' | 'air' | 'water'> = {
  Mesha: 'fire', Simha: 'fire', Dhanu: 'fire',
  Vrishabha: 'earth', Kanya: 'earth', Makara: 'earth',
  Mithuna: 'air', Tula: 'air', Kumbha: 'air',
  Karka: 'water', Vrischika: 'water', Meena: 'water',
};

const ARCHETYPES = {
  fire: { label: 'The Solar Catalyst', sanskrit: 'Agni-Tejas Nayaka',
          traits: ['Quick to ignite, slow to settle', 'Leads from instinct, not committee', 'Burns out without an outlet'],
          strengths: ['Initiative', 'Charisma', 'Courage'], edges: ['Patience', 'Pacing'],
          color: 'crimson', num: 9, window: '6 AM - 9 AM' },
  earth: { label: 'The Slow Architect', sanskrit: 'Prithvi Shilpi',
           traits: ['Builds in years, not weekends', 'Trusts only what is held', 'Mistakes stillness for safety'],
           strengths: ['Discipline', 'Endurance', 'Practicality'], edges: ['Spontaneity', 'Risk'],
           color: 'olive', num: 6, window: '8 AM - 12 PM' },
  air: { label: 'The Pattern Seeker', sanskrit: 'Vayu Vichara',
         traits: ['Maps the room before entering it', 'Trades depth for breadth, sometimes', 'Mind faster than commitment'],
         strengths: ['Strategy', 'Wit', 'Networks'], edges: ['Decision', 'Follow-through'],
         color: 'azure', num: 5, window: '10 AM - 2 PM' },
  water: { label: 'The Tidal Mirror', sanskrit: 'Jala Pratibimba',
           traits: ['Feels rooms before reading them', "Carries other people's weather", 'Retreats when overstimulated'],
           strengths: ['Empathy', 'Intuition', 'Memory'], edges: ['Boundaries', 'Selfhood'],
           color: 'indigo', num: 7, window: '8 PM - 12 AM' },
};

export function fallbackArchetype(chart: Chart): Archetype {
  const lagnaSign = chart.ascendant.rasi;
  const lagnaEl = ELEMENT_BY_SIGN[lagnaSign] ?? 'earth';
  const moonEl = ELEMENT_BY_SIGN[chart.moonSign] ?? lagnaEl;
  // blend: lagna dominant; moon flavors color/window
  const base = ARCHETYPES[lagnaEl];
  const flavor = ARCHETYPES[moonEl];
  const dasha = chart.currentDasha
    ? `${chart.currentDasha.mahadasha}-${chart.currentDasha.antardasha}`
    : 'Unknown';
  return {
    label: base.label,
    sanskritLabel: base.sanskrit,
    coreTraits: base.traits as [string, string, string],
    strengths: base.strengths as [string, string, string],
    growthEdges: base.edges as [string, string],
    luckyColor: flavor.color,
    luckyNumber: base.num,
    powerWindow: flavor.window,
    oneLiner: `${base.label} — ${base.traits[0].toLowerCase()}.`,
    provenance: {
      ayanamsa: chart.ayanamsa,
      system: 'Vedic sidereal',
      nakshatra: chart.nakshatra.name,
      lagna: lagnaSign,
      currentDasha: dasha,
    },
  };
}
