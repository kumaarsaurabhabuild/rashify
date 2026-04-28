import type { Chart, Planet } from './chart-types';

const TOKEN_URL = 'https://api.prokerala.com/token';
const KUNDLI_URL = 'https://api.prokerala.com/v2/astrology/kundli/advanced';
const PLANETS_URL = 'https://api.prokerala.com/v2/astrology/planet-position';

let cachedToken: { value: string; expiresAt: number } | null = null;

export function _resetTokenCacheForTests() {
  cachedToken = null;
}

async function getToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.value;
  const id = process.env.PROKERALA_CLIENT_ID;
  const secret = process.env.PROKERALA_CLIENT_SECRET;
  if (!id || !secret) throw new Error('PROKERALA_CREDS_MISSING');
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: id,
    client_secret: secret,
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error('PROKERALA_AUTH_FAILED');
  const j = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: j.access_token, expiresAt: Date.now() + j.expires_in * 1000 };
  return j.access_token;
}

export interface ChartInput {
  datetime: string; // ISO8601 with offset
  lat: number;
  lon: number;
  tzOffset: number;
}

interface KundliRaw {
  data: {
    nakshatra_details: {
      nakshatra: { name: string; pada: number; lord: { name: string } };
      chandra_rasi: { name: string };
      soorya_rasi: { name: string };
      additional_info?: {
        deity?: string;
        animal_sign?: string;
        color?: string;
        best_direction?: string;
        birth_stone?: string;
      };
    };
    mangal_dosha: { has_dosha: boolean };
    yoga_details?: Array<{
      yoga_list?: Array<{ name: string; has_yoga: boolean }>;
    }>;
    dasha_periods?: DashaPeriod[];
  };
}

interface DashaPeriod {
  name: string;
  start: string;
  end: string;
  antardasha?: DashaPeriod[];
}

interface PlanetsRaw {
  data: {
    planet_position: Array<{
      name: string;
      position: number;
      degree: number;
      is_retrograde: boolean;
      rasi: { name: string; lord: { name: string } };
    }>;
  };
}

function findCurrentDasha(
  periods: DashaPeriod[] | undefined,
  now: Date,
): Chart['currentDasha'] {
  if (!periods || periods.length === 0) return null;
  const md = periods.find((p) => new Date(p.start) <= now && now < new Date(p.end));
  if (!md) return null;
  const ad = (md.antardasha ?? []).find(
    (a) => new Date(a.start) <= now && now < new Date(a.end),
  );
  if (!ad) {
    return { mahadasha: md.name, antardasha: md.name, start: md.start, end: md.end };
  }
  return { mahadasha: md.name, antardasha: ad.name, start: ad.start, end: ad.end };
}

function activeYogaNames(yd: KundliRaw['data']['yoga_details']): string[] {
  if (!yd) return [];
  return yd.flatMap((cat) => (cat.yoga_list ?? []).filter((y) => y.has_yoga).map((y) => y.name));
}

function planetsFromRaw(raw: PlanetsRaw): { ascendant: Planet; planets: Planet[] } {
  const planets: Planet[] = raw.data.planet_position.map((p) => ({
    name: p.name,
    rasi: p.rasi.name,
    rasiLord: p.rasi.lord.name,
    house: p.position,
    degree: p.degree,
    isRetrograde: p.is_retrograde,
  }));
  const ascendant = planets.find((p) => p.name === 'Ascendant');
  if (!ascendant) throw new Error('PROKERALA_NO_ASCENDANT');
  return { ascendant, planets };
}

async function callProkerala<T>(url: string, params: URLSearchParams, token: string): Promise<T> {
  const res = await fetch(`${url}?${params}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (res.ok) return (await res.json()) as T;
  if (res.status === 429) throw new Error('PROKERALA_RATE_LIMIT');
  if (res.status === 401 || res.status === 403) throw new Error('PROKERALA_AUTH_FAILED');
  if (res.status >= 500) throw new Error(`PROKERALA_5XX_${res.status}`);
  // 4xx other than 401/403/429 — likely bad input (e.g. sandbox date restriction)
  const body = await res.text().catch(() => '');
  throw new Error(`PROKERALA_4XX_${res.status}: ${body.slice(0, 200)}`);
}

export async function fetchChart(input: ChartInput, now: Date = new Date()): Promise<Chart> {
  const tok = await getToken();
  const params = new URLSearchParams({
    ayanamsa: '1', // 1 = Lahiri
    coordinates: `${input.lat},${input.lon}`,
    datetime: input.datetime,
  });

  const [kundli, planetsRaw] = await Promise.all([
    callProkerala<KundliRaw>(KUNDLI_URL, params, tok),
    callProkerala<PlanetsRaw>(PLANETS_URL, params, tok),
  ]);

  const nd = kundli.data.nakshatra_details;
  const ai = nd.additional_info ?? {};
  const { ascendant, planets } = planetsFromRaw(planetsRaw);

  return {
    ayanamsa: 'Lahiri',
    nakshatra: { name: nd.nakshatra.name, pada: nd.nakshatra.pada, lord: nd.nakshatra.lord.name },
    moonSign: nd.chandra_rasi.name,
    sunSign: nd.soorya_rasi.name,
    ascendant,
    planets,
    currentDasha: findCurrentDasha(kundli.data.dasha_periods, now),
    activeYogas: activeYogaNames(kundli.data.yoga_details),
    mangalDosha: kundli.data.mangal_dosha.has_dosha,
    additionalInfo: {
      luckyColor: ai.color ?? 'Unknown',
      bestDirection: ai.best_direction ?? 'Unknown',
      deity: ai.deity ?? 'Unknown',
      animalSign: ai.animal_sign ?? 'Unknown',
      birthStone: ai.birth_stone ?? 'Unknown',
    },
    tzOffset: input.tzOffset,
  };
}
