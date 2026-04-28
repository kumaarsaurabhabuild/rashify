# Full Profile + Share-to-Unlock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 5-domain (Career, Health, Love, Wealth, Spiritual) personalized reading to every Rashify profile, gated behind a one-time WhatsApp share. LLM-written at signup via batched call. Async pipeline (Vercel→HF worker→Supabase write→Vercel polls) so it fits free Vercel hobby's 10s budget.

**Architecture:** Vercel `/api/generate` becomes thin fast-path (≤2s): validate, geocode, insert pending row, fire-and-forget HF `/generate-full`, return slug. HF Space (Python+FastAPI, 150s budget) computes chart, calls OpenRouter for ONE batched LLM completion (archetype + 5 teasers + 5 full reads + citations), writes back to Supabase. Vercel result page server-reads row; if pending shows polling component; if ready renders teasers + locked-blur full sections. Click "Unlock" opens WhatsApp intent + POSTs `/api/unlock` (server marks `unlocked_at`, returns full content) + sets localStorage flag → reveal.

**Tech Stack:** Next.js 16, TypeScript, Vitest, Supabase Postgres, FastAPI on HF Space, PyJHora+Swiss Ephemeris, OpenRouter (DeepSeek-chat), supabase-py, PostHog.

**Spec:** `docs/superpowers/specs/2026-04-28-full-profile-design.md`

**Two repos:**
- `/Users/saurabhkumarsingh/Desktop/rashify` — Vercel/Next.js
- `/Users/saurabhkumarsingh/Desktop/rashify-engine` — HF Space/FastAPI

**Test discipline:** TDD where externals are mocked. Live smoke tests after each phase. Frequent commits.

---

## File Structure

### Vercel app (rashify)

```
lib/astro/
  chart-types.ts                 [MODIFY] add DomainSet, FullProfile types
  engine.ts                      [MODIFY] new fetchFullProfile() that triggers /generate-full

lib/db/
  leads.ts                       [MODIFY] new insertPendingProfile, getProfile,
                                          markUnlocked, getFullProfile

lib/telemetry/
  events.ts                      [MODIFY] add 7 new domain/unlock events

app/api/
  generate/route.ts              [REWRITE] fast path → fire HF, return slug
  status/route.ts                [NEW]    GET poll status + teasers when ready
  unlock/route.ts                [NEW]    POST mark unlocked + return full
  cron-stuck/route.ts            [NEW]    cron: re-fire HF for rows pending >2min

app/u/[slug]/
  page.tsx                       [REWRITE] handle pending|ready|failed branches

components/
  PendingReading.tsx             [RESTORE] polling stage UI (was deleted earlier)
  DomainTeasers.tsx              [NEW] grid of 5 teaser cards
  DomainLocked.tsx               [NEW] blurred-fog placeholder for full reads
  DomainFull.tsx                 [NEW] revealed full-section component
  UnlockModal.tsx                [NEW] WA share-to-unlock modal
  HealthDisclaimer.tsx           [NEW] "for reflection only" footnote

supabase/migrations/
  20260428_full_profile.sql      [NEW] columns + views

vercel.json                      [NEW] cron config

app/terms/page.tsx               [MODIFY] DPDP "not medical/legal/financial advice"
                                          + reflection-only line
```

### Engine (rashify-engine)

```
app.py                           [MODIFY] add /generate-full endpoint
src/llm/
  __init__.py                    [NEW]
  openrouter_client.py           [NEW] requests-based OpenRouter call
  domain_prompts.py              [NEW] system prompt + per-domain hint builder
  schema.py                      [NEW] Pydantic schemas for LLM output
src/db/
  __init__.py                    [NEW]
  supabase_writer.py             [NEW] supabase-py client + update lead row
src/insights/
  __init__.py                    [NEW]
  domain_inputs.py               [NEW] derive domain-specific chart facts
                                       (10th lord, 7th lord, dignities, yogas)
requirements.txt                 [MODIFY] add supabase, openai, pydantic-settings
README.md                        [MODIFY] doc /generate-full + new env vars
```

---

## Phase 1 — Backend + Storage

### Task 1.1: Supabase migration

**Files:**
- Create: `/Users/saurabhkumarsingh/Desktop/rashify/supabase/migrations/20260428_full_profile.sql`

- [ ] **Step 1: Write migration SQL**

Create file with:
```sql
-- Full profile: 5 domains × (teaser, full, citations) + unlock tracking.
alter table leads
  add column if not exists domain_teasers jsonb,
  add column if not exists domain_full   jsonb,
  add column if not exists citations     jsonb,
  add column if not exists unlocked_at   timestamptz,
  add column if not exists unlocked_via  text,
  add column if not exists prompt_version int default 1;

-- Replace public_card view to include teasers (always public for SEO + tease).
drop view if exists public_card;
create view public_card as
  select slug, name, archetype, domain_teasers,
         status, error, created_at, referrer_slug
  from leads
  where deleted_at is null;
grant select on public_card to anon;

-- New view: only rows with unlocked_at IS NOT NULL expose domain_full.
drop view if exists unlocked_card;
create view unlocked_card as
  select slug, name, archetype, domain_teasers, domain_full, citations,
         status, created_at
  from leads
  where deleted_at is null and unlocked_at is not null;
grant select on unlocked_card to anon;
```

- [ ] **Step 2: Apply migration via Supabase SQL editor**

Open https://supabase.com/dashboard/project/btukudnzxhgfinguqjmc/sql/new → paste contents of file → Run.

Expected: "Success. No rows returned".

- [ ] **Step 3: Verify columns exist**

In SQL editor:
```sql
select column_name from information_schema.columns
where table_name='leads' and column_name in
  ('domain_teasers','domain_full','citations','unlocked_at','unlocked_via','prompt_version');
```

Expected: 6 rows.

- [ ] **Step 4: Commit**

```bash
cd /Users/saurabhkumarsingh/Desktop/rashify
git add supabase/migrations/20260428_full_profile.sql
git -c commit.gpgsign=false commit -m "chore: full-profile schema migration (domain_teasers + domain_full + unlock)"
```

---

### Task 1.2: Chart-types + Archetype Zod expansion

**Files:**
- Modify: `lib/astro/chart-types.ts`
- Test: `lib/astro/chart-types.test.ts` (existing)

- [ ] **Step 1: Append new types to chart-types.ts**

Add after existing `ArchetypeZ`:

```ts
export const DOMAIN_KEYS = ['career', 'health', 'love', 'wealth', 'spiritual'] as const;
export type DomainKey = typeof DOMAIN_KEYS[number];

const StringRecordZ = z.object({
  career: z.string(),
  health: z.string(),
  love: z.string(),
  wealth: z.string(),
  spiritual: z.string(),
});

const StringArrayRecordZ = z.object({
  career: z.array(z.string()),
  health: z.array(z.string()),
  love: z.array(z.string()),
  wealth: z.array(z.string()),
  spiritual: z.array(z.string()),
});

export const DomainTeasersZ = StringRecordZ;
export const DomainFullZ = StringRecordZ;
export const DomainCitationsZ = StringArrayRecordZ;

export type DomainTeasers = z.infer<typeof DomainTeasersZ>;
export type DomainFull = z.infer<typeof DomainFullZ>;
export type DomainCitations = z.infer<typeof DomainCitationsZ>;

export const FullProfileZ = z.object({
  archetype: ArchetypeZ,
  domain_teasers: DomainTeasersZ,
  domain_full: DomainFullZ,
  citations: DomainCitationsZ,
});
export type FullProfile = z.infer<typeof FullProfileZ>;
```

- [ ] **Step 2: Add tests**

Append to `lib/astro/chart-types.test.ts`:

```ts
import { DomainTeasersZ, DomainFullZ, FullProfileZ } from './chart-types';

describe('Domain schemas', () => {
  const okTeasers = {
    career: 'Strategic builder', health: 'Pitta-strong',
    love: 'Quiet wave', wealth: 'Slow harvest', spiritual: 'Through service',
  };
  it('accepts valid teasers', () => {
    expect(DomainTeasersZ.safeParse(okTeasers).success).toBe(true);
  });
  it('rejects missing domain', () => {
    const { wealth, ...rest } = okTeasers;
    void wealth;
    expect(DomainTeasersZ.safeParse(rest).success).toBe(false);
  });
});
```

- [ ] **Step 3: Run tests**

```bash
cd /Users/saurabhkumarsingh/Desktop/rashify && npm run test lib/astro/chart-types.test.ts
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add lib/astro/chart-types.ts lib/astro/chart-types.test.ts
git -c commit.gpgsign=false commit -m "feat(types): zod schemas for domain teasers/full/citations + FullProfile"
```

---

### Task 1.3: leads.ts — async lifecycle helpers

**Files:**
- Modify: `lib/db/leads.ts`
- Test: `lib/db/leads.test.ts`

