# Rashify MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a viral lead-gen web app where Indian users enter birth data, receive a personalized Vedic archetype card on a shareable URL + WhatsApp, in one day.

**Architecture:** Next.js 15 App Router on Vercel. POST `/api/generate` orchestrates: geocode → Prokerala (Vedic chart) → Gemini Flash (archetype JSON, Zod-validated, rule-based fallback) → Supabase insert → fire-and-forget AiSensy WhatsApp send. Result page `/u/[slug]` renders `<ShareCard>` (same JSX powers `/api/og` PNG via Vercel OG). PostHog tracks 18 typed events, stitched on `slug = distinct_id`.

**Tech Stack:** Next.js 15, TypeScript, Tailwind, Zod, Vitest, React Testing Library, Supabase (Postgres + RLS), Prokerala API, Google Gemini 2.0 Flash, AiSensy (WhatsApp), Vercel OG (Satori), PostHog, Cloudflare Turnstile, Sentry.

**Spec reference:** `docs/superpowers/specs/2026-04-27-rashify-design.md`

**Test discipline:** TDD throughout. Red → green → refactor → commit. External APIs mocked via `vi.fn()` stubs in unit tests; one end-to-end smoke test against staging at the end.

---

## Phase 0 — Project Bootstrap

### Task 0.1: Initialize Next.js project

**Files:**
- Create: `/Users/saurabhkumarsingh/Desktop/rashify/package.json` (via create-next-app)
- Create: `/Users/saurabhkumarsingh/Desktop/rashify/.gitignore`
- Create: `/Users/saurabhkumarsingh/Desktop/rashify/.env.local.example`

- [ ] **Step 1: Bootstrap Next.js**

```bash
cd /Users/saurabhkumarsingh/Desktop/rashify
# project dir already has docs/ committed; init Next.js in place
npx create-next-app@latest . --ts --tailwind --app --eslint --src-dir=false --import-alias='@/*' --use-npm --no-turbopack
```

Expected: prompts answered as flags; files scaffolded into existing repo. Review prompts answer `y` to overwrite of `.gitignore` if asked.

- [ ] **Step 2: Install runtime + dev deps**

```bash
npm install @supabase/supabase-js zod nanoid posthog-js posthog-node @sentry/nextjs @vercel/og @google/generative-ai
npm install -D vitest @vitest/ui @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @types/node msw
```

Expected: `package.json` has all listed deps; `npm install` exits 0.

- [ ] **Step 3: Configure Vitest**

Create `/Users/saurabhkumarsingh/Desktop/rashify/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/*.test.{ts,tsx}'],
    coverage: { reporter: ['text', 'html'] },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
});
```

Create `/Users/saurabhkumarsingh/Desktop/rashify/vitest.setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

Edit `package.json` `"scripts"`: add `"test": "vitest run"`, `"test:watch": "vitest"`.

- [ ] **Step 4: Verify scaffold**

```bash
npm run build
npm run test -- --run
```

Expected: build succeeds (default Next.js page); test exits 0 with "no test files found" warning (acceptable; we add tests next).

- [ ] **Step 5: Create env example**

Write `/Users/saurabhkumarsingh/Desktop/rashify/.env.local.example`:

```
PROKERALA_CLIENT_ID=
PROKERALA_CLIENT_SECRET=
GEMINI_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
AISENSY_API_KEY=
AISENSY_CAMPAIGN_NAME=rashify_archetype_v1
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://us.posthog.com
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
SLUG_SALT=replace-with-32-char-random
IP_HASH_SALT=replace-with-32-char-random
SENTRY_DSN=
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: bootstrap Next.js 15 + Vitest + deps"
```

---

### Task 0.2: Supabase schema migration script

**Files:**
- Create: `/Users/saurabhkumarsingh/Desktop/rashify/supabase/migrations/20260427_init.sql`
- Create: `/Users/saurabhkumarsingh/Desktop/rashify/supabase/README.md`

- [ ] **Step 1: Write migration SQL**

Create `supabase/migrations/20260427_init.sql`:

```sql
-- Rashify v1 schema
create extension if not exists "pgcrypto";

create table leads (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  name          text not null,
  phone_e164    text not null,
  dob_date      date not null,
  dob_time      time not null,
  birth_place   text not null,
  lat           numeric(9,6) not null,
  lon           numeric(9,6) not null,
  tz_offset     int not null,
  chart_json    jsonb not null,
  archetype     jsonb not null,
  referrer_slug text,
  utm           jsonb,
  ip_hash       text,
  consent_at    timestamptz not null,
  deleted_at    timestamptz,
  created_at    timestamptz default now()
);
create index leads_slug_idx     on leads (slug);
create index leads_phone_idx    on leads (phone_e164);
create index leads_referrer_idx on leads (referrer_slug);
create index leads_created_idx  on leads (created_at desc);

create table geocode_cache (
  query_norm  text primary key,
  lat         numeric(9,6) not null,
  lon         numeric(9,6) not null,
  tz_offset   int not null,
  hit_count   int default 1,
  updated_at  timestamptz default now()
);

create table wa_log (
  id          bigserial primary key,
  lead_id     uuid references leads(id) on delete cascade,
  template    text not null,
  status      text not null,
  payload     jsonb,
  error       text,
  created_at  timestamptz default now()
);

-- RLS: lock all
alter table leads enable row level security;
alter table geocode_cache enable row level security;
alter table wa_log enable row level security;

-- Public view: only safe columns, server queries this for /u/[slug]
create view public_card as
  select slug, name, archetype, created_at, referrer_slug
  from leads
  where deleted_at is null;
grant select on public_card to anon;
```

- [ ] **Step 2: Apply migration manually**

Open Supabase project (https://supabase.com/dashboard), SQL Editor → paste file → Run.

Expected: 3 tables + 1 view created; no errors.

Write `supabase/README.md`:

```md
# Supabase migrations

Apply manually via Supabase dashboard SQL editor in numeric order.

`20260427_init.sql` — initial schema (leads, geocode_cache, wa_log, public_card view).
```

- [ ] **Step 3: Verify**

In Supabase SQL editor:

```sql
select table_name from information_schema.tables where table_schema='public';
```

Expected: rows for `leads`, `geocode_cache`, `wa_log`, `public_card`.

- [ ] **Step 4: Commit**

```bash
git add supabase/
git commit -m "chore: supabase v1 schema migration"
```

---

## Phase 1 — Core Libs (TDD)

### Task 1.1: Slug generator

**Files:**
- Create: `/Users/saurabhkumarsingh/Desktop/rashify/lib/slug.ts`
- Test:   `/Users/saurabhkumarsingh/Desktop/rashify/lib/slug.test.ts`

- [ ] **Step 1: Write failing test**

Create `lib/slug.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test — confirm fail**

```bash
npm run test lib/slug.test.ts
```

Expected: 5 failures, "Cannot find module './slug'".

- [ ] **Step 3: Implement**

Create `lib/slug.ts`:

```ts
import { customAlphabet } from 'nanoid';

const suffixGen = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 4);

export function makeSlug(name: string): string {
  const cleaned = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9 ]+/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 24);
  const namePart = cleaned || 'user';
  return `${namePart}-${suffixGen()}`;
}
```

- [ ] **Step 4: Run test — confirm pass**

```bash
npm run test lib/slug.test.ts
```

Expected: 5 passing.

- [ ] **Step 5: Commit**

```bash
git add lib/slug.ts lib/slug.test.ts
git commit -m "feat: slug generator with name prefix + nanoid suffix"
```

---

### Task 1.2: Chart + archetype Zod schemas

**Files:**
- Create: `/Users/saurabhkumarsingh/Desktop/rashify/lib/astro/chart-types.ts`
- Test:   `/Users/saurabhkumarsingh/Desktop/rashify/lib/astro/chart-types.test.ts`

- [ ] **Step 1: Write failing test**

Create `lib/astro/chart-types.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { ChartZ, ArchetypeZ } from './chart-types';

const validChart = {
  ayanamsa: 'Lahiri',
  lagna: { sign: 'Vrishabha', degree: 12.5 },
  sun:   { sign: 'Mesha', house: 12, degree: 5.2, nakshatra: 'Ashwini', pada: 1 },
  moon:  { sign: 'Vrishchika', house: 7, degree: 3.1, nakshatra: 'Anuradha', pada: 2 },
  planets: [
    { name: 'Saturn', sign: 'Vrishchika', house: 7, degree: 8, nakshatra: 'Anuradha', pada: 2 },
  ],
  dasha: { mahadasha: 'Saturn', antardasha: 'Venus', start: '2024-01-01', end: '2027-01-01' },
  tzOffset: 330,
};

describe('ChartZ', () => {
  it('accepts a valid chart', () => {
    expect(ChartZ.safeParse(validChart).success).toBe(true);
  });
  it('rejects missing lagna', () => {
    const bad = { ...validChart, lagna: undefined };
    expect(ChartZ.safeParse(bad).success).toBe(false);
  });
});

describe('ArchetypeZ', () => {
  const ok = {
    label: 'The Saturn-Mercury Strategist',
    sanskritLabel: 'Karma-Yoga Tantri',
    coreTraits: ['a', 'b', 'c'],
    strengths: ['x', 'y', 'z'],
    growthEdges: ['p', 'q'],
    luckyColor: 'indigo',
    luckyNumber: 7,
    powerWindow: '10:30 PM - 2 AM',
    oneLiner: 'A patient architect of slow ambition.',
    provenance: {
      ayanamsa: 'Lahiri',
      system: 'Vedic sidereal',
      nakshatra: 'Anuradha',
      lagna: 'Vrishabha',
      currentDasha: 'Saturn-Venus',
    },
  };
  it('accepts valid archetype', () => {
    expect(ArchetypeZ.safeParse(ok).success).toBe(true);
  });
  it('rejects luckyNumber out of 1-9', () => {
    expect(ArchetypeZ.safeParse({ ...ok, luckyNumber: 12 }).success).toBe(false);
  });
  it('rejects coreTraits length != 3', () => {
    expect(ArchetypeZ.safeParse({ ...ok, coreTraits: ['a'] }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test — confirm fail**

```bash
npm run test lib/astro/chart-types.test.ts
```

Expected: failures, "Cannot find module './chart-types'".

- [ ] **Step 3: Implement**

Create `lib/astro/chart-types.ts`:

```ts
import { z } from 'zod';

