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
