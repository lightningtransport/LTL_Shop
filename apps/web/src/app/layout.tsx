import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { Suspense } from 'react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { DataProvider } from '@/lib/data-provider';
import { PathScrollReset } from '@/components/path-scroll-reset';
import { ThemeProvider } from '@/components/theme-provider';
import { ObservabilityProvider } from '@/components/observability-provider';
import { AppFrame } from '@/components/app-frame';
import { ActionToastProvider } from '@/components/action-toast';
import { ShopLocaleProvider } from '@/lib/locale-context';
import { parseShopLocale, SHOP_LOCALE_COOKIE } from '@/lib/shop-locale';

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
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
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
  viewportFit: 'cover',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieLocale = (await cookies()).get(SHOP_LOCALE_COOKIE)?.value;
  const locale = parseShopLocale(cookieLocale);

  return (
    <html lang={locale} suppressHydrationWarning className={`${bodyFont.variable} ${monoFont.variable}`}>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "if ('scrollRestoration' in history) history.scrollRestoration = 'manual';" +
              "try{var s=navigator.standalone===true||window.matchMedia('(display-mode: standalone)').matches||window.matchMedia('(display-mode: fullscreen)').matches;if(s)document.documentElement.dataset.display='standalone';}catch(e){}",
          }}
        />
        <ThemeProvider>
          <Suspense fallback={null}>
            <PathScrollReset />
          </Suspense>
          <ObservabilityProvider />
          <ShopLocaleProvider initialLocale={locale}>
            <ActionToastProvider>
              <AuthProvider>
                <DataProvider>
                  <AppFrame>{children}</AppFrame>
                </DataProvider>
              </AuthProvider>
            </ActionToastProvider>
          </ShopLocaleProvider>
        </ThemeProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
