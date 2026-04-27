# Rashify — Vedic Archetype Card · Design Spec

- **Date:** 2026-04-27
- **Owner:** Saurabh Kumar Singh (saurabhkumar.singh@habuild.in)
- **Goal:** Ship a viral lead-gen web app where Indian users enter birth data and receive a personalized Vedic archetype card on WhatsApp + a personal share URL. Primary KPI: leads captured (phone numbers). Secondary: K-factor (referrer_slug ≠ null rate).
- **Approach:** Approach 1 (1-day MVP) + telemetry baked in. Compatibility loop (A+C) parked for Day-2.

---

## 1. System Architecture

```
[User Browser]
     │
     ├─ Landing page (Next.js / Vercel edge)
     │   └─ form: name, DOB, time, place, phone (+ consent + Turnstile)
     │
     ▼
[Next.js API route: POST /api/generate]
     │
     ├─ 1. Validate + geocode place (Nominatim, cached in Supabase)
     ├─ 2. Call Prokerala Vedic API → chart JSON (rashi/nakshatra/lagna/dasha/planets)
     ├─ 3. Call Gemini 2.0 Flash → archetype JSON (Zod-validated; rule-based fallback)
     ├─ 4. Insert lead row into Supabase
     ├─ 5. Generate slug + render share URL
     ├─ 6. Fire-and-forget AiSensy WA send (template + image header)
     └─ Return {slug, archetypeJSON} to browser
     │
     ▼
[Result page: /u/{slug}]
     ├─ <ShareCard /> + <ArchetypeReveal /> (animated first-view)
     ├─ /api/og?slug=... → 1080×1920 PNG via Vercel OG (Satori)
     ├─ ShareActions: WA / Save image / Copy link / Compare (Day-2 stub)
     └─ Footer CTA → form (for visitors landing via shared link)
     │
[Cross-cutting]
     ├─ PostHog: 18 typed events, server + client stitched on slug
     ├─ Sentry: error tracing
     └─ Cloudflare Turnstile: bot protection on form
```

**Stack:**

| Layer | Tech | Notes |
|---|---|---|
| Frontend + API | Next.js 15 App Router on Vercel | Single deploy, edge fns |
| Vedic calc | Prokerala API (Vedic kundli endpoint) | Free 100/day; upgrade on viral spike |
| LLM | Gemini 2.0 Flash | JSON mode, ~$0.00024/lead |
| DB | Supabase Postgres | Free 500MB, RLS locked, public view for /u/{slug} |
| Image gen | Vercel OG / Satori | Same JSX as ShareCard, no template drift |
| WhatsApp | AiSensy (Meta WABA wrapper) | India-native, ~₹0.4/msg |
| Bot protection | Cloudflare Turnstile | Free, low friction |
| Analytics | PostHog | Funnels, session recording (phone masked) |
| Errors | Sentry | Free tier |
| Domain | rashify.in | Personal slug subdomain via dynamic route |

---

## 2. Component Breakdown + File Structure

