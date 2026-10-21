'use client';

import { usePathname } from 'next/navigation';

export function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith('/admin')) {
    return (
      <div id="main-content" className="flex h-dvh w-full min-w-0 flex-col overflow-hidden outline-none">
        {children}
      </div>
    );
  }
  // D54: the mechanic and PM screens use the tablet width; LTR-272: Safety's Quality Check too. Login and reset keep the phone column.
  const wide = pathname === '/' || /^\/(mechanic|work-orders|trucks|qc)(\/|$)/.test(pathname);
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className={wide ? 'app-shell app-shell-wide min-h-screen outline-none' : 'app-shell min-h-screen outline-none'}
    >
      {children}
    </main>
  );
}