- [ ] **Step 1: Replace insertReadyLead with insertPendingProfile + helpers**

Open `lib/db/leads.ts`. Replace whole file with:

```ts
import { serverClient } from './supabase';
import { makeSlug } from '@/lib/slug';

export type LeadStatus = 'pending' | 'processing' | 'ready' | 'failed';

export interface InsertPendingInput {
  name: string;
  phoneE164: string;
  dobDate: string;
  dobTime: string;
  birthPlace: string;
  lat: number;
  lon: number;
  tzOffset: number;
  ipHash: string | null;
  referrerSlug: string | null;
  utm: unknown | null;
}

/* Insert pending row OR return existing fully-ready row's slug for dedupe. */
export async function insertPendingProfile(
  input: InsertPendingInput,
): Promise<{ slug: string; isNew: boolean }> {
  const sb = serverClient();

  const existing = await sb
    .from('leads')
    .select('slug')
    .eq('phone_e164', input.phoneE164)
    .eq('status', 'ready')
    .not('archetype', 'is', null)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing.data?.slug) return { slug: existing.data.slug, isNew: false };

  const slug = makeSlug(input.name);
  const { data, error } = await sb
    .from('leads')
    .insert({
      slug, name: input.name, phone_e164: input.phoneE164,
      dob_date: input.dobDate, dob_time: input.dobTime,
      birth_place: input.birthPlace,
      lat: input.lat, lon: input.lon, tz_offset: input.tzOffset,
      status: 'pending',
      chart_json: null, archetype: null,
      domain_teasers: null, domain_full: null, citations: null,
      referrer_slug: input.referrerSlug, utm: input.utm,
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
  domain_teasers: unknown;
  status: LeadStatus;
  error: string | null;
  created_at: string;
  referrer_slug: string | null;
}

/* Read public_card view — teasers always exposed once status='ready'. */
export async function getCardBySlug(slug: string): Promise<PublicCard | null> {
  const sb = serverClient();
  const { data } = await sb
    .from('public_card')
    .select('slug, name, archetype, domain_teasers, status, error, created_at, referrer_slug')
    .eq('slug', slug)
    .maybeSingle();
  return (data as PublicCard | null) ?? null;
}

export interface UnlockedCard extends PublicCard {
  domain_full: unknown;
  citations: unknown;
}

/* Read unlocked_card view — only rows with unlocked_at set return full content. */
export async function getUnlockedCardBySlug(slug: string): Promise<UnlockedCard | null> {
  const sb = serverClient();
  const { data } = await sb
    .from('unlocked_card')
    .select('slug, name, archetype, domain_teasers, domain_full, citations, status, created_at')
    .eq('slug', slug)
    .maybeSingle();
  return (data as UnlockedCard | null) ?? null;
}

/* Server-side mark: idempotent — only sets unlocked_at if currently null. */
export async function markUnlocked(
  slug: string,
  via: 'wa' | 'ig' | 'copy',
): Promise<{ ok: boolean }> {
  const sb = serverClient();
  const { error } = await sb
    .from('leads')
    .update({ unlocked_at: new Date().toISOString(), unlocked_via: via })
    .eq('slug', slug)
    .is('unlocked_at', null);
  if (error) throw new Error(`UNLOCK_FAILED: ${error.message}`);
  return { ok: true };
}

/* Cron / stuck-row recovery — find rows still pending past a deadline. */
export async function findStuckPending(olderThanMs: number): Promise<Array<{ slug: string; lat: number; lon: number; dobDate: string; dobTime: string; tzOffset: number }>> {
  const sb = serverClient();
  const cutoff = new Date(Date.now() - olderThanMs).toISOString();
  const { data } = await sb
    .from('leads')
    .select('slug, lat, lon, dob_date, dob_time, tz_offset')
    .eq('status', 'pending')
    .lt('created_at', cutoff)
    .limit(20);
  return (data ?? []).map((r) => ({
    slug: r.slug, lat: r.lat, lon: r.lon,
    dobDate: r.dob_date, dobTime: r.dob_time, tzOffset: r.tz_offset,
  }));
}
```

- [ ] **Step 2: Update tests**

Replace `lib/db/leads.test.ts`:

```ts
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
```

- [ ] **Step 3: Run tests**

```bash
npm run test lib/db/leads.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 4: Commit**

```bash
git add lib/db/leads.ts lib/db/leads.test.ts
git -c commit.gpgsign=false commit -m "feat(db): async lifecycle helpers (pending/processing/ready) + unlock + stuck-row finder"
```

---

### Task 1.4: HF engine — domain inputs derivation

**Files:**
- Create: `/Users/saurabhkumarsingh/Desktop/rashify-engine/src/insights/__init__.py` (empty)
- Create: `/Users/saurabhkumarsingh/Desktop/rashify-engine/src/insights/domain_inputs.py`

- [ ] **Step 1: Write domain_inputs.py**

Pure derivation — given the raw chart_calc output, return per-domain hint dicts the LLM consumes.

```python
"""Per-domain chart-fact extractor. Pure functions; no external deps."""
from typing import Any


def _planet_in_house(planets: dict, house: int) -> list[str]:
    return [name for name, info in planets.items() if info.get("house") == house]


def _house_lord(houses: dict, house: int) -> str:
    return houses[str(house)]["lord"]


def _planet_dignity(planets: dict, planet: str) -> str:
    return planets.get(planet, {}).get("dignity", "neutral")


def career_inputs(d1: dict) -> dict[str, Any]:
    """10th house = profession; lagna lord = drive; Saturn = perseverance."""
    p, h = d1["planets"], d1["houses"]
    tenth_lord = _house_lord(h, 10)
    sixth_lord = _house_lord(h, 6)
    eleventh_lord = _house_lord(h, 11)
    return {
        "tenth_house_lord": tenth_lord,
        "tenth_house_lord_dignity": _planet_dignity(p, tenth_lord),
        "tenth_house_planets": _planet_in_house(p, 10),
        "sixth_house_lord": sixth_lord,
        "eleventh_house_lord": eleventh_lord,
        "saturn_dignity": _planet_dignity(p, "saturn"),
        "saturn_house": p.get("saturn", {}).get("house"),
    }


def health_inputs(d1: dict) -> dict[str, Any]:
    """Lagna lord vitality; 6th house disease; nadi from nakshatra."""
    p, h = d1["planets"], d1["houses"]
    lagna_lord = _house_lord(h, 1)
    return {
        "lagna_lord": lagna_lord,
        "lagna_lord_dignity": _planet_dignity(p, lagna_lord),
        "sixth_house_planets": _planet_in_house(p, 6),
        "sixth_house_lord": _house_lord(h, 6),
        "mars_dignity": _planet_dignity(p, "mars"),
        "saturn_house": p.get("saturn", {}).get("house"),
        "moon_nakshatra": p.get("moon", {}).get("nakshatra"),
    }


def love_inputs(d1: dict) -> dict[str, Any]:
    """7th house partner; Venus desire; 5th romance; mangal dosha tension."""
    p, h = d1["planets"], d1["houses"]
    seventh_lord = _house_lord(h, 7)
    return {
        "seventh_house_lord": seventh_lord,
        "seventh_house_lord_dignity": _planet_dignity(p, seventh_lord),
        "seventh_house_planets": _planet_in_house(p, 7),
        "venus_dignity": _planet_dignity(p, "venus"),
        "venus_house": p.get("venus", {}).get("house"),
        "mars_house": p.get("mars", {}).get("house"),
        "fifth_house_planets": _planet_in_house(p, 5),
    }


def wealth_inputs(d1: dict) -> dict[str, Any]:
    """2nd accumulated wealth; 11th gains; Jupiter blessings."""
    p, h = d1["planets"], d1["houses"]
    second_lord = _house_lord(h, 2)
    eleventh_lord = _house_lord(h, 11)
    return {
        "second_house_lord": second_lord,
        "second_house_lord_dignity": _planet_dignity(p, second_lord),
        "eleventh_house_lord": eleventh_lord,
        "eleventh_house_lord_dignity": _planet_dignity(p, eleventh_lord),
        "jupiter_dignity": _planet_dignity(p, "jupiter"),
        "jupiter_house": p.get("jupiter", {}).get("house"),
        "second_house_planets": _planet_in_house(p, 2),
    }


def spiritual_inputs(d1: dict) -> dict[str, Any]:
    """12th moksha; Ketu detachment; 9th dharma."""
    p, h = d1["planets"], d1["houses"]
    twelfth_lord = _house_lord(h, 12)
    ninth_lord = _house_lord(h, 9)
    return {
        "twelfth_house_lord": twelfth_lord,
        "twelfth_house_planets": _planet_in_house(p, 12),
        "ninth_house_lord": ninth_lord,
        "ninth_house_lord_dignity": _planet_dignity(p, ninth_lord),
        "ketu_house": p.get("ketu", {}).get("house"),
        "jupiter_dignity": _planet_dignity(p, "jupiter"),
    }


