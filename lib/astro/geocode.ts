import { serverClient } from '@/lib/db/supabase';

export interface GeocodeResult {
  lat: number;
  lon: number;
  tzOffset: number;   // minutes east of UTC
  cacheHit: boolean;
}

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const IST_OFFSET = 330;

function norm(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, ' ');
}

export async function geocode(query: string): Promise<GeocodeResult> {
  const key = norm(query);
  const sb = serverClient();

  const { data: cached } = await sb
    .from('geocode_cache')
    .select('lat, lon, tz_offset')
    .eq('query_norm', key)
    .maybeSingle();

  if (cached) {
    return { lat: cached.lat, lon: cached.lon, tzOffset: cached.tz_offset, cacheHit: true };
  }

  const url = `${NOMINATIM}?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=in`;
  const res = await fetch(url, { headers: { 'User-Agent': 'rashify.in/1.0' } });
  if (!res.ok) throw new Error('GEOCODE_FAILED');
  const arr = (await res.json()) as Array<{ lat: string; lon: string }>;
  if (arr.length === 0) throw new Error('GEOCODE_FAILED');

  const lat = parseFloat(arr[0].lat);
  const lon = parseFloat(arr[0].lon);
  const tzOffset = IST_OFFSET; // India-only v1; refine later

  await sb.from('geocode_cache').upsert({
    query_norm: key, lat, lon, tz_offset: tzOffset,
  });

  return { lat, lon, tzOffset, cacheHit: false };
}
