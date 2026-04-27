import { notFound } from 'next/navigation';
import { ArchetypeZ } from '@/lib/astro/chart-types';
import { getCardBySlug } from '@/lib/db/leads';
import { ShareCard } from '@/components/ShareCard';
import { ShareActions } from '@/components/ShareActions';
import { ArchetypeReveal } from '@/components/ArchetypeReveal';
import { Events } from '@/lib/telemetry/events';
import Script from 'next/script';

export const dynamic = 'force-dynamic';

export default async function CardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const card = await getCardBySlug(slug);
  if (!card) notFound();

  const parsed = ArchetypeZ.safeParse(card.archetype);
  if (!parsed.success) notFound();
  const archetype = parsed.data;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';

  return (
    <main className="min-h-screen px-6 py-12">
      <Script id="result-view" strategy="afterInteractive">{`
        if (window.posthog) window.posthog.capture('${Events.RESULT_VIEW}', { slug: '${slug}' });
      `}</Script>
      <ArchetypeReveal slug={slug}>
        <div style={{ transform: 'scale(0.4)', transformOrigin: 'top center', height: 800, overflow: 'visible' }}>
          <ShareCard archetype={archetype} slug={slug} appUrl={appUrl} />
        </div>
        <h2 className="text-center text-3xl font-serif mt-4">{archetype.label}</h2>
        <p className="text-center italic mt-1">{archetype.sanskritLabel}</p>
        <p className="text-center mt-3 max-w-md mx-auto">{archetype.oneLiner}</p>
        <ShareActions slug={slug} label={archetype.label} appUrl={appUrl} />
        <details className="max-w-md mx-auto mt-8 text-sm">
          <summary className="cursor-pointer">Why we say this</summary>
          <ul className="mt-2 list-disc list-inside opacity-80">
            <li>System: {archetype.provenance.system}</li>
            <li>Ayanamsa: {archetype.provenance.ayanamsa}</li>
            <li>Lagna: {archetype.provenance.lagna}</li>
            <li>Nakshatra: {archetype.provenance.nakshatra}</li>
            <li>Current dasha: {archetype.provenance.currentDasha}</li>
          </ul>
        </details>
        <div className="text-center mt-12">
          <a href="/" className="underline">Want yours? Get your archetype →</a>
        </div>
      </ArchetypeReveal>
    </main>
  );
}
