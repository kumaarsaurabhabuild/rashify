'use client';
import { Suspense, useEffect, useState } from 'react';
import posthog from 'posthog-js';
import { useRouter, useSearchParams } from 'next/navigation';
import Script from 'next/script';
import { BirthForm, type BirthFormValue } from '@/components/BirthForm';
import { BrandMark } from '@/components/BrandMark';
import { Events } from '@/lib/telemetry/events';

declare global {
  interface Window { turnstile?: { render: (id: string, opts: object) => string }; }
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <span className="eyebrow">Aligning the heavens…</span>
        </div>
      }
    >
      <Landing />
    </Suspense>
  );
}

function Landing() {
  const router = useRouter();
  const params = useSearchParams();
  const referrer = params.get('ref');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState<string>('');

  useEffect(() => { posthog.capture(Events.LANDING_VIEW, { referrer }); }, [referrer]);

  useEffect(() => {
    const id = setInterval(() => {
      const w = window as Window;
      if (w.turnstile && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) {
        w.turnstile.render('#cf-turnstile', {
          sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
          callback: setToken,
        });
        clearInterval(id);
      }
    }, 200);
    return () => clearInterval(id);
  }, []);

  const submit = async (v: BirthFormValue) => {
    posthog.capture(Events.FORM_SUBMIT_CLICK);
    setBusy(true);
    setError(null);
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...v, referrerSlug: referrer ?? null, turnstileToken: token || 'dev' }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      posthog.capture(Events.FORM_SUBMIT_FAIL, { error_code: j.error });
      setError(j.error ?? 'INTERNAL');
      setBusy(false);
      return;
    }
    const { slug } = await res.json();
    posthog.capture(Events.FORM_SUBMIT_SUCCESS, { slug });
    posthog.identify(slug);
    router.push(`/u/${slug}`);
  };

  return (
    <main className="min-h-screen flex flex-col">
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />

      <header className="px-8 sm:px-14 py-8 flex items-center justify-between">
        <BrandMark size="md" />
        <span className="eyebrow hidden sm:inline">An invitation, written for you</span>
      </header>

      <section className="flex-1 grid lg:grid-cols-[1.05fr_1fr] gap-16 px-8 sm:px-14 pb-20 max-w-[1280px] mx-auto w-full">
        {/* Left: editorial column */}
        <div className="flex flex-col justify-center max-w-[640px]">
          <span className="eyebrow reveal reveal-1">
            Vedic · Sidereal · Lahiri ayanamsa
          </span>

          <h1
            className="font-display reveal reveal-2"
            style={{
              fontSize: 'clamp(48px, 6vw, 88px)',
              lineHeight: 1.04,
              marginTop: 28,
              color: 'var(--parchment)',
              fontWeight: 400,
            }}
          >
            Discover what the
            <br />
            night sky was holding
            <br />
            <em
              className="font-display"
              style={{ fontStyle: 'italic', color: 'var(--gold-bright)' }}
            >
              when you arrived.
            </em>
          </h1>

          <p
            className="reveal reveal-3"
            style={{
              marginTop: 28,
              fontSize: 19,
              lineHeight: 1.6,
              maxWidth: 520,
              color: 'var(--parchment-dim)',
            }}
          >
            A reading of your sidereal birth chart, written for you in plain
            language. Thirty seconds. Delivered on WhatsApp.
          </p>

          <div className="reveal reveal-4 gold-rule" style={{ marginTop: 40 }} />

          <div className="reveal reveal-4" style={{ marginTop: 14 }}>
            <span className="eyebrow">Three things you receive</span>
            <ul
              style={{
                marginTop: 14,
                fontFamily: 'var(--font-body)',
                fontSize: 17,
                lineHeight: 1.7,
                color: 'var(--parchment-dim)',
                listStyle: 'none',
                padding: 0,
                display: 'grid',
                gap: 6,
              }}
            >
              <li>
                <span style={{ color: 'var(--gold)', marginRight: 12 }}>i.</span>
                Your archetype — a name and the truth behind it.
              </li>
              <li>
                <span style={{ color: 'var(--gold)', marginRight: 12 }}>ii.</span>
                Three behaviours the chart predicts about you.
              </li>
              <li>
                <span style={{ color: 'var(--gold)', marginRight: 12 }}>iii.</span>
                A shareable card with your lagna and current dasha cited.
              </li>
            </ul>
          </div>
        </div>

        {/* Right: form, anchored on the calm zone */}
        <div className="flex flex-col justify-center reveal reveal-3">
          <div
            style={{
              padding: '40px 36px',
              background: 'linear-gradient(180deg, rgba(241,231,212,0.04) 0%, rgba(241,231,212,0.02) 100%)',
              border: '1px solid var(--gold-dim)',
              backdropFilter: 'blur(2px)',
            }}
          >
            <div style={{ marginBottom: 28 }}>
              <span className="eyebrow">Your birth particulars</span>
              <p
                style={{
                  marginTop: 10,
                  fontFamily: 'var(--font-body)',
                  fontStyle: 'italic',
                  fontSize: 14,
                  color: 'var(--parchment-fade)',
                  lineHeight: 1.55,
                }}
              >
                The chart is calculated from your exact place and time. We never
                share these, and you may withdraw at any moment.
              </p>
            </div>

            {busy ? (
              <div
                style={{
                  padding: '64px 0',
                  textAlign: 'center',
                  fontFamily: 'var(--font-display)',
                  fontStyle: 'italic',
                  fontSize: 24,
                  color: 'var(--parchment-dim)',
                }}
              >
                Reading your stars
                <span className="ellipsis-anim">…</span>
                <p
                  className="eyebrow"
                  style={{ marginTop: 18, color: 'var(--parchment-fade)' }}
                >
                  This usually takes 30–90 seconds
                </p>
              </div>
            ) : (
              <BirthForm onSubmit={submit} mode="self" />
            )}

            {error && (
              <div
                role="alert"
                style={{
                  marginTop: 16,
                  color: '#e6c270',
                  fontFamily: 'var(--font-ui)',
                  fontSize: 13,
                }}
              >
                Could not complete the reading: <strong>{error}</strong>. Try again.
              </div>
            )}
            <div id="cf-turnstile" className="mt-4 flex justify-center" />
          </div>
        </div>
      </section>

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
