import { describe, it, expect } from 'vitest';
import { ChartZ, ArchetypeZ, DomainTeasersZ, DomainFullZ, FullProfileZ } from './chart-types';
void DomainFullZ;
void FullProfileZ;

const validChart = {
  ayanamsa: 'Lahiri',
  nakshatra: { name: 'Anuradha', pada: 2, lord: 'Saturn' },
  moonSign: 'Vrischika',
  sunSign: 'Mesha',
  ascendant: { name: 'Ascendant', rasi: 'Vrishabha', rasiLord: 'Venus', house: 1, degree: 12, isRetrograde: false },
  planets: [
    { name: 'Sun', rasi: 'Mesha', rasiLord: 'Mars', house: 12, degree: 5.2, isRetrograde: false },
    { name: 'Moon', rasi: 'Vrischika', rasiLord: 'Mars', house: 7, degree: 3.1, isRetrograde: false },
    { name: 'Saturn', rasi: 'Vrischika', rasiLord: 'Mars', house: 7, degree: 8, isRetrograde: false },
  ],
  currentDasha: { mahadasha: 'Saturn', antardasha: 'Venus', start: '2024-01-01', end: '2027-01-01' },
  activeYogas: ['Kedara Yoga'],
  mangalDosha: false,
  additionalInfo: { luckyColor: 'Black', bestDirection: 'East', deity: 'Apas', animalSign: 'Monkey', birthStone: 'Diamond' },
  tzOffset: 330,
};

describe('ChartZ', () => {
  it('accepts a valid chart', () => {
    expect(ChartZ.safeParse(validChart).success).toBe(true);
  });
  it('rejects missing ascendant', () => {
    const bad = { ...validChart, ascendant: undefined };
    expect(ChartZ.safeParse(bad).success).toBe(false);
  });
  it('accepts null currentDasha', () => {
    expect(ChartZ.safeParse({ ...validChart, currentDasha: null }).success).toBe(true);
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

describe('Domain schemas', () => {
  const okTeasers = {
    career: 'Strategic builder', health: 'Pitta-strong',
    love: 'Quiet wave', wealth: 'Slow harvest', spiritual: 'Through service',
  };
  it('accepts valid teasers', () => {
    expect(DomainTeasersZ.safeParse(okTeasers).success).toBe(true);
  });
  it('rejects missing domain', () => {
    const { wealth, ...rest } = okTeasers;
    void wealth;
    expect(DomainTeasersZ.safeParse(rest).success).toBe(false);
  });
});
