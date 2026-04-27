import { describe, it, expect } from 'vitest';
import { fallbackArchetype } from './fallback-archetype';
import type { Chart } from '@/lib/astro/chart-types';

const chart: Chart = {
  ayanamsa: 'Lahiri',
  lagna: { sign: 'Vrishabha', degree: 12 },
  sun: { name: 'Sun', sign: 'Mesha', house: 12, degree: 5, nakshatra: 'Ashwini', pada: 1 },
  moon: { name: 'Moon', sign: 'Vrishchika', house: 7, degree: 3, nakshatra: 'Anuradha', pada: 2 },
  planets: [],
  dasha: { mahadasha: 'Saturn', antardasha: 'Venus', start: '2024-01-01', end: '2027-01-01' },
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
  });

  it('different lagna+nakshatra produces different label', () => {
    const a1 = fallbackArchetype(chart);
    const c2: Chart = { ...chart, lagna: { sign: 'Simha', degree: 1 }, moon: { ...chart.moon, nakshatra: 'Magha' } };
    const a2 = fallbackArchetype(c2);
    expect(a1.label).not.toBe(a2.label);
  });
});
