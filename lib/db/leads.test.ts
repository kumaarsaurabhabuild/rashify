import { describe, it, expect, vi, beforeEach } from 'vitest';
import { insertReadyLead, getCardBySlug } from './leads';

const mockFrom = vi.fn();
vi.mock('@/lib/db/supabase', () => ({
  serverClient: () => ({ from: mockFrom }),
}));

beforeEach(() => mockFrom.mockReset());

const baseInput = {
  name: 'Saurabh',
  phoneE164: '+919999999999',
  dobDate: '1995-08-15',
  dobTime: '14:30',
  birthPlace: 'Mumbai',
  lat: 19.07, lon: 72.87, tzOffset: 330,
  chartJson: { x: 1 },
  archetype: { y: 2 },
  ipHash: 'h', referrerSlug: null, utm: null,
};

describe('insertReadyLead', () => {
  it('returns existing slug when phone already present', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          is: () => ({ maybeSingle: async () => ({ data: { slug: 'oldslug' }, error: null }) }),
        }),
      }),
    });
    const r = await insertReadyLead(baseInput);
    expect(r.slug).toBe('oldslug');
    expect(r.isNew).toBe(false);
  });

  it('inserts new ready row when phone not seen', async () => {
    mockFrom
      .mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            is: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
          }),
        }),
      })
      .mockReturnValueOnce({
        insert: (payload: Record<string, unknown>) => {
          expect(payload.status).toBe('ready');
          expect(payload.archetype).toEqual({ y: 2 });
          return {
            select: () => ({
              single: async () => ({ data: { slug: 'saurabh-abc1' }, error: null }),
            }),
          };
        },
      });
    const r = await insertReadyLead(baseInput);
    expect(r.slug).toMatch(/^saurabh-/);
    expect(r.isNew).toBe(true);
  });
});

describe('getCardBySlug', () => {
  it('returns row from public_card view', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { slug: 'x', name: 'S', archetype: {}, status: 'ready', error: null, created_at: 'now', referrer_slug: null },
            error: null,
          }),
        }),
      }),
    });
    const r = await getCardBySlug('x');
    expect(r?.slug).toBe('x');
    expect(r?.status).toBe('ready');
  });
});
