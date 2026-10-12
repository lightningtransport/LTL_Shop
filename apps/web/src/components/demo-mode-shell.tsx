'use client';

import { DemoModeProvider } from '@/lib/demo/demo-context';
import { DemoPanel } from './demo-panel';
import { DemoSpotlight } from './demo-spotlight';

/** The demo provider and panel together, so one chunk carries both (see demo-mode.tsx). */
export function DemoModeShell({ children }: { children: React.ReactNode }) {
  return (
    <DemoModeProvider>
      {children}
      <DemoPanel />
      <DemoSpotlight />
    </DemoModeProvider>
  );
}
