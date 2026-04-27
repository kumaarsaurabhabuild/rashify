'use client';
import { useEffect, useState } from 'react';
import posthog from 'posthog-js';
import { useRouter, useSearchParams } from 'next/navigation';
import Script from 'next/script';
import { BirthForm, type BirthFormValue } from '@/components/BirthForm';
import { Events } from '@/lib/telemetry/events';

declare global {
  interface Window { turnstile?: { render: (id: string, opts: object) => string }; }
}

export default function Landing() {
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
    <main className="min-h-screen px-6 py-16">
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
      <header className="max-w-md mx-auto mb-10">
        <h1 className="text-4xl font-serif text-center">Discover your Vedic archetype</h1>
        <p className="text-center text-sm mt-2">In 30 seconds. On WhatsApp.</p>
      </header>
      {busy ? (
        <div className="text-center">Reading your stars…</div>
      ) : (
        <BirthForm onSubmit={submit} mode="self" />
      )}
      {error && <div className="text-center text-red-600 mt-4">Error: {error}. Try again.</div>}
      <div id="cf-turnstile" className="mt-6 flex justify-center" />
    </main>
  );
}
