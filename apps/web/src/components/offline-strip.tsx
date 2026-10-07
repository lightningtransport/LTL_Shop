'use client';

import { WifiOff } from 'lucide-react';
import { useOnline } from '@/lib/use-online';
import { cn } from '@/lib/utils';

/**
 * Stage PM-5 (block C, UX-6-007, Q10): one notice when the phone has no connection — the same strip on
 * every field-role screen, instead of red errors piling up under each action.
 */
export function OfflineStrip({ message, className }: { message: string; className?: string }) {
  const online = useOnline();
  if (online) return null;
  return (
    <p
      role="status"
      data-testid="offline-strip"
      className={cn('mb-4 flex min-h-11 items-center gap-2 rounded-lg border border-warning/40 bg-warning-surface px-3 text-sm font-medium text-warning-foreground', className)}
    >
      <WifiOff aria-hidden="true" className="size-4 shrink-0" />
      {message}
    </p>
  );
}
