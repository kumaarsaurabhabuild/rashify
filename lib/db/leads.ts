import { serverClient } from './supabase';
import { makeSlug } from '@/lib/slug';

export interface InsertLeadInput {
  name: string;
  phoneE164: string;
  dobDate: string;
  dobTime: string;
  birthPlace: string;
  lat: number;
  lon: number;
  tzOffset: number;
  chartJson: unknown;
  archetype: unknown;
  ipHash: string | null;
  referrerSlug: string | null;
  utm: unknown | null;
}

export async function insertOrFetchLead(input: InsertLeadInput): Promise<{ slug: string; isNew: boolean }> {
  const sb = serverClient();

  const existing = await sb
    .from('leads')
    .select('slug')
    .eq('phone_e164', input.phoneE164)
    .is('deleted_at', null)
    .maybeSingle();

  if (existing.data?.slug) return { slug: existing.data.slug, isNew: false };

  const slug = makeSlug(input.name);
  const { data, error } = await sb
    .from('leads')
    .insert({
      slug,
      name: input.name,
      phone_e164: input.phoneE164,
      dob_date: input.dobDate,
      dob_time: input.dobTime,
      birth_place: input.birthPlace,
      lat: input.lat, lon: input.lon, tz_offset: input.tzOffset,
      chart_json: input.chartJson,
      archetype: input.archetype,
      referrer_slug: input.referrerSlug,
      utm: input.utm,
      ip_hash: input.ipHash,
      consent_at: new Date().toISOString(),
    })
    .select('slug')
    .single();

  if (error || !data) throw new Error(`LEAD_INSERT_FAILED: ${error?.message ?? 'unknown'}`);
  return { slug: data.slug, isNew: true };
}

export interface PublicCard {
  slug: string;
  name: string;
  archetype: unknown;
  created_at: string;
  referrer_slug: string | null;
}

export async function getCardBySlug(slug: string): Promise<PublicCard | null> {
  const sb = serverClient();
  const { data } = await sb
    .from('public_card')
    .select('slug, name, archetype, created_at, referrer_slug')
    .eq('slug', slug)
    .maybeSingle();
  return (data as PublicCard | null) ?? null;
}
