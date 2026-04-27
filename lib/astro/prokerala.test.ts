import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
global.fetch = mockFetch as never;

// Reset module state between tests so the cached Prokerala token
// from one test doesn't bleed into the next.
let fetchChart: typeof import('./prokerala').fetchChart;

beforeEach(async () => {
  mockFetch.mockReset();
  process.env.PROKERALA_CLIENT_ID = 'cid';
  process.env.PROKERALA_CLIENT_SECRET = 'csec';
  vi.resetModules();
  ({ fetchChart } = await import('./prokerala'));
});

describe('fetchChart', () => {
  it('exchanges client creds for token, then fetches kundli', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'tok', expires_in: 3600 }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            ayanamsa: { name: 'Lahiri' },
            lagna: { sign: 'Vrishabha', longitude: 12.5 },
            planets: [
              { name: 'Sun', sign: 'Mesha', house: 12, longitude: 5.2, nakshatra: { name: 'Ashwini', pada: 1 } },
              { name: 'Moon', sign: 'Vrishchika', house: 7, longitude: 3.1, nakshatra: { name: 'Anuradha', pada: 2 } },
              { name: 'Saturn', sign: 'Vrishchika', house: 7, longitude: 8, nakshatra: { name: 'Anuradha', pada: 2 } },
            ],
            dasha: { mahadasha: 'Saturn', antardasha: 'Venus',
                     start_date: '2024-01-01', end_date: '2027-01-01' },
          },
        }),
      });
    const out = await fetchChart({
      datetime: '1995-08-15T14:30:00+05:30',
      lat: 19.07, lon: 72.87, tzOffset: 330,
    });
    expect(out.lagna.sign).toBe('Vrishabha');
    expect(out.sun.sign).toBe('Mesha');
    expect(out.moon.nakshatra).toBe('Anuradha');
    expect(out.dasha.mahadasha).toBe('Saturn');
    expect(out.tzOffset).toBe(330);
  });

  it('throws PROKERALA_DOWN on chart 5xx', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'tok', expires_in: 3600 }) })
      .mockResolvedValueOnce({ ok: false, status: 502 });
    await expect(fetchChart({ datetime: '1995-08-15T14:30:00+05:30', lat: 0, lon: 0, tzOffset: 0 }))
      .rejects.toThrow('PROKERALA_DOWN');
  });
});
