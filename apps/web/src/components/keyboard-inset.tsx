'use client';

import { useEffect } from 'react';
import { keyboardInset, opensKeyboard } from '@/lib/use-keyboard-inset';

/**
 * LTR-234: mounted once in the root layout. Keeps `--keyboard-inset` (px the keyboard covers) and
 * `html[data-keyboard-open]` up to date from the visual viewport, so bottom sheets stand on top of the keyboard and
 * fixed bottom bars hide while typing (globals.css). When a field gets focus, it is brought into view once the
 * keyboard has opened.
 */
export function KeyboardInset() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const root = document.documentElement;
    let pending: HTMLElement | null = null;
    let timer: number | undefined;

    const reveal = () => {
      const field = pending ?? (opensKeyboard(document.activeElement) ? (document.activeElement as HTMLElement) : null);
      pending = null;
      if (field && field.isConnected) field.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    };

    const update = () => {
      const inset = keyboardInset(window.innerHeight, viewport.height, viewport.offsetTop);
      const was = root.style.getPropertyValue('--keyboard-inset');
      root.style.setProperty('--keyboard-inset', `${inset}px`);
      if (inset > 0) root.dataset.keyboardOpen = '';
      else delete root.dataset.keyboardOpen;
      if (`${inset}px` !== was && inset > 0) window.requestAnimationFrame(reveal);
    };

    const onFocusIn = (event: FocusEvent) => {
      if (!opensKeyboard(event.target as Element)) return;
      pending = event.target as HTMLElement;
      // When the keyboard is already open (moving between fields) no resize comes: reveal after a beat.
      window.clearTimeout(timer);
      timer = window.setTimeout(reveal, 320);
    };

    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
      document.removeEventListener('focusin', onFocusIn);
      window.clearTimeout(timer);
      root.style.removeProperty('--keyboard-inset');
      delete root.dataset.keyboardOpen;
    };
  }, []);
  return null;
}
