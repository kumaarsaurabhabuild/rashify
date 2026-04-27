import { ImageResponse } from 'next/og';
import { ShareCard } from '@/components/ShareCard';
import { getCardBySlug } from '@/lib/db/leads';
import { ArchetypeZ } from '@/lib/astro/chart-types';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get('slug');
  if (!slug) return new Response('missing slug', { status: 400 });

  const card = await getCardBySlug(slug);
  if (!card) return new Response('not found', { status: 404 });

  const parsed = ArchetypeZ.safeParse(card.archetype);
  if (!parsed.success) return new Response('bad archetype', { status: 500 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';

  return new ImageResponse(
    <ShareCard archetype={parsed.data} slug={slug} appUrl={appUrl} />,
    {
      width: 1080,
      height: 1920,
      headers: {
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      },
    },
  );
}