def all_domain_inputs(d1: dict) -> dict[str, dict[str, Any]]:
    """Bundle all 5 domains for LLM consumption."""
    return {
        "career": career_inputs(d1),
        "health": health_inputs(d1),
        "love": love_inputs(d1),
        "wealth": wealth_inputs(d1),
        "spiritual": spiritual_inputs(d1),
    }
```

Also create `/Users/saurabhkumarsingh/Desktop/rashify-engine/src/insights/__init__.py` empty.

- [ ] **Step 2: Add unit test**

Create `/Users/saurabhkumarsingh/Desktop/rashify-engine/tests/__init__.py` empty + `/Users/saurabhkumarsingh/Desktop/rashify-engine/tests/test_domain_inputs.py`:

```python
from src.insights.domain_inputs import all_domain_inputs


def _fake_d1():
    return {
        "planets": {
            "sun":     {"sign": "Karka", "house": 9,  "dignity": "neutral",      "nakshatra": "Pushya"},
            "moon":    {"sign": "Meena", "house": 5,  "dignity": "friend_sign",  "nakshatra": "Revati"},
            "mars":    {"sign": "Kanya", "house": 11, "dignity": "neutral"},
            "mercury": {"sign": "Simha", "house": 10, "dignity": "neutral"},
            "jupiter": {"sign": "Vrischika","house": 1, "dignity": "friend_sign"},
            "venus":   {"sign": "Karka", "house": 9,  "dignity": "friend_sign"},
            "saturn":  {"sign": "Kumbha","house": 4,  "dignity": "own_sign"},
            "rahu":    {"sign": "Tula",  "house": 12, "dignity": "neutral"},
            "ketu":    {"sign": "Mesha", "house": 6,  "dignity": "neutral"},
        },
        "houses": {
            "1":  {"sign": "Vrischika", "lord": "mars"},
            "2":  {"sign": "Dhanu",     "lord": "jupiter"},
            "5":  {"sign": "Meena",     "lord": "jupiter"},
            "6":  {"sign": "Mesha",     "lord": "mars"},
            "7":  {"sign": "Vrishabha", "lord": "venus"},
            "9":  {"sign": "Karka",     "lord": "moon"},
            "10": {"sign": "Simha",     "lord": "sun"},
            "11": {"sign": "Kanya",     "lord": "mercury"},
            "12": {"sign": "Tula",      "lord": "venus"},
        },
    }


def test_all_domain_inputs_has_5_keys():
    out = all_domain_inputs(_fake_d1())
    assert set(out.keys()) == {"career", "health", "love", "wealth", "spiritual"}


def test_career_picks_10th_lord():
    out = all_domain_inputs(_fake_d1())
    assert out["career"]["tenth_house_lord"] == "sun"
    assert out["career"]["saturn_dignity"] == "own_sign"


def test_love_picks_7th_lord_and_venus():
    out = all_domain_inputs(_fake_d1())
    assert out["love"]["seventh_house_lord"] == "venus"
    assert out["love"]["venus_house"] == 9


def test_spiritual_picks_12th_and_ketu():
    out = all_domain_inputs(_fake_d1())
    assert out["spiritual"]["twelfth_house_lord"] == "venus"
    assert out["spiritual"]["ketu_house"] == 6
```

- [ ] **Step 3: Run tests**

```bash
cd /Users/saurabhkumarsingh/Desktop/rashify-engine
source .venv/bin/activate
pip install pytest >/dev/null
PYTHONPATH=. pytest tests/test_domain_inputs.py -v
```

Expected: 4 passed.

- [ ] **Step 4: Commit**

```bash
git add src/insights/__init__.py src/insights/domain_inputs.py tests/__init__.py tests/test_domain_inputs.py
git -c commit.gpgsign=false commit -m "feat(insights): per-domain chart-fact extractor for 5 life domains"
```

---

### Task 1.5: HF engine — OpenRouter client

**Files:**
- Create: `src/llm/__init__.py` (empty)
- Create: `src/llm/openrouter_client.py`

- [ ] **Step 1: Write openrouter_client.py**

```python
"""OpenAI-compatible OpenRouter call. Single completion + JSON validation."""
import json
import time
from typing import Any

import requests


OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_MODEL = "deepseek/deepseek-chat"


class LLMError(Exception):
    """Raised on persistent LLM failure (4xx after retry, 5xx after retries)."""


def _is_transient(status: int) -> bool:
    return status == 429 or status >= 500


def call_llm(
    *,
    api_key: str,
    system_prompt: str,
    user_message: str,
    model: str = DEFAULT_MODEL,
    referer: str = "https://rashify.in",
    title: str = "Rashify",
    max_tokens: int = 6000,
    temperature: float = 0.7,
) -> str:
    """Call OpenRouter; retry transient 429/5xx up to 2 times w/ backoff."""
    body = {
        "model": model,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": referer,
        "X-Title": title,
    }
    backoffs = [0.8, 2.5]
    for attempt in range(1 + len(backoffs)):
        res = requests.post(OPENROUTER_URL, json=body, headers=headers, timeout=90)
        if res.ok:
            data = res.json()
            return data["choices"][0]["message"]["content"]
        if not _is_transient(res.status_code):
            raise LLMError(f"LLM_HTTP_{res.status_code}: {res.text[:200]}")
        if attempt < len(backoffs):
            time.sleep(backoffs[attempt])
    raise LLMError(f"LLM_HTTP_{res.status_code}_after_retries: {res.text[:200]}")


def parse_json_or_raise(raw: str) -> dict[str, Any]:
    try:
        return json.loads(raw)
    except json.JSONDecodeError as e:
        raise LLMError(f"LLM_BAD_JSON: {e}; first200={raw[:200]}")
```

- [ ] **Step 2: Add tests**

Create `tests/test_openrouter_client.py`:

```python
import pytest
from unittest.mock import patch, MagicMock
from src.llm.openrouter_client import call_llm, parse_json_or_raise, LLMError


@patch("src.llm.openrouter_client.requests.post")
def test_call_llm_happy(mock_post):
    mock_post.return_value = MagicMock(
        ok=True, status_code=200,
        json=lambda: {"choices": [{"message": {"content": '{"ok": true}'}}]},
    )
    out = call_llm(api_key="k", system_prompt="s", user_message="u")
    assert out == '{"ok": true}'


@patch("src.llm.openrouter_client.requests.post")
def test_call_llm_retry_then_succeed(mock_post):
    mock_post.side_effect = [
        MagicMock(ok=False, status_code=504, text="busy"),
        MagicMock(ok=True, status_code=200,
                  json=lambda: {"choices": [{"message": {"content": "ok"}}]}),
    ]
    out = call_llm(api_key="k", system_prompt="s", user_message="u")
    assert out == "ok"


@patch("src.llm.openrouter_client.requests.post")
def test_call_llm_4xx_no_retry(mock_post):
    mock_post.return_value = MagicMock(ok=False, status_code=400, text="bad input")
    with pytest.raises(LLMError, match="LLM_HTTP_400"):
        call_llm(api_key="k", system_prompt="s", user_message="u")


def test_parse_json_valid():
    assert parse_json_or_raise('{"a": 1}') == {"a": 1}


def test_parse_json_bad():
    with pytest.raises(LLMError, match="LLM_BAD_JSON"):
        parse_json_or_raise("not json")
```

- [ ] **Step 3: Run**

```bash
cd /Users/saurabhkumarsingh/Desktop/rashify-engine && source .venv/bin/activate
PYTHONPATH=. pytest tests/test_openrouter_client.py -v
```

Expected: 5 passed.

- [ ] **Step 4: Commit**

```bash
git add src/llm/__init__.py src/llm/openrouter_client.py tests/test_openrouter_client.py
git -c commit.gpgsign=false commit -m "feat(llm): OpenRouter client with retry + JSON parse"
```

---

### Task 1.6: HF engine — domain prompt + LLM schema

**Files:**
- Create: `src/llm/domain_prompts.py`
- Create: `src/llm/schema.py`

- [ ] **Step 1: Write schema.py**

```python
"""Pydantic models for LLM JSON output validation."""
from pydantic import BaseModel, Field, field_validator


class ProvenanceOut(BaseModel):
    ayanamsa: str
    system: str
    nakshatra: str
    lagna: str
    currentDasha: str


