import type { DomainKey, DomainTeasers as Teasers } from '@/lib/astro/chart-types';

const TITLES: Record<DomainKey, string> = {
  career: 'Career & Calling', health: 'Health & Wellness',
  love: 'Love & Relationships', wealth: 'Wealth & Money',
  spiritual: 'Spiritual Path',
};

/** Server-rendered locked teaser preview with blur fade. Used before unlock. */
export function DomainLocked({ teasers }: { teasers: Teasers }) {
  return (
    <div className="locked-stack" style={{ marginTop: 24, display: 'flex',
      flexDirection: 'column', gap: 32 }}>
      {(Object.keys(TITLES) as DomainKey[]).map((k) => (
        <article key={k} style={{ borderTop: '1px solid var(--gold-dim)', paddingTop: 24 }}>
          <span className="eyebrow">{TITLES[k]}</span>
          <h3 className="font-display" style={{
            fontSize: 28, fontWeight: 400, fontStyle: 'italic', margin: '8px 0 14px',
            color: 'var(--gold)' }}>
            {teasers[k]}
          </h3>
          <div style={{ position: 'relative', maxHeight: 96, overflow: 'hidden' }}>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 16, lineHeight: 1.7,
              color: 'var(--ink-soft)', filter: 'blur(4px)', userSelect: 'none' }}>
              The full reading describes the specific planetary positions in your chart that shape this domain — your dignity, your dasha, the yogas active right now, and what to do with what they reveal.
            </p>
            <div style={{ position: 'absolute', inset: 0,
              background: 'linear-gradient(180deg, transparent 0%, var(--parchment) 90%)',
              pointerEvents: 'none' }} />
          </div>
        </article>
      ))}
    </div>
  );
}
