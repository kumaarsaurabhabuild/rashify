'use client';
import posthog from 'posthog-js';
import { Events } from '@/lib/telemetry/events';

export function ShareActions({ slug, label, appUrl }: { slug: string; label: string; appUrl: string }) {
  const personalUrl = `${appUrl}/u/${slug}`;
  const ogUrl = `${appUrl}/api/og?slug=${slug}`;
  const waText = encodeURIComponent(`I am ${label} 🪔 — discover your Vedic archetype: ${personalUrl}?ref=${slug}`);

  const wa = () => { posthog.capture(Events.SHARE_WA_CLICK, { slug }); window.open(`https://wa.me/?text=${waText}`, '_blank'); };
  const dl = () => { posthog.capture(Events.SHARE_DOWNLOAD_CLICK, { slug }); window.open(ogUrl, '_blank'); };
  const cp = async () => {
    posthog.capture(Events.SHARE_COPY_CLICK, { slug });
    await navigator.clipboard.writeText(personalUrl);
  };
  const cmp = () => posthog.capture(Events.SHARE_COMPARE_CLICK, { slug });

  return (
    <div className="flex flex-wrap justify-center gap-3 mt-6">
      <button onClick={wa} className="bg-[#3a0a14] text-[#f1e7d4] px-4 py-2 rounded">Send on WhatsApp</button>
      <button onClick={dl} className="border border-[#3a0a14] px-4 py-2 rounded">Save image</button>
      <button onClick={cp} className="border border-[#3a0a14] px-4 py-2 rounded">Copy link</button>
      <button onClick={cmp} className="border border-[#3a0a14] px-4 py-2 rounded opacity-60 cursor-not-allowed" disabled title="Coming soon">
        Compare with friend
      </button>
    </div>
  );
}
