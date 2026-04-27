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
