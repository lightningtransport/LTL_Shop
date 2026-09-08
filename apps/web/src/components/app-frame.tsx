'use client';

import { usePathname } from 'next/navigation';

export function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith('/admin')) {
    return <div id="main-content" className="min-h-screen outline-none">{children}</div>;
  }
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="app-shell min-h-screen outline-none"
    >
      {children}
    </main>
  );
}
