'use client';

import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div
      className={cn(
        'min-h-screen',
        !pathname.startsWith('/admin') && 'mx-auto max-w-md px-4 pb-10 pt-6',
      )}
    >
      {children}
    </div>
  );
}
