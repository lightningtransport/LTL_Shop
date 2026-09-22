'use client';

import * as React from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/** Owns history scroll restoration so mobile Safari never reopens a route mid-page. */
export function PathScrollReset() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams.toString()}`;
  const previousPathname = React.useRef(pathname);

  const resetScroll = React.useCallback(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    const adminMain = document.querySelector('#main-content main');
    if (adminMain instanceof HTMLElement) {
      adminMain.scrollTop = 0;
      adminMain.scrollLeft = 0;
    }
  }, []);

  React.useLayoutEffect(() => {
    const pathnameChanged = previousPathname.current !== pathname;
    previousPathname.current = pathname;

    resetScroll();
    if (pathnameChanged) {
      document.getElementById('main-content')?.focus({ preventScroll: true });
      resetScroll();
    }

    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      resetScroll();
      secondFrame = window.requestAnimationFrame(resetScroll);
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
  }, [pathname, resetScroll, routeKey]);

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
