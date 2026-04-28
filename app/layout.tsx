import './globals.css';
import { Cormorant_Garamond, Tiro_Devanagari_Hindi, Newsreader } from 'next/font/google';
import { PostHogProvider } from '@/components/PostHogProvider';
import { CelestialBackground } from '@/components/CelestialBackground';

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-cormorant',
  display: 'swap',
});
const tiro = Tiro_Devanagari_Hindi({
  subsets: ['devanagari', 'latin'],
  weight: ['400'],
  variable: '--font-tiro',
  display: 'swap',
});
const newsreader = Newsreader({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-newsreader',
  display: 'swap',
});

export const metadata = {
  title: 'Rashify — your Vedic archetype',
  description:
    'Discover your Vedic archetype. A sidereal reading of your birth chart, written for you. Delivered on WhatsApp.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#f7efdc',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${cormorant.variable} ${tiro.variable} ${newsreader.variable}`}
    >
      <body className="min-h-screen">
        <CelestialBackground />
        <PostHogProvider>{children}</PostHogProvider>
      </body>
    </html>
  );
}
