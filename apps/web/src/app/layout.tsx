import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { DataProvider } from '@/lib/data-provider';
import { PathScrollReset } from '@/components/path-scroll-reset';
import { ThemeProvider } from '@/components/theme-provider';
import { ObservabilityProvider } from '@/components/observability-provider';

const bodyFont = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const monoFont = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Lightning Shop — Mechanic',
  description: 'Lightning Shop Mechanic Work Order app',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'LTL Shop',
  },
};

export const viewport: Viewport = {
  themeColor: '#0f1720',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${bodyFont.variable} ${monoFont.variable}`}>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: "if ('scrollRestoration' in history) history.scrollRestoration = 'manual';",
          }}
        />
        <ThemeProvider>
          <Suspense fallback={null}>
            <PathScrollReset />
          </Suspense>
          <ObservabilityProvider />
          <AuthProvider>
            <DataProvider>
              <main id="main-content" tabIndex={-1} className="app-shell">
                {children}
              </main>
            </DataProvider>
          </AuthProvider>
        </ThemeProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
