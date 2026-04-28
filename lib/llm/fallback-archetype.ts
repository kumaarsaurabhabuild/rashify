import type { Chart, Archetype } from '@/lib/astro/chart-types';

/* Deterministic archetype lookup.
 * Primary key: lagna rasi (12 unique signs).
 * Secondary modifier: moon nakshatra lord (9 planets) — adjusts traits[2],
 * growthEdges[1], luckyColor, luckyNumber, powerWindow.
 * Total unique combos: 12 × 9 = 108 (no two lagnas collide). */

interface BaseArchetype {
  label: string;
  sanskrit: string;
  traits: [string, string];      // first two traits (lagna anchors)
  strengths: [string, string, string];
  growthEdges: [string];          // first edge (lagna anchors)
}

const LAGNA_BASE: Record<string, BaseArchetype> = {
  Mesha: {
    label: 'The Solar Catalyst',
    sanskrit: 'Agni-Vegavān',
    traits: ['Acts before the room finishes thinking', 'Burns hot, decides faster than they doubt'],
    strengths: ['Initiative', 'Courage', 'Spark'],
    growthEdges: ['Patience'],
  },
  Vrishabha: {
    label: 'The Quiet Builder',
    sanskrit: 'Sthira Shilpī',
    traits: ['Builds in years, not weekends', 'Trusts only what they can hold'],
    strengths: ['Endurance', 'Loyalty', 'Aesthetic'],
    growthEdges: ['Letting go'],
  },
  Mithuna: {
    label: 'The Restless Weaver',
    sanskrit: 'Vāyu Granthī',
    traits: ['Reads three rooms while answering one', 'Trades depth for breadth, sometimes'],
    strengths: ['Wit', 'Networks', 'Versatility'],
    growthEdges: ['Commitment'],
  },
  Karka: {
    label: 'The Tidal Keeper',
    sanskrit: 'Jala Pālaka',
    traits: ['Feels rooms before reading them', 'Carries other people\'s weather home'],
    strengths: ['Empathy', 'Memory', 'Care'],
    growthEdges: ['Boundaries'],
  },
  Simha: {
    label: 'The Stage-Lit Sovereign',
    sanskrit: 'Rāja Tejas',
    traits: ['Walks in like the room owes them attention', 'Generosity is the throne, ego the moat'],
    strengths: ['Charisma', 'Vision', 'Loyalty'],
    growthEdges: ['Humility'],
  },
  Kanya: {
    label: 'The Forensic Mind',
    sanskrit: 'Vichāra Sūkṣma',
    traits: ['Spots the typo three pages back', 'Service is love, perfectionism is the cost'],
    strengths: ['Precision', 'Discipline', 'Insight'],
    growthEdges: ['Acceptance'],
  },
  Tula: {
    label: 'The Quiet Diplomat',
    sanskrit: 'Sama-Tulā',
    traits: ['Holds two truths without picking one', 'Reflects more than they reveal'],
    strengths: ['Charm', 'Fairness', 'Taste'],
    growthEdges: ['Decisiveness'],
  },
  Vrischika: {
    label: 'The Deep Diver',
    sanskrit: 'Gambhīra Yoddhā',
    traits: ['Trusts the under-current, not the surface', 'Loves and grudges with equal half-life'],
    strengths: ['Intensity', 'Will', 'Insight'],
    growthEdges: ['Forgiveness'],
  },
  Dhanu: {
    label: 'The Long-Arc Seeker',
    sanskrit: 'Dīrgha Mārga',
    traits: ['Reads horizons better than rooms', 'Truth first, tact second'],
    strengths: ['Vision', 'Optimism', 'Honesty'],
    growthEdges: ['Tact'],
  },
  Makara: {
    label: 'The Slow Architect',
    sanskrit: 'Karma-Yoga Tantrī',
    traits: ['Plays the twenty-year game alone', 'Mistakes solitude for self-sufficiency'],
    strengths: ['Discipline', 'Resilience', 'Strategy'],
    growthEdges: ['Receiving help'],
  },
  Kumbha: {
    label: 'The Pattern Outsider',
    sanskrit: 'Vichitra Dṛṣṭi',
    traits: ['Sees the system from outside it', 'Cares for humanity, awkward with the human in front'],
    strengths: ['Originality', 'Vision', 'Detachment'],
    growthEdges: ['Intimacy'],
  },
  Meena: {
    label: 'The Soft Mystic',
    sanskrit: 'Soumya Drishtā',
    traits: ['Senses what others say behind their words', 'Boundaries blur before they\'re drawn'],
    strengths: ['Imagination', 'Compassion', 'Devotion'],
    growthEdges: ['Grounding'],
  },
};

