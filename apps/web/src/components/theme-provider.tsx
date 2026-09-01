'use client';

import * as React from 'react';
import { ThemeProvider as NextThemesProvider, useTheme } from 'next-themes';

function BrowserThemeColor() {
  const { resolvedTheme } = useTheme();

  React.useEffect(() => {
    const themeColor = resolvedTheme === 'dark' ? '#18243b' : '#ffffff';
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
