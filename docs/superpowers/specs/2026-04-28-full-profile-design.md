# Rashify Full Profile + Share-to-Unlock — Design Spec

**Date:** 2026-04-28
**Owner:** Saurabh
**Approach:** Path C — full LLM at signup, batched into one call. Async pipeline restored (Vercel fast path → HF worker → Supabase write → Vercel polls). Share-to-unlock gate is purely client-side (localStorage flag).

---

## 1. Architecture

```
                ┌──────────────────────────────────────┐
[User Browser]  │                                      │
    │           │     Supabase (Postgres)              │
    │ POST      │     leads (status, archetype,        │
    ▼ form      │            domain_teasers,           │
[Vercel /api/generate]──insert pending row──▶ domain_full, etc.) │
    │           │                                      │
    │ fires (no-await) HTTP to HF                      │
    ▼           └──────────────────────────────────────┘
[HF /generate-full]───┐                  ▲
   1. Compute D1+D9   │                  │ writes
   2. Compute domain  │                  │ status=ready
      inputs (rules)  │                  │
   3. One LLM call    │                  │
      (batched: arch  │                  │
      + 5 teasers     │                  │
      + 5 full reads) │                  │
   4. Write Supabase  │                  │
      via service-role│                  │
                      │                  │
[/u/[slug] page]      │                  │
   ├── Server reads from Supabase        │
   ├── If status=pending: <PendingPoll>──┼─ polls /api/status every 2s
   └── If status=ready:                  │
       ├── Archetype card + WA share     │
       ├── 5 domain teasers (visible)    │
       └── 5 full-read sections          │
           (hidden by localStorage gate) │
              │                          │
              └─ Click "Read full"       │
                 ├─ Modal: "Share to     │
                 │   unlock"             │
                 ├─ Click WA share       │
                 ├─ Open wa.me intent    │
                 ├─ Set localStorage     │
                 │   rashify:unlocked:{slug} │
                 └─ Reveal full          │
                                         │
[/api/status?slug=X] ──────reads pub_view┘
```

