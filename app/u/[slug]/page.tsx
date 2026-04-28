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

      <header className="px-8 sm:px-14 py-8 flex items-center justify-between">
        <BrandMark size="md" />
        <a
          href="/"
          className="eyebrow"
          style={{ color: 'var(--parchment-fade)', textDecoration: 'none' }}
        >
          ← Begin a new reading
        </a>
      </header>

      <article
        className="column-prose w-full mx-auto px-8 sm:px-14 pb-20 flex flex-col"
        style={{ paddingTop: 24 }}
      >
        <div className="reveal reveal-1" style={{ textAlign: 'center' }}>
          <span className="eyebrow">A reading prepared on {date}</span>
        </div>

        <h1
          className="font-display reveal reveal-2"
          style={{
            textAlign: 'center',
            fontSize: 'clamp(40px, 5.4vw, 76px)',
            lineHeight: 1.05,
            margin: '24px 0 12px',
            fontWeight: 400,
            color: 'var(--parchment)',
          }}
        >
          {a.label}
        </h1>

        <p
          className="font-sanskrit reveal reveal-3"
          style={{ textAlign: 'center', fontSize: 28, color: 'var(--gold)', margin: 0 }}
        >
          {a.sanskritLabel}
        </p>

        <p
          className="reveal reveal-4"
          style={{
            textAlign: 'center',
            marginTop: 20,
            fontSize: 19,
            lineHeight: 1.55,
            color: 'var(--parchment-dim)',
            maxWidth: 520,
            alignSelf: 'center',
            fontStyle: 'italic',
          }}
        >
          {a.oneLiner}
        </p>

        <div
          className="reveal reveal-5"
          style={{ marginTop: 56, display: 'flex', justifyContent: 'center', overflow: 'hidden' }}
        >
          <div
            style={{
              transform: 'scale(0.42)',
              transformOrigin: 'top center',
              height: 1920 * 0.42,
              width: 1080,
            }}
          >
            <ShareCard archetype={a} slug={slug} appUrl={appUrl} />
          </div>
        </div>

        <div
          className="reveal reveal-5"
          style={{
            marginTop: 32,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 56,
            borderTop: '1px solid var(--gold-dim)',
            borderBottom: '1px solid var(--gold-dim)',
            padding: '32px 0',
          }}
        >
          <div>
            <span className="eyebrow">Strength</span>
            <p style={{ marginTop: 12, fontSize: 22, fontFamily: 'var(--font-display)', lineHeight: 1.4 }}>
              {a.strengths.join(' · ')}
            </p>
          </div>
          <div>
            <span className="eyebrow">Growth edge</span>
            <p style={{ marginTop: 12, fontSize: 22, fontFamily: 'var(--font-display)', lineHeight: 1.4 }}>
              {a.growthEdges.join(' · ')}
            </p>
          </div>
        </div>

        <div
          className="reveal reveal-6"
          style={{ marginTop: 32, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 56 }}
        >
          <div>
            <span className="eyebrow">Power window</span>
            <p style={{ marginTop: 12, fontSize: 22, fontFamily: 'var(--font-display)' }}>
              {a.powerWindow}
            </p>
          </div>
          <div>
            <span className="eyebrow">Lucky</span>
            <p style={{ marginTop: 12, fontSize: 22, fontFamily: 'var(--font-display)' }}>
              {a.luckyColor} · {a.luckyNumber}
            </p>
          </div>
        </div>

        <div className="reveal reveal-6" style={{ marginTop: 56 }}>
          <ShareActions slug={slug} label={a.label} appUrl={appUrl} />
        </div>

        <details
          className="reveal reveal-6"
          style={{ marginTop: 56, borderTop: '1px solid var(--gold-dim)', paddingTop: 24 }}
        >
          <summary className="eyebrow" style={{ cursor: 'pointer', color: 'var(--gold)', listStyle: 'none' }}>
            Why we say this
          </summary>
          <ul
            style={{
              marginTop: 18, listStyle: 'none', padding: 0,
              display: 'grid', gap: 10,
              fontFamily: 'var(--font-body)', fontSize: 16, color: 'var(--parchment-dim)',
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
            marginTop: 64, textAlign: 'center',
            fontFamily: 'var(--font-display)', fontStyle: 'italic',
            fontSize: 22, color: 'var(--parchment-fade)',
          }}
        >
          Forward this to someone who would want to know theirs.
        </div>
      </article>

      <footer
        className="px-8 sm:px-14 py-8 flex items-center justify-between"
        style={{ borderTop: '1px solid var(--gold-dim)', color: 'var(--parchment-fade)' }}
      >
        <span className="eyebrow">◆ MMXXVI · Rashify</span>
        <nav style={{ display: 'flex', gap: 24, fontFamily: 'var(--font-ui)', fontSize: 12, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
          <a href="/privacy" style={{ color: 'var(--parchment-dim)' }}>Privacy</a>
          <a href="/terms" style={{ color: 'var(--parchment-dim)' }}>Terms</a>
        </nav>
      </footer>
    </main>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <li style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 20 }}>
      <span className="eyebrow" style={{ color: 'var(--parchment-fade)' }}>{label}</span>
      <span>{children}</span>
    </li>
  );
}
