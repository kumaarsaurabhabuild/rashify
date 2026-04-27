/* Live smoke: Prokerala kundli + OpenRouter archetype, no Supabase needed.
   Run: npx tsx --env-file=.env.local scripts/smoke-llm.ts
*/
import { fetchChart } from '@/lib/astro/prokerala';
import { generateArchetype } from '@/lib/llm/gemini';

async function main() {
  console.log('▶ Fetching chart from Prokerala (sandbox: Jan 1 only)...');
  const chart = await fetchChart({
    datetime: '1995-01-01T14:30:00+05:30',
    lat: 19.0760,
    lon: 72.8777,
    tzOffset: 330,
  });
  console.log('✓ Chart received.');
  console.log('  Lagna:', chart.ascendant.rasi, `(${chart.ascendant.degree.toFixed(2)}°)`);
  console.log('  Moon:', chart.moonSign, '·', chart.nakshatra.name, 'pada', chart.nakshatra.pada);
  console.log('  Sun:', chart.sunSign);
  console.log('  Active yogas:', chart.activeYogas.join(', ') || '(none)');
  console.log('  Current dasha:', chart.currentDasha
    ? `${chart.currentDasha.mahadasha}-${chart.currentDasha.antardasha}`
    : 'unknown');

  console.log('\n▶ Generating archetype via OpenRouter (gemini-2.0-flash)...');
  const archetype = await generateArchetype(chart, 'Saurabh');
  console.log('✓ Archetype received:\n');
  console.log(JSON.stringify(archetype, null, 2));
}

main().catch((err) => {
  console.error('❌', err);
  process.exit(1);
});
