import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendArchetype } from './aisensy';

const mockFetch = vi.fn();
global.fetch = mockFetch as never;

beforeEach(() => {
  mockFetch.mockReset();
  process.env.AISENSY_API_KEY = 'k';
  process.env.AISENSY_CAMPAIGN_NAME = 'rashify_archetype_v1';
});

const args = {
  phoneE164: '+919999999999',
  firstName: 'Saurabh',
  slug: 'saurabh-x7k2',
  archetype: {
    label: 'The Saturn-Mercury Strategist',
    sanskritLabel: 'Karma-Yoga Tantri',
    coreTraits: ['t1', 't2', 't3'],
    strengths: ['s1', 's2', 's3'],
    growthEdges: ['e1', 'e2'],
    luckyColor: 'indigo', luckyNumber: 7,
    powerWindow: '10 PM', oneLiner: 'x',
    provenance: { ayanamsa: 'Lahiri', system: 'V', nakshatra: 'A', lagna: 'V', currentDasha: 'Sa-Ve' },
  } as const,
  ogUrl: 'https://rashify.in/api/og?slug=saurabh-x7k2',
};

describe('sendArchetype', () => {
  it('posts to aisensy with built payload', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ status: 'success' }) });
    const r = await sendArchetype(args);
    expect(r.status).toBe('queued');
    expect(mockFetch).toHaveBeenCalledOnce();
    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(body.destination).toBe('919999999999');
    expect(body.templateParams[0]).toBe('saurabh-x7k2');
  });

  it('returns failed on aisensy 4xx', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 400, text: async () => 'bad' });
    const r = await sendArchetype(args);
    expect(r.status).toBe('failed');
    expect(r.error).toContain('400');
  });
});
