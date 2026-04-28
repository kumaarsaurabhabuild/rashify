import { NextResponse } from 'next/server';
import { z } from 'zod';
import { geocode } from '@/lib/astro/geocode';
import { fetchChart } from '@/lib/astro/prokerala';
import { fallbackArchetype } from '@/lib/llm/fallback-archetype';
import { insertReadyLead } from '@/lib/db/leads';
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

/* Sync pipeline: validate → geocode → Prokerala → deterministic archetype
 * lookup → insert ready row → fire-and-forget WA. ~3-7s typical, fits in
 * Vercel hobby's 10s budget. The archetype source is the 4-element fallback
 * for v1; a 324-row lagna×nakshatra lookup can layer in later. */
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
  const startedAt = Date.now();
  trackServer(distinctId, Events.GEN_PIPELINE_START);

  try {
    const t0 = Date.now();
    const geo = await geocode(body.birthPlace);
    trackServer(distinctId, Events.GEN_GEOCODE_OK, {
      duration_ms: Date.now() - t0, cache_hit: geo.cacheHit,
    });

    const t1 = Date.now();
    const datetime = `${body.dobDate}T${body.dobTime}:00+05:30`;
    const chart = await fetchChart({
      datetime, lat: geo.lat, lon: geo.lon, tzOffset: geo.tzOffset,
    });
    trackServer(distinctId, Events.GEN_PROKERALA_OK, { duration_ms: Date.now() - t1 });

    const archetype = fallbackArchetype(chart);
    const firstName = body.name.split(/\s+/)[0];

    const { slug, isNew } = await insertReadyLead({
      name: body.name, phoneE164: body.phoneE164,
      dobDate: body.dobDate, dobTime: body.dobTime, birthPlace: body.birthPlace,
      lat: geo.lat, lon: geo.lon, tzOffset: geo.tzOffset,
      chartJson: chart, archetype,
      ipHash: ipH, referrerSlug: body.referrerSlug ?? null, utm: body.utm ?? null,
    });

    if (isNew) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
      const ogUrl = `${appUrl}/api/og?slug=${slug}`;
      sendArchetype({ phoneE164: body.phoneE164, firstName, slug, archetype, ogUrl })
        .catch((err) => trackServer(slug, Events.GEN_PIPELINE_FAIL, {
          step: 'wa_send', error: err instanceof Error ? err.message : String(err),
        }));
    }

    trackServer(slug, Events.GEN_PIPELINE_DONE, { total_ms: Date.now() - startedAt });
    await flushTelemetry();

    return NextResponse.json({ slug, isNew, archetype });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'UNKNOWN';
    trackServer(distinctId, Events.GEN_PIPELINE_FAIL, { error: msg });
    await flushTelemetry();
    if (msg === 'GEOCODE_FAILED') {
      return NextResponse.json({ error: 'GEOCODE_FAILED' }, { status: 400 });
    }
    if (msg === 'PROKERALA_RATE_LIMIT') {
      return NextResponse.json({ error: 'RATE_LIMIT' }, { status: 429 });
    }
    if (msg.startsWith('PROKERALA_')) {
      return NextResponse.json({ error: 'PROKERALA_DOWN' }, { status: 502 });
    }
    return NextResponse.json({ error: 'INTERNAL' }, { status: 500 });
  }
}
