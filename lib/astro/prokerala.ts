import type { Chart } from './chart-types';

const TOKEN_URL = 'https://api.prokerala.com/token';
const KUNDLI_URL = 'https://api.prokerala.com/v2/astrology/kundli';

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.value;
  const id = process.env.PROKERALA_CLIENT_ID!;
  const secret = process.env.PROKERALA_CLIENT_SECRET!;
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
  datetime: string;   // ISO8601 with offset
  lat: number;
  lon: number;
  tzOffset: number;
}

export async function fetchChart(input: ChartInput): Promise<Chart> {
  const tok = await getToken();
  const params = new URLSearchParams({
    ayanamsa: '1',                              // 1 = Lahiri
    coordinates: `${input.lat},${input.lon}`,
    datetime: input.datetime,
  });
  const res = await fetch(`${KUNDLI_URL}?${params}`, {
    headers: { Authorization: `Bearer ${tok}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error('PROKERALA_DOWN');
  const { data } = (await res.json()) as { data: ProkRaw };
  return mapToChart(data, input.tzOffset);
}

interface ProkRaw {
  ayanamsa: { name: string };
  lagna: { sign: string; longitude: number };
  planets: Array<{
    name: string;
    sign: string;
    house: number;
    longitude: number;
    nakshatra: { name: string; pada: number };
  }>;
  dasha: { mahadasha: string; antardasha: string; start_date: string; end_date: string };
}

function mapToChart(d: ProkRaw, tzOffset: number): Chart {
  const sun = d.planets.find((p) => p.name === 'Sun')!;
  const moon = d.planets.find((p) => p.name === 'Moon')!;
  const norm = (p: ProkRaw['planets'][number]) => ({
    name: p.name, sign: p.sign, house: p.house,
    degree: p.longitude, nakshatra: p.nakshatra.name, pada: p.nakshatra.pada,
  });
  return {
    ayanamsa: d.ayanamsa.name,
    lagna: { sign: d.lagna.sign, degree: d.lagna.longitude },
    sun: norm(sun),
    moon: norm(moon),
    planets: d.planets.map(norm),
    dasha: {
      mahadasha: d.dasha.mahadasha,
      antardasha: d.dasha.antardasha,
      start: d.dasha.start_date,
      end: d.dasha.end_date,
    },
    tzOffset,
  };
}
