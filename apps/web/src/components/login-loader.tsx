'use client';

import { useEffect, useRef, useState } from 'react';
import { LOGIN_LOADER_FADE_MS, LOGIN_LOADER_MAX_WAIT_MS, LOGIN_LOADER_SEEN_KEY, loginLoaderDuration } from '@/lib/login-loader';

/**
 * Owner request (2026-10-06): before the sign-in screen, the animated Lightning logo on the brand navy, full
 * screen; it fades away and the sign-in form is underneath. Rendered by the server so the form never flashes
 * first; the client decides how long it stays (`loginLoaderDuration`) and removes it.
 */
export function LoginLoader({ label }: { label: string }) {
  const [phase, setPhase] = useState<'show' | 'fade' | 'gone'>('show');
  // The logo is added only on the client, once the duration is known, so its animation and the timer start together.
  const [duration, setDuration] = useState<number | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    let seen = false;
    try {
      seen = window.sessionStorage.getItem(LOGIN_LOADER_SEEN_KEY) === '1';
    } catch {
      // Storage blocked: treat it as the first time.
    }
    const next = loginLoaderDuration({
      param: new URLSearchParams(window.location.search).get('loader'),
      seen,
      webdriver: Boolean(navigator.webdriver),
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    });
    if (!next) {
      setPhase('gone');
      return undefined;
    }
    try {
      window.sessionStorage.setItem(LOGIN_LOADER_SEEN_KEY, '1');
    } catch {
      // Not remembered: it shows again next time.
    }
    setDuration(next);
    // If the logo never loads, do not keep the sign-in screen hidden.
    timers.current.push(window.setTimeout(() => finish(0), LOGIN_LOADER_MAX_WAIT_MS));
    const pending = timers.current;
    return () => pending.forEach((timer) => window.clearTimeout(timer));
  }, []);

  function finish(after: number) {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [
      window.setTimeout(() => setPhase('fade'), after),
      window.setTimeout(() => setPhase('gone'), after + LOGIN_LOADER_FADE_MS),
    ];
  }

  if (phase === 'gone') return null;
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      data-testid="login-loader"
      className={`fixed inset-0 z-[100] grid place-items-center bg-[#0f1a33] transition-opacity duration-300 motion-reduce:transition-none ${phase === 'fade' ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
    >
      {duration ? (
        // eslint-disable-next-line @next/next/no-img-element -- an animated SVG: next/image would rasterize it.
        <img src="/lightning-loader.svg" alt="" className="w-[min(60vw,320px)]" onLoad={() => finish(duration)} onError={() => finish(0)} />
      ) : null}
    </div>
  );
}