```
rashify/
├── app/
│   ├── layout.tsx                  # Cormorant + Inter fonts, PostHog provider
│   ├── page.tsx                    # Landing → <BirthForm /> hero
│   ├── u/[slug]/page.tsx           # Result page (own + shared)
│   ├── u/[slug]/loading.tsx        # Skeleton during gen
│   ├── privacy/page.tsx            # DPDP-compliant policy
│   ├── terms/page.tsx              # Entertainment-only disclaimer
│   ├── api/
│   │   ├── generate/route.ts       # POST: pipeline orchestrator
│   │   ├── og/route.tsx            # GET: Vercel OG card image
│   │   ├── delete-me/route.ts      # POST: DPDP deletion stub (Day-1) → functional (Day-7)
│   │   └── wa-callback/route.ts    # POST: AiSensy delivery webhook
│   └── globals.css
├── components/
│   ├── BirthForm.tsx               # mode="self"|"friend" (compat-ready)
│   ├── ShareCard.tsx               # Single-source-of-truth JSX (screen + OG)
│   ├── ShareActions.tsx            # WA / IG / copy / download buttons
│   ├── ArchetypeReveal.tsx         # First-view animation (localStorage flagged)
│   ├── ConsentCheckbox.tsx         # DPDP-mandatory consent
│   └── ProvenanceFooter.tsx        # "Sidereal · Lahiri" trust badge
├── lib/
│   ├── astro/
│   │   ├── prokerala.ts            # Client + token cache + retry
│   │   ├── geocode.ts              # Nominatim wrapper, Supabase cache
│   │   └── chart-types.ts          # Zod schemas
│   ├── llm/
│   │   ├── gemini.ts               # JSON-mode client
│   │   ├── archetype-prompt.ts     # System + user templates
│   │   └── fallback-archetype.ts   # 324-row lagna×nakshatra lookup
│   ├── wa/
│   │   ├── aisensy.ts              # Template send wrapper
│   │   └── templates.ts            # Approved template names + payload shapes
│   ├── db/
│   │   ├── supabase.ts             # Server (service_role) + client (anon)
│   │   └── leads.ts                # CRUD + slug gen + dedupe
│   ├── telemetry/
│   │   ├── posthog.ts              # Server + client init
│   │   └── events.ts               # Typed event registry
│   └── slug.ts                     # nanoid + name-prefix slugger
├── public/
│   ├── fonts/                      # Cormorant Garamond + Tiro Devanagari + Inter
│   ├── glyphs/                     # 12 rashi SVGs, 27 nakshatra SVGs
│   └── og-fallback.png
├── docs/superpowers/specs/
│   └── 2026-04-27-rashify-design.md
├── .env.local
├── package.json
└── README.md
```

**Boundaries:**
- `lib/astro` is the only consumer of Prokerala. Future swap to PyJHora/AstrologyAPI changes one file.
- `lib/llm` is stateless: chart JSON in, archetype JSON out.
- `lib/wa` is fire-and-forget; never blocks user response.
- `BirthForm.tsx` is reusable for solo + Day-2 compatibility flow.
- `ShareCard.tsx` JSX is rendered by both `app/u/[slug]/page.tsx` and `app/api/og/route.tsx` — no template drift.

---

## 3. Data Model + API Contracts

### Supabase schema

```sql
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
  query_norm text primary key,
  lat numeric(9,6), lon numeric(9,6),
  tz_offset int,
  hit_count int default 1,
  updated_at timestamptz default now()
);

create table wa_log (
  id bigserial primary key,
  lead_id uuid references leads(id) on delete cascade,
  template text not null,
  status   text not null,                      -- queued|sent|delivered|read|failed
  payload  jsonb,
  error    text,
  created_at timestamptz default now()
);

create view public_card as
  select slug, name, archetype, created_at, referrer_slug
  from leads
  where deleted_at is null;
```

RLS locked on all tables; server uses `service_role`. Public read on `public_card` only (no PII).

### API contracts

**`POST /api/generate`**

```ts
// req
{ name: string,
  dobDate: "YYYY-MM-DD",
  dobTime: "HH:mm",
  birthPlace: string,
  phoneE164: string,
  referrerSlug?: string,
  utm?: {source,medium,campaign},
  turnstileToken: string,
  consent: true }

// res 200
{ slug: "saurabh-x7k2",
  archetype: {
    label: "The Saturn-Mercury Strategist",
    sanskritLabel: "Karma-Yoga Tantri",
    coreTraits: [string,string,string],
    strengths: [string,string,string],
    growthEdges: [string,string],
    luckyColor: "indigo",
    luckyNumber: 7,
    powerWindow: "10:30 PM – 2 AM",
    oneLiner: "...",
    provenance: { ayanamsa: "Lahiri",
                  system: "Vedic sidereal",
                  nakshatra: "Anuradha",
                  lagna: "Vrishabha",
                  currentDasha: "Saturn-Venus" } } }

// res 4xx
{ error: "INVALID_PHONE" | "GEOCODE_FAILED" | "PROKERALA_DOWN"
       | "RATE_LIMIT" | "TURNSTILE_FAIL" | "CONSENT_MISSING" }
```

