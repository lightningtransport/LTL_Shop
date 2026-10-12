'use client';

import { DemoModeProvider } from '@/lib/demo/demo-context';
import { DEMO_HOSTED } from '@/lib/dev-login';
import { DemoAccessGate } from './demo-access-gate';
import { DemoPanel } from './demo-panel';
import { DemoSpotlight } from './demo-spotlight';

/** The demo provider and panel together, so one chunk carries both (see demo-mode.tsx). */
export function DemoModeShell({ children }: { children: React.ReactNode }) {
  const demo = (
    <DemoModeProvider>
      {children}
      <DemoPanel />
      <DemoSpotlight />
    </DemoModeProvider>
  );
  // D39 (DP3): the published demo shows nothing until the visitor types the code that came with the link.
  return DEMO_HOSTED ? <DemoAccessGate>{demo}</DemoAccessGate> : demo;
}
