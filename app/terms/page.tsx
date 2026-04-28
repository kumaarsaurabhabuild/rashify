import { BrandMark } from '@/components/BrandMark';

export const metadata = { title: 'Terms — Rashify' };

export default function Terms() {
  return (
    <main className="min-h-screen flex flex-col">
      <header className="px-8 sm:px-14 py-8 flex items-center justify-between">
        <BrandMark size="md" />
        <a href="/" className="eyebrow" style={{ color: 'var(--ink-fade)', textDecoration: 'none' }}>
          ← Begin a reading
        </a>
      </header>

      <article className="prose-page column-prose px-8 sm:px-14 py-12 flex-1">
        <span className="eyebrow">Effective 27 April 2026</span>
        <h1>Terms of use</h1>

        <p>
          Rashify provides Vedic astrological archetypes for reflection and
          entertainment. The readings are written in plain language by a
          language model from your sidereal chart. They are not a substitute
          for medical, legal, financial, or psychological advice.
        </p>

        <h2>Honesty</h2>
        <p>
          By submitting your details, you confirm the information is your own
          and you have the right to share it.
        </p>

        <h2>Forwarding to others</h2>
        <p>
          Sharing your card with friends is encouraged. Sharing someone
          else&apos;s chart without their permission is not.
        </p>

        <h2>Changes</h2>
        <p>
          We may update these terms. Continued use means you accept the
          updated version.
        </p>

        <h2>Domain readings — what they are not</h2>
        <p>
          Health, wealth, career, relationship, and spiritual readings are written
          for reflection. They are not medical, legal, financial, or psychological
          advice. Speak to a qualified professional for any concern that needs one.
        </p>

        <h2>Contact</h2>
        <p>
          For anything else: <a href="mailto:hello@rashify.in">hello@rashify.in</a>.
        </p>
      </article>

      <footer
        className="px-8 sm:px-14 py-8 flex items-center justify-between"
        style={{ borderTop: '1px solid var(--gold-dim)', color: 'var(--ink-fade)' }}
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
