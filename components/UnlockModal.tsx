'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import posthog from 'posthog-js';
import { Events } from '@/lib/telemetry/events';

export function UnlockModal({
  slug, label, appUrl, onClose,
}: {
  slug: string; label: string; appUrl: string; onClose: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const personalUrl = `${appUrl}/u/${slug}?ref=${slug}`;
  const waText = encodeURIComponent(
    `I am ${label} 🪔 — discover your Vedic archetype: ${personalUrl}`,
  );

  const unlock = async () => {
    setBusy(true);
    posthog.capture(Events.UNLOCK_SHARE_CLICKED, { slug, via: 'wa' });
    window.open(`https://wa.me/?text=${waText}`, '_blank');
    try {
      await fetch('/api/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, via: 'wa' }),
      });
    } catch { /* still set localStorage */ }
    localStorage.setItem(`rashify:unlocked:${slug}`, '1');
    onClose();
    router.refresh();
  };

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(45,21,23,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
      padding: 20,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: 'var(--parchment)', maxWidth: 460, width: '100%',
        padding: 32, border: '1px solid var(--gold)',
      }}>
        <span className="eyebrow">Unlock your full reading</span>
        <h2 className="font-display" style={{
          fontSize: 32, fontWeight: 400, fontStyle: 'italic', lineHeight: 1.15,
          margin: '12px 0 18px', color: 'var(--ink)',
        }}>
          Forward to one friend on WhatsApp.
        </h2>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, lineHeight: 1.6,
          color: 'var(--ink-soft)', marginBottom: 24 }}>
          Sharing your card with one person unlocks all five of your domains —
          career, health, love, wealth, and spiritual path. Your friend gets a
          link to find theirs too.
        </p>
        <button onClick={unlock} disabled={busy}
                className="btn-primary shimmer" style={{ width: '100%' }}>
          <span>{busy ? 'Opening WhatsApp…' : 'Forward on WhatsApp'}</span>
          <span aria-hidden style={{ fontSize: 16 }}>↗</span>
        </button>
        <button onClick={onClose} className="btn-ghost"
                style={{ width: '100%', marginTop: 10 }}>
          Maybe later
        </button>
      </div>
    </div>
  );
}
