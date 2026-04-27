import { buildArchetypePayload, type ArchetypeTemplatePayload } from './templates';
import type { Archetype } from '@/lib/astro/chart-types';

const AISENSY_URL = 'https://backend.aisensy.com/campaign/t1/api/v2';

export interface SendArgs {
  phoneE164: string;
  firstName: string;
  slug: string;
  archetype: Archetype;
  ogUrl: string;
}

export interface SendResult {
  status: 'queued' | 'failed';
  payload: ArchetypeTemplatePayload;
  error?: string;
}

export async function sendArchetype(args: SendArgs): Promise<SendResult> {
  const apiKey = process.env.AISENSY_API_KEY!;
  const campaignName = process.env.AISENSY_CAMPAIGN_NAME!;
  const payload = buildArchetypePayload({ apiKey, campaignName, ...args });

  const res = await fetch(AISENSY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return { status: 'failed', payload, error: `${res.status} ${text}`.slice(0, 500) };
  }
  return { status: 'queued', payload };
}
