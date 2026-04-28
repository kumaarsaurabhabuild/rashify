import type { Chart, Planet } from './chart-types';

const DEFAULT_URL = 'http://localhost:8080';

export interface ChartInput {
  birthDate: string;   // YYYY-MM-DD
  birthTime: string;   // HH:MM
  lat: number;
  lon: number;
}

interface PlanetRaw {
  name: string;
  rasi: string;
  rasi_lord: string;
  house: number;
  degree: number;
  is_retrograde: boolean;
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
    name: p.name,
    rasi: p.rasi,
    rasiLord: p.rasi_lord,
    house: p.house,
    degree: p.degree,
    isRetrograde: p.is_retrograde,
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
      luckyColor: 'Unknown',
      bestDirection: 'Unknown',
      deity: 'Unknown',
      animalSign: 'Unknown',
      birthStone: 'Unknown',
    },
    tzOffset: raw.tz_offset,
  };
}

export async function fetchChart(input: ChartInput): Promise<Chart> {
  const url = (process.env.CHART_ENGINE_URL ?? DEFAULT_URL).replace(/\/$/, '');
  const res = await fetch(`${url}/chart`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      birth_date: input.birthDate,
      birth_time: input.birthTime,
      lat: input.lat,
      lon: input.lon,
    }),
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    if (res.status === 400) throw new Error(`ENGINE_BAD_INPUT: ${body.slice(0, 200)}`);
    if (res.status >= 500) throw new Error(`ENGINE_5XX_${res.status}: ${body.slice(0, 200)}`);
    throw new Error(`ENGINE_4XX_${res.status}: ${body.slice(0, 200)}`);
  }

  const raw = (await res.json()) as ChartRaw;
  return toChart(raw);
}
