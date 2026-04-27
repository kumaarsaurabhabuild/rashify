/* Probe Supabase connection + verify migration ran.
   Run: npx tsx --env-file=.env.local --tsconfig tsconfig.json scripts/smoke-supabase.ts
*/
import { serverClient } from '@/lib/db/supabase';

async function main() {
  const sb = serverClient();

  console.log('▶ leads table reachable?');
  const leads = await sb.from('leads').select('id', { count: 'exact', head: true });
  if (leads.error) {
    console.error('❌ leads:', leads.error.message);
  } else {
    console.log(`✓ leads — count=${leads.count ?? 0}`);
  }

  console.log('\n▶ geocode_cache table reachable?');
  const gc = await sb.from('geocode_cache').select('query_norm', { count: 'exact', head: true });
  if (gc.error) {
    console.error('❌ geocode_cache:', gc.error.message);
  } else {
    console.log(`✓ geocode_cache — count=${gc.count ?? 0}`);
  }

  console.log('\n▶ wa_log table reachable?');
  const wl = await sb.from('wa_log').select('id', { count: 'exact', head: true });
  if (wl.error) {
    console.error('❌ wa_log:', wl.error.message);
  } else {
    console.log(`✓ wa_log — count=${wl.count ?? 0}`);
  }

  console.log('\n▶ public_card view reachable?');
  const pc = await sb.from('public_card').select('slug', { count: 'exact', head: true });
  if (pc.error) {
    console.error('❌ public_card:', pc.error.message);
  } else {
    console.log(`✓ public_card — count=${pc.count ?? 0}`);
  }
}

main().catch((err) => {
  console.error('❌ Fatal:', err);
  process.exit(1);
});