**`GET /api/og?slug=...`** → 1080×1920 PNG, cache `public, max-age=86400`.

**`GET /u/[slug]`** → server-renders `public_card` row → ShareCard + ShareActions. Invalid slug → 404 with CTA.

**`POST /api/delete-me`** → DPDP deletion (Day-1 stub returns "we'll process within 30 days"; Day-7 functional with OTP confirm).

---

## 4. Share Artifact Spec

### 4a. ShareCard (1080×1920, 9:16)

Layout (top→bottom): brand mark · archetype label (Cormorant Garamond 48pt) · Sanskrit label (Tiro Devanagari) · glyph row (lagna/nakshatra/dasha-lord SVGs) · core traits (3 bullets, Inter 28pt) · strengths/growth-edges (2-col) · power window + lucky · provenance footer (sidereal/Lahiri/dasha period) · personal URL `saurabh.rashify.in` · QR (200×200, gold on cream).

Palette: `#3a0a14` (deep maroon bg), `#f1e7d4` (ivory text), `#c9a24a` (antique gold). Subtle paper-grain CSS noise filter. No emojis. No gradients.

Type: Cormorant Garamond (display), Tiro Devanagari (Sanskrit), Inter (body).

### 4b. /u/{slug} page

Same card on screen + below:
- `<ArchetypeReveal>` animated reveal on first view (localStorage flag, ~2s).
- 4 share actions: **Send on WhatsApp** (`wa.me/?text=...`), **Save image** (downloads `/api/og`), **Copy link**, **Compare with friend** (Day-2; v1 disabled with "coming soon" tooltip).
- Expandable provenance: "Why we say this" → raw chart highlights (lagna degree, nakshatra pada, current dasha period).
- Footer: "Want yours?" → form CTA for visitors.

### 4c. WhatsApp template

Name: `rashify_archetype_v1` · Category: Marketing · Lang: en+Hindi mix.

```
Header (image): https://rashify.in/api/og?slug={{1}}

Body:
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

Variables: `{{1}}=slug, {{2}}=firstName, {{3}}=archetypeLabel, {{4}}=sanskritLabel, {{5-7}}=traits[0..2]`.

CTA buttons: **View my profile**, **Share with friends**.

**Submit template to Meta on H+0** — 24h approval window blocks WA send only; rest of build can proceed.

---

## 5. LLM Prompt + Telemetry

### 5a. Gemini 2.0 Flash — system prompt

```
You are a Vedic astrologer + modern personality writer. Given a sidereal natal chart JSON, output ONE archetype card describing the person.

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

Refuse politely if chart JSON is malformed.
```

User msg: trimmed chart JSON (lagna, sun, moon, nakshatra+pada, 9 grahas with sign+house+degree+nakshatra, current mahadasha+antardasha, ayanamsa, tz) + first name.

Settings: `temperature=0.7`, `responseMimeType="application/json"`, `maxOutputTokens=800`. Zod-validate output; one retry with stricter prompt on schema fail; fall back to rule-based archetype on second fail.

Cost: ~$0.00024/lead. 10k leads = $2.40.

### 5b. Telemetry events (PostHog)

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
```

**`distinct_id = lead.slug`** stitches server + client events. Phone masked in session recordings (DPDP).

**Funnels day-1:**
1. `landing_view → form_submit_click → form_submit_success → result_view → share_wa_click`
2. `wa_delivered → wa_button_click → landing_view`
3. `visitor_on_shared → form_submit_success` (= K-factor numerator)

---

## 6. Error Handling + Privacy + Edge Cases

### 6a. Errors

