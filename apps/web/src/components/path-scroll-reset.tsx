'use client';

import * as React from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/** The element that scrolls: the Admin's `<main>` beside the menu, or the page everywhere else. */
function scroller(): HTMLElement | null {
  const adminMain = document.querySelector('#main-content main');
  return adminMain instanceof HTMLElement ? adminMain : (document.scrollingElement as HTMLElement | null);
}

function readScroll() {
  return scroller()?.scrollTop ?? 0;
}

function writeScroll(top: number) {
  if (top === 0) {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }
  const element = scroller();
  if (element) {
    element.scrollTop = top;
    if (top === 0) element.scrollLeft = 0;
  }
}

type Navigation = { kind: 'push' | 'replace' | 'pop'; href: string };

/**
 * Owns history scroll restoration (`scrollRestoration = 'manual'` in the layout).
 * - Going forward (a link, a `?action=` push) opens at the top, so mobile Safari never reopens a route mid-page.
 * - LTR-293 §1: Back and Forward return to where the person was on that page (the list they scrolled).
 * - LTR-293 §1: a filter or search that replaces the URL on the same screen (`useUrlFilters`, `{ scroll: false }`)
 *   does not move the page; a replace to another screen (a redirect) opens at the top.
 */
export function PathScrollReset() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams.toString()}`;
  const previousPathname = React.useRef(pathname);
  const saved = React.useRef(new Map<string, number>());
  const shownHref = React.useRef<string | null>(null);
  const navigation = React.useRef<Navigation | null>(null);
  // Between a click on a link and the next screen, the old page can empty out (WebKit); its place is kept from the click.
  const frozen = React.useRef(false);

  React.useEffect(() => {
    shownHref.current = window.location.href;
    // Remember where the person is on the page that is showing (capture: the Admin's <main> scrolls, not the window).
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        if (shownHref.current && !frozen.current) saved.current.set(shownHref.current, readScroll());
      });
    };
    const onClick = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!link || !shownHref.current) return;
      saved.current.set(shownHref.current, readScroll());
      frozen.current = true;
    };
    // Next.js moves through history with pushState / replaceState; wrap them to know which one it was.
    const { pushState, replaceState } = window.history;
    // Only note which kind it was: by now the new page may already be in the DOM, so the scroll listener (not this)
    // keeps the position of the page that was showing.
    const record = (kind: 'push' | 'replace', url: string | URL | null | undefined) => {
      navigation.current = { kind, href: new URL(url ?? window.location.href, window.location.href).href };
    };
    window.history.pushState = function (data, unused, url) {
      record('push', url);
      return pushState.call(this, data, unused, url);
    };
    window.history.replaceState = function (data, unused, url) {
      if (url != null && new URL(url, window.location.href).href !== window.location.href) record('replace', url);
      return replaceState.call(this, data, unused, url);
    };
    const onPop = () => {
      navigation.current = { kind: 'pop', href: window.location.href };
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    document.addEventListener('click', onClick, { capture: true });
    // Capture: Next.js renders the page inside its own popstate listener, so this has to run first.
    window.addEventListener('popstate', onPop, { capture: true });
    return () => {
      window.history.pushState = pushState;
      window.history.replaceState = replaceState;
      document.removeEventListener('scroll', onScroll, { capture: true });
      document.removeEventListener('click', onClick, { capture: true });
      window.removeEventListener('popstate', onPop, { capture: true });
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  React.useLayoutEffect(() => {
    const pathnameChanged = previousPathname.current !== pathname;
    previousPathname.current = pathname;
    const href = window.location.href;
    const noted = navigation.current?.href === href ? navigation.current : null;
    navigation.current = null;
    frozen.current = false;
    // The URL changed with no push or replace noted: Back or Forward.
    const nav: Navigation | null = noted ?? (shownHref.current && shownHref.current !== href ? { kind: 'pop', href } : null);
    shownHref.current = href;

    if (pathnameChanged) document.getElementById('main-content')?.focus({ preventScroll: true });

    // A filter replaced the URL on the same screen: stay where the person is. A redirect to another screen opens at the top.
    if (nav?.kind === 'replace' && !pathnameChanged) return;

    const target = nav?.kind === 'pop' ? saved.current.get(href) ?? 0 : 0;
    writeScroll(target);
    if (target === 0) {
      // The new page may paint a frame later; keep it at the top.
      let secondFrame = 0;
      const firstFrame = window.requestAnimationFrame(() => {
        writeScroll(0);
        secondFrame = window.requestAnimationFrame(() => writeScroll(0));
      });
      return () => {
        window.cancelAnimationFrame(firstFrame);
        window.cancelAnimationFrame(secondFrame);
      };
    }

    // Back to a list: its rows load after the route and can redraw (a revalidation), so for up to 5 s put the page
    // back whenever it is not where the person left it. It stops as soon as they scroll, tap, click or type.
    let frame = 0;
    let stopped = false;
    const startedAt = performance.now();
    const stop = () => { stopped = true; };
    const step = () => {
      if (stopped || performance.now() - startedAt > 5000) return;
      if (Math.abs(readScroll() - target) > 1) writeScroll(target);
      frame = window.requestAnimationFrame(step);
    };
    frame = window.requestAnimationFrame(step);
    const events = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const;
    for (const name of events) window.addEventListener(name, stop, { passive: true, once: true, capture: true });
    return () => {
      stopped = true;
      window.cancelAnimationFrame(frame);
      for (const name of events) window.removeEventListener(name, stop, { capture: true });
    };
  }, [pathname, routeKey]);

  return null;
}