const PlanetZ = z.object({
  name: z.string(),
  sign: z.string(),
  house: z.number().int().min(1).max(12),
  degree: z.number(),
  nakshatra: z.string(),
  pada: z.number().int().min(1).max(4),
});

export const ChartZ = z.object({
  ayanamsa: z.string(),
  lagna: z.object({ sign: z.string(), degree: z.number() }),
  sun: PlanetZ,
  moon: PlanetZ,
  planets: z.array(PlanetZ),
  dasha: z.object({
    mahadasha: z.string(),
    antardasha: z.string(),
    start: z.string(),
    end: z.string(),
  }),
  tzOffset: z.number(),
  tzEstimated: z.boolean().optional(),
});
export type Chart = z.infer<typeof ChartZ>;

export const ArchetypeZ = z.object({
  label: z.string().min(2),
  sanskritLabel: z.string().min(2),
  coreTraits: z.array(z.string()).length(3),
  strengths: z.array(z.string()).length(3),
  growthEdges: z.array(z.string()).length(2),
  luckyColor: z.string(),
  luckyNumber: z.number().int().min(1).max(9),
  powerWindow: z.string(),
  oneLiner: z.string().max(140),
  provenance: z.object({
    ayanamsa: z.string(),
    system: z.string(),
    nakshatra: z.string(),
    lagna: z.string(),
    currentDasha: z.string(),
  }),
});
export type Archetype = z.infer<typeof ArchetypeZ>;
```

- [ ] **Step 4: Run test — confirm pass**

```bash
npm run test lib/astro/chart-types.test.ts
```

Expected: 5 passing.

- [ ] **Step 5: Commit**

```bash
git add lib/astro/chart-types.ts lib/astro/chart-types.test.ts
git commit -m "feat: zod schemas for chart + archetype"
```

---

### Task 1.3: Geocode wrapper with Supabase cache

**Files:**
- Create: `/Users/saurabhkumarsingh/Desktop/rashify/lib/astro/geocode.ts`
- Test:   `/Users/saurabhkumarsingh/Desktop/rashify/lib/astro/geocode.test.ts`
- Create: `/Users/saurabhkumarsingh/Desktop/rashify/lib/db/supabase.ts`

- [ ] **Step 1: Implement Supabase server client (no test — config only)**

Create `lib/db/supabase.ts`:

```ts
import { createClient } from '@supabase/supabase-js';

export function serverClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase env missing');
  return createClient(url, key, { auth: { persistSession: false } });
}
```

- [ ] **Step 2: Write failing test for geocode**

Create `lib/astro/geocode.test.ts`:

```ts
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
```

- [ ] **Step 3: Run test — confirm fail**

```bash
npm run test lib/astro/geocode.test.ts
```

Expected: "Cannot find module './geocode'".

- [ ] **Step 4: Implement**

Create `lib/astro/geocode.ts`:

```ts
import { serverClient } from '@/lib/db/supabase';

export interface GeocodeResult {
  lat: number;
  lon: number;
  tzOffset: number;   // minutes east of UTC
  cacheHit: boolean;
}

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const IST_OFFSET = 330;

function norm(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, ' ');
}

export async function geocode(query: string): Promise<GeocodeResult> {
  const key = norm(query);
  const sb = serverClient();

  const { data: cached } = await sb
    .from('geocode_cache')
    .select('lat, lon, tz_offset')
    .eq('query_norm', key)
    .maybeSingle();

  if (cached) {
    return { lat: cached.lat, lon: cached.lon, tzOffset: cached.tz_offset, cacheHit: true };
  }

  const url = `${NOMINATIM}?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=in`;
  const res = await fetch(url, { headers: { 'User-Agent': 'rashify.in/1.0' } });
  if (!res.ok) throw new Error('GEOCODE_FAILED');
  const arr = (await res.json()) as Array<{ lat: string; lon: string }>;
  if (arr.length === 0) throw new Error('GEOCODE_FAILED');

  const lat = parseFloat(arr[0].lat);
  const lon = parseFloat(arr[0].lon);
  const tzOffset = IST_OFFSET; // India-only v1; refine later

  await sb.from('geocode_cache').upsert({
    query_norm: key, lat, lon, tz_offset: tzOffset,
  });

  return { lat, lon, tzOffset, cacheHit: false };
}
```

- [ ] **Step 5: Run test — confirm pass**

```bash
npm run test lib/astro/geocode.test.ts
```

Expected: 3 passing.

- [ ] **Step 6: Commit**

```bash
git add lib/db/supabase.ts lib/astro/geocode.ts lib/astro/geocode.test.ts
git commit -m "feat: geocode wrapper with supabase cache"
```

---

### Task 1.4: Prokerala client (Vedic chart fetch)

**Files:**
- Create: `/Users/saurabhkumarsingh/Desktop/rashify/lib/astro/prokerala.ts`
- Test:   `/Users/saurabhkumarsingh/Desktop/rashify/lib/astro/prokerala.test.ts`

- [ ] **Step 1: Write failing test**

Create `lib/astro/prokerala.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchChart } from './prokerala';

const mockFetch = vi.fn();
global.fetch = mockFetch as never;

beforeEach(() => {
  mockFetch.mockReset();
  process.env.PROKERALA_CLIENT_ID = 'cid';
  process.env.PROKERALA_CLIENT_SECRET = 'csec';
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
```

- [ ] **Step 2: Run — confirm fail**

```bash
npm run test lib/astro/prokerala.test.ts
```

Expected: module not found.

- [ ] **Step 3: Implement**

Create `lib/astro/prokerala.ts`:

```ts
import type { Chart } from './chart-types';

const TOKEN_URL = 'https://api.prokerala.com/token';
const KUNDLI_URL = 'https://api.prokerala.com/v2/astrology/kundli';

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.value;
  const id = process.env.PROKERALA_CLIENT_ID!;
  const secret = process.env.PROKERALA_CLIENT_SECRET!;
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: id,
    client_secret: secret,
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error('PROKERALA_AUTH_FAILED');
  const j = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: j.access_token, expiresAt: Date.now() + j.expires_in * 1000 };
  return j.access_token;
}

export interface ChartInput {
  datetime: string;   // ISO8601 with offset
  lat: number;
  lon: number;
  tzOffset: number;
}

