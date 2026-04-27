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
    } catch {
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
