'use client';

import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className={cn(
        'min-h-screen outline-none',
        !pathname.startsWith('/admin') && 'app-shell',
      )}
    >
      {children}
    </main>
  );
}
