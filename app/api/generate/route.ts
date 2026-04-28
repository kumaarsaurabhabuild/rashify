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
