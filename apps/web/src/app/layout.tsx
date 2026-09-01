import type { Metadata, Viewport } from 'next';
import Image from 'next/image';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { DataProvider } from '@/lib/data-provider';
import { PathScrollReset } from '@/components/path-scroll-reset';
import { ThemeProvider } from '@/components/theme-provider';
import { ThemeToggle } from '@/components/ui';

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
        <ThemeProvider>
          <PathScrollReset />
          <AuthProvider>
            <DataProvider>
              <div className="mx-auto min-h-screen max-w-md px-4 pb-10 pt-6">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <Image
                    src="/ltl-logo.png"
                    alt="Lightning Transport and Logistics"
                    width={1536}
                    height={894}
                    priority
                    className="h-auto w-40 object-contain sm:w-48"
                  />
                  <ThemeToggle />
                </div>
                {children}
              </div>
            </DataProvider>
          </AuthProvider>
        </ThemeProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