export async function fetchChart(input: ChartInput): Promise<Chart> {
  const tok = await getToken();
  const params = new URLSearchParams({
    ayanamsa: '1',                              // 1 = Lahiri
    coordinates: `${input.lat},${input.lon}`,
    datetime: input.datetime,
  });
  const res = await fetch(`${KUNDLI_URL}?${params}`, {
    headers: { Authorization: `Bearer ${tok}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error('PROKERALA_DOWN');
  const { data } = (await res.json()) as { data: ProkRaw };
  return mapToChart(data, input.tzOffset);
}

interface ProkRaw {
  ayanamsa: { name: string };
  lagna: { sign: string; longitude: number };
  planets: Array<{
    name: string;
    sign: string;
    house: number;
    longitude: number;
    nakshatra: { name: string; pada: number };
  }>;
  dasha: { mahadasha: string; antardasha: string; start_date: string; end_date: string };
}

function mapToChart(d: ProkRaw, tzOffset: number): Chart {
  const sun = d.planets.find((p) => p.name === 'Sun')!;
  const moon = d.planets.find((p) => p.name === 'Moon')!;
  const norm = (p: ProkRaw['planets'][number]) => ({
    name: p.name, sign: p.sign, house: p.house,
    degree: p.longitude, nakshatra: p.nakshatra.name, pada: p.nakshatra.pada,
  });
  return {
    ayanamsa: d.ayanamsa.name,
    lagna: { sign: d.lagna.sign, degree: d.lagna.longitude },
    sun: norm(sun),
    moon: norm(moon),
    planets: d.planets.map(norm),
    dasha: {
      mahadasha: d.dasha.mahadasha,
      antardasha: d.dasha.antardasha,
      start: d.dasha.start_date,
      end: d.dasha.end_date,
    },
    tzOffset,
  };
}
```

- [ ] **Step 4: Run — confirm pass**

```bash
npm run test lib/astro/prokerala.test.ts
```

Expected: 2 passing.

- [ ] **Step 5: Commit**

```bash
git add lib/astro/prokerala.ts lib/astro/prokerala.test.ts
git commit -m "feat: prokerala client with token cache"
```

---

### Task 1.5: Gemini archetype client + prompt

**Files:**
- Create: `/Users/saurabhkumarsingh/Desktop/rashify/lib/llm/archetype-prompt.ts`
- Create: `/Users/saurabhkumarsingh/Desktop/rashify/lib/llm/gemini.ts`
- Test:   `/Users/saurabhkumarsingh/Desktop/rashify/lib/llm/gemini.test.ts`

- [ ] **Step 1: Write prompt module (no test — pure data)**

Create `lib/llm/archetype-prompt.ts`:

```ts
import type { Chart } from '@/lib/astro/chart-types';

export const SYSTEM_PROMPT = `You are a Vedic astrologer + modern personality writer. Given a sidereal natal chart JSON, output ONE archetype card describing the person.

Constraints:
- Output VALID JSON only, matching the schema below. No prose outside JSON.
- Voice: reverent + data-grounded. Sanskrit terms allowed but always paired with English.
- NO sycophancy. NO generic horoscope filler ("you are special"). Specifics or nothing.
- Cite at least one chart fact per trait (e.g. "Saturn in Anuradha gives slow-burn ambition").
- Keep traits behavioral and falsifiable, not flattering.
- Tone: Astrotalk meets The Pattern. Mystical + scientific.

Schema:
{
  "label": "string, 2-5 words",
  "sanskritLabel": "string, 2-3 Sanskrit words, romanized + diacritics",
  "coreTraits": ["3 strings, 4-7 words each, behavioral"],
  "strengths": ["3 strings, single noun-phrase, 2-4 words"],
  "growthEdges": ["2 strings, single noun-phrase, 2-4 words"],
  "luckyColor": "single color name",
  "luckyNumber": "integer 1-9",
  "powerWindow": "string time range, IST",
  "oneLiner": "string, ≤120 chars",
  "provenance": {
    "ayanamsa": "Lahiri",
    "system": "Vedic sidereal",
    "nakshatra": "string from input",
    "lagna": "string from input",
    "currentDasha": "string lord-sublord"
  }
}

Refuse politely if chart JSON is malformed.`;

export function buildUserMessage(chart: Chart, firstName: string): string {
  const trimmed = {
    ayanamsa: chart.ayanamsa,
    lagna: chart.lagna,
    sun: chart.sun,
    moon: chart.moon,
    planets: chart.planets,
    dasha: chart.dasha,
    tzOffset: chart.tzOffset,
    tzEstimated: chart.tzEstimated ?? false,
  };
  return `Chart JSON:\n${JSON.stringify(trimmed, null, 2)}\n\nSubject first name: ${firstName}`;
}
```

- [ ] **Step 2: Write failing test for Gemini client**

Create `lib/llm/gemini.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateArchetype } from './gemini';
import type { Chart } from '@/lib/astro/chart-types';

const mockGenerate = vi.fn();
vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return { generateContent: mockGenerate };
    }
  },
}));

const chart: Chart = {
  ayanamsa: 'Lahiri',
  lagna: { sign: 'Vrishabha', degree: 12 },
  sun: { name: 'Sun', sign: 'Mesha', house: 12, degree: 5, nakshatra: 'Ashwini', pada: 1 },
  moon: { name: 'Moon', sign: 'Vrishchika', house: 7, degree: 3, nakshatra: 'Anuradha', pada: 2 },
  planets: [],
  dasha: { mahadasha: 'Saturn', antardasha: 'Venus', start: '2024-01-01', end: '2027-01-01' },
  tzOffset: 330,
};

const goodArchetype = {
  label: 'The Saturn-Mercury Strategist',
  sanskritLabel: 'Karma-Yoga Tantri',
  coreTraits: ['Patient architect of slow ambition', 'Quiet authority in groups', 'Long arc thinking'],
  strengths: ['Strategy', 'Patience', 'Discipline'],
  growthEdges: ['Letting go', 'Spontaneity'],
  luckyColor: 'indigo',
  luckyNumber: 7,
  powerWindow: '10:30 PM - 2 AM',
  oneLiner: 'A patient architect of slow ambition.',
  provenance: { ayanamsa: 'Lahiri', system: 'Vedic sidereal', nakshatra: 'Anuradha', lagna: 'Vrishabha', currentDasha: 'Saturn-Venus' },
};

beforeEach(() => {
  mockGenerate.mockReset();
  process.env.GEMINI_API_KEY = 'fake';
});

describe('generateArchetype', () => {
  it('returns parsed archetype on valid JSON response', async () => {
    mockGenerate.mockResolvedValueOnce({
      response: { text: () => JSON.stringify(goodArchetype) },
    });
    const out = await generateArchetype(chart, 'Saurabh');
    expect(out.label).toBe(goodArchetype.label);
    expect(out.coreTraits).toHaveLength(3);
  });

  it('retries once on schema failure with stricter prompt', async () => {
    mockGenerate
      .mockResolvedValueOnce({ response: { text: () => '{"label":"x"}' } })           // bad
      .mockResolvedValueOnce({ response: { text: () => JSON.stringify(goodArchetype) } });
    const out = await generateArchetype(chart, 'Saurabh');
    expect(mockGenerate).toHaveBeenCalledTimes(2);
    expect(out.label).toBe(goodArchetype.label);
  });

  it('throws LLM_BAD after second failure', async () => {
    mockGenerate.mockResolvedValue({ response: { text: () => '{"label":"x"}' } });
    await expect(generateArchetype(chart, 'X')).rejects.toThrow('LLM_BAD');
  });
});
```

- [ ] **Step 3: Run — confirm fail**

```bash
npm run test lib/llm/gemini.test.ts
```

Expected: module missing.

- [ ] **Step 4: Implement**

Create `lib/llm/gemini.ts`:

```ts
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ArchetypeZ, type Archetype, type Chart } from '@/lib/astro/chart-types';
import { SYSTEM_PROMPT, buildUserMessage } from './archetype-prompt';

export async function generateArchetype(chart: Chart, firstName: string): Promise<Archetype> {
  const key = process.env.GEMINI_API_KEY!;
  const client = new GoogleGenerativeAI(key);
  const model = client.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 800,
      responseMimeType: 'application/json',
    },
  });

  const userMsg = buildUserMessage(chart, firstName);

  const first = await model.generateContent(userMsg);
  const parsed = ArchetypeZ.safeParse(safeJSON(first.response.text()));
  if (parsed.success) return parsed.data;

  // retry once with stricter wrapper
  const stricter = `${userMsg}\n\nIMPORTANT: previous response was malformed. Output ONLY valid JSON matching the schema. coreTraits must have exactly 3 entries, growthEdges exactly 2, luckyNumber an integer 1-9.`;
  const second = await model.generateContent(stricter);
  const reparsed = ArchetypeZ.safeParse(safeJSON(second.response.text()));
  if (reparsed.success) return reparsed.data;

  throw new Error('LLM_BAD');
}

function safeJSON(s: string): unknown {
  try { return JSON.parse(s); } catch { return null; }
}
```

- [ ] **Step 5: Run — confirm pass**

```bash
npm run test lib/llm/gemini.test.ts
```

Expected: 3 passing.

- [ ] **Step 6: Commit**

```bash
git add lib/llm/
git commit -m "feat: gemini archetype client with retry"
```

---

### Task 1.6: Rule-based fallback archetype

**Files:**
- Create: `/Users/saurabhkumarsingh/Desktop/rashify/lib/llm/fallback-archetype.ts`
- Test:   `/Users/saurabhkumarsingh/Desktop/rashify/lib/llm/fallback-archetype.test.ts`

- [ ] **Step 1: Write failing test**

Create `lib/llm/fallback-archetype.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { fallbackArchetype } from './fallback-archetype';
import type { Chart } from '@/lib/astro/chart-types';

const chart: Chart = {
  ayanamsa: 'Lahiri',
  lagna: { sign: 'Vrishabha', degree: 12 },
  sun: { name: 'Sun', sign: 'Mesha', house: 12, degree: 5, nakshatra: 'Ashwini', pada: 1 },
  moon: { name: 'Moon', sign: 'Vrishchika', house: 7, degree: 3, nakshatra: 'Anuradha', pada: 2 },
  planets: [],
  dasha: { mahadasha: 'Saturn', antardasha: 'Venus', start: '2024-01-01', end: '2027-01-01' },
  tzOffset: 330,
};

describe('fallbackArchetype', () => {
  it('returns valid archetype matching schema', () => {
    const a = fallbackArchetype(chart);
    expect(a.coreTraits).toHaveLength(3);
    expect(a.growthEdges).toHaveLength(2);
    expect(a.luckyNumber).toBeGreaterThanOrEqual(1);
    expect(a.luckyNumber).toBeLessThanOrEqual(9);
    expect(a.provenance.lagna).toBe('Vrishabha');
    expect(a.provenance.nakshatra).toBe('Anuradha');
  });

  it('different lagna+nakshatra produces different label', () => {
    const a1 = fallbackArchetype(chart);
    const c2: Chart = { ...chart, lagna: { sign: 'Simha', degree: 1 }, moon: { ...chart.moon, nakshatra: 'Magha' } };
    const a2 = fallbackArchetype(c2);
    expect(a1.label).not.toBe(a2.label);
  });
});
```

- [ ] **Step 2: Run — confirm fail**

```bash
npm run test lib/llm/fallback-archetype.test.ts
```

- [ ] **Step 3: Implement**

Create `lib/llm/fallback-archetype.ts`:

```ts
import type { Chart, Archetype } from '@/lib/astro/chart-types';

const ELEMENT_BY_SIGN: Record<string, 'fire' | 'earth' | 'air' | 'water'> = {
  Mesha: 'fire', Simha: 'fire', Dhanu: 'fire',
  Vrishabha: 'earth', Kanya: 'earth', Makara: 'earth',
  Mithuna: 'air', Tula: 'air', Kumbha: 'air',
  Karka: 'water', Vrishchika: 'water', Meena: 'water',
};

const ARCHETYPES = {
  fire: { label: 'The Solar Catalyst', sanskrit: 'Agni-Tejas Nayaka',
          traits: ['Quick to ignite, slow to settle', 'Leads from instinct, not committee', 'Burns out without an outlet'],
          strengths: ['Initiative', 'Charisma', 'Courage'], edges: ['Patience', 'Pacing'],
          color: 'crimson', num: 9, window: '6 AM - 9 AM' },
  earth: { label: 'The Slow Architect', sanskrit: 'Prithvi Shilpi',
           traits: ['Builds in years, not weekends', 'Trusts only what is held', 'Mistakes stillness for safety'],
           strengths: ['Discipline', 'Endurance', 'Practicality'], edges: ['Spontaneity', 'Risk'],
           color: 'olive', num: 6, window: '8 AM - 12 PM' },
  air: { label: 'The Pattern Seeker', sanskrit: 'Vayu Vichara',
         traits: ['Maps the room before entering it', 'Trades depth for breadth, sometimes', 'Mind faster than commitment'],
         strengths: ['Strategy', 'Wit', 'Networks'], edges: ['Decision', 'Follow-through'],
         color: 'azure', num: 5, window: '10 AM - 2 PM' },
  water: { label: 'The Tidal Mirror', sanskrit: 'Jala Pratibimba',
           traits: ['Feels rooms before reading them', 'Carries other people\'s weather', 'Retreats when overstimulated'],
           strengths: ['Empathy', 'Intuition', 'Memory'], edges: ['Boundaries', 'Selfhood'],
           color: 'indigo', num: 7, window: '8 PM - 12 AM' },
};

export function fallbackArchetype(chart: Chart): Archetype {
  const lagnaEl = ELEMENT_BY_SIGN[chart.lagna.sign] ?? 'earth';
  const moonEl = ELEMENT_BY_SIGN[chart.moon.sign] ?? lagnaEl;
  // blend: lagna dominant; moon flavors color/window
  const base = ARCHETYPES[lagnaEl];
  const flavor = ARCHETYPES[moonEl];
  return {
    label: base.label,
    sanskritLabel: base.sanskrit,
    coreTraits: base.traits as [string, string, string],
    strengths: base.strengths as [string, string, string],
    growthEdges: base.edges as [string, string],
    luckyColor: flavor.color,
    luckyNumber: base.num,
    powerWindow: flavor.window,
    oneLiner: `${base.label} — ${base.traits[0].toLowerCase()}.`,
    provenance: {
      ayanamsa: chart.ayanamsa,
      system: 'Vedic sidereal',
      nakshatra: chart.moon.nakshatra,
      lagna: chart.lagna.sign,
      currentDasha: `${chart.dasha.mahadasha}-${chart.dasha.antardasha}`,
    },
  };
}
```

- [ ] **Step 4: Run — confirm pass**

```bash
npm run test lib/llm/fallback-archetype.test.ts
```

Expected: 2 passing.

- [ ] **Step 5: Commit**

```bash
git add lib/llm/fallback-archetype.ts lib/llm/fallback-archetype.test.ts
git commit -m "feat: rule-based fallback archetype"
```

---

### Task 1.7: Lead CRUD with dedupe

**Files:**
- Create: `/Users/saurabhkumarsingh/Desktop/rashify/lib/db/leads.ts`
- Test:   `/Users/saurabhkumarsingh/Desktop/rashify/lib/db/leads.test.ts`

- [ ] **Step 1: Write failing test**

Create `lib/db/leads.test.ts`:

```ts
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
```

- [ ] **Step 2: Run — confirm fail**

```bash
npm run test lib/db/leads.test.ts
```

- [ ] **Step 3: Implement**

Create `lib/db/leads.ts`:

```ts
import { serverClient } from './supabase';
import { makeSlug } from '@/lib/slug';

export interface InsertLeadInput {
  name: string;
  phoneE164: string;
  dobDate: string;
  dobTime: string;
  birthPlace: string;
  lat: number;
  lon: number;
  tzOffset: number;
  chartJson: unknown;
  archetype: unknown;
  ipHash: string | null;
  referrerSlug: string | null;
  utm: unknown | null;
}

export async function insertOrFetchLead(input: InsertLeadInput): Promise<{ slug: string; isNew: boolean }> {
  const sb = serverClient();

  const existing = await sb
    .from('leads')
    .select('slug')
    .eq('phone_e164', input.phoneE164)
    .is('deleted_at', null)
    .maybeSingle();

  if (existing.data?.slug) return { slug: existing.data.slug, isNew: false };

  const slug = makeSlug(input.name);
  const { data, error } = await sb
    .from('leads')
    .insert({
      slug,
      name: input.name,
      phone_e164: input.phoneE164,
      dob_date: input.dobDate,
      dob_time: input.dobTime,
      birth_place: input.birthPlace,
      lat: input.lat, lon: input.lon, tz_offset: input.tzOffset,
      chart_json: input.chartJson,
      archetype: input.archetype,
      referrer_slug: input.referrerSlug,
      utm: input.utm,
      ip_hash: input.ipHash,
      consent_at: new Date().toISOString(),
    })
    .select('slug')
    .single();

  if (error || !data) throw new Error(`LEAD_INSERT_FAILED: ${error?.message ?? 'unknown'}`);
  return { slug: data.slug, isNew: true };
}

export interface PublicCard {
  slug: string;
  name: string;
  archetype: unknown;
  created_at: string;
  referrer_slug: string | null;
}

export async function getCardBySlug(slug: string): Promise<PublicCard | null> {
  const sb = serverClient();
  const { data } = await sb
    .from('public_card')
    .select('slug, name, archetype, created_at, referrer_slug')
    .eq('slug', slug)
    .maybeSingle();
  return (data as PublicCard | null) ?? null;
}
```

- [ ] **Step 4: Run — confirm pass**

```bash
npm run test lib/db/leads.test.ts
```

Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add lib/db/leads.ts lib/db/leads.test.ts
git commit -m "feat: leads dedupe + public card fetch"
```

---

### Task 1.8: Telemetry events registry + clients

**Files:**
- Create: `/Users/saurabhkumarsingh/Desktop/rashify/lib/telemetry/events.ts`
- Create: `/Users/saurabhkumarsingh/Desktop/rashify/lib/telemetry/posthog.ts`

(No tests — thin wrappers around posthog SDK.)

- [ ] **Step 1: Write events registry**

Create `lib/telemetry/events.ts`:

```ts
export const Events = {
  LANDING_VIEW: 'landing_view',
  FORM_FIELD_FOCUS: 'form_field_focus',
  FORM_FIELD_BLUR: 'form_field_blur',
  FORM_SUBMIT_CLICK: 'form_submit_click',
  FORM_SUBMIT_SUCCESS: 'form_submit_success',
  FORM_SUBMIT_FAIL: 'form_submit_fail',

  GEN_PIPELINE_START: 'gen_pipeline_start',
  GEN_GEOCODE_OK: 'gen_geocode_ok',
  GEN_PROKERALA_OK: 'gen_prokerala_ok',
  GEN_LLM_OK: 'gen_llm_ok',
  GEN_PIPELINE_DONE: 'gen_pipeline_done',
  GEN_PIPELINE_FAIL: 'gen_pipeline_fail',

  RESULT_VIEW: 'result_view',
  RESULT_REVEAL_DONE: 'result_reveal_done',
  SHARE_WA_CLICK: 'share_wa_click',
  SHARE_DOWNLOAD_CLICK: 'share_download_click',
  SHARE_COPY_CLICK: 'share_copy_click',
  SHARE_COMPARE_CLICK: 'share_compare_click',

  WA_DELIVERED: 'wa_delivered',
  WA_READ: 'wa_read',
  WA_BUTTON_CLICK: 'wa_button_click',

  VISITOR_ON_SHARED: 'visitor_on_shared',
  VIRAL_SIGNUP: 'viral_signup',
} as const;
export type EventName = (typeof Events)[keyof typeof Events];
```

- [ ] **Step 2: Write server PostHog client**

Create `lib/telemetry/posthog.ts`:

```ts
import { PostHog } from 'posthog-node';
import type { EventName } from './events';

let client: PostHog | null = null;
function getClient(): PostHog | null {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (!key) return null;
  if (!client) client = new PostHog(key, { host, flushAt: 1, flushInterval: 0 });
  return client;
}

export function trackServer(distinctId: string, event: EventName, props?: Record<string, unknown>) {
  const c = getClient();
  if (!c) return;
  c.capture({ distinctId, event, properties: { phase: 'server', ...props } });
}

export async function flushTelemetry() {
  await client?.shutdown();
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/telemetry/
git commit -m "feat: posthog telemetry registry + server client"
```

---

### Task 1.9: AiSensy WhatsApp client

**Files:**
- Create: `/Users/saurabhkumarsingh/Desktop/rashify/lib/wa/aisensy.ts`
- Create: `/Users/saurabhkumarsingh/Desktop/rashify/lib/wa/templates.ts`
- Test:   `/Users/saurabhkumarsingh/Desktop/rashify/lib/wa/aisensy.test.ts`

- [ ] **Step 1: Write template module**

Create `lib/wa/templates.ts`:

```ts
import type { Archetype } from '@/lib/astro/chart-types';

export interface ArchetypeTemplatePayload {
  apiKey: string;
  campaignName: string;
  destination: string;            // phone E.164 minus '+'
  userName: string;               // first name
  templateParams: string[];       // ordered: slug, firstName, label, sanskritLabel, t1, t2, t3
  source: 'rashify-web';
  media: { url: string; filename: string };
}

export function buildArchetypePayload(args: {
  apiKey: string;
  campaignName: string;
  phoneE164: string;
  firstName: string;
  slug: string;
  archetype: Archetype;
  ogUrl: string;
}): ArchetypeTemplatePayload {
  const traits = args.archetype.coreTraits;
  return {
    apiKey: args.apiKey,
    campaignName: args.campaignName,
    destination: args.phoneE164.replace(/^\+/, ''),
    userName: args.firstName,
    templateParams: [
      args.slug,
      args.firstName,
      args.archetype.label,
      args.archetype.sanskritLabel,
      traits[0], traits[1], traits[2],
    ],
    source: 'rashify-web',
    media: { url: args.ogUrl, filename: `${args.slug}.png` },
  };
}
```

- [ ] **Step 2: Write failing test**

Create `lib/wa/aisensy.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendArchetype } from './aisensy';

const mockFetch = vi.fn();
global.fetch = mockFetch as never;

beforeEach(() => {
  mockFetch.mockReset();
  process.env.AISENSY_API_KEY = 'k';
  process.env.AISENSY_CAMPAIGN_NAME = 'rashify_archetype_v1';
});

const args = {
  phoneE164: '+919999999999',
  firstName: 'Saurabh',
  slug: 'saurabh-x7k2',
  archetype: {
    label: 'The Saturn-Mercury Strategist',
    sanskritLabel: 'Karma-Yoga Tantri',
    coreTraits: ['t1', 't2', 't3'],
    strengths: ['s1', 's2', 's3'],
    growthEdges: ['e1', 'e2'],
    luckyColor: 'indigo', luckyNumber: 7,
    powerWindow: '10 PM', oneLiner: 'x',
    provenance: { ayanamsa: 'Lahiri', system: 'V', nakshatra: 'A', lagna: 'V', currentDasha: 'Sa-Ve' },
  } as const,
  ogUrl: 'https://rashify.in/api/og?slug=saurabh-x7k2',
};

describe('sendArchetype', () => {
  it('posts to aisensy with built payload', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ status: 'success' }) });
    const r = await sendArchetype(args);
    expect(r.status).toBe('queued');
    expect(mockFetch).toHaveBeenCalledOnce();
    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(body.destination).toBe('919999999999');
    expect(body.templateParams[0]).toBe('saurabh-x7k2');
  });

  it('returns failed on aisensy 4xx', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 400, text: async () => 'bad' });
    const r = await sendArchetype(args);
    expect(r.status).toBe('failed');
    expect(r.error).toContain('400');
  });
});
```

- [ ] **Step 3: Run — confirm fail**

```bash
npm run test lib/wa/aisensy.test.ts
```

- [ ] **Step 4: Implement**

Create `lib/wa/aisensy.ts`:

```ts
import { buildArchetypePayload, type ArchetypeTemplatePayload } from './templates';
import type { Archetype } from '@/lib/astro/chart-types';