| Failure | User msg | Server | Recovery |
|---|---|---|---|
| Geocode miss | Inline: "Place not found" | None | User retry |
| Prokerala 5xx/timeout | "Stars are buffering 🪐" + retry | One auto-retry, alert | Yes |
| Prokerala rate-limit | Same | Queue: chart_json={pending}; BG worker | Yes async |
| Gemini bad JSON | None | Retry once stricter; fall back to rule-based | Yes degrade |
| Gemini 5xx | None | Rule-based fallback; flag for re-gen | Yes |
| AiSensy fail | None | wa_log status=failed; nightly cron retry | Yes async |
| Supabase down | "Cosmic alignment off" | Sentry alert | No |
| Duplicate phone | "Welcome back!" → existing slug | Don't dupe | Feature |
| Invalid phone | Inline error | Reject | User fix |
| DOB future | Inline error | Reject | User fix |

Global server timeout: 10s (Vercel hobby cap). Abort downstream after 8s, fall back.

**Rule-based fallback:** static lookup `(lagnaSign × moonNakshatra) → archetypeLabel` covers 12×27=324 combos. Hand-written labels. Zero LLM dependency.

### 6b. Privacy (DPDP Act 2023)

- Consent checkbox on form (pre-unchecked, required to submit). Single line covering WA receipt + storage. `consent_at` column.
- `/privacy` page: data, purpose, retention (7y), 3rd parties (Prokerala, Gemini, AiSensy/Meta, Supabase, PostHog), DPO email, withdrawal mechanism.
- `/terms` page: entertainment-only, no medical/financial claims.
- WhatsApp opt-in = form submission (Meta record).
- Data minimization: `ip_hash = sha256(ip + salt)` only.
- Deletion: `POST /api/delete-me` (Day-1 stub, Day-7 functional with OTP confirm). Soft-delete via `deleted_at`.

### 6c. Edge cases

- Tier-2 city geocoding weak → pre-warm `geocode_cache` with top 1000 Indian cities at deploy.
- Birth time unknown → "I don't know" toggle → noon default + LLM softens lagna ("likely Vrishabha rising"). Mark `tz_estimated` in chart_json.
- Pre-1947 DOB → Prokerala handles tz; document edge.
- Phone collision (shared device) → picker UX; don't block.
- Bot abuse → ip_hash rate limit (10/IP/day) + Turnstile.

---

## 7. Ship Timeline + Secrets

### 7a. Hour-by-hour Day-1 (~10hr)

| Hr | Task | Output |
|---|---|---|
| H+0 | Register Prokerala, AiSensy, Meta WABA, submit `rashify_archetype_v1` template (24h approval). Buy `rashify.in`. | Accounts live, template queued. |
| H+0.5 | `create-next-app` + Vercel + Supabase project. | Blank deploy live. |
| H+1.5 | Schema migration. Wire `lib/db`. | Tables exist. |
| H+2.5 | `BirthForm` + landing + Zod + Turnstile + consent. | Form posts to stub. |
| H+3.5 | `lib/astro/prokerala` + token cache + Nominatim cache. | Real chart JSON flows. |
| H+4.5 | `lib/llm/gemini` + prompt + Zod + rule-based fallback. | Archetype JSON returned. |
| H+5.5 | `app/u/[slug]/page.tsx` + ShareCard CSS/HTML. | Cards render in browser. |
| H+6.5 | `app/api/og/route.tsx` (Vercel OG/Satori). | PNG generated at edge. |
| H+7.5 | `lib/wa/aisensy` (after Meta approval) + ShareActions. | WA arrives on test phone. |
| H+8.5 | PostHog wired (server+client). 18 events firing. Funnel dashboard. | Telemetry live. |
| H+9 | Privacy/Terms. /api/delete-me stub. DNS. Smoke test 5 charts. | Production-ready. |
| H+9.5 | Soft launch: 1 WA group + 1 Twitter post. | Real users. |
| H+10 | Hotfixes from first-hour data. | Stable. |

