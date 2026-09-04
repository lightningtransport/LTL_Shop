'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';

/** Owns history scroll restoration so mobile Safari never reopens a route mid-page. */
export function PathScrollReset() {
  const pathname = usePathname();
  const resetScroll = React.useCallback(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, []);

  React.useLayoutEffect(() => {
    resetScroll();
    const firstFrame = window.requestAnimationFrame(() => {
      resetScroll();
      window.requestAnimationFrame(resetScroll);
    });
    return () => window.cancelAnimationFrame(firstFrame);
  }, [pathname, resetScroll]);

  React.useEffect(() => {
    const onRestore = () => {
      resetScroll();
      window.requestAnimationFrame(resetScroll);
    };
    window.addEventListener('pageshow', onRestore);
    window.addEventListener('popstate', onRestore);
    return () => {
      window.removeEventListener('pageshow', onRestore);
      window.removeEventListener('popstate', onRestore);
    };
  }, [resetScroll]);

  return null;
}
