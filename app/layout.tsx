import './globals.css';
import { PostHogProvider } from '@/components/PostHogProvider';

export const metadata = {
  title: 'Rashify — your Vedic archetype',
  description: 'Discover your Vedic archetype on WhatsApp.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#f1e7d4] text-[#3a0a14] min-h-screen">
        <PostHogProvider>{children}</PostHogProvider>
      </body>
    </html>
  );
}
