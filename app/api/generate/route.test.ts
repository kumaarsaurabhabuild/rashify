import { describe, it, expect, vi, beforeEach } from 'vitest';

const { insertReadyLead, sendArchetype } = vi.hoisted(() => ({
  insertReadyLead: vi.fn(),
  sendArchetype: vi.fn(),
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
vi.mock('@/lib/db/leads', () => ({ insertReadyLead }));
vi.mock('@/lib/wa/aisensy', () => ({ sendArchetype }));
vi.mock('@/lib/telemetry/posthog', () => ({ trackServer: vi.fn(), flushTelemetry: vi.fn() }));
vi.mock('@/lib/util/turnstile', () => ({ verifyTurnstile: vi.fn(async () => true) }));

import { POST } from './route';

beforeEach(() => {
  insertReadyLead.mockReset();
  insertReadyLead.mockImplementation(async () => ({ slug: 'saurabh-abc1', isNew: true }));
  sendArchetype.mockReset();
  sendArchetype.mockResolvedValue({ status: 'queued' });
  process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
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

describe('POST /api/generate (sync)', () => {
  it('200 happy path returns slug + archetype + isNew=true', async () => {
    const r = await POST(req(valid));
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.slug).toBe('saurabh-abc1');
    expect(j.isNew).toBe(true);
    expect(j.archetype).toBeDefined();
    expect(j.archetype.label).toBeDefined();
  });

  it('does not retrigger WA send for existing user', async () => {
    insertReadyLead.mockResolvedValueOnce({ slug: 'returning-1', isNew: false });
    const r = await POST(req(valid));
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.isNew).toBe(false);
    // small async wait for fire-and-forget detection
    await new Promise((r) => setTimeout(r, 5));
    expect(sendArchetype).not.toHaveBeenCalled();
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
});
