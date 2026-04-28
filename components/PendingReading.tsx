'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const STAGES = [
  { at: 0,    label: 'Aligning the heavens' },
  { at: 5000, label: 'Reading your nakshatra' },
  { at: 12000, label: 'Tracing your dasha' },
  { at: 22000, label: 'Writing your full reading' },
  { at: 45000, label: 'The words are settling' },
];

export function PendingReading({ slug }: { slug: string }) {
  const router = useRouter();
  const [stage, setStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const startedAt = useState(() => Date.now())[0];

  useEffect(() => {
    const id = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      setStage(STAGES.reduce((acc, s, i) => (elapsed >= s.at ? i : acc), 0));
    }, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/status?slug=${slug}`, { cache: 'no-store' });
        if (!res.ok) return;
        const j = await res.json();
        if (cancelled) return;
        if (j.status === 'ready') router.refresh();
        else if (j.status === 'failed') setError(j.error ?? 'INTERNAL');
      } catch { /* network blip */ }
    };
    poll();
    const id = setInterval(poll, 2000);
    return () => { cancelled = true; clearInterval(id); };
  }, [slug, router]);

  if (error) {
    return (
      <div style={{ textAlign: 'center', maxWidth: 480, margin: '0 auto' }}>
        <span className="eyebrow" style={{ color: '#a35a23' }}>Reading could not complete</span>
        <h2 className="font-display" style={{ fontSize: 36, marginTop: 16, fontWeight: 400 }}>
          The stars are quiet right now.
        </h2>
        <a href="/" className="btn-primary" style={{ marginTop: 24, display: 'inline-flex', maxWidth: 320 }}>
          Begin a new reading
        </a>
      </div>
    );
  }

  return (
    <div style={{ textAlign: 'center', maxWidth: 520, margin: '0 auto' }}>
      <span className="eyebrow reveal reveal-1">A reading is being prepared</span>
      <h2
        className="font-display reveal reveal-2"
        style={{ fontSize: 'clamp(32px, 4.5vw, 48px)', fontWeight: 400, fontStyle: 'italic',
                 margin: '20px 0 28px', color: 'var(--ink)' }}
      >
        {STAGES[stage].label}<span className="ellipsis-anim">…</span>
      </h2>
      <ol style={{ listStyle: 'none', padding: 0, margin: '0 auto', maxWidth: 360,
                   display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'left' }}>
        {STAGES.map((s, i) => (
          <li key={s.label} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            fontFamily: 'var(--font-ui)', fontSize: 13, letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: i <= stage ? 'var(--gold)' : 'var(--ink-fade)',
            opacity: i <= stage ? 1 : 0.5,
            transition: 'all 0.4s var(--ease-quill)',
          }}>
            <span aria-hidden style={{ width: 18 }}>
              {i < stage ? '✓' : i === stage ? '◆' : '○'}
            </span>
            {s.label}
          </li>
        ))}
      </ol>
      <p className="reveal reveal-4" style={{ marginTop: 32, fontStyle: 'italic',
        fontSize: 15, color: 'var(--ink-fade)', maxWidth: 400, marginInline: 'auto' }}>
        Vedic computation is unhurried. A full reading takes 30 to 60 seconds.
      </p>
    </div>
  );
}
