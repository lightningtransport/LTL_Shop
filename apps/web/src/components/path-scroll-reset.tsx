'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';

/** Resets document scroll only for pathname changes; query-only state is preserved. */
export function PathScrollReset() {
  const pathname = usePathname();
  const previousPathname = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (previousPathname.current !== null && previousPathname.current !== pathname) {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }
    previousPathname.current = pathname;
  }, [pathname]);

  return null;
}
