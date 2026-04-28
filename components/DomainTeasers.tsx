'use client';
import posthog from 'posthog-js';
import { Events } from '@/lib/telemetry/events';
import type { DomainTeasers as Teasers, DomainKey } from '@/lib/astro/chart-types';

const META: Record<DomainKey, { glyph: string; title: string }> = {
  career:    { glyph: '🛕', title: 'Career & Calling' },
  health:    { glyph: '✦', title: 'Health & Wellness' },
  love:      { glyph: '❀', title: 'Love & Relationships' },
  wealth:    { glyph: '◆', title: 'Wealth & Money' },
  spiritual: { glyph: '☸', title: 'Spiritual Path' },
};

export function DomainTeasers({ slug, teasers }: { slug: string; teasers: Teasers }) {
  return (
    <section className="reveal reveal-5" style={{ marginTop: 48 }}>
      <span className="eyebrow" style={{ display: 'block', textAlign: 'center' }}>
        Five domains of your life
      </span>
      <div className="domain-grid" style={{
        marginTop: 18,
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: 14,
      }}>
        {(Object.keys(META) as DomainKey[]).map((k) => (
          <div key={k} style={{
            border: '1px solid var(--gold-dim)', background: 'var(--parchment-soft)',
            padding: 20, borderRadius: 2,
          }}
          onClick={() => posthog.capture(Events.DOMAIN_TEASER_CLICK, { slug, domain: k })}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ color: 'var(--gold)', fontSize: 18 }}>{META[k].glyph}</span>
              <span className="eyebrow">{META[k].title}</span>
            </div>
            <p style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic',
              fontSize: 18, lineHeight: 1.4, color: 'var(--ink)', margin: 0 }}>
              {teasers[k]}
            </p>
            <div style={{ marginTop: 12, fontSize: 11, letterSpacing: '0.2em',
              textTransform: 'uppercase', color: 'var(--ink-fade)' }}>
              🔒 Read more
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
