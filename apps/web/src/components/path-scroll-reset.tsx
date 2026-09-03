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
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
    resetScroll();
    const frame = window.requestAnimationFrame(resetScroll);
    return () => window.cancelAnimationFrame(frame);
  }, [pathname, resetScroll]);

  React.useEffect(() => {
    const onPageShow = () => {
      resetScroll();
      window.requestAnimationFrame(resetScroll);
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [resetScroll]);

  return null;
}
