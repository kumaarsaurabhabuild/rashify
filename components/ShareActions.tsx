'use client';
import { useState } from 'react';
import posthog from 'posthog-js';
import { Events } from '@/lib/telemetry/events';

export function ShareActions({ slug, label, appUrl }: { slug: string; label: string; appUrl: string }) {
  const personalUrl = `${appUrl}/u/${slug}?ref=${slug}`;
  const ogUrl = `${appUrl}/api/og?slug=${slug}`;
  const shareText = `I am ${label} according to Vedic astrology — discover yours: ${personalUrl}`;
  const [busy, setBusy] = useState<'wa' | 'dl' | null>(null);

  const wa = async () => {
    posthog.capture(Events.SHARE_WA_CLICK, { slug });
    setBusy('wa');
    try {
      // Web Share Level 2: attach PNG + text natively (mobile WA gets card image).
      const res = await fetch(ogUrl, { cache: 'force-cache' });
      const blob = await res.blob();
      const file = new File([blob], `rashify-${slug}.png`, { type: 'image/png' });

      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text: shareText });
        return;
      }
      // Desktop / unsupported — fall back to wa.me text-only deeplink.
      window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank');
    } catch (e) {
      // User cancel or network — silent fallback to text deeplink.
      if ((e as Error)?.name !== 'AbortError') {
        window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank');
      }
    } finally {
      setBusy(null);
    }
  };

  const dl = async () => {
    posthog.capture(Events.SHARE_DOWNLOAD_CLICK, { slug });
    setBusy('dl');
    try {
      const res = await fetch(ogUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rashify-${slug}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // Last-resort fallback — open in tab so user can right-click save.
      window.open(ogUrl, '_blank');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <span className="eyebrow" style={{ textAlign: 'center' }}>Forward this reading</span>

      <button
        onClick={wa}
        disabled={busy !== null}
        className="btn-primary shimmer"
        style={{ width: '100%', maxWidth: 480, alignSelf: 'center' }}
      >
        <span>{busy === 'wa' ? 'Preparing image…' : 'Send on WhatsApp'}</span>
        <span aria-hidden style={{ fontSize: 16 }}>↗</span>
      </button>

      <button
        onClick={dl}
        disabled={busy !== null}
        className="btn-ghost"
        style={{ width: '100%', maxWidth: 480, alignSelf: 'center', padding: '14px 12px', fontSize: 13 }}
      >
        {busy === 'dl' ? 'Downloading…' : 'Save image'}
      </button>
    </div>
  );
}
