import { describe, it, expect } from 'vitest';
import { fallbackArchetype } from './fallback-archetype';
import type { Chart, Planet } from '@/lib/astro/chart-types';

function p(name: string, rasi: string, house = 1, degree = 0, lord = 'Mars'): Planet {
  return { name, rasi, rasiLord: lord, house, degree, isRetrograde: false };
}

const chart: Chart = {
  ayanamsa: 'Lahiri',
  nakshatra: { name: 'Anuradha', pada: 2, lord: 'Saturn' },
  moonSign: 'Vrischika',
  sunSign: 'Mesha',
  ascendant: p('Ascendant', 'Vrishabha', 1, 12, 'Venus'),
  planets: [p('Sun', 'Mesha'), p('Moon', 'Vrischika')],
  currentDasha: { mahadasha: 'Saturn', antardasha: 'Venus', start: '2024-01-01', end: '2027-01-01' },
  activeYogas: [],
  mangalDosha: false,
  additionalInfo: { luckyColor: 'Black', bestDirection: 'East', deity: 'X', animalSign: 'Y', birthStone: 'Z' },
  tzOffset: 330,
};

describe('fallbackArchetype', () => {
  it('returns valid archetype matching schema', () => {
    const a = fallbackArchetype(chart);
    expect(a.coreTraits).toHaveLength(3);
    expect(a.growthEdges).toHaveLength(2);
    expect(a.luckyNumber).toBeGreaterThanOrEqual(1);
    expect(a.luckyNumber).toBeLessThanOrEqual(9);
    expect(a.provenance.lagna).toBe('Vrishabha');
    expect(a.provenance.nakshatra).toBe('Anuradha');
    expect(a.provenance.currentDasha).toBe('Saturn-Venus');
  });

  it('different lagna+moon-sign produces different label', () => {
    const a1 = fallbackArchetype(chart);
    const c2: Chart = {
      ...chart,
      ascendant: p('Ascendant', 'Simha', 1, 1, 'Sun'),  // fire lagna
      moonSign: 'Mesha',
      nakshatra: { name: 'Magha', pada: 1, lord: 'Ketu' },
    };
    const a2 = fallbackArchetype(c2);
    expect(a1.label).not.toBe(a2.label);
  });

  it('handles missing currentDasha', () => {
    const c: Chart = { ...chart, currentDasha: null };
    const a = fallbackArchetype(c);
    expect(a.provenance.currentDasha).toBe('Unknown');
  });
});
