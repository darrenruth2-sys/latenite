import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/inter';
import '@fontsource/vt323';
import '@fontsource-variable/fraunces';
import '@fontsource/space-mono';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'SignedOn — your profile, your music, your friends', template: '%s · SignedOn' },
  description: 'The social network that remembers when the internet was fun. Custom profiles, Top Friends, guestbooks, and a messenger with nudges.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
};

export const viewport: Viewport = { themeColor: '#0a0a18', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">
        <a href="#main" className="sr-only-focusable fixed left-2 top-2 z-50 bg-cyan px-3 py-2 font-semibold text-ink">Skip to content</a>
        {children}
      </body>
    </html>
  );
}
