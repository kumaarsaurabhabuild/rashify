'use client';
import posthog from 'posthog-js';
import { Events } from '@/lib/telemetry/events';

export function ShareActions({ slug, label, appUrl }: { slug: string; label: string; appUrl: string }) {
  const personalUrl = `${appUrl}/u/${slug}`;
  const ogUrl = `${appUrl}/api/og?slug=${slug}`;
  const waText = encodeURIComponent(
    `I am ${label} 🪔 — discover your Vedic archetype: ${personalUrl}?ref=${slug}`,
  );

  const wa = () => {
    posthog.capture(Events.SHARE_WA_CLICK, { slug });
    window.open(`https://wa.me/?text=${waText}`, '_blank');
  };
  const dl = () => {
    posthog.capture(Events.SHARE_DOWNLOAD_CLICK, { slug });
    window.open(ogUrl, '_blank');
  };
  const cp = async () => {
    posthog.capture(Events.SHARE_COPY_CLICK, { slug });
    await navigator.clipboard.writeText(personalUrl);
  };
  const cmp = () => posthog.capture(Events.SHARE_COMPARE_CLICK, { slug });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <span className="eyebrow" style={{ textAlign: 'center' }}>Forward this reading</span>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 12,
        }}
      >
        <button onClick={wa} className="btn-primary shimmer" style={{ fontSize: 18, padding: '14px 22px' }}>
          <span>Send on WhatsApp</span>
          <span aria-hidden style={{ fontSize: 16 }}>↗</span>
        </button>
        <button onClick={dl} className="btn-ghost">Save image</button>
        <button onClick={cp} className="btn-ghost">Copy link</button>
        <button
          onClick={cmp}
          className="btn-ghost"
          disabled
          title="Coming soon"
        >
          Compare with friend
        </button>
      </div>
    </div>
  );
}