Free Vercel fits because pipeline split:
- /api/generate: ~2s (validate + geocode + insert pending + fire HF + return)
- HF worker: ~25s (chart + LLM batched + write to Supabase, fits HF's 150s timeout)
- /api/status: <500ms read
- /u/[slug] polling: 2s interval

---

## 2. Domain definitions

5 life domains, each derived from chart facts.

| Domain | Primary inputs | Secondary | Lock-icon emoji |
|---|---|---|---|
| **Career & Calling** | 10th house lord, lagna lord dignity, Saturn pos, current dasha | active yogas (Raja/Dharma), 6th lord (service), 11th lord (gains) | 🛕 |
| **Health & Wellness** | lagna lord dignity, 6th house, Mars/Saturn aspects | nadi (vata/pitta/kapha), animalSign, gandanta presence | ✦ |
| **Love & Relationships** | 7th house lord + dignity, Venus pos + dignity, Moon-Venus axis | 5th (romance), Mars dignity, mangal_dosha | ❀ |
| **Wealth & Money** | 2nd lord, 11th lord, Jupiter pos | Lakshmi/Dhana yogas (filtered from active_yogas), 8th house | ◆ |
| **Spiritual Path** | 12th house, Ketu pos, current mahadasha lord nature | 9th lord, Jupiter dignity, moksha-trikona influence | ☸ |

Each domain entry has:
```ts
{
  teaser: string,           // 1 sentence, ~80 chars, posed as question/hook
  full:   string,           // 3 paragraphs, ~600 words, cites specific chart facts
  citations: string[],      // 2-3 chart fact strings used: e.g. ["10th lord Saturn in Vrischika", "Saturn-Venus dasha", "Kedara yoga active"]
}
```

---

## 3. Data model changes

```sql
alter table leads
  add column domain_teasers jsonb,    -- {career, health, love, wealth, spiritual} → string
  add column domain_full   jsonb,     -- {career, health, love, wealth, spiritual} → string
  add column citations     jsonb,     -- {career, health, love, wealth, spiritual} → string[]
  add column unlocked_at   timestamptz,
  add column unlocked_via  text;       -- 'wa' | 'ig' | 'copy'

-- public_card view: keep teasers public, full gated server-side too (defense in depth)
drop view public_card;
create view public_card as
  select slug, name, archetype,
         domain_teasers,
         status, error, created_at, referrer_slug
  from leads
  where deleted_at is null;
grant select on public_card to anon;

-- A separate view for unlocked: includes full content. Read by /api/unlocked.
create view unlocked_card as
  select slug, name, archetype, domain_teasers, domain_full, citations,
         status, created_at
  from leads
  where deleted_at is null and unlocked_at is not null;
grant select on unlocked_card to anon;
```

Note: `unlocked_card` view requires unlocked_at to be set server-side, which only happens after `/api/unlock` POST (next section). Even if a user fakes localStorage, server enforces. Defense in depth.

---

## 4. API surface

### Vercel side

**`POST /api/generate`** (≤5s): existing endpoint, unchanged behavior — insert pending, fire HF, return slug.

**`GET /api/status?slug=X`** (~500ms): returns `{status, teasers?}`. Once status=ready, includes teasers only.

**`POST /api/unlock`** — NEW
```ts
// req
{ slug: string, via: 'wa' | 'ig' | 'copy' }
// res 200
{ unlocked: true, full: {career, health, love, wealth, spiritual}, citations: {...} }
// res 4xx
{ error: 'NOT_FOUND' | 'NOT_READY' }
```
Server sets `unlocked_at = now()`, `unlocked_via = via`. Idempotent (set only if null). Returns full content.

### HF engine side

**`POST /generate-full`** — NEW
```ts
// req
{ slug, birth_date, birth_time, lat, lon,
  supabase_url, supabase_service_key,        // pass-through; HF doesn't store
  openrouter_key, openrouter_model }
// flow
// 1. Compute chart (existing logic)
// 2. Build LLM context (chart + domain rule hints)
// 3. Single OpenRouter call with structured JSON output (1 call, ~3-5K out tokens)
// 4. UPDATE leads SET status='ready', archetype=..., domain_teasers=...,
//    domain_full=..., citations=..., chart_json=... WHERE slug=$1
// 5. Return {ok: true} (Vercel doesn't await this — fire-and-forget)
```

Existing `POST /chart` stays for direct chart access.

---

## 5. LLM prompt — single batched call

System prompt: same Vedic+modern voice as today, expanded for 5-domain output.

User message: trimmed chart JSON + first name + per-domain hint blocks (which lords/houses/yogas are most relevant).

Output JSON schema:
```ts
{
  archetype: <existing Archetype shape>,
  domain_teasers: {
    career: string, health: string, love: string,
    wealth: string, spiritual: string
  },
  domain_full: {
    career: string, health: string, love: string,
    wealth: string, spiritual: string  // each ~600 words, 3 paragraphs
  },
  citations: {
    career: string[], health: string[], love: string[],
    wealth: string[], spiritual: string[]  // 2-3 chart facts each
  }
}
```

Validation: Zod schema. On schema fail: retry once with stricter prompt. On second fail: rule-based fallback per domain (lookup table from chart facts).

Cost: DeepSeek ~$0.001/profile. 3k users = ₹250. Well under $5 OpenRouter budget — but increase to $10 budget for headroom.

---

## 6. Share-to-unlock client logic

### Result page (`/u/[slug]`)

```
[Archetype Card section]
[Send on WhatsApp / Save / Copy buttons]    ← already exists
─────
[Domain teasers grid (5 cards)]
  Each card: emoji + domain name + teaser sentence
  + dim "🔒 Read more" hint at bottom of card

[Big CTA: "🔒 Unlock your full reading"]
  Click → opens <UnlockModal />
```

### `<UnlockModal />`
```
"Share with one friend on WhatsApp to unlock all 5 domains.

When you forward, your friend gets a link to discover their own
archetype too. (Forwarding helps us stay free + ad-free.)

[Forward on WhatsApp →]   [Maybe later]
```

### Click handler
```ts
async function unlock() {
  // 1. Open WA intent
  window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank');

  // 2. Server-side mark
  await fetch('/api/unlock', {
    method: 'POST',
    body: JSON.stringify({ slug, via: 'wa' })
  });

  // 3. Local flag for instant UI
  localStorage.setItem(`rashify:unlocked:${slug}`, '1');

  // 4. Re-fetch full (or use response from step 2)
  router.refresh();
}
```

On result page mount, server sees `unlocked_at IS NOT NULL` and bakes full content into HTML directly — no client roundtrip needed for return visits.

### "Soft" unlock state
Until unlocked: full sections render as teaser-only blurred-card placeholders. CSS:
```css
.locked-section {
  position: relative;
  max-height: 120px;
  overflow: hidden;
}
.locked-section::after {
  content: '';
  position: absolute; inset: 0;
  background: linear-gradient(180deg, transparent, var(--parchment) 95%);
  backdrop-filter: blur(6px);
  pointer-events: none;
}
```

Visible teaser remains crisp; full text peeks through then fades to parchment fog.

---

## 7. Failure modes + recovery

| Failure | Behavior | Recovery |
|---|---|---|
| HF /generate-full times out (>30s) | Vercel /api/generate already returned slug; row stuck pending | Cron checker (Day-2 add) re-fires worker for stuck pending rows older than 2 min |
| OpenRouter 5xx | Retry once at HF side | 2nd fail → rule-based fallback fills domain_teasers + domain_full from chart lookup tables; status=ready (degraded) |
| Schema parse fail | Retry stricter prompt once | 2nd fail → rule-based fallback |
| User clicks unlock before status=ready | UI disables "Unlock" button while `status='pending'` | n/a |
| User shares but cancels WA midway | We only know they clicked; counts as unlock per spec | trust-click policy (locked decision Q5) |
| Network glitch during /api/unlock POST | retry 1x; if still fails, set localStorage flag anyway so user sees content | DB record may be missing unlocked_at — Day-7 cleanup cron syncs from analytics events |

---

## 8. Performance budget

| Stage | Target | Hard cap |
|---|---|---|
| Vercel /api/generate (form submit → slug) | <2s | 10s (hobby) |
| HF /generate-full (chart + LLM + DB write) | 20-25s | 150s (HF) |
| /api/status poll | <300ms | 5s |
| /api/unlock | <500ms | 5s |

Polling cadence: 2s. Max wait for full result: ~30s. UX during wait: animated "Reading your stars" stage progress (already built; restore PendingReading.tsx).

---

## 9. Telemetry events to add

PostHog events (already wired infrastructure):
```
DOMAIN_TEASER_CLICK         — {slug, domain}
UNLOCK_MODAL_OPEN           — {slug}
UNLOCK_MODAL_DISMISSED      — {slug}
UNLOCK_SHARE_CLICKED        — {slug, via}
UNLOCK_COMPLETED            — {slug, via, time_to_unlock_ms}
DOMAIN_FULL_VIEW            — {slug, domain}
DOMAIN_FULL_SCROLL_DEPTH    — {slug, domain, pct}
```

Funnels worth tracking:
1. landing_view → form_submit_success → result_view → unlock_modal_open → unlock_completed
2. visitor_on_shared (with ?ref) → form_submit_success (= K-factor numerator)

---

## 10. Open risks

- **HF Space sleep on inactivity:** HF wakes ~5s on first request after 48h idle. First user post-idle waits longer. Mitigation: keep-alive ping every 24h via cron (later).
- **OpenRouter rate-limit during traffic spikes:** DeepSeek tier may throttle. Add 30s queue with retry on 429 + fallback to rule-based on persistent fail.
- **DPDP-Act compliance for Health domain:** "Health" content might be regulated as health advice. Mitigation: clear "for reflection only, not medical advice" disclaimer on every Health section + at /terms.
- **Long pages on mobile:** 5 × 600-word paragraphs = ~3k words. Mitigate with collapsible per-domain accordion on mobile.
- **Cache invalidation:** archetype/full changes if we update prompt. Add `prompt_version int default 1` column; bump when prompt changes; nightly cron re-generates rows with stale version (manual at first; automate Day-30).

---

## 11. Phased delivery

**Phase 1 — backend + storage (engineering only, no UI yet):**
- Add columns
- HF /generate-full endpoint (chart + LLM batched + write)
- Vercel /api/generate refactor to fire-and-forget HF
- /api/status to read full status from row

**Phase 2 — UI (consume what backend produces):**
- Result page renders teasers
- Locked-section blur UI
- Unlock modal + share-to-unlock flow
- /api/unlock endpoint
- localStorage gate
- Restore PendingReading component for polling state

**Phase 3 — analytics + hardening:**
- PostHog events
- Cron checker for stuck pending rows
- Health disclaimer + Terms update
- Mobile accordion for long sections

Each phase shippable independently. Phase 1 alone gives you richer Supabase data (the 5-domain JSON for every lead) even if UI isn't built yet — useful for manual analysis.

---

## 12. Success criteria (Day-30)

- ≥40% of leads click "Read full"
- ≥25% of leads complete unlock (share fires)
- K-factor ≥0.4 (4 in 10 unlocks bring a friend back as new lead)
- No domain-specific abandonment cliff (each domain teaser → full ratio within 10% of each other)
- HF /generate-full P95 ≤30s
- LLM cost ≤₹100/day at 100 leads/day
