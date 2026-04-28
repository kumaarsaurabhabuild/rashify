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

      {/* Primary CTA — WhatsApp send (full-width on mobile) */}
      <button
        onClick={wa}
        className="btn-primary shimmer"
        style={{ width: '100%', maxWidth: 480, alignSelf: 'center' }}
      >
        <span>Send on WhatsApp</span>
        <span aria-hidden style={{ fontSize: 16 }}>↗</span>
      </button>

      {/* Secondary actions — 2-col on mobile, row on wider */}
      <div
        className="grid grid-2"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 10,
          maxWidth: 480,
          width: '100%',
          alignSelf: 'center',
        }}
      >
        <button onClick={dl} className="btn-ghost" style={{ padding: '12px 8px', fontSize: 11 }}>Save image</button>
        <button onClick={cp} className="btn-ghost" style={{ padding: '12px 8px', fontSize: 11 }}>Copy link</button>
        <button
          onClick={cmp}
          className="btn-ghost"
          disabled
          title="Coming soon"
          style={{ padding: '12px 8px', fontSize: 11 }}
        >
          Compare
        </button>
      </div>
    </div>
  );
}
