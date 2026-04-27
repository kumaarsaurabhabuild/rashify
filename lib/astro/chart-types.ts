import { z } from 'zod';

export const PlanetZ = z.object({
  name: z.string(),                  // 'Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Rahu', 'Ketu', 'Ascendant'
  rasi: z.string(),                  // sign name (Vedic, e.g. 'Dhanu')
  rasiLord: z.string(),              // ruling planet of the sign
  house: z.number().int().min(1).max(12),
  degree: z.number(),
  isRetrograde: z.boolean(),
});
export type Planet = z.infer<typeof PlanetZ>;

export const NakshatraZ = z.object({
  name: z.string(),
  pada: z.number().int().min(1).max(4),
  lord: z.string(),
});

export const ChartZ = z.object({
  ayanamsa: z.string(),                                // 'Lahiri'
  nakshatra: NakshatraZ,                                // moon nakshatra
  moonSign: z.string(),                                 // chandra_rasi
  sunSign: z.string(),                                  // soorya_rasi
  ascendant: PlanetZ,                                   // the Ascendant entry — its `rasi` is lagna
  planets: z.array(PlanetZ),                            // all 10 incl. Ascendant
  currentDasha: z
    .object({
      mahadasha: z.string(),
      antardasha: z.string(),
      start: z.string(),
      end: z.string(),
    })
    .nullable(),
  activeYogas: z.array(z.string()),                     // names of has_yoga=true
  mangalDosha: z.boolean(),
  additionalInfo: z.object({
    luckyColor: z.string(),
    bestDirection: z.string(),
    deity: z.string(),
    animalSign: z.string(),
    birthStone: z.string(),
  }),
  tzOffset: z.number(),
  tzEstimated: z.boolean().optional(),
});
export type Chart = z.infer<typeof ChartZ>;

export const ArchetypeZ = z.object({
  label: z.string().min(2),
  sanskritLabel: z.string().min(2),
  coreTraits: z.array(z.string()).length(3),
  strengths: z.array(z.string()).length(3),
  growthEdges: z.array(z.string()).length(2),
  luckyColor: z.string(),
  luckyNumber: z.number().int().min(1).max(9),
  powerWindow: z.string(),
  oneLiner: z.string().max(140),
  provenance: z.object({
    ayanamsa: z.string(),
    system: z.string(),
    nakshatra: z.string(),
    lagna: z.string(),
    currentDasha: z.string(),
  }),
});
export type Archetype = z.infer<typeof ArchetypeZ>;
