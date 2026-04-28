import { describe, it, expect, vi, beforeEach } from 'vitest';

const { insertPendingProfile, triggerFullProfile } = vi.hoisted(() => ({
  insertPendingProfile: vi.fn(),
  triggerFullProfile: vi.fn(),
}));

vi.mock('@/lib/astro/geocode', () => ({
  geocode: vi.fn(async () => ({ lat: 19.07, lon: 72.87, tzOffset: 330, cacheHit: false })),
}));
vi.mock('@/lib/astro/engine', () => ({ triggerFullProfile, fetchChart: vi.fn() }));
vi.mock('@/lib/db/leads', () => ({ insertPendingProfile }));
vi.mock('@/lib/telemetry/posthog', () => ({ trackServer: vi.fn(), flushTelemetry: vi.fn() }));
vi.mock('@/lib/util/turnstile', () => ({ verifyTurnstile: vi.fn(async () => true) }));

import { POST } from './route';

beforeEach(() => {
  insertPendingProfile.mockReset();
  insertPendingProfile.mockImplementation(async () => ({ slug: 'saurabh-x1', isNew: true }));
  triggerFullProfile.mockReset();
  triggerFullProfile.mockResolvedValue(undefined);
});

function req(body: object) {
  return new Request('http://localhost/api/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const valid = {
  name: 'Saurabh', dobDate: '1995-08-15', dobTime: '14:30',
  birthPlace: 'Mumbai', phoneE164: '+919999999999',
  consent: true, turnstileToken: 'tok',
};

describe('POST /api/generate (async)', () => {
  it('200 returns slug + status=pending; fires worker', async () => {
    const r = await POST(req(valid));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ slug: 'saurabh-x1', isNew: true, status: 'pending' });
    await new Promise((r) => setTimeout(r, 0));
    expect(triggerFullProfile).toHaveBeenCalledWith(expect.objectContaining({ slug: 'saurabh-x1' }));
  });

  it('returns existing slug with status=ready, no worker fire', async () => {
    insertPendingProfile.mockResolvedValueOnce({ slug: 'returning-1', isNew: false });
    const r = await POST(req(valid));
    expect(await r.json()).toEqual({ slug: 'returning-1', isNew: false, status: 'ready' });
    expect(triggerFullProfile).not.toHaveBeenCalled();
  });

  it('400 INVALID_PHONE on bad phone', async () => {
    const r = await POST(req({ ...valid, phoneE164: '12345' }));
    expect(r.status).toBe(400);
    expect((await r.json()).error).toBe('INVALID_PHONE');
  });
});
