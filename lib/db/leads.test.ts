import { describe, it, expect, vi, beforeEach } from 'vitest';
import { insertOrFetchLead, getCardBySlug } from './leads';

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
  chartJson: { any: 'thing' },
  archetype: { any: 'thing' },
  ipHash: 'h', referrerSlug: null, utm: null,
};

describe('insertOrFetchLead', () => {
  it('returns existing slug when phone already present', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({ eq: () => ({ is: () => ({ maybeSingle: async () => ({ data: { slug: 'oldslug-x7k2' }, error: null }) }) }) }),
    });
    const r = await insertOrFetchLead(baseInput);
    expect(r.slug).toBe('oldslug-x7k2');
    expect(r.isNew).toBe(false);
  });

  it('inserts new row when phone not seen', async () => {
    mockFrom
      .mockReturnValueOnce({
        select: () => ({ eq: () => ({ is: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
      })
      .mockReturnValueOnce({
        insert: () => ({ select: () => ({ single: async () => ({ data: { slug: 'saurabh-abc1' }, error: null }) }) }),
      });
    const r = await insertOrFetchLead(baseInput);
    expect(r.slug).toMatch(/^saurabh-/);
    expect(r.isNew).toBe(true);
  });
});

describe('getCardBySlug', () => {
  it('returns row from public_card view', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { slug: 'x', name: 'S', archetype: {}, created_at: 'now' }, error: null }) }) }),
    });
    const r = await getCardBySlug('x');
    expect(r?.slug).toBe('x');
  });
});
