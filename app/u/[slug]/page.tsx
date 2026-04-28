import { notFound } from 'next/navigation';
import Script from 'next/script';
import { ArchetypeZ } from '@/lib/astro/chart-types';
import { getCardBySlug } from '@/lib/db/leads';
import { ShareCard } from '@/components/ShareCard';
import { ShareActions } from '@/components/ShareActions';
import { BrandMark } from '@/components/BrandMark';
import { Events } from '@/lib/telemetry/events';

export const dynamic = 'force-dynamic';

export default async function CardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const card = await getCardBySlug(slug);
  if (!card) notFound();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';

  const parsed = ArchetypeZ.safeParse(card.archetype);
  if (!parsed.success) notFound();
  const a = parsed.data;

  const date = new Date(card.created_at).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <main className="min-h-screen flex flex-col">
      <Script id="result-view" strategy="afterInteractive">{`
        if (window.posthog) window.posthog.capture('${Events.RESULT_VIEW}', { slug: '${slug}' });
      `}</Script>

      <header
        className="flex items-center justify-between py-6 sm:py-8"
        style={{ paddingInline: 'clamp(20px, 5vw, 56px)' }}
      >
        <BrandMark size="md" />
        <a
          href="/"
          className="eyebrow"
          style={{ color: 'var(--ink-soft)', textDecoration: 'none' }}
        >
          ← <span className="hidden sm:inline">Begin a new reading</span>
          <span className="sm:hidden">New</span>
        </a>
      </header>

      <article
        className="column-prose w-full mx-auto pb-16 sm:pb-20 flex flex-col"
        style={{
          paddingInline: 'clamp(20px, 5vw, 56px)',
          paddingTop: 16,
        }}
      >
        <div className="reveal reveal-1" style={{ textAlign: 'center' }}>
          <span className="eyebrow">A reading prepared on {date}</span>
        </div>

        <h1
          className="font-display reveal reveal-2"
          style={{
            textAlign: 'center',
            fontSize: 'clamp(36px, 5.4vw, 76px)',
            lineHeight: 1.05,
            margin: '20px 0 12px',
            fontWeight: 400,
            color: 'var(--ink)',
          }}
        >
          {a.label}
        </h1>

        <p
          className="font-sanskrit reveal reveal-3"
          style={{ textAlign: 'center', fontSize: 'clamp(22px, 3vw, 28px)', color: 'var(--gold)', margin: 0 }}
        >
          {a.sanskritLabel}
        </p>

        <p
          className="reveal reveal-4"
          style={{
            textAlign: 'center',
            marginTop: 20,
            fontSize: 'clamp(16px, 2.2vw, 19px)',
            lineHeight: 1.55,
            color: 'var(--ink-soft)',
            maxWidth: 520,
            alignSelf: 'center',
            fontStyle: 'italic',
          }}
        >
          {a.oneLiner}
        </p>

        {/* Card preview — responsive scale */}
        <div
          className="reveal reveal-5"
          style={{ marginTop: 40, display: 'flex', justifyContent: 'center', overflow: 'hidden' }}
        >
          <div
            className="card-scale"
            style={{
              transformOrigin: 'top center',
              width: 1080,
            }}
          >
            <ShareCard archetype={a} slug={slug} appUrl={appUrl} />
          </div>
        </div>
        <style>{`
          .card-scale { transform: scale(0.42); height: ${1920 * 0.42}px; }
          @media (max-width: 768px) {
            .card-scale { transform: scale(0.30); height: ${1920 * 0.30}px; }
          }
          @media (max-width: 480px) {
            .card-scale { transform: scale(0.24); height: ${1920 * 0.24}px; }
          }
        `}</style>

        <div
          className="reveal reveal-5 grid grid-2"
          style={{
            marginTop: 28,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 40,
            borderTop: '1px solid var(--gold-dim)',
            borderBottom: '1px solid var(--gold-dim)',
            padding: '28px 0',
          }}
        >
          <div>
            <span className="eyebrow">Strength</span>
            <p style={{ marginTop: 10, fontSize: 'clamp(18px, 2.5vw, 22px)', fontFamily: 'var(--font-display)', lineHeight: 1.4 }}>
              {a.strengths.join(' · ')}
            </p>
          </div>
          <div>
            <span className="eyebrow">Growth edge</span>
            <p style={{ marginTop: 10, fontSize: 'clamp(18px, 2.5vw, 22px)', fontFamily: 'var(--font-display)', lineHeight: 1.4 }}>
              {a.growthEdges.join(' · ')}
            </p>
          </div>
        </div>

        <div
          className="reveal reveal-6 grid grid-2"
          style={{ marginTop: 28, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40 }}
        >
          <div>
            <span className="eyebrow">Power window</span>
            <p style={{ marginTop: 10, fontSize: 'clamp(18px, 2.5vw, 22px)', fontFamily: 'var(--font-display)' }}>
              {a.powerWindow}
            </p>
          </div>
          <div>
            <span className="eyebrow">Lucky</span>
            <p style={{ marginTop: 10, fontSize: 'clamp(18px, 2.5vw, 22px)', fontFamily: 'var(--font-display)' }}>
              {a.luckyColor} · {a.luckyNumber}
            </p>
          </div>
        </div>

        <div className="reveal reveal-6" style={{ marginTop: 48 }}>
          <ShareActions slug={slug} label={a.label} appUrl={appUrl} />
        </div>

        <details
          className="reveal reveal-6"
          style={{ marginTop: 48, borderTop: '1px solid var(--gold-dim)', paddingTop: 24 }}
        >
          <summary className="eyebrow" style={{ cursor: 'pointer', color: 'var(--gold)', listStyle: 'none' }}>
            Why we say this
          </summary>
          <ul
            style={{
              marginTop: 18, listStyle: 'none', padding: 0,
              display: 'grid', gap: 10,
              fontFamily: 'var(--font-body)', fontSize: 16, color: 'var(--ink-soft)',
            }}
          >
            <Row label="System">{a.provenance.system}</Row>
            <Row label="Ayanamsa">{a.provenance.ayanamsa}</Row>
            <Row label="Lagna (rising)">{a.provenance.lagna}</Row>
            <Row label="Moon nakshatra">{a.provenance.nakshatra}</Row>
            <Row label="Current dasha">{a.provenance.currentDasha}</Row>
          </ul>
        </details>

        <div
          className="reveal reveal-6"
          style={{
            marginTop: 56, textAlign: 'center',
            fontFamily: 'var(--font-display)', fontStyle: 'italic',
            fontSize: 'clamp(18px, 2.6vw, 22px)', color: 'var(--ink-fade)',
          }}
        >
          Forward this to someone who would want to know theirs.
        </div>
      </article>

      <footer
        className="flex flex-col sm:flex-row gap-3 sm:gap-0 items-center sm:justify-between py-6 sm:py-8"
        style={{
          paddingInline: 'clamp(20px, 5vw, 56px)',
          borderTop: '1px solid var(--gold-dim)',
          color: 'var(--ink-fade)',
        }}
      >
        <span className="eyebrow">◆ MMXXVI · Rashify</span>
        <nav style={{ display: 'flex', gap: 24, fontFamily: 'var(--font-ui)', fontSize: 12, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
          <a href="/privacy" style={{ color: 'var(--ink-soft)' }}>Privacy</a>
          <a href="/terms" style={{ color: 'var(--ink-soft)' }}>Terms</a>
        </nav>
      </footer>
    </main>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <li
      className="prov-row"
      style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 20 }}
    >
      <span className="eyebrow" style={{ color: 'var(--ink-fade)' }}>{label}</span>
      <span>{children}</span>
      <style>{`
        @media (max-width: 640px) {
          .prov-row { grid-template-columns: 1fr !important; gap: 4px !important; }
        }
      `}</style>
    </li>
  );
}
