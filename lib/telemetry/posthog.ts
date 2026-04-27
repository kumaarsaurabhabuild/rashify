import { PostHog } from 'posthog-node';
import type { EventName } from './events';

let client: PostHog | null = null;
function getClient(): PostHog | null {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (!key) return null;
  if (!client) client = new PostHog(key, { host, flushAt: 1, flushInterval: 0 });
  return client;
}

export function trackServer(distinctId: string, event: EventName, props?: Record<string, unknown>) {
  const c = getClient();
  if (!c) return;
  c.capture({ distinctId, event, properties: { phase: 'server', ...props } });
}

export async function flushTelemetry() {
  await client?.shutdown();
}
