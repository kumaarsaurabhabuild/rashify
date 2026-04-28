import { describe, it, expect, vi, beforeEach } from 'vitest';
import { insertPendingProfile, getCardBySlug, getUnlockedCardBySlug, markUnlocked } from './leads';

const mockFrom = vi.fn();
vi.mock('@/lib/db/supabase', () => ({
  serverClient: () => ({ from: mockFrom }),
}));

beforeEach(() => mockFrom.mockReset());

const baseInput = {
  name: 'Saurabh', phoneE164: '+919999999999',
  dobDate: '1995-08-15', dobTime: '14:30', birthPlace: 'Mumbai',
  lat: 19.07, lon: 72.87, tzOffset: 330,
  ipHash: 'h', referrerSlug: null, utm: null,
};

function existingChain(returnSlug: string | null) {
  const tail = { maybeSingle: async () => ({ data: returnSlug ? { slug: returnSlug } : null, error: null }) };
  return {
    select: () => ({ eq: () => ({ eq: () => ({ not: () => ({ is: () => ({ order: () => ({ limit: () => tail }) }) }) }) }) }),
  };
}

describe('insertPendingProfile', () => {
  it('returns existing slug if ready row present', async () => {
    mockFrom.mockReturnValueOnce(existingChain('oldslug'));
    const r = await insertPendingProfile(baseInput);
    expect(r).toEqual({ slug: 'oldslug', isNew: false });
  });

  it('inserts new pending row when no existing', async () => {
    mockFrom
      .mockReturnValueOnce(existingChain(null))
      .mockReturnValueOnce({
        insert: (payload: Record<string, unknown>) => {
          expect(payload.status).toBe('pending');
          expect(payload.archetype).toBeNull();
          expect(payload.domain_teasers).toBeNull();
          return { select: () => ({ single: async () => ({ data: { slug: 'saurabh-x1' }, error: null }) }) };
        },
      });
    const r = await insertPendingProfile(baseInput);
    expect(r).toEqual({ slug: 'saurabh-x1', isNew: true });
  });
});

describe('getCardBySlug', () => {
  it('reads public_card view with teasers', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { slug: 'x', name: 'S', archetype: {}, domain_teasers: {career:'a',health:'b',love:'c',wealth:'d',spiritual:'e'}, status: 'ready', error: null, created_at: 'now', referrer_slug: null },
            error: null,
          }),
        }),
      }),
    });
    const r = await getCardBySlug('x');
    expect(r?.status).toBe('ready');
  });
});

describe('getUnlockedCardBySlug', () => {
  it('returns null when not yet unlocked', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
    });
    const r = await getUnlockedCardBySlug('x');
    expect(r).toBeNull();
  });
});

describe('markUnlocked', () => {
  it('updates unlocked_at via UPDATE..WHERE unlocked_at IS NULL (idempotent)', async () => {
    mockFrom.mockReturnValueOnce({
      update: (patch: Record<string, unknown>) => {
        expect(patch).toHaveProperty('unlocked_at');
        expect(patch.unlocked_via).toBe('wa');
        return { eq: () => ({ is: async () => ({ error: null }) }) };
      },
    });
    const r = await markUnlocked('x', 'wa');
    expect(r.ok).toBe(true);
  });
});
