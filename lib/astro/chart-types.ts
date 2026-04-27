import { z } from 'zod';

const PlanetZ = z.object({
  name: z.string(),
  sign: z.string(),
  house: z.number().int().min(1).max(12),
  degree: z.number(),
  nakshatra: z.string(),
  pada: z.number().int().min(1).max(4),
});

export const ChartZ = z.object({
  ayanamsa: z.string(),
  lagna: z.object({ sign: z.string(), degree: z.number() }),
  sun: PlanetZ,
  moon: PlanetZ,
  planets: z.array(PlanetZ),
  dasha: z.object({
    mahadasha: z.string(),
    antardasha: z.string(),
    start: z.string(),
    end: z.string(),
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