Parallelizable while Meta approves: all coding ships; only WA send blocked. Use `wa.me/?text=` deep-link as fallback for share testing.

### 7b. Secrets needed

```bash
PROKERALA_CLIENT_ID=
PROKERALA_CLIENT_SECRET=
GEMINI_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_ANON_KEY=
AISENSY_API_KEY=
AISENSY_CAMPAIGN_NAME=rashify_archetype_v1
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://us.posthog.com
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
NEXT_PUBLIC_APP_URL=https://rashify.in
SLUG_SALT=<random 32-char>
IP_HASH_SALT=<random 32-char>
SENTRY_DSN=
```

### 7c. Free-tier capacity

- Vercel hobby: 100GB BW + 100k fn invocations/mo → ~25k card gens.
- Supabase free: 500MB → ~50k leads.
- Prokerala free: 100/day → **bottleneck**. Upgrade ~₹1,500/mo at first viral spike (Sentry alert at 50/hr).
- Gemini Flash: 15 RPM free → 21k/day. Plenty.
- AiSensy: ~₹0.4/utility msg + setup.
- PostHog: 1M events/mo free.

---

## 8. Bonus Features (Backlog)

**Tier 1 — high-leverage:**
1. Compatibility flow (A+C) — Day-2. Reuses 80% of Day-1 code. Estimated 2x K-factor.
2. "Year 2026" upsell — D7 WA personalized monthly forecast.
3. WA leaderboard broadcast — "Yours is the 4th rarest archetype in India this week."
4. Pre-filled IG story OG template (`/api/og?template=story`).
5. Custom share text per archetype — "I am The Saturn-Mercury Strategist 🪔 — what are you?"

**Tier 2 — engagement/LTV:**
6. ₹49 detailed kundli PDF (10 pages: houses, dasha timeline, gemstones).
7. `/wall` — public ranking of most-shared archetypes.
8. Birthday WA trigger.
9. "Rashify Daily" — 7-day transit habit-builder.
10. ElevenLabs voice-note version for WA family groups.

**Tier 3 — virality:**
11. Bollywood celebrity twin lookup ("You share archetype with Ratan Tata").
12. Anonymous Q&A — LLM responds in archetype voice.
13. City rankings ("12% of Mumbai are Strategists").
14. Founder Mode — LinkedIn-shareable business-archetype overlay.
15. Meme generator: "When your Saturn is in retrograde…" auto-personalized.

**Tier 4 — long-tail:** kundli milan, pandit booking marketplace, Telegram/Discord bots.

---

## 9. Open Questions / Risks

- **Prokerala API quality on edge cases** (pre-1947 DOB, non-Indian locations). Smoke-test 10 varied charts before launch.
- **AiSensy template approval lag** — could exceed 24h. Mitigation: ship without WA send Day-1, enable on approval.
- **Domain DNS propagation** — buy `rashify.in` H+0; can take 1-12h. Soft-launch on `*.vercel.app` if DNS slow.
- **DPDP Act enforcement** — currently soft; consent + deletion mechanism is sufficient for v1, but monitor regulator guidance.
- **Tier-2 city geocoding gaps** — pre-warm cache, but expect ~5% form-failure rate on first day from "Bhubaneswar"-class typos. Fix iteratively from PostHog `form_submit_fail` data.

---

## 10. Success Criteria (Day-7 review)

- ≥500 leads captured (phone + consent).
- K-factor (`leads.referrer_slug != null` rate) ≥ 0.3.
- Funnel `landing_view → form_submit_success` ≥ 25%.
- Funnel `form_submit_success → share_wa_click` ≥ 40%.
- Zero DPDP-noncompliance incidents.
- WA template approved + delivering with ≥80% read rate.

If K-factor < 0.2 after Day-3, ship compat flow (A+C) Day-4 — that's the planned virality unlock.