class ArchetypeOut(BaseModel):
    label: str
    sanskritLabel: str
    coreTraits: list[str]
    strengths: list[str]
    growthEdges: list[str]
    luckyColor: str
    luckyNumber: int = Field(ge=1, le=9)
    powerWindow: str
    oneLiner: str
    provenance: ProvenanceOut

    @field_validator("coreTraits")
    @classmethod
    def _three_traits(cls, v: list[str]) -> list[str]:
        if len(v) != 3:
            raise ValueError("coreTraits must have exactly 3 entries")
        return v

    @field_validator("strengths")
    @classmethod
    def _three_strengths(cls, v: list[str]) -> list[str]:
        if len(v) != 3:
            raise ValueError("strengths must have exactly 3 entries")
        return v

    @field_validator("growthEdges")
    @classmethod
    def _two_edges(cls, v: list[str]) -> list[str]:
        if len(v) != 2:
            raise ValueError("growthEdges must have exactly 2 entries")
        return v


class DomainSet(BaseModel):
    career: str
    health: str
    love: str
    wealth: str
    spiritual: str


class DomainCitations(BaseModel):
    career: list[str]
    health: list[str]
    love: list[str]
    wealth: list[str]
    spiritual: list[str]


class FullProfile(BaseModel):
    archetype: ArchetypeOut
    domain_teasers: DomainSet
    domain_full: DomainSet
    citations: DomainCitations
```

- [ ] **Step 2: Write domain_prompts.py**

```python
"""System prompt + user-message builder for the batched full-profile call."""
import json
from typing import Any


SYSTEM_PROMPT = """You are a Vedic astrologer + modern personality writer. You receive a sidereal natal chart JSON plus per-domain hint blocks. You output ONE JSON object containing:

  {
    "archetype": <existing archetype card>,
    "domain_teasers": {career, health, love, wealth, spiritual} → 1 sentence each,
    "domain_full":    {career, health, love, wealth, spiritual} → 3 paragraphs each,
    "citations":      {career, health, love, wealth, spiritual} → 2-3 chart-fact strings
  }

Constraints:
- Output VALID JSON only. No prose outside JSON. No markdown fences.
- Voice: reverent + data-grounded. Sanskrit terms allowed, paired with English.
- NO sycophancy. NO generic horoscope filler. Specifics or nothing.
- Cite specific chart facts (planet placements, dignities, dasha periods, yogas).
- Behavioral, falsifiable claims — not flattering.
- Tone: Astrotalk meets The Pattern. Mystical + scientific.

Per-domain rules:
- TEASERS: 1 sentence, ≤80 chars, posed as a hook/question. Make the reader curious.
- FULL: 3 paragraphs. ~600 words total. Cite specific chart facts. Each paragraph
  = one specific claim grounded in the chart.
- CITATIONS: 2-3 short strings each (e.g. "Saturn in 4th, own sign", "Venus-Ketu mahadasha 2024-29").

Health domain: include disclaimer language naturally — frame as tendencies/awareness, not medical advice.

archetype follows the existing schema (label 2-5 words, sanskritLabel romanized,
coreTraits exactly 3, strengths exactly 3, growthEdges exactly 2, luckyNumber 1-9,
powerWindow time range IST, oneLiner ≤120 chars, provenance from input).
"""


def build_user_message(
    chart: dict[str, Any],
    domain_inputs: dict[str, dict[str, Any]],
    first_name: str,
) -> str:
    """Compose the user message: chart + domain hints + first name."""
    payload = {
        "chart": chart,
        "domain_hints": domain_inputs,
        "first_name": first_name,
    }
    return f"Build a full Vedic profile for the following chart:\n\n{json.dumps(payload, indent=2)}\n\nReturn the JSON object as specified."
```

- [ ] **Step 3: Add tests**

Create `tests/test_schema.py`:

```python
import pytest
from src.llm.schema import FullProfile, ArchetypeOut


def _ok_archetype():
    return {
        "label": "The Slow Architect", "sanskritLabel": "Karma-Yoga Tantri",
        "coreTraits": ["a", "b", "c"], "strengths": ["x", "y", "z"],
        "growthEdges": ["p", "q"], "luckyColor": "indigo", "luckyNumber": 7,
        "powerWindow": "10 PM - 2 AM", "oneLiner": "test",
        "provenance": {"ayanamsa": "Lahiri", "system": "Vedic sidereal",
                       "nakshatra": "Anuradha", "lagna": "Vrishabha",
                       "currentDasha": "Saturn-Venus"},
    }


def test_archetype_strict_lengths():
    ArchetypeOut(**_ok_archetype())


def test_archetype_rejects_4_traits():
    bad = _ok_archetype()
    bad["coreTraits"] = ["a", "b", "c", "d"]
    with pytest.raises(Exception):
        ArchetypeOut(**bad)


def test_full_profile_complete():
    payload = {
        "archetype": _ok_archetype(),
        "domain_teasers": {"career": "1", "health": "2", "love": "3", "wealth": "4", "spiritual": "5"},
        "domain_full":    {"career": "1", "health": "2", "love": "3", "wealth": "4", "spiritual": "5"},
        "citations":      {"career": ["a"], "health": ["b"], "love": ["c"], "wealth": ["d"], "spiritual": ["e"]},
    }
    p = FullProfile(**payload)
    assert p.domain_teasers.career == "1"
```

- [ ] **Step 4: Run**

```bash
cd /Users/saurabhkumarsingh/Desktop/rashify-engine && source .venv/bin/activate
PYTHONPATH=. pytest tests/test_schema.py -v
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/llm/domain_prompts.py src/llm/schema.py tests/test_schema.py
git -c commit.gpgsign=false commit -m "feat(llm): batched full-profile prompt + Pydantic schema"
```

---

### Task 1.7: HF engine — Supabase writer

**Files:**
- Create: `src/db/__init__.py` (empty)
- Create: `src/db/supabase_writer.py`

- [ ] **Step 1: Add supabase to requirements + install**

Modify `requirements.txt`, append:
```
supabase>=2.7.0
```

```bash
cd /Users/saurabhkumarsingh/Desktop/rashify-engine && source .venv/bin/activate
pip install "supabase>=2.7.0"
```

- [ ] **Step 2: Write supabase_writer.py**

```python
"""Supabase row updater for the engine — writes back full profile post-LLM."""
from typing import Any

from supabase import Client, create_client


def make_client(url: str, service_key: str) -> Client:
    return create_client(url, service_key)


def update_profile(
    client: Client,
    *,
    slug: str,
    chart_json: dict[str, Any],
    archetype: dict[str, Any],
    domain_teasers: dict[str, str],
    domain_full: dict[str, str],
    citations: dict[str, list[str]],
) -> None:
    """Mark row ready and populate all generated content."""
    res = client.table("leads").update({
        "status": "ready",
        "chart_json": chart_json,
        "archetype": archetype,
        "domain_teasers": domain_teasers,
        "domain_full": domain_full,
        "citations": citations,
        "error": None,
    }).eq("slug", slug).execute()
    if hasattr(res, "error") and res.error:
        raise RuntimeError(f"SUPABASE_UPDATE_FAILED: {res.error}")


def mark_failed(client: Client, *, slug: str, error_msg: str) -> None:
    client.table("leads").update({
        "status": "failed",
        "error": error_msg[:500],
    }).eq("slug", slug).execute()
```

- [ ] **Step 3: Commit**

```bash
git add src/db/__init__.py src/db/supabase_writer.py requirements.txt
git -c commit.gpgsign=false commit -m "feat(db): supabase writer to update lead row from engine"
```

---

### Task 1.8: HF engine — `/generate-full` endpoint

**Files:**
- Modify: `app.py`

- [ ] **Step 1: Append the endpoint to app.py**

Open `app.py`, after the existing `chart()` route, add imports at the top of the file:

```python
import os
import threading
from src.insights.domain_inputs import all_domain_inputs
from src.llm.openrouter_client import call_llm, parse_json_or_raise, LLMError
from src.llm.domain_prompts import SYSTEM_PROMPT, build_user_message
from src.llm.schema import FullProfile
from src.db.supabase_writer import make_client, update_profile, mark_failed
```

Add a new request model:

```python
class GenerateFullRequest(BaseModel):
    slug: str
    birth_date: str
    birth_time: str
    lat: float
    lon: float
```

Add the endpoint:

```python
@app.post("/generate-full")
def generate_full(req: GenerateFullRequest):
    """Background-style endpoint. Vercel fires this fire-and-forget; we still
    must return promptly because the calling Vercel function has a 10s budget.
    Run heavy work on a thread and return immediately."""
    threading.Thread(target=_do_full_pipeline, args=(req,), daemon=True).start()
    return {"queued": True, "slug": req.slug}