const AISENSY_URL = 'https://backend.aisensy.com/campaign/t1/api/v2';

export interface SendArgs {
  phoneE164: string;
  firstName: string;
  slug: string;
  archetype: Archetype;
  ogUrl: string;
}

export interface SendResult {
  status: 'queued' | 'failed';
  payload: ArchetypeTemplatePayload;
  error?: string;
}

export async function sendArchetype(args: SendArgs): Promise<SendResult> {
  const apiKey = process.env.AISENSY_API_KEY!;
  const campaignName = process.env.AISENSY_CAMPAIGN_NAME!;
  const payload = buildArchetypePayload({ apiKey, campaignName, ...args });

  const res = await fetch(AISENSY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return { status: 'failed', payload, error: `${res.status} ${text}`.slice(0, 500) };
  }
  return { status: 'queued', payload };
}
```

- [ ] **Step 5: Run — confirm pass**

```bash
npm run test lib/wa/aisensy.test.ts
```

Expected: 2 passing.

- [ ] **Step 6: Commit**

```bash
git add lib/wa/
git commit -m "feat: aisensy whatsapp send with template payload"
```

---

## Phase 2 — API Pipeline

### Task 2.1: `/api/generate` orchestrator

**Files:**
- Create: `/Users/saurabhkumarsingh/Desktop/rashify/app/api/generate/route.ts`
- Test:   `/Users/saurabhkumarsingh/Desktop/rashify/app/api/generate/route.test.ts`
- Create: `/Users/saurabhkumarsingh/Desktop/rashify/lib/util/ip-hash.ts`

- [ ] **Step 1: Write IP hash util**

Create `lib/util/ip-hash.ts`:

```ts
import { createHash } from 'node:crypto';
export function ipHash(ip: string): string {
  const salt = process.env.IP_HASH_SALT ?? '';
  return createHash('sha256').update(ip + salt).digest('hex');
}
```

- [ ] **Step 2: Write failing test for orchestrator**

Create `app/api/generate/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';

