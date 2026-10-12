'use client';

import dynamic from 'next/dynamic';
import { DEMO_MODE_AVAILABLE } from '@/lib/dev-login';

/**
 * D36 / PF11: the demo provider, its stories and the panel load only in builds where Dev Login exists
 * (local, e2e, demo). In production the flag is false, so the chunk exists but is never requested, and the
 * shared layout bundle no longer carries the stories and the panel. SSR stays on (the e2e build is a demo build).
 */
const DemoModeShell = DEMO_MODE_AVAILABLE
  ? dynamic(() => import('./demo-mode-shell').then((module) => module.DemoModeShell))
  : null;

export function DemoMode({ children }: { children: React.ReactNode }) {
  if (!DemoModeShell) return <>{children}</>;
  return <DemoModeShell>{children}</DemoModeShell>;
}
