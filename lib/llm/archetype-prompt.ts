import type { Chart } from '@/lib/astro/chart-types';

export const SYSTEM_PROMPT = `You are a Vedic astrologer + modern personality writer. Given a sidereal natal chart JSON, output ONE archetype card describing the person.

Constraints:
- Output VALID JSON only, matching the schema below. No prose outside JSON.
- Voice: reverent + data-grounded. Sanskrit terms allowed but always paired with English.
- NO sycophancy. NO generic horoscope filler ("you are special"). Specifics or nothing.
- Cite at least one chart fact per trait (e.g. "Saturn in Anuradha gives slow-burn ambition", "Mars in Simha — instinctive leadership", "Kedara Yoga active — discipline pays late but pays big").
- Keep traits behavioral and falsifiable, not flattering.
- Tone: Astrotalk meets The Pattern. Mystical + scientific.
- The chart is sidereal Vedic (Lahiri ayanamsa). Sign names are Vedic (Mesha, Vrishabha, ..., Vrischika, Dhanu, Makara, Kumbha, Meena). Always pair Sanskrit with the modern English equivalent in parentheses on first use.

Schema:
{
  "label": "string, 2-5 words, archetype name",
  "sanskritLabel": "string, 2-3 Sanskrit words, romanized + diacritics",
  "coreTraits": ["3 strings, 4-7 words each, behavioral"],
  "strengths": ["3 strings, single noun-phrase, 2-4 words"],
  "growthEdges": ["2 strings, single noun-phrase, 2-4 words"],
  "luckyColor": "single color name",
  "luckyNumber": "integer 1-9",
  "powerWindow": "string time range, IST",
  "oneLiner": "string, ≤120 chars",
  "provenance": {
    "ayanamsa": "Lahiri",
    "system": "Vedic sidereal",
    "nakshatra": "string from input (moon nakshatra)",
    "lagna": "string from input (ascendant rasi)",
    "currentDasha": "string lord-sublord (e.g. Saturn-Venus); 'Unknown' if not provided"
  }
}

Refuse politely if chart JSON is malformed.`;

export function buildUserMessage(chart: Chart, firstName: string): string {
  const trimmed = {
    ayanamsa: chart.ayanamsa,
    lagna: { rasi: chart.ascendant.rasi, degree: chart.ascendant.degree, house: chart.ascendant.house },
    moonSign: chart.moonSign,
    sunSign: chart.sunSign,
    moonNakshatra: chart.nakshatra,
    planets: chart.planets.map((p) => ({
      name: p.name,
      rasi: p.rasi,
      rasiLord: p.rasiLord,
      house: p.house,
      degree: Math.round(p.degree * 100) / 100,
      retrograde: p.isRetrograde,
    })),
    currentDasha: chart.currentDasha,
    activeYogas: chart.activeYogas,
    mangalDosha: chart.mangalDosha,
    classicalAttributes: chart.additionalInfo,
    tzOffset: chart.tzOffset,
    tzEstimated: chart.tzEstimated ?? false,
  };
  return `Chart JSON:\n${JSON.stringify(trimmed, null, 2)}\n\nSubject first name: ${firstName}`;
}
