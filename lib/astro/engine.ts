import type { Chart, Planet } from './chart-types';

const DEFAULT_URL = 'http://localhost:8080';

export interface ChartInput {
  birthDate: string;
  birthTime: string;
  lat: number;
  lon: number;
}

interface PlanetRaw {
  name: string; rasi: string; rasi_lord: string;
  house: number; degree: number; is_retrograde: boolean;
}
interface ChartRaw {
  ayanamsa: string;
  nakshatra: { name: string; pada: number; lord: string };
  moon_sign: string;
  sun_sign: string;
  ascendant: PlanetRaw;
  planets: PlanetRaw[];
  current_dasha: { mahadasha: string; antardasha: string; start: string; end: string } | null;
  active_yogas: string[];
  mangal_dosha: boolean;
  tz_offset: number;
}

function toPlanet(p: PlanetRaw): Planet {
  return {
    name: p.name, rasi: p.rasi, rasiLord: p.rasi_lord,
    house: p.house, degree: p.degree, isRetrograde: p.is_retrograde,
  };
}

function toChart(raw: ChartRaw): Chart {
  return {
    ayanamsa: raw.ayanamsa,
    nakshatra: raw.nakshatra,
    moonSign: raw.moon_sign,
    sunSign: raw.sun_sign,
    ascendant: toPlanet(raw.ascendant),
    planets: raw.planets.map(toPlanet),
    currentDasha: raw.current_dasha,
    activeYogas: raw.active_yogas,
    mangalDosha: raw.mangal_dosha,
    additionalInfo: {
      luckyColor: 'Unknown', bestDirection: 'Unknown',
      deity: 'Unknown', animalSign: 'Unknown', birthStone: 'Unknown',
    },
    tzOffset: raw.tz_offset,
  };
}

function engineUrl(): string {
  return (process.env.CHART_ENGINE_URL ?? DEFAULT_URL).replace(/\/$/, '');
}

export async function fetchChart(input: ChartInput): Promise<Chart> {
  const res = await fetch(`${engineUrl()}/chart`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      birth_date: input.birthDate, birth_time: input.birthTime,
      lat: input.lat, lon: input.lon,
    }),
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`ENGINE_${res.status}: ${body.slice(0, 200)}`);
  }
  return toChart((await res.json()) as ChartRaw);
}

/** Fire-and-forget the heavy /generate-full endpoint. Don't await response. */
export async function triggerFullProfile(input: ChartInput & { slug: string }): Promise<void> {
  // Use a short timeout so we don't block /api/generate if HF is slow.
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 3000);
  try {
    await fetch(`${engineUrl()}/generate-full`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: input.slug, birth_date: input.birthDate, birth_time: input.birthTime,
        lat: input.lat, lon: input.lon,
      }),
      signal: controller.signal,
    });
  } catch {
    // Even if our trigger times out, HF likely received and started the thread.
    // Cron checker will catch any truly stuck rows.
  } finally {
    clearTimeout(t);
  }
}
