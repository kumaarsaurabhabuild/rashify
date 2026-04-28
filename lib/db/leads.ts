import { serverClient } from './supabase';
import { makeSlug } from '@/lib/slug';

export type LeadStatus = 'pending' | 'processing' | 'ready' | 'failed';

export interface InsertPendingInput {
  name: string;
  phoneE164: string;
  dobDate: string;
  dobTime: string;
  birthPlace: string;
  lat: number;
  lon: number;
  tzOffset: number;
  ipHash: string | null;
  referrerSlug: string | null;
  utm: unknown | null;
}

/* Insert pending row OR return existing fully-ready row's slug for dedupe. */
export async function insertPendingProfile(
  input: InsertPendingInput,
): Promise<{ slug: string; isNew: boolean }> {
  const sb = serverClient();

  const existing = await sb
    .from('leads')
    .select('slug')
    .eq('phone_e164', input.phoneE164)
    .eq('status', 'ready')
    .not('archetype', 'is', null)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing.data?.slug) return { slug: existing.data.slug, isNew: false };

  const slug = makeSlug(input.name);
  const { data, error } = await sb
    .from('leads')
    .insert({
      slug, name: input.name, phone_e164: input.phoneE164,
      dob_date: input.dobDate, dob_time: input.dobTime,
      birth_place: input.birthPlace,
      lat: input.lat, lon: input.lon, tz_offset: input.tzOffset,
      status: 'pending',
      chart_json: null, archetype: null,
      domain_teasers: null, domain_full: null, citations: null,
      referrer_slug: input.referrerSlug, utm: input.utm,
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
  domain_teasers: unknown;
  status: LeadStatus;
  error: string | null;
  created_at: string;
  referrer_slug: string | null;
}

/* Read public_card view — teasers always exposed once status='ready'. */
export async function getCardBySlug(slug: string): Promise<PublicCard | null> {
  const sb = serverClient();
  const { data } = await sb
    .from('public_card')
    .select('slug, name, archetype, domain_teasers, status, error, created_at, referrer_slug')
    .eq('slug', slug)
    .maybeSingle();
  return (data as PublicCard | null) ?? null;
}

export interface UnlockedCard extends PublicCard {
  domain_full: unknown;
  citations: unknown;
}

/* Read unlocked_card view — only rows with unlocked_at set return full content. */
export async function getUnlockedCardBySlug(slug: string): Promise<UnlockedCard | null> {
  const sb = serverClient();
  const { data } = await sb
    .from('unlocked_card')
    .select('slug, name, archetype, domain_teasers, domain_full, citations, status, created_at')
    .eq('slug', slug)
    .maybeSingle();
  return (data as UnlockedCard | null) ?? null;
}

/* Server-side mark: idempotent — only sets unlocked_at if currently null. */
export async function markUnlocked(
  slug: string,
  via: 'wa' | 'ig' | 'copy',
): Promise<{ ok: boolean }> {
  const sb = serverClient();
  const { error } = await sb
    .from('leads')
    .update({ unlocked_at: new Date().toISOString(), unlocked_via: via })
    .eq('slug', slug)
    .is('unlocked_at', null);
  if (error) throw new Error(`UNLOCK_FAILED: ${error.message}`);
  return { ok: true };
}

/* Cron / stuck-row recovery — find rows still pending past a deadline. */
export async function findStuckPending(olderThanMs: number): Promise<Array<{ slug: string; lat: number; lon: number; dobDate: string; dobTime: string; tzOffset: number }>> {
  const sb = serverClient();
  const cutoff = new Date(Date.now() - olderThanMs).toISOString();
  const { data } = await sb
    .from('leads')
    .select('slug, lat, lon, dob_date, dob_time, tz_offset')
    .eq('status', 'pending')
    .lt('created_at', cutoff)
    .limit(20);
  return (data ?? []).map((r) => ({
    slug: r.slug, lat: r.lat, lon: r.lon,
    dobDate: r.dob_date, dobTime: r.dob_time, tzOffset: r.tz_offset,
  }));
}
