import { BrandMark } from '@/components/BrandMark';

export const metadata = { title: 'Privacy — Rashify' };

export default function Privacy() {
  return (
    <main className="min-h-screen flex flex-col">
      <header className="px-8 sm:px-14 py-8 flex items-center justify-between">
        <BrandMark size="md" />
        <a href="/" className="eyebrow" style={{ color: 'var(--parchment-fade)', textDecoration: 'none' }}>
          ← Begin a reading
        </a>
      </header>

      <article className="prose-page column-prose px-8 sm:px-14 py-12 flex-1">
        <span className="eyebrow">Effective 27 April 2026</span>
        <h1>Privacy policy</h1>

        <p>
          Rashify keeps a small amount of your information so we can prepare
          your reading and deliver it to you. This page tells you what we keep,
          why, and how to remove it.
        </p>

        <h2>What we collect</h2>
        <ul>
          <li>Your name, date, time, and place of birth.</li>
          <li>The WhatsApp number you provide.</li>
          <li>A hashed copy of your IP address (we cannot reverse it; it is only used to slow abuse).</li>
          <li>Marketing source — the link you arrived through, if any.</li>
        </ul>

        <h2>Why we keep it</h2>
        <p>
          To compute your sidereal birth chart, write your archetype, and
          deliver the result to your WhatsApp. We do not sell your data and we
          do not enrol you in unrelated lists.
        </p>

        <h2>Who else sees your data</h2>
        <ul>
          <li>Prokerala — for chart calculation.</li>
          <li>OpenRouter and the language model provider on it — for the written reading.</li>
          <li>AiSensy and Meta — for the WhatsApp delivery you have asked for.</li>
          <li>Supabase — where the row is stored.</li>
          <li>PostHog — where we measure aggregate funnel metrics; your phone number is masked.</li>
        </ul>

        <h2>How long we keep it</h2>
        <p>Seven years, unless you ask us to delete it sooner.</p>

        <h2>Your rights</h2>
        <p>
          Under India&apos;s Digital Personal Data Protection Act, you may
          request deletion of your record any time. Send a request to{' '}
          <a href="/api/delete-me">/api/delete-me</a> or simply reply{' '}
          <strong>STOP</strong> on any WhatsApp message we send you, and we
          will remove your row.
        </p>

        <h2>Contact</h2>
        <p>
          For anything privacy-related: <a href="mailto:privacy@rashify.in">privacy@rashify.in</a>.
        </p>
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