interface LordModifier {
  trait3: string;
  edge2: string;
  luckyColor: string;
  luckyNumber: number;
  powerWindow: string;
  oneLinerHint: string;
}

const NAKSHATRA_LORD_MOD: Record<string, LordModifier> = {
  Sun: {
    trait3: 'Burns brightest when seen',
    edge2: 'Sharing the spotlight',
    luckyColor: 'amber',
    luckyNumber: 1,
    powerWindow: '6 AM – 10 AM',
    oneLinerHint: 'lit from within',
  },
  Moon: {
    trait3: 'Mood is the weather, not the news',
    edge2: 'Constancy',
    luckyColor: 'pearl',
    luckyNumber: 2,
    powerWindow: '8 PM – 12 AM',
    oneLinerHint: 'reads tides others ignore',
  },
  Mars: {
    trait3: 'Acts on instinct, asks later',
    edge2: 'Restraint',
    luckyColor: 'coral',
    luckyNumber: 9,
    powerWindow: '5 AM – 8 AM',
    oneLinerHint: 'born to start things',
  },
  Mercury: {
    trait3: 'Minds it before they speak it',
    edge2: 'Stillness',
    luckyColor: 'jade',
    luckyNumber: 5,
    powerWindow: '10 AM – 2 PM',
    oneLinerHint: 'thinks in maps, not lists',
  },
  Jupiter: {
    trait3: 'Teaches by being, not telling',
    edge2: 'Selectivity',
    luckyColor: 'ochre',
    luckyNumber: 3,
    powerWindow: '3 PM – 6 PM',
    oneLinerHint: 'expands every room',
  },
  Venus: {
    trait3: 'Beautifies whatever they touch',
    edge2: 'Solitude tolerance',
    luckyColor: 'rose',
    luckyNumber: 6,
    powerWindow: '5 PM – 9 PM',
    oneLinerHint: 'a slow, considered yes',
  },
  Saturn: {
    trait3: 'Rewards arrive late, but they arrive',
    edge2: 'Lightness',
    luckyColor: 'indigo',
    luckyNumber: 8,
    powerWindow: '10 PM – 2 AM',
    oneLinerHint: 'patience is the real superpower',
  },
  Rahu: {
    trait3: 'Wants what they were told not to want',
    edge2: 'Contentment',
    luckyColor: 'midnight blue',
    luckyNumber: 4,
    powerWindow: '11 PM – 3 AM',
    oneLinerHint: 'the unconventional path is the path',
  },
  Ketu: {
    trait3: 'Detached even when present',
    edge2: 'Engagement',
    luckyColor: 'smoke grey',
    luckyNumber: 7,
    powerWindow: '4 AM – 6 AM',
    oneLinerHint: 'an old soul running fresh code',
  },
};

const LAGNA_FALLBACK: BaseArchetype = LAGNA_BASE.Vrishabha;
const LORD_FALLBACK: LordModifier = NAKSHATRA_LORD_MOD.Saturn;

export function fallbackArchetype(chart: Chart): Archetype {
  const lagnaSign = chart.ascendant.rasi;
  const base = LAGNA_BASE[lagnaSign] ?? LAGNA_FALLBACK;
  const lord = NAKSHATRA_LORD_MOD[chart.nakshatra.lord] ?? LORD_FALLBACK;

  const dasha = chart.currentDasha
    ? `${chart.currentDasha.mahadasha}-${chart.currentDasha.antardasha}`
    : 'Unknown';

  return {
    label: base.label,
    sanskritLabel: base.sanskrit,
    coreTraits: [base.traits[0], base.traits[1], lord.trait3],
    strengths: base.strengths,
    growthEdges: [base.growthEdges[0], lord.edge2],
    luckyColor: lord.luckyColor,
    luckyNumber: lord.luckyNumber,
    powerWindow: lord.powerWindow,
    oneLiner: `${base.label} — ${lord.oneLinerHint}.`,
    provenance: {
      ayanamsa: chart.ayanamsa,
      system: 'Vedic sidereal',
      nakshatra: chart.nakshatra.name,
      lagna: lagnaSign,
      currentDasha: dasha,
    },
  };
}
