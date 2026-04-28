import type { DomainKey, DomainFull as Full, DomainCitations as Cites } from '@/lib/astro/chart-types';

const TITLES: Record<DomainKey, string> = {
  career: 'Career & Calling', health: 'Health & Wellness',
  love: 'Love & Relationships', wealth: 'Wealth & Money',
  spiritual: 'Spiritual Path',
};

export function DomainFull({ full, citations }: { full: Full; citations: Cites }) {
  return (
    <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 48 }}>
      {(Object.keys(TITLES) as DomainKey[]).map((k) => (
        <article key={k} style={{ borderTop: '1px solid var(--gold-dim)', paddingTop: 24 }}>
          <span className="eyebrow">{TITLES[k]}</span>
          <div style={{ marginTop: 14, fontFamily: 'var(--font-body)',
            fontSize: 17, lineHeight: 1.75, color: 'var(--ink-soft)',
            whiteSpace: 'pre-wrap' }}>
            {full[k]}
          </div>
          {citations[k]?.length > 0 && (
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px dashed var(--gold-dim)',
              fontSize: 12, fontFamily: 'var(--font-ui)', color: 'var(--ink-fade)',
              letterSpacing: '0.04em' }}>
              <span style={{ color: 'var(--gold)' }}>Cited:</span>{' '}
              {citations[k].join(' · ')}
            </div>
          )}
          {k === 'health' && (
            <p style={{ marginTop: 12, fontStyle: 'italic', fontSize: 13,
              color: 'var(--ink-fade)' }}>
              For reflection only. Not medical advice.
            </p>
          )}
        </article>
      ))}
    </div>
  );
}
