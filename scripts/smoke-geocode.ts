/* Live geocode → Supabase cache → re-fetch hits cache.
   Run: npx tsx --env-file=.env.local --tsconfig tsconfig.json scripts/smoke-geocode.ts
*/
import { geocode } from '@/lib/astro/geocode';
import { serverClient } from '@/lib/db/supabase';

async function main() {
  const place = 'Mumbai';

  console.log(`▶ Geocoding "${place}" (cache miss expected first run)...`);
  const a = await geocode(place);
  console.log(`✓ Got: lat=${a.lat}, lon=${a.lon}, tzOffset=${a.tzOffset}, cacheHit=${a.cacheHit}`);

  console.log(`\n▶ Geocoding "${place}" again (cache hit expected)...`);
  const b = await geocode(place);
  console.log(`✓ Got: lat=${b.lat}, lon=${b.lon}, tzOffset=${b.tzOffset}, cacheHit=${b.cacheHit}`);

  console.log('\n▶ Verifying row in geocode_cache table...');
  const sb = serverClient();
  const { data, error } = await sb.from('geocode_cache').select('*').eq('query_norm', 'mumbai').maybeSingle();
  if (error) {
    console.error('❌', error.message);
  } else {
    console.log('✓ row:', data);
  }

  // Cleanup so subsequent runs re-test the miss path
  await sb.from('geocode_cache').delete().eq('query_norm', 'mumbai');
  console.log('\n▶ Cleanup done (deleted mumbai row).');
}

main().catch((err) => {
  console.error('❌ Fatal:', err);
  process.exit(1);
});
