'use client';

import * as React from 'react';
import { ThemeProvider as NextThemesProvider, useTheme } from 'next-themes';

function BrowserThemeColor() {
  const { resolvedTheme } = useTheme();

  React.useEffect(() => {
    // UX-4-109: the real dark background (--background, slate-900), so the iPhone status bar matches the page.
    const themeColor = resolvedTheme === 'dark' ? '#0f172a' : '#ffffff';
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', themeColor);
  }, [resolvedTheme]);

  return null;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <BrowserThemeColor />
      {children}
    </NextThemesProvider>
  );
}
