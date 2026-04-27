'use client';
import { useEffect, useState } from 'react';
import posthog from 'posthog-js';
import { Events } from '@/lib/telemetry/events';

export function ArchetypeReveal({ children, slug }: { children: React.ReactNode; slug: string }) {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const seen = localStorage.getItem(`rashify:seen:${slug}`);
    if (seen) { setRevealed(true); return; }
    const t = setTimeout(() => {
      setRevealed(true);
      localStorage.setItem(`rashify:seen:${slug}`, '1');
      posthog.capture(Events.RESULT_REVEAL_DONE, { slug });
    }, 1800);
    return () => clearTimeout(t);
  }, [slug]);
  return (
    <div style={{ opacity: revealed ? 1 : 0, transition: 'opacity 1.2s ease' }}>
      {children}
    </div>
  );
}
