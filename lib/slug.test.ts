import { describe, it, expect } from 'vitest';
import { makeSlug } from './slug';

describe('makeSlug', () => {
  it('lowercases name and appends 4-char suffix', () => {
    const s = makeSlug('Saurabh Singh');
    expect(s).toMatch(/^saurabh-singh-[a-z0-9]{4}$/);
  });

  it('strips special chars', () => {
    expect(makeSlug('Aman & Co.!')).toMatch(/^aman-co-[a-z0-9]{4}$/);
  });

  it('handles devanagari by transliterating-or-stripping', () => {
    // fall back to "user" if name strips empty
    const s = makeSlug('अमन');
    expect(s).toMatch(/^user-[a-z0-9]{4}$/);
  });

  it('caps name length at 24 chars before suffix', () => {
    const s = makeSlug('A'.repeat(50));
    const namePart = s.split('-').slice(0, -1).join('-');
    expect(namePart.length).toBeLessThanOrEqual(24);
  });

  it('produces different suffix on repeated calls', () => {
    const s1 = makeSlug('Saurabh');
    const s2 = makeSlug('Saurabh');
    expect(s1).not.toBe(s2);
  });
});