def _do_full_pipeline(req: GenerateFullRequest):
    """Run on background thread. Self-recovers on error by writing failed status."""
    sb_url = os.environ.get("SUPABASE_URL", "")
    sb_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    or_key = os.environ.get("OPENROUTER_API_KEY", "")
    or_model = os.environ.get("OPENROUTER_MODEL", "deepseek/deepseek-chat")

    if not sb_url or not sb_key or not or_key:
        # No client to mark failed — just log; cron will requeue.
        print(f"[generate-full] Missing env for slug={req.slug}")
        return

    sb = make_client(sb_url, sb_key)

    try:
        # 1. Compute chart (existing logic)
        location = f"{req.lat},{req.lon}"
        vc = VedicChart(birth_date=req.birth_date, birth_time=req.birth_time, location=location)
        d = vc.calculate()
        chart_json = _to_chart_out(d["d1"], vc.timezone_offset, vc.location_raw).model_dump()

        # 2. Build per-domain hints
        hints = all_domain_inputs(d["d1"])

        # 3. LLM call
        first_name = "Friend"  # we don't have name in this endpoint; use generic
        user_msg = build_user_message(chart_json, hints, first_name)
        raw = call_llm(api_key=or_key, system_prompt=SYSTEM_PROMPT,
                       user_message=user_msg, model=or_model, max_tokens=6000)
        parsed = FullProfile(**parse_json_or_raise(raw))

        # 4. Patch provenance from real chart data (LLM may hallucinate)
        prov = parsed.archetype.provenance
        prov.ayanamsa = chart_json["ayanamsa"]
        prov.lagna = chart_json["ascendant"]["rasi"]
        prov.nakshatra = chart_json["nakshatra"]["name"]
        cd = chart_json.get("current_dasha")
        prov.currentDasha = (
            f"{cd['mahadasha']}-{cd['antardasha']}" if cd else "Unknown"
        )

        # 5. Map to camelCase Archetype shape Vercel expects
        archetype_out = parsed.archetype.model_dump()

        # 6. Write to Supabase
        update_profile(
            sb,
            slug=req.slug,
            chart_json=chart_json,
            archetype=archetype_out,
            domain_teasers=parsed.domain_teasers.model_dump(),
            domain_full=parsed.domain_full.model_dump(),
            citations=parsed.citations.model_dump(),
        )
    except LLMError as e:
        mark_failed(sb, slug=req.slug, error_msg=f"LLM:{e}")
    except ValueError as e:
        mark_failed(sb, slug=req.slug, error_msg=f"VALIDATION:{e}")
    except Exception as e:
        mark_failed(sb, slug=req.slug, error_msg=f"UNKNOWN:{e}")
```

- [ ] **Step 2: Add a smoke test stub locally**

Run engine locally (.venv active):

```bash
SUPABASE_URL=https://btukudnzxhgfinguqjmc.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<SUPABASE_SERVICE_ROLE_KEY> \
OPENROUTER_API_KEY=<OPENROUTER_API_KEY> \
OPENROUTER_MODEL=deepseek/deepseek-chat \
uvicorn app:app --port 8080
```

In another shell, first INSERT a pending row in Supabase SQL editor:
```sql
insert into leads
  (slug, name, phone_e164, dob_date, dob_time, birth_place,
   lat, lon, tz_offset, status, consent_at)
values
  ('smoke-full-1', 'Smoke', '+919900000099', '1995-08-15', '14:30:00',
   'Mumbai', 19.054999, 72.869204, 330, 'pending', now());
```

Then:
```bash
curl -X POST http://localhost:8080/generate-full \
  -H 'Content-Type: application/json' \
  -d '{"slug":"smoke-full-1","birth_date":"1995-08-15","birth_time":"14:30","lat":19.054999,"lon":72.869204}'
```

Expected immediate: `{"queued": true, "slug": "smoke-full-1"}`.

Wait ~30s, query Supabase:
```sql
select status, archetype->>'label' as label,
       domain_teasers->>'career' as career_teaser,
       length(domain_full->>'career') as career_full_chars
from leads where slug='smoke-full-1';
```

Expected: status='ready', non-null teaser, full > 1500 chars.

- [ ] **Step 3: Commit**

```bash
cd /Users/saurabhkumarsingh/Desktop/rashify-engine
git add app.py
git -c commit.gpgsign=false commit -m "feat(engine): /generate-full async endpoint — chart + LLM + Supabase write"
```

---

### Task 1.9: HF engine — push + add env vars to Space

**Files:** none

- [ ] **Step 1: Push to HF Space**

```bash
cd /Users/saurabhkumarsingh/Desktop/rashify-engine
git push https://kumaarsaurabh:<HF_TOKEN>@huggingface.co/spaces/kumaarsaurabh/rashify-engine main
```

(Use your HF write token; rotate after.)

- [ ] **Step 2: Set Space env vars**

In HF Space UI: **Settings** → **Variables and secrets** → **New secret**:

| Key | Value |
|---|---|
| `SUPABASE_URL` | `https://btukudnzxhgfinguqjmc.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | `<SUPABASE_SERVICE_ROLE_KEY>` |
| `OPENROUTER_API_KEY` | `sk-or-v1-...` |
| `OPENROUTER_MODEL` | `deepseek/deepseek-chat` |

Save. Space rebuilds (~3 min).

- [ ] **Step 3: Live smoke**

After Space is back to "Running":
```bash
curl -X POST https://kumaarsaurabh-rashify-engine.hf.space/generate-full \
  -H 'Content-Type: application/json' \
  -d '{"slug":"smoke-prod-1","birth_date":"1995-08-15","birth_time":"14:30","lat":19.054999,"lon":72.869204}'
```

(First insert a pending row with `slug='smoke-prod-1'` in Supabase as in 1.8.)

Expected: 200 + `queued: true`. Wait ~30s. Verify status=ready in Supabase.

- [ ] **Step 4: Rotate HF token**

https://huggingface.co/settings/tokens → invalidate the deploy token used.

---

### Task 1.10: Vercel — fire-and-forget HF + status endpoint

**Files:**
- Rewrite: `app/api/generate/route.ts`
- Modify: `lib/astro/engine.ts` (add `triggerFullProfile`)
- Create: `app/api/status/route.ts`
- Modify: `app/api/generate/route.test.ts`

- [ ] **Step 1: Add trigger to engine.ts**

Replace `lib/astro/engine.ts`:

```ts
import type { Chart, Planet } from './chart-types';

const DEFAULT_URL = 'http://localhost:8080';

export interface ChartInput {
  birthDate: string;
  birthTime: string;
  lat: number;
  lon: number;
}

interface PlanetRaw {
  name: string; rasi: string; rasi_lord: string;
  house: number; degree: number; is_retrograde: boolean;
}
interface ChartRaw {
  ayanamsa: string;
  nakshatra: { name: string; pada: number; lord: string };
  moon_sign: string;
  sun_sign: string;
  ascendant: PlanetRaw;
  planets: PlanetRaw[];
  current_dasha: { mahadasha: string; antardasha: string; start: string; end: string } | null;
  active_yogas: string[];
  mangal_dosha: boolean;
  tz_offset: number;
}

function toPlanet(p: PlanetRaw): Planet {
  return {
    name: p.name, rasi: p.rasi, rasiLord: p.rasi_lord,
    house: p.house, degree: p.degree, isRetrograde: p.is_retrograde,
  };
}

function toChart(raw: ChartRaw): Chart {
  return {
    ayanamsa: raw.ayanamsa,
    nakshatra: raw.nakshatra,
    moonSign: raw.moon_sign,
    sunSign: raw.sun_sign,
    ascendant: toPlanet(raw.ascendant),
    planets: raw.planets.map(toPlanet),
    currentDasha: raw.current_dasha,
    activeYogas: raw.active_yogas,
    mangalDosha: raw.mangal_dosha,
    additionalInfo: {
      luckyColor: 'Unknown', bestDirection: 'Unknown',
      deity: 'Unknown', animalSign: 'Unknown', birthStone: 'Unknown',
    },
    tzOffset: raw.tz_offset,
  };
}

function engineUrl(): string {
  return (process.env.CHART_ENGINE_URL ?? DEFAULT_URL).replace(/\/$/, '');
}

export async function fetchChart(input: ChartInput): Promise<Chart> {
  const res = await fetch(`${engineUrl()}/chart`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      birth_date: input.birthDate, birth_time: input.birthTime,
      lat: input.lat, lon: input.lon,
    }),
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`ENGINE_${res.status}: ${body.slice(0, 200)}`);
  }
  return toChart((await res.json()) as ChartRaw);
}

/** Fire-and-forget the heavy /generate-full endpoint. Don't await response. */
export async function triggerFullProfile(input: ChartInput & { slug: string }): Promise<void> {
  // Use a short timeout so we don't block /api/generate if HF is slow.
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 3000);
  try {
    await fetch(`${engineUrl()}/generate-full`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: input.slug, birth_date: input.birthDate, birth_time: input.birthTime,
        lat: input.lat, lon: input.lon,
      }),
      signal: controller.signal,
    });
  } catch {
    // Even if our trigger times out, HF likely received and started the thread.
    // Cron checker will catch any truly stuck rows.
  } finally {
    clearTimeout(t);
  }
}
```

- [ ] **Step 2: Rewrite /api/generate**