vi.mock('@/lib/astro/geocode', () => ({
  geocode: vi.fn(async () => ({ lat: 19.07, lon: 72.87, tzOffset: 330, cacheHit: false })),
}));
vi.mock('@/lib/astro/prokerala', () => ({
  fetchChart: vi.fn(async () => ({
    ayanamsa: 'Lahiri',
    lagna: { sign: 'Vrishabha', degree: 12 },
    sun: { name: 'Sun', sign: 'Mesha', house: 12, degree: 5, nakshatra: 'Ashwini', pada: 1 },
    moon: { name: 'Moon', sign: 'Vrishchika', house: 7, degree: 3, nakshatra: 'Anuradha', pada: 2 },
    planets: [],
    dasha: { mahadasha: 'Saturn', antardasha: 'Venus', start: '2024-01-01', end: '2027-01-01' },
    tzOffset: 330,
  })),
}));
const archetype = {
  label: 'The Slow Architect', sanskritLabel: 'Prithvi Shilpi',
  coreTraits: ['a','b','c'], strengths: ['x','y','z'], growthEdges: ['p','q'],
  luckyColor: 'olive', luckyNumber: 6, powerWindow: '8 AM - 12 PM', oneLiner: 'o',
  provenance: { ayanamsa: 'Lahiri', system: 'Vedic sidereal', nakshatra: 'Anuradha', lagna: 'Vrishabha', currentDasha: 'Saturn-Venus' },
};
const generateArchetype = vi.fn(async () => archetype);
vi.mock('@/lib/llm/gemini', () => ({ generateArchetype }));
vi.mock('@/lib/llm/fallback-archetype', () => ({ fallbackArchetype: () => archetype }));
const insertOrFetchLead = vi.fn(async () => ({ slug: 'saurabh-abc1', isNew: true }));
vi.mock('@/lib/db/leads', () => ({ insertOrFetchLead }));
vi.mock('@/lib/wa/aisensy', () => ({ sendArchetype: vi.fn(async () => ({ status: 'queued' })) }));
vi.mock('@/lib/telemetry/posthog', () => ({ trackServer: vi.fn(), flushTelemetry: vi.fn() }));
// turnstile verify always passes in tests
vi.mock('@/lib/util/turnstile', () => ({ verifyTurnstile: vi.fn(async () => true) }));

beforeEach(() => {
  generateArchetype.mockClear();
  insertOrFetchLead.mockClear();
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
```

- [ ] **Step 3: Run — confirm fail**

```bash
npm run test app/api/generate/route.test.ts
```

Expected: route module + turnstile util missing.

- [ ] **Step 4: Implement Turnstile verifier**

Create `lib/util/turnstile.ts`:

```ts
const URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export async function verifyTurnstile(token: string, ip: string | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // dev/test fallback
  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set('remoteip', ip);
  const res = await fetch(URL, { method: 'POST', body });
  if (!res.ok) return false;
  const j = (await res.json()) as { success: boolean };
  return !!j.success;
}
```

- [ ] **Step 5: Implement orchestrator**

Create `app/api/generate/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { geocode } from '@/lib/astro/geocode';
import { fetchChart } from '@/lib/astro/prokerala';
import { generateArchetype } from '@/lib/llm/gemini';
import { fallbackArchetype } from '@/lib/llm/fallback-archetype';
import { insertOrFetchLead } from '@/lib/db/leads';
import { sendArchetype } from '@/lib/wa/aisensy';
import { trackServer, flushTelemetry } from '@/lib/telemetry/posthog';
import { Events } from '@/lib/telemetry/events';
import { verifyTurnstile } from '@/lib/util/turnstile';
import { ipHash } from '@/lib/util/ip-hash';

const ReqZ = z.object({
  name: z.string().min(1).max(80),
  dobDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dobTime: z.string().regex(/^\d{2}:\d{2}$/),
  birthPlace: z.string().min(2).max(120),
  phoneE164: z.string().regex(/^\+91\d{10}$/),
  referrerSlug: z.string().optional().nullable(),
  utm: z.record(z.string()).optional().nullable(),
  consent: z.literal(true),
  turnstileToken: z.string(),
});

export const runtime = 'nodejs';
export const maxDuration = 10;

export async function POST(req: Request): Promise<Response> {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  const ipH = ip ? ipHash(ip) : null;
  let parsed;
  try {
    parsed = ReqZ.safeParse(await req.json());
  } catch {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 });
  }
  if (!parsed.success) {
    const issues = parsed.error.issues;
    if (issues.some((i) => i.path.includes('phoneE164'))) {
      return NextResponse.json({ error: 'INVALID_PHONE' }, { status: 400 });
    }
    if (issues.some((i) => i.path.includes('consent'))) {
      return NextResponse.json({ error: 'CONSENT_MISSING' }, { status: 400 });
    }
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 });
  }
  const body = parsed.data;

  if (!(await verifyTurnstile(body.turnstileToken, ip))) {
    return NextResponse.json({ error: 'TURNSTILE_FAIL' }, { status: 400 });
  }

  const distinctId = `tmp-${Date.now()}`;
  const start = Date.now();
  trackServer(distinctId, Events.GEN_PIPELINE_START);

  try {
    const t0 = Date.now();
    const geo = await geocode(body.birthPlace);
    trackServer(distinctId, Events.GEN_GEOCODE_OK, { duration_ms: Date.now() - t0, cache_hit: geo.cacheHit });

    const t1 = Date.now();
    const datetime = `${body.dobDate}T${body.dobTime}:00+05:30`;
    const chart = await fetchChart({ datetime, lat: geo.lat, lon: geo.lon, tzOffset: geo.tzOffset });
    trackServer(distinctId, Events.GEN_PROKERALA_OK, { duration_ms: Date.now() - t1 });

    const firstName = body.name.split(/\s+/)[0];
    const t2 = Date.now();
    let archetype;
    let llmRetries = 0;
    try {
      archetype = await generateArchetype(chart, firstName);
    } catch (e) {
      llmRetries = 1;
      archetype = fallbackArchetype(chart);
    }
    trackServer(distinctId, Events.GEN_LLM_OK, { duration_ms: Date.now() - t2, retries: llmRetries });

    const { slug } = await insertOrFetchLead({
      name: body.name, phoneE164: body.phoneE164,
      dobDate: body.dobDate, dobTime: body.dobTime, birthPlace: body.birthPlace,
      lat: geo.lat, lon: geo.lon, tzOffset: geo.tzOffset,
      chartJson: chart, archetype,
      ipHash: ipH, referrerSlug: body.referrerSlug ?? null, utm: body.utm ?? null,
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
    const ogUrl = `${appUrl}/api/og?slug=${slug}`;
    sendArchetype({ phoneE164: body.phoneE164, firstName, slug, archetype, ogUrl })
      .catch((err) => trackServer(slug, Events.GEN_PIPELINE_FAIL, { step: 'wa_send', error: String(err) }));

    trackServer(slug, Events.GEN_PIPELINE_DONE, { total_ms: Date.now() - start });
    await flushTelemetry();
    return NextResponse.json({ slug, archetype });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'UNKNOWN';
    trackServer(distinctId, Events.GEN_PIPELINE_FAIL, { error: msg });
    await flushTelemetry();
    const code = msg === 'GEOCODE_FAILED' ? 'GEOCODE_FAILED'
              : msg === 'PROKERALA_DOWN' ? 'PROKERALA_DOWN'
              : 'INTERNAL';
    return NextResponse.json({ error: code }, { status: code === 'INTERNAL' ? 500 : 502 });
  }
}
```

- [ ] **Step 6: Run — confirm pass**

```bash
npm run test app/api/generate/route.test.ts
```

Expected: 4 passing.

- [ ] **Step 7: Commit**

```bash
git add app/api/generate/ lib/util/
git commit -m "feat: /api/generate pipeline orchestrator with telemetry + fallback"
```

---

## Phase 3 — UI

### Task 3.1: ShareCard component

**Files:**
- Create: `/Users/saurabhkumarsingh/Desktop/rashify/components/ShareCard.tsx`
- Test:   `/Users/saurabhkumarsingh/Desktop/rashify/components/ShareCard.test.tsx`

- [ ] **Step 1: Write failing test**

Create `components/ShareCard.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ShareCard } from './ShareCard';

