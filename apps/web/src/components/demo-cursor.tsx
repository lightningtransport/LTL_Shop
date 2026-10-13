'use client';

import { useSyncExternalStore } from 'react';
import { demoCursor } from '@/lib/demo/cursor';

/**
 * D40 (DA2): the demo's cursor. It glides to what the step asks to tap (manual: it points; Play: it taps) and
 * ripples on each tap, so the audience follows the hand instead of reading where to look. Never takes clicks.
 */
export function DemoCursor() {
  const cursor = useSyncExternalStore(demoCursor.subscribe, demoCursor.get, demoCursor.get);
  if (!cursor.visible) return null;
  return (
    <div
      data-demo-cursor=""
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-[70]"
      style={{
        transform: `translate(${cursor.x}px, ${cursor.y}px)`,
        transition: cursor.glideMs ? `transform ${cursor.glideMs}ms cubic-bezier(0.45, 0, 0.2, 1)` : 'none',
      }}
    >
      {cursor.taps ? <span key={cursor.taps} className="demo-cursor-ripple absolute -left-5 -top-5 size-10 rounded-full border-2 border-primary bg-primary/25" /> : null}
      <svg width="28" height="32" viewBox="0 0 28 32" className="relative drop-shadow-[0_2px_3px_rgb(0_0_0/0.45)]">
        <path d="M2 2 L2 25 L8.5 19 L13 29.5 L17.5 27.5 L13 17.5 L22 17.5 Z" fill="white" stroke="black" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
      <style>{`
        .demo-cursor-ripple { animation: demo-cursor-ripple 650ms ease-out forwards; }
        @keyframes demo-cursor-ripple { from { transform: scale(0.3); opacity: 1; } to { transform: scale(1.6); opacity: 0; } }
        @media (prefers-reduced-motion: reduce) { .demo-cursor-ripple { animation-duration: 1ms; } }
      `}</style>
    </div>
  );
}