Replace `app/api/generate/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { geocode } from '@/lib/astro/geocode';
import { triggerFullProfile } from '@/lib/astro/engine';
import { insertPendingProfile } from '@/lib/db/leads';
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
  utm: z.record(z.string(), z.string()).optional().nullable(),
  consent: z.literal(true),
  turnstileToken: z.string(),
});

export const runtime = 'nodejs';
export const maxDuration = 10;

export async function POST(req: Request): Promise<Response> {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  const ipH = ip ? ipHash(ip) : null;

  let parsed;
  try { parsed = ReqZ.safeParse(await req.json()); }
  catch { return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 }); }
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

  try {
    const geo = await geocode(body.birthPlace);

    const { slug, isNew } = await insertPendingProfile({
      name: body.name, phoneE164: body.phoneE164,
      dobDate: body.dobDate, dobTime: body.dobTime, birthPlace: body.birthPlace,
      lat: geo.lat, lon: geo.lon, tzOffset: geo.tzOffset,
      ipHash: ipH, referrerSlug: body.referrerSlug ?? null, utm: body.utm ?? null,
    });

    if (isNew) {
      // Fire-and-forget HF; don't await full pipeline
      triggerFullProfile({
        slug, birthDate: body.dobDate, birthTime: body.dobTime,
        lat: geo.lat, lon: geo.lon,
      }).catch(() => { /* swallow — cron handles stuck */ });
      trackServer(slug, Events.GEN_PIPELINE_START, { isNew: true });
    }

    await flushTelemetry();
    return NextResponse.json({ slug, isNew, status: isNew ? 'pending' : 'ready' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'UNKNOWN';
    if (msg === 'GEOCODE_FAILED') {
      return NextResponse.json({ error: 'GEOCODE_FAILED' }, { status: 400 });
    }
    return NextResponse.json({ error: 'INTERNAL' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Create /api/status**

`app/api/status/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { getCardBySlug } from '@/lib/db/leads';

