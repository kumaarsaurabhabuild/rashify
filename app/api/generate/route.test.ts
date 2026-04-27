import { describe, it, expect, vi, beforeEach } from 'vitest';

const archetype = {
  label: 'The Slow Architect', sanskritLabel: 'Prithvi Shilpi',
  coreTraits: ['a','b','c'], strengths: ['x','y','z'], growthEdges: ['p','q'],
  luckyColor: 'olive', luckyNumber: 6, powerWindow: '8 AM - 12 PM', oneLiner: 'o',
  provenance: { ayanamsa: 'Lahiri', system: 'Vedic sidereal', nakshatra: 'Anuradha', lagna: 'Vrishabha', currentDasha: 'Saturn-Venus' },
};

const { generateArchetype, insertOrFetchLead } = vi.hoisted(() => ({
  generateArchetype: vi.fn(),
  insertOrFetchLead: vi.fn(),
}));

vi.mock('@/lib/astro/geocode', () => ({
  geocode: vi.fn(async () => ({ lat: 19.07, lon: 72.87, tzOffset: 330, cacheHit: false })),
}));
vi.mock('@/lib/astro/prokerala', () => ({
  fetchChart: vi.fn(async () => ({
    ayanamsa: 'Lahiri',
    nakshatra: { name: 'Anuradha', pada: 2, lord: 'Saturn' },
    moonSign: 'Vrischika',
    sunSign: 'Mesha',
    ascendant: { name: 'Ascendant', rasi: 'Vrishabha', rasiLord: 'Venus', house: 1, degree: 12, isRetrograde: false },
    planets: [
      { name: 'Sun', rasi: 'Mesha', rasiLord: 'Mars', house: 12, degree: 5, isRetrograde: false },
      { name: 'Moon', rasi: 'Vrischika', rasiLord: 'Mars', house: 7, degree: 3, isRetrograde: false },
    ],
    currentDasha: { mahadasha: 'Saturn', antardasha: 'Venus', start: '2024-01-01', end: '2027-01-01' },
    activeYogas: [],
    mangalDosha: false,
    additionalInfo: { luckyColor: 'Black', bestDirection: 'East', deity: 'X', animalSign: 'Y', birthStone: 'Z' },
    tzOffset: 330,
  })),
}));
vi.mock('@/lib/llm/gemini', () => ({ generateArchetype }));
vi.mock('@/lib/llm/fallback-archetype', () => ({ fallbackArchetype: () => archetype }));
vi.mock('@/lib/db/leads', () => ({ insertOrFetchLead }));
vi.mock('@/lib/wa/aisensy', () => ({ sendArchetype: vi.fn(async () => ({ status: 'queued' })) }));
vi.mock('@/lib/telemetry/posthog', () => ({ trackServer: vi.fn(), flushTelemetry: vi.fn() }));
// turnstile verify always passes in tests
vi.mock('@/lib/util/turnstile', () => ({ verifyTurnstile: vi.fn(async () => true) }));

import { POST } from './route';

beforeEach(() => {
  generateArchetype.mockReset();
  generateArchetype.mockImplementation(async () => archetype);
  insertOrFetchLead.mockReset();
  insertOrFetchLead.mockImplementation(async () => ({ slug: 'saurabh-abc1', isNew: true }));
  process.env.NEXT_PUBLIC_APP_URL = 'https://rashify.in';
});

function req(body: object) {
  return new Request('http://localhost/api/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const valid = {
  name: 'Saurabh Singh',
  dobDate: '1995-08-15',
  dobTime: '14:30',
  birthPlace: 'Mumbai',
  phoneE164: '+919999999999',
  consent: true,
  turnstileToken: 'tok',
};

describe('POST /api/generate', () => {
  it('200 on happy path; returns slug + archetype', async () => {
    const r = await POST(req(valid));
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.slug).toBe('saurabh-abc1');
    expect(j.archetype.label).toBeDefined();
  });

  it('400 INVALID_PHONE on bad phone', async () => {
    const r = await POST(req({ ...valid, phoneE164: '12345' }));
    expect(r.status).toBe(400);
    expect((await r.json()).error).toBe('INVALID_PHONE');
  });

  it('400 CONSENT_MISSING when consent=false', async () => {
    const r = await POST(req({ ...valid, consent: false }));
    expect(r.status).toBe(400);
    expect((await r.json()).error).toBe('CONSENT_MISSING');
  });

  it('falls back to rule-based on LLM_BAD', async () => {
    generateArchetype.mockRejectedValueOnce(new Error('LLM_BAD'));
    const r = await POST(req(valid));
    expect(r.status).toBe(200);
    expect(insertOrFetchLead).toHaveBeenCalled();
  });
});
