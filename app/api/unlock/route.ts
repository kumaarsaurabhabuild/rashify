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
