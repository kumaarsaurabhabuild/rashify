import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateArchetype } from './gemini';
import type { Chart } from '@/lib/astro/chart-types';

const mockFetch = vi.fn();
global.fetch = mockFetch as never;

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

function chatRes(content: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content } }] }),
    text: async () => '',
  };
}

beforeEach(() => {
  mockFetch.mockReset();
  process.env.OPENROUTER_API_KEY = 'fake';
  process.env.OPENROUTER_MODEL = 'google/gemini-2.0-flash-001';
});

describe('generateArchetype (OpenRouter)', () => {
  it('returns parsed archetype on valid JSON response', async () => {
    mockFetch.mockResolvedValueOnce(chatRes(JSON.stringify(goodArchetype)));
    const out = await generateArchetype(chart, 'Saurabh');
    expect(out.label).toBe(goodArchetype.label);
    expect(out.coreTraits).toHaveLength(3);

    const call = mockFetch.mock.calls[0];
    expect(call[0]).toBe('https://openrouter.ai/api/v1/chat/completions');
    const init = call[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer fake');
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('google/gemini-2.0-flash-001');
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[1].role).toBe('user');
  });

  it('retries once on schema failure with stricter prompt', async () => {
    mockFetch
      .mockResolvedValueOnce(chatRes('{"label":"x"}'))
      .mockResolvedValueOnce(chatRes(JSON.stringify(goodArchetype)));
    const out = await generateArchetype(chart, 'Saurabh');
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(out.label).toBe(goodArchetype.label);
  });

  it('throws LLM_BAD after second failure', async () => {
    mockFetch.mockResolvedValue(chatRes('{"label":"x"}'));
    await expect(generateArchetype(chart, 'X')).rejects.toThrow('LLM_BAD');
  });

  it('throws LLM_HTTP on 5xx', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 503, text: async () => 'busy' });
    await expect(generateArchetype(chart, 'X')).rejects.toThrow(/LLM_HTTP_503/);
  });
});