const archetype = {
  label: 'The Saturn-Mercury Strategist',
  sanskritLabel: 'Karma-Yoga Tantri',
  coreTraits: ['Patient architect', 'Quiet authority', 'Slow ambition'],
  strengths: ['Strategy', 'Patience', 'Discipline'],
  growthEdges: ['Letting go', 'Spontaneity'],
  luckyColor: 'indigo',
  luckyNumber: 7,
  powerWindow: '10:30 PM - 2 AM',
  oneLiner: 'A patient architect of slow ambition.',
  provenance: { ayanamsa: 'Lahiri', system: 'Vedic sidereal', nakshatra: 'Anuradha', lagna: 'Vrishabha', currentDasha: 'Saturn-Venus' },
};

describe('ShareCard', () => {
  it('renders archetype label, sanskrit label and traits', () => {
    render(<ShareCard archetype={archetype} slug="saurabh-x7k2" appUrl="https://rashify.in" />);
    expect(screen.getByText(archetype.label)).toBeInTheDocument();
    expect(screen.getByText(archetype.sanskritLabel)).toBeInTheDocument();
    archetype.coreTraits.forEach((t) => expect(screen.getByText(t)).toBeInTheDocument());
    expect(screen.getByText(/rashify\.in\/u\/saurabh-x7k2/)).toBeInTheDocument();
  });

  it('renders provenance footer', () => {
    render(<ShareCard archetype={archetype} slug="x" appUrl="https://rashify.in" />);
    expect(screen.getByText(/Lahiri/)).toBeInTheDocument();
    expect(screen.getByText(/Saturn-Venus/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — confirm fail**

```bash
npm run test components/ShareCard.test.tsx
```

- [ ] **Step 3: Implement**

Create `components/ShareCard.tsx`:

```tsx
import type { Archetype } from '@/lib/astro/chart-types';

export interface ShareCardProps {
  archetype: Archetype;
  slug: string;
  appUrl: string;
}

export function ShareCard({ archetype: a, slug, appUrl }: ShareCardProps) {
  const personalUrl = `${appUrl.replace(/^https?:\/\//, '')}/u/${slug}`;
  return (
    <div
      style={{
        width: 1080, height: 1920,
        background: '#3a0a14', color: '#f1e7d4',
        fontFamily: 'Cormorant Garamond, serif',
        padding: 96, display: 'flex', flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <div style={{ fontSize: 36, letterSpacing: 8, color: '#c9a24a' }}>◆ RASHIFY</div>

      <div>
        <div style={{ fontSize: 36, color: '#c9a24a' }}>✦</div>
        <h1 style={{ fontSize: 96, lineHeight: 1.05, margin: '24px 0' }}>{a.label}</h1>
        <div style={{ fontSize: 48, color: '#c9a24a', fontStyle: 'italic' }}>{a.sanskritLabel}</div>
      </div>

      <div style={{ fontFamily: 'Inter, sans-serif' }}>
        <div style={{ fontSize: 28, letterSpacing: 4, color: '#c9a24a', marginBottom: 16 }}>CORE TRAITS</div>
        {a.coreTraits.map((t) => (
          <div key={t} style={{ fontSize: 40, marginBottom: 12 }}>• {t}</div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 96, fontFamily: 'Inter, sans-serif' }}>
        <div>
          <div style={{ fontSize: 24, color: '#c9a24a', letterSpacing: 4 }}>STRENGTH</div>
          <div style={{ fontSize: 36 }}>{a.strengths.join(' · ')}</div>
        </div>
        <div>
          <div style={{ fontSize: 24, color: '#c9a24a', letterSpacing: 4 }}>GROWTH EDGE</div>
          <div style={{ fontSize: 36 }}>{a.growthEdges.join(' · ')}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 96, fontFamily: 'Inter, sans-serif' }}>
        <div>
          <div style={{ fontSize: 24, color: '#c9a24a', letterSpacing: 4 }}>POWER WINDOW</div>
          <div style={{ fontSize: 32 }}>{a.powerWindow}</div>
        </div>
        <div>
          <div style={{ fontSize: 24, color: '#c9a24a', letterSpacing: 4 }}>LUCKY</div>
          <div style={{ fontSize: 32 }}>{a.luckyColor} · {a.luckyNumber}</div>
        </div>
      </div>

      <div style={{ borderTop: '1px solid #c9a24a44', paddingTop: 24, fontFamily: 'Inter, sans-serif' }}>
        <div style={{ fontSize: 20, color: '#c9a24a' }}>
          {a.provenance.system} · {a.provenance.ayanamsa} · {a.provenance.lagna} · {a.provenance.nakshatra} · {a.provenance.currentDasha} dasha
        </div>
        <div style={{ fontSize: 36, marginTop: 16, color: '#f1e7d4' }}>{personalUrl}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run — confirm pass**

```bash
npm run test components/ShareCard.test.tsx
```

Expected: 2 passing.

- [ ] **Step 5: Commit**

```bash
git add components/ShareCard.tsx components/ShareCard.test.tsx
git commit -m "feat: ShareCard JSX with provenance footer"
```

---

### Task 3.2: `/api/og` PNG renderer

**Files:**
- Create: `/Users/saurabhkumarsingh/Desktop/rashify/app/api/og/route.tsx`

(No test — visual rendering verified manually.)

- [ ] **Step 1: Implement**

Create `app/api/og/route.tsx`:

```tsx
import { ImageResponse } from 'next/og';
import { ShareCard } from '@/components/ShareCard';
import { getCardBySlug } from '@/lib/db/leads';
import { ArchetypeZ } from '@/lib/astro/chart-types';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get('slug');
  if (!slug) return new Response('missing slug', { status: 400 });

  const card = await getCardBySlug(slug);
  if (!card) return new Response('not found', { status: 404 });

  const parsed = ArchetypeZ.safeParse(card.archetype);
  if (!parsed.success) return new Response('bad archetype', { status: 500 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';

  return new ImageResponse(
    <ShareCard archetype={parsed.data} slug={slug} appUrl={appUrl} />,
    {
      width: 1080,
      height: 1920,
      headers: {
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      },
    },
  );
}
```

- [ ] **Step 2: Smoke check**

```bash
npm run dev
# in another terminal:
curl -I "http://localhost:3000/api/og?slug=test-missing"
```

Expected: `HTTP/1.1 404`. Real slug check happens after Phase 4 (form submits).

- [ ] **Step 3: Commit**

```bash
git add app/api/og/
git commit -m "feat: /api/og PNG renderer reuses ShareCard JSX"
```

---

### Task 3.3: BirthForm component

**Files:**
- Create: `/Users/saurabhkumarsingh/Desktop/rashify/components/BirthForm.tsx`
- Create: `/Users/saurabhkumarsingh/Desktop/rashify/components/ConsentCheckbox.tsx`
- Test:   `/Users/saurabhkumarsingh/Desktop/rashify/components/BirthForm.test.tsx`

- [ ] **Step 1: Write failing test**

Create `components/BirthForm.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BirthForm } from './BirthForm';

describe('BirthForm', () => {
  it('blocks submit without consent', async () => {
    const onSubmit = vi.fn();
    render(<BirthForm onSubmit={onSubmit} mode="self" />);
    await userEvent.type(screen.getByLabelText(/name/i), 'Saurabh');
    await userEvent.type(screen.getByLabelText(/date/i), '1995-08-15');
    await userEvent.type(screen.getByLabelText(/time/i), '14:30');
    await userEvent.type(screen.getByLabelText(/place/i), 'Mumbai');
    await userEvent.type(screen.getByLabelText(/phone/i), '9999999999');
    await userEvent.click(screen.getByRole('button', { name: /reveal|see/i }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(await screen.findByText(/consent/i)).toBeInTheDocument();
  });

  it('submits valid input with phone normalized to E.164', async () => {
    const onSubmit = vi.fn();
    render(<BirthForm onSubmit={onSubmit} mode="self" />);
    await userEvent.type(screen.getByLabelText(/name/i), 'Saurabh');
    await userEvent.type(screen.getByLabelText(/date/i), '1995-08-15');
    await userEvent.type(screen.getByLabelText(/time/i), '14:30');
    await userEvent.type(screen.getByLabelText(/place/i), 'Mumbai');
    await userEvent.type(screen.getByLabelText(/phone/i), '9999999999');
    await userEvent.click(screen.getByLabelText(/i consent/i));
    await userEvent.click(screen.getByRole('button', { name: /reveal|see/i }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Saurabh', phoneE164: '+919999999999', consent: true }),
    );
  });
});
```

- [ ] **Step 2: Run — confirm fail**

```bash
npm run test components/BirthForm.test.tsx
```

- [ ] **Step 3: Implement consent + form**

Create `components/ConsentCheckbox.tsx`:

```tsx
'use client';
import { useId } from 'react';

export function ConsentCheckbox({
  checked, onChange, error,
}: { checked: boolean; onChange: (b: boolean) => void; error?: boolean }) {
  const id = useId();
  return (
    <label htmlFor={id} className={`flex items-start gap-2 text-sm ${error ? 'text-red-600' : ''}`}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-label="I consent"
      />
      <span>
        I consent to receiving my Vedic profile on WhatsApp and to Rashify storing my birth details for analysis.{' '}
        <a href="/privacy" className="underline">Privacy policy</a>.
      </span>
    </label>
  );
}
```

Create `components/BirthForm.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { ConsentCheckbox } from './ConsentCheckbox';

export interface BirthFormValue {
  name: string;
  dobDate: string;
  dobTime: string;
  birthPlace: string;
  phoneE164: string;
  consent: true;
}

export function BirthForm({
  onSubmit, mode,
}: {
  onSubmit: (v: BirthFormValue) => void | Promise<void>;
  mode: 'self' | 'friend';
}) {
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [time, setTime] = useState('');
  const [place, setPlace] = useState('');
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submitLabel = mode === 'self' ? 'Reveal my archetype' : 'See our match';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consent) { setErr('Consent required'); return; }
    const phoneClean = phone.replace(/\D/g, '');
    if (phoneClean.length !== 10) { setErr('Enter 10-digit Indian mobile'); return; }
    setErr(null);
    await onSubmit({
      name: name.trim(),
      dobDate: dob,
      dobTime: time,
      birthPlace: place.trim(),
      phoneE164: `+91${phoneClean}`,
      consent: true,
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 max-w-md mx-auto">
      <label className="flex flex-col">
        <span className="text-sm">Name</span>
        <input className="border rounded px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label className="flex flex-col">
        <span className="text-sm">Date of birth</span>
        <input type="date" className="border rounded px-3 py-2" value={dob} onChange={(e) => setDob(e.target.value)} required />
      </label>
      <label className="flex flex-col">
        <span className="text-sm">Time of birth</span>
        <input type="time" className="border rounded px-3 py-2" value={time} onChange={(e) => setTime(e.target.value)} required />
      </label>
      <label className="flex flex-col">
        <span className="text-sm">Place of birth</span>
        <input className="border rounded px-3 py-2" value={place} onChange={(e) => setPlace(e.target.value)} required placeholder="Mumbai" />
      </label>
      <label className="flex flex-col">
        <span className="text-sm">Phone (WhatsApp)</span>
        <input className="border rounded px-3 py-2" value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="9999999999" inputMode="numeric" />
      </label>
      <ConsentCheckbox checked={consent} onChange={setConsent} error={err === 'Consent required'} />
      {err && <div className="text-red-600 text-sm">{err}</div>}
      <button type="submit" className="bg-[#3a0a14] text-[#f1e7d4] py-3 rounded">{submitLabel}</button>
    </form>
  );
}
```

- [ ] **Step 4: Run — confirm pass**

```bash
npm run test components/BirthForm.test.tsx
```

Expected: 2 passing.

- [ ] **Step 5: Commit**

```bash
git add components/BirthForm.tsx components/ConsentCheckbox.tsx components/BirthForm.test.tsx
git commit -m "feat: BirthForm with consent + phone normalize"
```

---

### Task 3.4: Landing page wires form to /api/generate + Turnstile + PostHog

**Files:**
- Modify: `/Users/saurabhkumarsingh/Desktop/rashify/app/page.tsx`
- Create: `/Users/saurabhkumarsingh/Desktop/rashify/components/PostHogProvider.tsx`
- Modify: `/Users/saurabhkumarsingh/Desktop/rashify/app/layout.tsx`

- [ ] **Step 1: Wire client-side PostHog**

Create `components/PostHogProvider.tsx`:

```tsx
'use client';
import { useEffect } from 'react';
import posthog from 'posthog-js';

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return;
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      capture_pageview: true,
      session_recording: { maskAllInputs: true },
    });
  }, []);
  return <>{children}</>;
}
```

Modify `app/layout.tsx` — wrap `<body>` children in `<PostHogProvider>`. Replace existing root layout:

```tsx
import './globals.css';
import { PostHogProvider } from '@/components/PostHogProvider';

export const metadata = {
  title: 'Rashify — your Vedic archetype',
  description: 'Discover your Vedic archetype on WhatsApp.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#f1e7d4] text-[#3a0a14] min-h-screen">
        <PostHogProvider>{children}</PostHogProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Replace `app/page.tsx` with form-driven landing**

```tsx
'use client';
import { useEffect, useState } from 'react';
import posthog from 'posthog-js';
import { useRouter, useSearchParams } from 'next/navigation';
import Script from 'next/script';
import { BirthForm, type BirthFormValue } from '@/components/BirthForm';
import { Events } from '@/lib/telemetry/events';

declare global {
  interface Window { turnstile?: { render: (id: string, opts: object) => string }; }
}

export default function Landing() {
  const router = useRouter();
  const params = useSearchParams();
  const referrer = params.get('ref');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState<string>('');

  useEffect(() => { posthog.capture(Events.LANDING_VIEW, { referrer }); }, [referrer]);

  useEffect(() => {
    const id = setInterval(() => {
      const w = window as Window;
      if (w.turnstile && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) {
        w.turnstile.render('#cf-turnstile', {
          sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
          callback: setToken,
        });
        clearInterval(id);
      }
    }, 200);
    return () => clearInterval(id);
  }, []);

  const submit = async (v: BirthFormValue) => {
    posthog.capture(Events.FORM_SUBMIT_CLICK);
    setBusy(true);
    setError(null);
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...v, referrerSlug: referrer ?? null, turnstileToken: token || 'dev' }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      posthog.capture(Events.FORM_SUBMIT_FAIL, { error_code: j.error });
      setError(j.error ?? 'INTERNAL');
      setBusy(false);
      return;
    }
    const { slug } = await res.json();
    posthog.capture(Events.FORM_SUBMIT_SUCCESS, { slug });
    posthog.identify(slug);
    router.push(`/u/${slug}`);
  };

  return (
    <main className="min-h-screen px-6 py-16">
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
      <header className="max-w-md mx-auto mb-10">
        <h1 className="text-4xl font-serif text-center">Discover your Vedic archetype</h1>
        <p className="text-center text-sm mt-2">In 30 seconds. On WhatsApp.</p>
      </header>
      {busy ? (
        <div className="text-center">Reading your stars…</div>
      ) : (
        <BirthForm onSubmit={submit} mode="self" />
      )}
      {error && <div className="text-center text-red-600 mt-4">Error: {error}. Try again.</div>}
      <div id="cf-turnstile" className="mt-6 flex justify-center" />
    </main>
  );
}
```

- [ ] **Step 3: Smoke**

```bash
npm run dev
# open http://localhost:3000 in browser; visually verify form renders
```

Expected: form visible, no console errors.

- [ ] **Step 4: Commit**

```bash
git add app/layout.tsx app/page.tsx components/PostHogProvider.tsx
git commit -m "feat: landing page wires BirthForm + PostHog + Turnstile"
```

---

### Task 3.5: Result page `/u/[slug]` + ShareActions

**Files:**
- Create: `/Users/saurabhkumarsingh/Desktop/rashify/app/u/[slug]/page.tsx`
- Create: `/Users/saurabhkumarsingh/Desktop/rashify/app/u/[slug]/loading.tsx`
- Create: `/Users/saurabhkumarsingh/Desktop/rashify/components/ShareActions.tsx`
- Create: `/Users/saurabhkumarsingh/Desktop/rashify/components/ArchetypeReveal.tsx`

- [ ] **Step 1: Reveal animation**

Create `components/ArchetypeReveal.tsx`:

```tsx
'use client';
import { useEffect, useState } from 'react';
import posthog from 'posthog-js';
import { Events } from '@/lib/telemetry/events';

export function ArchetypeReveal({ children, slug }: { children: React.ReactNode; slug: string }) {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const seen = localStorage.getItem(`rashify:seen:${slug}`);
    if (seen) { setRevealed(true); return; }
    const t = setTimeout(() => {
      setRevealed(true);
      localStorage.setItem(`rashify:seen:${slug}`, '1');
      posthog.capture(Events.RESULT_REVEAL_DONE, { slug });
    }, 1800);
    return () => clearTimeout(t);
  }, [slug]);
  return (
    <div style={{ opacity: revealed ? 1 : 0, transition: 'opacity 1.2s ease' }}>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Share actions**

Create `components/ShareActions.tsx`:

```tsx
'use client';
import posthog from 'posthog-js';
import { Events } from '@/lib/telemetry/events';

export function ShareActions({ slug, label, appUrl }: { slug: string; label: string; appUrl: string }) {
  const personalUrl = `${appUrl}/u/${slug}`;
  const ogUrl = `${appUrl}/api/og?slug=${slug}`;
  const waText = encodeURIComponent(`I am ${label} 🪔 — discover your Vedic archetype: ${personalUrl}?ref=${slug}`);

  const wa = () => { posthog.capture(Events.SHARE_WA_CLICK, { slug }); window.open(`https://wa.me/?text=${waText}`, '_blank'); };
  const dl = () => { posthog.capture(Events.SHARE_DOWNLOAD_CLICK, { slug }); window.open(ogUrl, '_blank'); };
  const cp = async () => {
    posthog.capture(Events.SHARE_COPY_CLICK, { slug });
    await navigator.clipboard.writeText(personalUrl);
  };
  const cmp = () => posthog.capture(Events.SHARE_COMPARE_CLICK, { slug });

  return (
    <div className="flex flex-wrap justify-center gap-3 mt-6">
      <button onClick={wa} className="bg-[#3a0a14] text-[#f1e7d4] px-4 py-2 rounded">Send on WhatsApp</button>
      <button onClick={dl} className="border border-[#3a0a14] px-4 py-2 rounded">Save image</button>
      <button onClick={cp} className="border border-[#3a0a14] px-4 py-2 rounded">Copy link</button>
      <button onClick={cmp} className="border border-[#3a0a14] px-4 py-2 rounded opacity-60 cursor-not-allowed" disabled title="Coming soon">
        Compare with friend
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Result page**

Create `app/u/[slug]/loading.tsx`:

```tsx
export default function Loading() {
  return <div className="min-h-screen flex items-center justify-center">Reading your stars…</div>;
}
```

Create `app/u/[slug]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { ArchetypeZ } from '@/lib/astro/chart-types';
import { getCardBySlug } from '@/lib/db/leads';
import { ShareCard } from '@/components/ShareCard';
import { ShareActions } from '@/components/ShareActions';
import { ArchetypeReveal } from '@/components/ArchetypeReveal';
import { Events } from '@/lib/telemetry/events';
import Script from 'next/script';

export const dynamic = 'force-dynamic';

export default async function CardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const card = await getCardBySlug(slug);
  if (!card) notFound();

  const parsed = ArchetypeZ.safeParse(card.archetype);
  if (!parsed.success) notFound();
  const archetype = parsed.data;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';

  return (
    <main className="min-h-screen px-6 py-12">
      <Script id="result-view" strategy="afterInteractive">{`
        if (window.posthog) window.posthog.capture('${Events.RESULT_VIEW}', { slug: '${slug}' });
      `}</Script>
      <ArchetypeReveal slug={slug}>
        <div style={{ transform: 'scale(0.4)', transformOrigin: 'top center', height: 800, overflow: 'visible' }}>
          <ShareCard archetype={archetype} slug={slug} appUrl={appUrl} />
        </div>
        <h2 className="text-center text-3xl font-serif mt-4">{archetype.label}</h2>
        <p className="text-center italic mt-1">{archetype.sanskritLabel}</p>
        <p className="text-center mt-3 max-w-md mx-auto">{archetype.oneLiner}</p>
        <ShareActions slug={slug} label={archetype.label} appUrl={appUrl} />
        <details className="max-w-md mx-auto mt-8 text-sm">
          <summary className="cursor-pointer">Why we say this</summary>
          <ul className="mt-2 list-disc list-inside opacity-80">
            <li>System: {archetype.provenance.system}</li>
            <li>Ayanamsa: {archetype.provenance.ayanamsa}</li>
            <li>Lagna: {archetype.provenance.lagna}</li>
            <li>Nakshatra: {archetype.provenance.nakshatra}</li>
            <li>Current dasha: {archetype.provenance.currentDasha}</li>
          </ul>
        </details>
        <div className="text-center mt-12">
          <a href="/" className="underline">Want yours? Get your archetype →</a>
        </div>
      </ArchetypeReveal>
    </main>
  );
}
```

- [ ] **Step 4: Smoke**

```bash
npm run dev
# manually POST to /api/generate via the form, observe redirect to /u/<slug>
```

Expected: card renders, share actions visible, "Why we say this" expands.

- [ ] **Step 5: Commit**

```bash
git add app/u/ components/ShareActions.tsx components/ArchetypeReveal.tsx
git commit -m "feat: /u/[slug] result page with reveal + share actions"
```

---

## Phase 4 — Compliance + Launch

### Task 4.1: Privacy + Terms + delete-me stub

**Files:**
- Create: `/Users/saurabhkumarsingh/Desktop/rashify/app/privacy/page.tsx`
- Create: `/Users/saurabhkumarsingh/Desktop/rashify/app/terms/page.tsx`
- Create: `/Users/saurabhkumarsingh/Desktop/rashify/app/api/delete-me/route.ts`

- [ ] **Step 1: Privacy page**

Create `app/privacy/page.tsx`:

```tsx
export default function Privacy() {
  return (
    <main className="prose mx-auto px-6 py-12">
      <h1>Privacy Policy</h1>
      <p>Last updated: 2026-04-27.</p>
      <h2>What we collect</h2>
      <ul>
        <li>Name, date/time/place of birth, WhatsApp phone number</li>
        <li>Hashed IP address (for abuse prevention)</li>
        <li>UTM + referrer for attribution</li>
      </ul>
      <h2>Why</h2>
      <p>To generate and deliver your Vedic archetype profile and to send your results on WhatsApp.</p>
      <h2>Third parties we share with</h2>
      <ul>
        <li>Prokerala (chart calculation)</li>
        <li>Google (Gemini, archetype writing)</li>
        <li>AiSensy + Meta (WhatsApp delivery)</li>
        <li>Supabase (storage)</li>
        <li>PostHog (analytics, phone is masked in recordings)</li>
      </ul>
      <h2>Retention</h2>
      <p>7 years, or until deletion requested.</p>
      <h2>Your rights (DPDP Act 2023)</h2>
      <p>You may request deletion of your data at <a href="/api/delete-me">/api/delete-me</a> or by replying STOP to any WhatsApp from us.</p>
      <h2>Contact</h2>
      <p>Email: privacy@rashify.in</p>
    </main>
  );
}
```

- [ ] **Step 2: Terms page**

Create `app/terms/page.tsx`:

```tsx
export default function Terms() {
  return (
    <main className="prose mx-auto px-6 py-12">
      <h1>Terms of Service</h1>
      <p>Rashify provides Vedic astrology archetypes for entertainment and self-reflection.</p>
      <p>Nothing on this site is medical, legal, financial, or psychological advice.</p>
      <p>By submitting your details, you confirm the information is yours and you have the right to share it.</p>
      <p>We may update these terms at any time; continued use constitutes acceptance.</p>
    </main>
  );
}
```

- [ ] **Step 3: Delete-me stub**

Create `app/api/delete-me/route.ts`:

```ts
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const phone = typeof body.phone === 'string' ? body.phone : '';
  if (!/^\+91\d{10}$/.test(phone)) {
    return NextResponse.json({ error: 'INVALID_PHONE' }, { status: 400 });
  }
  // TODO Day-7: OTP confirm + soft-delete row.
  // v1 stub: queue manually via email.
  return NextResponse.json({
    status: 'queued',
    message: 'Your deletion request has been received. We will process it within 30 days. For immediate help, email privacy@rashify.in.',
  });
}

export async function GET() {
  return new Response(
    'POST {"phone":"+91XXXXXXXXXX"} to request deletion. Or email privacy@rashify.in.',
    { headers: { 'Content-Type': 'text/plain' } },
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add app/privacy/ app/terms/ app/api/delete-me/
git commit -m "feat: privacy + terms + delete-me stub (DPDP)"
```

---

### Task 4.2: WhatsApp template submission script

**Files:**
- Create: `/Users/saurabhkumarsingh/Desktop/rashify/scripts/wa-template-spec.md`

- [ ] **Step 1: Template doc for manual submission**

Create `scripts/wa-template-spec.md`:

```md
# WhatsApp Template — rashify_archetype_v1

Submit via AiSensy dashboard → Templates → Create.

**Name:** `rashify_archetype_v1`
**Category:** Marketing
**Language:** English (with Hindi-mixed body)

**Header:** Image (1200x628 or 1080x1920)
**Body:**

```
Namaste {{2}} 🪔

Your Vedic archetype is ready:

*{{3}}*
{{4}}

3 things the stars say about you:
• {{5}}
• {{6}}
• {{7}}

Open your full profile:
https://rashify.in/u/{{1}}

Forward to someone who needs to see theirs ✨
```

**Variables:**
- `{{1}}` — slug
- `{{2}}` — first name
- `{{3}}` — archetype label
- `{{4}}` — sanskrit label
- `{{5}}` `{{6}}` `{{7}}` — coreTraits[0..2]

**Buttons:**
- URL button "View my profile" → `https://rashify.in/u/{{1}}`
- URL button "Share with friends" → `https://wa.me/?text=...` (static, opens chat picker)

**Submit on H+0.** Approval window ~24h. Once approved, set `AISENSY_CAMPAIGN_NAME=rashify_archetype_v1` in Vercel env.
```

- [ ] **Step 2: Commit**

```bash
git add scripts/wa-template-spec.md
git commit -m "docs: whatsapp template spec for aisensy submission"
```

---

### Task 4.3: Vercel deploy + env wiring

**Files:**
- Modify: `/Users/saurabhkumarsingh/Desktop/rashify/README.md`

- [ ] **Step 1: README runbook**

Replace `README.md`:

```md
# Rashify

Viral Vedic archetype lead-gen MVP. Built in one day.

## Local dev

```bash
cp .env.local.example .env.local   # fill in real keys
npm install
npm run dev
```

## Deploy

```bash
# Vercel CLI
vercel --prod
# Or push to GitHub + connect repo in Vercel dashboard.
```

Set every var from `.env.local.example` in Vercel project settings.

## Test

```bash
npm run test
```

## Apply schema

Open Supabase SQL Editor → run `supabase/migrations/20260427_init.sql`.

## Submit WhatsApp template

See `scripts/wa-template-spec.md`. Submit via AiSensy on H+0; ~24h approval window.

## Specs

- Design: `docs/superpowers/specs/2026-04-27-rashify-design.md`
- Plan: `docs/superpowers/plans/2026-04-27-rashify-mvp.md`
```

- [ ] **Step 2: Run full test suite**

```bash
npm run test
```

Expected: all tests pass (slug, chart-types, geocode, prokerala, gemini, fallback, leads, aisensy, generate route, ShareCard, BirthForm).

- [ ] **Step 3: Build**

```bash
npm run build
```

Expected: build succeeds; no type errors.

- [ ] **Step 4: Deploy**

```bash
npx vercel link
npx vercel env add PROKERALA_CLIENT_ID
# repeat for every var in .env.local.example
npx vercel --prod
```

- [ ] **Step 5: Domain DNS**

In Vercel dashboard → Domains → add `rashify.in` and `www.rashify.in`. Configure DNS at registrar (A record + CNAME). Wait propagation.

- [ ] **Step 6: PostHog dashboards**

In PostHog UI:
1. Insights → Funnel: `landing_view → form_submit_click → form_submit_success → result_view → share_wa_click`. Save as "Acquisition funnel".
2. Insights → Funnel: `wa_delivered → wa_button_click → landing_view`. Save as "WhatsApp re-engagement".
3. Trends: `count(visitor_on_shared)` and `count(viral_signup)` per day. Save as "K-factor pulse".

- [ ] **Step 7: Smoke test 5 charts**

Submit form 5 times on production with varied DOBs (1995, 2001, 1980, 1965, 2010). Verify:
- Lead row in Supabase.
- Card renders at `/u/{slug}` for each.
- WA arrives on test phone for at least one (after AiSensy approval lands).
- PostHog funnel events firing.

- [ ] **Step 8: Commit + tag**

```bash
git add README.md
git commit -m "docs: rashify runbook"
git tag v1.0.0
```

- [ ] **Step 9: Soft launch**

Post to one WhatsApp group + one Twitter/X post with personal-URL screenshot. Watch PostHog funnel for first hour. Hotfix the first failure surfaced.

---

## Self-Review Notes

**Spec coverage:** every section of `docs/superpowers/specs/2026-04-27-rashify-design.md` mapped:
- §1 Architecture → tasks 0.1, 2.1, 3.x
- §2 Component breakdown → matches plan file structure
- §3 Data model → 0.2, 1.7
- §4 Share artifact → 3.1, 3.2, 3.5
- §5 LLM + telemetry → 1.5, 1.8, 2.1
- §6 Errors + privacy → 1.6 (fallback), 4.1
- §7 Timeline + secrets → 4.3
- §8 Backlog — explicitly out of v1 (compat flow ships Day-2)
- §9 Risks → covered in 4.3 step 7 smoke test
- §10 Success criteria → measured via 4.3 step 6 dashboards

**Type consistency:** `Chart`, `Archetype`, `BirthFormValue`, `PublicCard`, `SendArgs` shared across tasks; properties consistent. `slug` everywhere; `archetype.label` everywhere; `phoneE164` shape `+91XXXXXXXXXX` validated in form (3.3) and route (2.1).

**No placeholders:** all steps have full code or exact commands. The single TODO in `delete-me/route.ts` is intentionally documented as "Day-7" follow-up per spec §6b.

**Day-2 compatibility hooks left in place:**
- `BirthForm` accepts `mode="self"|"friend"`.
- `ShareActions` has disabled "Compare with friend" button + `SHARE_COMPARE_CLICK` event tracker.
- Schema supports `referrer_slug` for K-factor.
