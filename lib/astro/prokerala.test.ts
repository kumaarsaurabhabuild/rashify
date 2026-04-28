import { describe, it, expect, vi, beforeEach } from 'vitest';
import kundliFixture from './__fixtures__/kundli-advanced.json';
import planetsFixture from './__fixtures__/planet-position.json';
import { fetchChart, _resetTokenCacheForTests } from './prokerala';

const mockFetch = vi.fn();
global.fetch = mockFetch as never;

beforeEach(() => {
  _resetTokenCacheForTests();
  mockFetch.mockReset();
  process.env.PROKERALA_CLIENT_ID = 'cid';
  process.env.PROKERALA_CLIENT_SECRET = 'csec';
});

function tokenRes() {
  return { ok: true, json: async () => ({ access_token: 'tok', expires_in: 3600 }) };
}

describe('fetchChart', () => {
  it('exchanges creds for token, calls both endpoints, maps to Chart', async () => {
    mockFetch
      .mockResolvedValueOnce(tokenRes())
      .mockResolvedValueOnce({ ok: true, json: async () => kundliFixture })
      .mockResolvedValueOnce({ ok: true, json: async () => planetsFixture });

    const out = await fetchChart(
      { datetime: '1995-01-01T14:30:00+05:30', lat: 19.07, lon: 72.87, tzOffset: 330 },
      new Date('2026-04-27T00:00:00Z'),
    );

    // From kundli fixture
    expect(out.nakshatra.name).toBe('Purva Ashadha');
    expect(out.nakshatra.pada).toBe(1);
    expect(out.nakshatra.lord).toBe('Venus');
    expect(out.moonSign).toBe('Dhanu');
    expect(out.sunSign).toBe('Dhanu');
    expect(out.mangalDosha).toBe(false);
    expect(out.additionalInfo.luckyColor).toBe('Black');
    expect(out.activeYogas).toContain('Kedara Yoga');

    // From planets fixture
    expect(out.ascendant.rasi).toBe('Mesha');
    expect(out.ascendant.house).toBe(1);
    expect(out.planets).toHaveLength(10);
    const moon = out.planets.find((p) => p.name === 'Moon');
    expect(moon?.rasi).toBe('Dhanu');

    expect(out.tzOffset).toBe(330);
  });

  it('throws PROKERALA_5XX_502 on chart 502', async () => {
    mockFetch
      .mockResolvedValueOnce(tokenRes())
      .mockResolvedValueOnce({ ok: false, status: 502 })
      .mockResolvedValueOnce({ ok: true, json: async () => planetsFixture });
    await expect(
      fetchChart({ datetime: '1995-01-01T14:30:00+05:30', lat: 0, lon: 0, tzOffset: 0 }),
    ).rejects.toThrow('PROKERALA_5XX_502');
  });

  it('throws PROKERALA_RATE_LIMIT on 429', async () => {
    mockFetch
      .mockResolvedValueOnce(tokenRes())
      .mockResolvedValueOnce({ ok: false, status: 429 })
      .mockResolvedValueOnce({ ok: true, json: async () => planetsFixture });
    await expect(
      fetchChart({ datetime: '1995-01-01T14:30:00+05:30', lat: 0, lon: 0, tzOffset: 0 }),
    ).rejects.toThrow('PROKERALA_RATE_LIMIT');
  });

  it('throws PROKERALA_AUTH_FAILED on token 4xx', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
    await expect(
      fetchChart({ datetime: '1995-01-01T14:30:00+05:30', lat: 0, lon: 0, tzOffset: 0 }),
    ).rejects.toThrow('PROKERALA_AUTH_FAILED');
  });
});