export const runtime = 'nodejs';
export const maxDuration = 5;

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const slug = url.searchParams.get('slug');
  if (!slug) return NextResponse.json({ error: 'MISSING_SLUG' }, { status: 400 });

  const card = await getCardBySlug(slug);
  if (!card) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

  return NextResponse.json({
    slug: card.slug, status: card.status, error: card.error,
    archetype: card.status === 'ready' ? card.archetype : null,
    domain_teasers: card.status === 'ready' ? card.domain_teasers : null,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
```

- [ ] **Step 4: Update generate route test**

Replace `app/api/generate/route.test.ts`:

```ts
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
```

- [ ] **Step 5: Run all Vercel tests**

```bash
cd /Users/saurabhkumarsingh/Desktop/rashify && npm run test
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add lib/astro/engine.ts app/api/generate/route.ts app/api/status/route.ts app/api/generate/route.test.ts
git -c commit.gpgsign=false commit -m "feat(api): async pipeline — fire HF /generate-full + status polling endpoint"
```

---

## Phase 2 — UI (consume backend outputs)

### Task 2.1: PendingReading restore + result page handles status

**Files:**
- Create: `components/PendingReading.tsx`
- Modify: `app/u/[slug]/page.tsx`

- [ ] **Step 1: PendingReading**

Create `components/PendingReading.tsx`:

```tsx
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const STAGES = [
  { at: 0,    label: 'Aligning the heavens' },
  { at: 5000, label: 'Reading your nakshatra' },
  { at: 12000, label: 'Tracing your dasha' },
  { at: 22000, label: 'Writing your full reading' },
  { at: 45000, label: 'The words are settling' },
];

export function PendingReading({ slug }: { slug: string }) {
  const router = useRouter();
  const [stage, setStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const startedAt = useState(() => Date.now())[0];

  useEffect(() => {
    const id = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      setStage(STAGES.reduce((acc, s, i) => (elapsed >= s.at ? i : acc), 0));
    }, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/status?slug=${slug}`, { cache: 'no-store' });
        if (!res.ok) return;
        const j = await res.json();
        if (cancelled) return;
        if (j.status === 'ready') router.refresh();
        else if (j.status === 'failed') setError(j.error ?? 'INTERNAL');
      } catch { /* network blip */ }
    };
    poll();
    const id = setInterval(poll, 2000);
    return () => { cancelled = true; clearInterval(id); };
  }, [slug, router]);

  if (error) {
    return (
      <div style={{ textAlign: 'center', maxWidth: 480, margin: '0 auto' }}>
        <span className="eyebrow" style={{ color: '#a35a23' }}>Reading could not complete</span>
        <h2 className="font-display" style={{ fontSize: 36, marginTop: 16, fontWeight: 400 }}>
          The stars are quiet right now.
        </h2>
        <a href="/" className="btn-primary" style={{ marginTop: 24, display: 'inline-flex', maxWidth: 320 }}>
          Begin a new reading
        </a>
      </div>
    );
  }

  return (
    <div style={{ textAlign: 'center', maxWidth: 520, margin: '0 auto' }}>
      <span className="eyebrow reveal reveal-1">A reading is being prepared</span>
      <h2
        className="font-display reveal reveal-2"
        style={{ fontSize: 'clamp(32px, 4.5vw, 48px)', fontWeight: 400, fontStyle: 'italic',
                 margin: '20px 0 28px', color: 'var(--ink)' }}
      >
        {STAGES[stage].label}<span className="ellipsis-anim">…</span>
      </h2>
      <ol style={{ listStyle: 'none', padding: 0, margin: '0 auto', maxWidth: 360,
                   display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'left' }}>
        {STAGES.map((s, i) => (
          <li key={s.label} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            fontFamily: 'var(--font-ui)', fontSize: 13, letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: i <= stage ? 'var(--gold)' : 'var(--ink-fade)',
            opacity: i <= stage ? 1 : 0.5,
            transition: 'all 0.4s var(--ease-quill)',
          }}>
            <span aria-hidden style={{ width: 18 }}>
              {i < stage ? '✓' : i === stage ? '◆' : '○'}
            </span>
            {s.label}
          </li>
        ))}
      </ol>
      <p className="reveal reveal-4" style={{ marginTop: 32, fontStyle: 'italic',
        fontSize: 15, color: 'var(--ink-fade)', maxWidth: 400, marginInline: 'auto' }}>
        Vedic computation is unhurried. A full reading takes 30 to 60 seconds.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Modify result page to handle status**

In `app/u/[slug]/page.tsx`, near top imports add:
```tsx
import { PendingReading } from '@/components/PendingReading';
```

Right after `if (!card) notFound();` block, before the `parsed = ArchetypeZ.safeParse...` line, add:

```tsx
  if (card.status === 'pending' || card.status === 'processing' || card.status === 'failed') {
    return (
      <main className="min-h-screen flex flex-col">
        <header className="flex items-center justify-between py-6 sm:py-8"
                style={{ paddingInline: 'clamp(20px, 5vw, 56px)' }}>
          <BrandMark size="md" />
          <a href="/" className="eyebrow"
             style={{ color: 'var(--ink-fade)', textDecoration: 'none' }}>
            ← <span className="hidden sm:inline">Begin a new reading</span><span className="sm:hidden">New</span>
          </a>
        </header>
        <article className="flex-1 flex items-center justify-center px-6 py-12">
          <PendingReading slug={slug} />
        </article>
      </main>
    );
  }
```

- [ ] **Step 3: Run + commit**

```bash
npm run test && npm run build
git add components/PendingReading.tsx app/u/[slug]/page.tsx
git -c commit.gpgsign=false commit -m "feat(ui): restore PendingReading + result page status branching"
```

---

### Task 2.2: Domain teasers + locked-blur components

**Files:**
- Create: `components/DomainTeasers.tsx`
- Create: `components/DomainLocked.tsx`
- Create: `components/DomainFull.tsx`

- [ ] **Step 1: DomainTeasers**

```tsx
'use client';
import posthog from 'posthog-js';
import { Events } from '@/lib/telemetry/events';
import type { DomainTeasers as Teasers, DomainKey } from '@/lib/astro/chart-types';

const META: Record<DomainKey, { glyph: string; title: string }> = {
  career:    { glyph: '🛕', title: 'Career & Calling' },
  health:    { glyph: '✦', title: 'Health & Wellness' },
  love:      { glyph: '❀', title: 'Love & Relationships' },
  wealth:    { glyph: '◆', title: 'Wealth & Money' },
  spiritual: { glyph: '☸', title: 'Spiritual Path' },
};

export function DomainTeasers({ slug, teasers }: { slug: string; teasers: Teasers }) {
  return (
    <section className="reveal reveal-5" style={{ marginTop: 48 }}>
      <span className="eyebrow" style={{ display: 'block', textAlign: 'center' }}>
        Five domains of your life
      </span>
      <div className="domain-grid" style={{
        marginTop: 18,
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: 14,
      }}>
        {(Object.keys(META) as DomainKey[]).map((k) => (
          <div key={k} style={{
            border: '1px solid var(--gold-dim)', background: 'var(--parchment-soft)',
            padding: 20, borderRadius: 2,
          }}
          onClick={() => posthog.capture(Events.DOMAIN_TEASER_CLICK, { slug, domain: k })}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ color: 'var(--gold)', fontSize: 18 }}>{META[k].glyph}</span>
              <span className="eyebrow">{META[k].title}</span>
            </div>
            <p style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic',
              fontSize: 18, lineHeight: 1.4, color: 'var(--ink)', margin: 0 }}>
              {teasers[k]}
            </p>
            <div style={{ marginTop: 12, fontSize: 11, letterSpacing: '0.2em',
              textTransform: 'uppercase', color: 'var(--ink-fade)' }}>
              🔒 Read more
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: DomainLocked + DomainFull**

`components/DomainLocked.tsx`:

```tsx
import type { DomainKey, DomainTeasers as Teasers } from '@/lib/astro/chart-types';

const TITLES: Record<DomainKey, string> = {
  career: 'Career & Calling', health: 'Health & Wellness',
  love: 'Love & Relationships', wealth: 'Wealth & Money',
  spiritual: 'Spiritual Path',
};

/** Server-rendered locked teaser preview with blur fade. Used before unlock. */
export function DomainLocked({ teasers }: { teasers: Teasers }) {
  return (
    <div className="locked-stack" style={{ marginTop: 24, display: 'flex',
      flexDirection: 'column', gap: 32 }}>
      {(Object.keys(TITLES) as DomainKey[]).map((k) => (
        <article key={k} style={{ borderTop: '1px solid var(--gold-dim)', paddingTop: 24 }}>
          <span className="eyebrow">{TITLES[k]}</span>
          <h3 className="font-display" style={{
            fontSize: 28, fontWeight: 400, fontStyle: 'italic', margin: '8px 0 14px',
            color: 'var(--gold)' }}>
            {teasers[k]}
          </h3>
          <div style={{ position: 'relative', maxHeight: 96, overflow: 'hidden' }}>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 16, lineHeight: 1.7,
              color: 'var(--ink-soft)', filter: 'blur(4px)', userSelect: 'none' }}>
              The full reading describes the specific planetary positions in your chart that shape this domain — your dignity, your dasha, the yogas active right now, and what to do with what they reveal.
            </p>
            <div style={{ position: 'absolute', inset: 0,
              background: 'linear-gradient(180deg, transparent 0%, var(--parchment) 90%)',
              pointerEvents: 'none' }} />
          </div>
        </article>
      ))}
    </div>
  );
}
```

`components/DomainFull.tsx`:

```tsx
import type { DomainKey, DomainFull as Full, DomainCitations as Cites } from '@/lib/astro/chart-types';

const TITLES: Record<DomainKey, string> = {
  career: 'Career & Calling', health: 'Health & Wellness',
  love: 'Love & Relationships', wealth: 'Wealth & Money',
  spiritual: 'Spiritual Path',
};

export function DomainFull({ full, citations }: { full: Full; citations: Cites }) {
  return (
    <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 48 }}>
      {(Object.keys(TITLES) as DomainKey[]).map((k) => (
        <article key={k} style={{ borderTop: '1px solid var(--gold-dim)', paddingTop: 24 }}>
          <span className="eyebrow">{TITLES[k]}</span>
          <div style={{ marginTop: 14, fontFamily: 'var(--font-body)',
            fontSize: 17, lineHeight: 1.75, color: 'var(--ink-soft)',
            whiteSpace: 'pre-wrap' }}>
            {full[k]}
          </div>
          {citations[k]?.length > 0 && (
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px dashed var(--gold-dim)',
              fontSize: 12, fontFamily: 'var(--font-ui)', color: 'var(--ink-fade)',
              letterSpacing: '0.04em' }}>
              <span style={{ color: 'var(--gold)' }}>Cited:</span>{' '}
              {citations[k].join(' · ')}
            </div>
          )}
          {k === 'health' && (
            <p style={{ marginTop: 12, fontStyle: 'italic', fontSize: 13,
              color: 'var(--ink-fade)' }}>
              For reflection only. Not medical advice.
            </p>
          )}
        </article>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/DomainTeasers.tsx components/DomainLocked.tsx components/DomainFull.tsx
git -c commit.gpgsign=false commit -m "feat(ui): domain teaser grid + locked-blur preview + full-render components"
```

---

### Task 2.3: Unlock modal + /api/unlock

**Files:**
- Create: `components/UnlockModal.tsx`
- Create: `app/api/unlock/route.ts`

- [ ] **Step 1: /api/unlock route**

```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { markUnlocked, getUnlockedCardBySlug } from '@/lib/db/leads';
import { trackServer, flushTelemetry } from '@/lib/telemetry/posthog';
import { Events } from '@/lib/telemetry/events';

const ReqZ = z.object({
  slug: z.string().min(1),
  via: z.enum(['wa', 'ig', 'copy']),
});

export const runtime = 'nodejs';
export const maxDuration = 5;

export async function POST(req: Request): Promise<Response> {
  let parsed;
  try { parsed = ReqZ.safeParse(await req.json()); }
  catch { return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 }); }
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 });
  }
  const { slug, via } = parsed.data;

  try {
    await markUnlocked(slug, via);
  } catch (err) {
    return NextResponse.json({ error: 'UNLOCK_FAILED', detail: String(err) }, { status: 500 });
  }

  const card = await getUnlockedCardBySlug(slug);
  if (!card) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }
  if (card.status !== 'ready') {
    return NextResponse.json({ error: 'NOT_READY' }, { status: 409 });
  }

  trackServer(slug, Events.UNLOCK_COMPLETED, { via });
  await flushTelemetry();

  return NextResponse.json({
    unlocked: true,
    domain_full: card.domain_full,
    citations: card.citations,
  });
}
```

- [ ] **Step 2: UnlockModal**

```tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import posthog from 'posthog-js';
import { Events } from '@/lib/telemetry/events';

export function UnlockModal({
  slug, label, appUrl, onClose,
}: {
  slug: string; label: string; appUrl: string; onClose: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const personalUrl = `${appUrl}/u/${slug}?ref=${slug}`;
  const waText = encodeURIComponent(
    `I am ${label} 🪔 — discover your Vedic archetype: ${personalUrl}`,
  );

  const unlock = async () => {
    setBusy(true);
    posthog.capture(Events.UNLOCK_SHARE_CLICKED, { slug, via: 'wa' });
    window.open(`https://wa.me/?text=${waText}`, '_blank');
    try {
      await fetch('/api/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, via: 'wa' }),
      });
    } catch { /* still set localStorage */ }
    localStorage.setItem(`rashify:unlocked:${slug}`, '1');
    onClose();
    router.refresh();
  };

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(45,21,23,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
      padding: 20,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: 'var(--parchment)', maxWidth: 460, width: '100%',
        padding: 32, border: '1px solid var(--gold)',
      }}>
        <span className="eyebrow">Unlock your full reading</span>
        <h2 className="font-display" style={{
          fontSize: 32, fontWeight: 400, fontStyle: 'italic', lineHeight: 1.15,
          margin: '12px 0 18px', color: 'var(--ink)',
        }}>
          Forward to one friend on WhatsApp.
        </h2>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, lineHeight: 1.6,
          color: 'var(--ink-soft)', marginBottom: 24 }}>
          Sharing your card with one person unlocks all five of your domains —
          career, health, love, wealth, and spiritual path. Your friend gets a
          link to find theirs too.
        </p>
        <button onClick={unlock} disabled={busy}
                className="btn-primary shimmer" style={{ width: '100%' }}>
          <span>{busy ? 'Opening WhatsApp…' : 'Forward on WhatsApp'}</span>
          <span aria-hidden style={{ fontSize: 16 }}>↗</span>
        </button>
        <button onClick={onClose} className="btn-ghost"
                style={{ width: '100%', marginTop: 10 }}>
          Maybe later
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/unlock/route.ts components/UnlockModal.tsx
git -c commit.gpgsign=false commit -m "feat(ui+api): unlock modal + /api/unlock POST endpoint"
```

---

### Task 2.4: Result page wires everything

**Files:**
- Modify: `app/u/[slug]/page.tsx`

- [ ] **Step 1: Replace result-page render section**

In `app/u/[slug]/page.tsx`, after the existing `card.status` pending branch (from Task 2.1), and after Zod parse of archetype, add right before return:

```tsx
import { getUnlockedCardBySlug } from '@/lib/db/leads';
import { DomainTeasersZ, DomainFullZ, DomainCitationsZ } from '@/lib/astro/chart-types';
import { DomainTeasers } from '@/components/DomainTeasers';
import { DomainLocked } from '@/components/DomainLocked';
import { DomainFull } from '@/components/DomainFull';
import { ResultUnlockButton } from '@/components/ResultUnlockButton';
```

After parsing archetype:
```tsx
  const teasersParse = DomainTeasersZ.safeParse(card.domain_teasers);
  const teasers = teasersParse.success ? teasersParse.data : null;

  // Server-side unlock state (defense in depth + return-visit fast-path)
  const unlocked = await getUnlockedCardBySlug(slug);
  let fullPayload: { full: import('@/lib/astro/chart-types').DomainFull; citations: import('@/lib/astro/chart-types').DomainCitations } | null = null;
  if (unlocked) {
    const f = DomainFullZ.safeParse(unlocked.domain_full);
    const c = DomainCitationsZ.safeParse(unlocked.citations);
    if (f.success && c.success) fullPayload = { full: f.data, citations: c.data };
  }
```

In the JSX, after the existing `<ShareActions>` section, before `<details>`, insert:

```tsx
        {teasers && <DomainTeasers slug={slug} teasers={teasers} />}

        {fullPayload ? (
          <section className="reveal reveal-6" style={{ marginTop: 32 }}>
            <DomainFull full={fullPayload.full} citations={fullPayload.citations} />
          </section>
        ) : teasers ? (
          <section className="reveal reveal-6" style={{ marginTop: 32 }}>
            <DomainLocked teasers={teasers} />
            <div style={{ marginTop: 32, textAlign: 'center' }}>
              <ResultUnlockButton slug={slug} label={a.label} appUrl={appUrl} />
            </div>
          </section>
        ) : null}
```

- [ ] **Step 2: Create ResultUnlockButton**

`components/ResultUnlockButton.tsx`:

```tsx
'use client';
import { useState } from 'react';
import posthog from 'posthog-js';
import { Events } from '@/lib/telemetry/events';
import { UnlockModal } from './UnlockModal';

export function ResultUnlockButton({ slug, label, appUrl }: { slug: string; label: string; appUrl: string }) {
  const [open, setOpen] = useState(false);
  const onClick = () => {
    posthog.capture(Events.UNLOCK_MODAL_OPEN, { slug });
    setOpen(true);
  };
  return (
    <>
      <button onClick={onClick} className="btn-primary shimmer" style={{ maxWidth: 480, marginInline: 'auto' }}>
        <span>🔒 Unlock full reading</span>
      </button>
      {open && (
        <UnlockModal
          slug={slug} label={label} appUrl={appUrl}
          onClose={() => {
            posthog.capture(Events.UNLOCK_MODAL_DISMISSED, { slug });
            setOpen(false);
          }}
        />
      )}
    </>
  );
}
```

- [ ] **Step 3: Update events registry**

In `lib/telemetry/events.ts`, add at end of `Events` const:

```ts
  DOMAIN_TEASER_CLICK: 'domain_teaser_click',
  UNLOCK_MODAL_OPEN: 'unlock_modal_open',
  UNLOCK_MODAL_DISMISSED: 'unlock_modal_dismissed',
  UNLOCK_SHARE_CLICKED: 'unlock_share_clicked',
  UNLOCK_COMPLETED: 'unlock_completed',
  DOMAIN_FULL_VIEW: 'domain_full_view',
  DOMAIN_FULL_SCROLL_DEPTH: 'domain_full_scroll_depth',
```

- [ ] **Step 4: Run + commit**

```bash
npm run test && npm run build
git add app/u/[slug]/page.tsx components/ResultUnlockButton.tsx lib/telemetry/events.ts
git -c commit.gpgsign=false commit -m "feat(ui): result page wires teasers + locked+unlock + full-after-unlock"
```

---

### Task 2.5: Health disclaimer + Terms update

**Files:**
- Modify: `app/terms/page.tsx`

- [ ] **Step 1: Add disclaimer paragraph**

In `app/terms/page.tsx`, append a new `<h2>` block before the Contact section:

```tsx
        <h2>Domain readings — what they are not</h2>
        <p>
          Health, wealth, career, relationship, and spiritual readings are written
          for reflection. They are not medical, legal, financial, or psychological
          advice. Speak to a qualified professional for any concern that needs one.
        </p>
```

- [ ] **Step 2: Commit**

```bash
git add app/terms/page.tsx
git -c commit.gpgsign=false commit -m "docs(terms): add domain-readings disclaimer (not medical/legal/financial advice)"
```

---

## Phase 3 — Hardening + analytics

### Task 3.1: Vercel Cron — stuck-row checker

**Files:**
- Create: `app/api/cron-stuck/route.ts`
- Create: `vercel.json`

- [ ] **Step 1: Cron endpoint**

```ts
// app/api/cron-stuck/route.ts
import { NextResponse } from 'next/server';
import { findStuckPending } from '@/lib/db/leads';
import { triggerFullProfile } from '@/lib/astro/engine';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET(req: Request): Promise<Response> {
  // Vercel sends Authorization: Bearer <CRON_SECRET>
  const auth = req.headers.get('authorization') ?? '';
  const expected = process.env.CRON_SECRET;
  if (expected && auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const stuck = await findStuckPending(2 * 60 * 1000); // older than 2 min
  let refired = 0;
  for (const row of stuck) {
    triggerFullProfile({
      slug: row.slug, birthDate: row.dobDate, birthTime: row.dobTime,
      lat: row.lat, lon: row.lon,
    }).catch(() => {});
    refired++;
  }
  return NextResponse.json({ refired, stuck: stuck.length });
}
```

- [ ] **Step 2: vercel.json**

```json
{
  "crons": [
    { "path": "/api/cron-stuck", "schedule": "*/5 * * * *" }
  ]
}
```

- [ ] **Step 3: Set CRON_SECRET on Vercel**

Vercel → Settings → Environment Variables → add `CRON_SECRET=<random 32-char>`. Redeploy.

- [ ] **Step 4: Commit**

```bash
git add app/api/cron-stuck/route.ts vercel.json
git -c commit.gpgsign=false commit -m "feat(cron): re-fire HF /generate-full for rows stuck pending >2min"
```

---

### Task 3.2: PostHog event docs + dashboard checklist

**Files:**
- Modify: `docs/superpowers/specs/2026-04-28-full-profile-design.md` (append "PostHog dashboards" appendix)

- [ ] **Step 1: Document funnels in spec**

Append to spec:

```md
## Appendix A — PostHog dashboards (post-launch)

Setup once via PostHog UI:

1. Funnel: `landing_view → form_submit_success → result_view → unlock_modal_open → unlock_completed`
2. Funnel (viral): `visitor_on_shared (with ?ref) → form_submit_success`
3. Trend: `count(unlock_completed) / count(result_view)` daily — unlock conversion
4. Trend: `count(form_submit_success where referrer_slug != null)` — viral acquisitions
5. Cohort by domain: which domain's teaser most often triggers unlock click?
   Insight → Trends → series = `domain_teaser_click`, breakdown by `domain` property.
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-04-28-full-profile-design.md
git -c commit.gpgsign=false commit -m "docs(spec): PostHog dashboards appendix for post-launch setup"
```

---

## Self-Review

**Spec coverage:**
- §1 Architecture — Tasks 1.6–1.10
- §2 Domain definitions — Task 1.4
- §3 Data model — Task 1.1, 1.3
- §4 API surface — Tasks 1.10, 2.3
- §5 LLM prompt — Task 1.6
- §6 Share-to-unlock — Tasks 2.3, 2.4
- §7 Failure modes — Task 1.10 (engine error mapping), 2.3 (UNLOCK_FAILED), 3.1 (cron)
- §8 Performance budget — fast path 1.10, polling 2.1, cron 3.1
- §9 Telemetry — Task 2.4 (events) + 3.2 (dashboards)
- §10 Risks — addressed: HF sleep (cron keep-alive deferred), DPDP (Task 2.5), mobile accordion (deferred to post-launch)
- §11 Phased delivery — matches plan structure
- §12 Success criteria — measured via PostHog dashboards in 3.2

**Placeholder scan:** none. All steps have concrete code or commands.

**Type consistency:** `DomainKey`, `DomainTeasers`, `DomainFull`, `DomainCitations`, `FullProfile` defined in 1.2, used consistently in 2.1, 2.2, 2.4. Lifecycle helpers `insertPendingProfile`, `getCardBySlug`, `getUnlockedCardBySlug`, `markUnlocked`, `findStuckPending` defined in 1.3, used in 1.10, 2.3, 3.1.

**Deferred (acknowledged out of scope for v1):**
- HF Space keep-alive cron — risk noted in spec §10
- Mobile per-domain accordion — risk noted in spec §10
- prompt_version migration cron — schema column added but auto-update flow deferred

---

## Execution choice

**Plan complete and saved to `docs/superpowers/plans/2026-04-28-full-profile-mvp.md`.** Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
