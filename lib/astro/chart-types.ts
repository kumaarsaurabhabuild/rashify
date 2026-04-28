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

export const DOMAIN_KEYS = ['career', 'health', 'love', 'wealth', 'spiritual'] as const;
export type DomainKey = typeof DOMAIN_KEYS[number];

const StringRecordZ = z.object({
  career: z.string(),
  health: z.string(),
  love: z.string(),
  wealth: z.string(),
  spiritual: z.string(),
});

const StringArrayRecordZ = z.object({
  career: z.array(z.string()),
  health: z.array(z.string()),
  love: z.array(z.string()),
  wealth: z.array(z.string()),
  spiritual: z.array(z.string()),
});

export const DomainTeasersZ = StringRecordZ;
export const DomainFullZ = StringRecordZ;
export const DomainCitationsZ = StringArrayRecordZ;

export type DomainTeasers = z.infer<typeof DomainTeasersZ>;
export type DomainFull = z.infer<typeof DomainFullZ>;
export type DomainCitations = z.infer<typeof DomainCitationsZ>;

export const FullProfileZ = z.object({
  archetype: ArchetypeZ,
  domain_teasers: DomainTeasersZ,
  domain_full: DomainFullZ,
  citations: DomainCitationsZ,
});
export type FullProfile = z.infer<typeof FullProfileZ>;
