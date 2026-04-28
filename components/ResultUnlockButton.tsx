'use client';
import { useState } from 'react';
import posthog from 'posthog-js';
import { Events } from '@/lib/telemetry/events';
import { UnlockModal } from './UnlockModal';

export function ResultUnlockButton({ slug, label, appUrl }: { slug: string; label: string; appUrl: string }) {
  const [open, setOpen] = useState(false);
  const onClick = () => {
    posthog.capture(Events.UNLOCK_MODAL_OPEN, { slug });
    setOpen(true);
  };
  return (
    <>
      <button onClick={onClick} className="btn-primary shimmer" style={{ maxWidth: 480, marginInline: 'auto' }}>
        <span>🔒 Unlock full reading</span>
      </button>
      {open && (
        <UnlockModal
          slug={slug} label={label} appUrl={appUrl}
          onClose={() => {
            posthog.capture(Events.UNLOCK_MODAL_DISMISSED, { slug });
            setOpen(false);
          }}
        />
      )}
    </>
  );
}
