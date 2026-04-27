import { describe, it, expect, vi, beforeEach } from 'vitest';
import { geocode } from './geocode';

const mockFrom = vi.fn();
vi.mock('@/lib/db/supabase', () => ({
  serverClient: () => ({ from: mockFrom }),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch as never;

beforeEach(() => {
  mockFrom.mockReset();
  mockFetch.mockReset();
});

function cacheChain(returnRow: unknown) {
  return {
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: returnRow, error: null }) }) }),
    upsert: async () => ({ error: null }),
  };
}

describe('geocode', () => {
  it('returns cached value on hit', async () => {
    mockFrom.mockReturnValueOnce(cacheChain({ lat: 19.07, lon: 72.87, tz_offset: 330 }));
    const r = await geocode('Mumbai');
    expect(r).toEqual({ lat: 19.07, lon: 72.87, tzOffset: 330, cacheHit: true });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('calls Nominatim on cache miss and upserts', async () => {
    mockFrom.mockReturnValue(cacheChain(null));
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ lat: '12.97', lon: '77.59' }],
    });
    const r = await geocode('Bengaluru');
    expect(r.lat).toBeCloseTo(12.97);
    expect(r.lon).toBeCloseTo(77.59);
    expect(r.tzOffset).toBe(330);
    expect(r.cacheHit).toBe(false);
  });

  it('throws GEOCODE_FAILED on no results', async () => {
    mockFrom.mockReturnValue(cacheChain(null));
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [] });
    await expect(geocode('zzzznone')).rejects.toThrow('GEOCODE_FAILED');
  });
});
