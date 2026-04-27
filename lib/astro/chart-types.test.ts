import { describe, it, expect } from 'vitest';
import { ChartZ, ArchetypeZ } from './chart-types';

const validChart = {
  ayanamsa: 'Lahiri',
  lagna: { sign: 'Vrishabha', degree: 12.5 },
  sun:   { name: 'Sun', sign: 'Mesha', house: 12, degree: 5.2, nakshatra: 'Ashwini', pada: 1 },
  moon:  { name: 'Moon', sign: 'Vrishchika', house: 7, degree: 3.1, nakshatra: 'Anuradha', pada: 2 },
  planets: [
    { name: 'Saturn', sign: 'Vrishchika', house: 7, degree: 8, nakshatra: 'Anuradha', pada: 2 },
  ],
  dasha: { mahadasha: 'Saturn', antardasha: 'Venus', start: '2024-01-01', end: '2027-01-01' },
  tzOffset: 330,
};

describe('ChartZ', () => {
  it('accepts a valid chart', () => {
    expect(ChartZ.safeParse(validChart).success).toBe(true);
  });
  it('rejects missing lagna', () => {
    const bad = { ...validChart, lagna: undefined };
    expect(ChartZ.safeParse(bad).success).toBe(false);
  });
});

describe('ArchetypeZ', () => {
  const ok = {
    label: 'The Saturn-Mercury Strategist',
    sanskritLabel: 'Karma-Yoga Tantri',
    coreTraits: ['a', 'b', 'c'],
    strengths: ['x', 'y', 'z'],
    growthEdges: ['p', 'q'],
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
  it('accepts valid archetype', () => {
    expect(ArchetypeZ.safeParse(ok).success).toBe(true);
  });
  it('rejects luckyNumber out of 1-9', () => {
    expect(ArchetypeZ.safeParse({ ...ok, luckyNumber: 12 }).success).toBe(false);
  });
  it('rejects coreTraits length != 3', () => {
    expect(ArchetypeZ.safeParse({ ...ok, coreTraits: ['a'] }).success).toBe(false);
  });
});
