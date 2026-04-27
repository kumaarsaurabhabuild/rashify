import type { Archetype } from '@/lib/astro/chart-types';

export interface ArchetypeTemplatePayload {
  apiKey: string;
  campaignName: string;
  destination: string;            // phone E.164 minus '+'
  userName: string;               // first name
  templateParams: string[];       // ordered: slug, firstName, label, sanskritLabel, t1, t2, t3
  source: 'rashify-web';
  media: { url: string; filename: string };
}

export function buildArchetypePayload(args: {
  apiKey: string;
  campaignName: string;
  phoneE164: string;
  firstName: string;
  slug: string;
  archetype: Archetype;
  ogUrl: string;
}): ArchetypeTemplatePayload {
  const traits = args.archetype.coreTraits;
  return {
    apiKey: args.apiKey,
    campaignName: args.campaignName,
    destination: args.phoneE164.replace(/^\+/, ''),
    userName: args.firstName,
    templateParams: [
      args.slug,
      args.firstName,
      args.archetype.label,
      args.archetype.sanskritLabel,
      traits[0], traits[1], traits[2],
    ],
    source: 'rashify-web',
    media: { url: args.ogUrl, filename: `${args.slug}.png` },
  };
}
