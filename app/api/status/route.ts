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
