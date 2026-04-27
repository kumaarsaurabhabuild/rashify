import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateArchetype } from './gemini';
import type { Chart } from '@/lib/astro/chart-types';

const mockGenerate = vi.fn();
vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return { generateContent: mockGenerate };
    }
  },
}));

const chart: Chart = {
  ayanamsa: 'Lahiri',
  lagna: { sign: 'Vrishabha', degree: 12 },
  sun: { name: 'Sun', sign: 'Mesha', house: 12, degree: 5, nakshatra: 'Ashwini', pada: 1 },
  moon: { name: 'Moon', sign: 'Vrishchika', house: 7, degree: 3, nakshatra: 'Anuradha', pada: 2 },
  planets: [],
  dasha: { mahadasha: 'Saturn', antardasha: 'Venus', start: '2024-01-01', end: '2027-01-01' },
  tzOffset: 330,
};

const goodArchetype = {
  label: 'The Saturn-Mercury Strategist',
  sanskritLabel: 'Karma-Yoga Tantri',
  coreTraits: ['Patient architect of slow ambition', 'Quiet authority in groups', 'Long arc thinking'],
  strengths: ['Strategy', 'Patience', 'Discipline'],
  growthEdges: ['Letting go', 'Spontaneity'],
  luckyColor: 'indigo',
  luckyNumber: 7,
  powerWindow: '10:30 PM - 2 AM',
  oneLiner: 'A patient architect of slow ambition.',
  provenance: { ayanamsa: 'Lahiri', system: 'Vedic sidereal', nakshatra: 'Anuradha', lagna: 'Vrishabha', currentDasha: 'Saturn-Venus' },
};

beforeEach(() => {
  mockGenerate.mockReset();
  process.env.GEMINI_API_KEY = 'fake';
});

describe('generateArchetype', () => {
  it('returns parsed archetype on valid JSON response', async () => {
    mockGenerate.mockResolvedValueOnce({
      response: { text: () => JSON.stringify(goodArchetype) },
    });
    const out = await generateArchetype(chart, 'Saurabh');
    expect(out.label).toBe(goodArchetype.label);
    expect(out.coreTraits).toHaveLength(3);
  });

  it('retries once on schema failure with stricter prompt', async () => {
    mockGenerate
      .mockResolvedValueOnce({ response: { text: () => '{"label":"x"}' } })           // bad
      .mockResolvedValueOnce({ response: { text: () => JSON.stringify(goodArchetype) } });
    const out = await generateArchetype(chart, 'Saurabh');
    expect(mockGenerate).toHaveBeenCalledTimes(2);
    expect(out.label).toBe(goodArchetype.label);
  });

  it('throws LLM_BAD after second failure', async () => {
    mockGenerate.mockResolvedValue({ response: { text: () => '{"label":"x"}' } });
    await expect(generateArchetype(chart, 'X')).rejects.toThrow('LLM_BAD');
  });
});
