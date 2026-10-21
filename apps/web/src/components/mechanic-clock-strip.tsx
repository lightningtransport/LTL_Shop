'use client';

import Link from 'next/link';
import { ChevronRight, WifiOff } from 'lucide-react';
import { AppCapability, MechanicMode } from '@ltl-shop/shared';
import { useAuth } from '@/lib/auth-context';
import { useShopLocale } from '@/lib/locale-context';
import { useWorkOrders } from '@/lib/shop-data';
import { useOnline } from '@/lib/use-online';
import { cn } from '@/lib/utils';

/**
 * Stage MG-2 (MG1, D21): one strip under the header on every General mechanic screen that says which Truck
 * I am working on ("Working on Truck 922") or that nothing is active. D53: never since when or how long. Without a connection it
 * becomes the single offline notice (UX-6-007). It reads the same list the home screen reads.
 */
export function MechanicClockStrip({ className }: { className?: string }) {
  const { token, user } = useAuth();
  const { messages } = useShopLocale();
  const online = useOnline();
  // Like the home screen: no list request before the session's capabilities are known (LTR-167).
  const { data } = useWorkOrders(Boolean(token && user?.capabilities.includes(AppCapability.MECHANIC_STANDARD)), MechanicMode.STANDARD);

  if (!online) {
    return (
      <p
        role="status"
        data-testid="offline-strip"
        className={cn('mb-4 flex min-h-11 items-center gap-2 rounded-lg border border-warning/40 bg-warning-surface px-3 text-sm font-medium text-warning-foreground', className)}
      >
        <WifiOff aria-hidden="true" className="size-4 shrink-0" />
        {messages.offlineNotSent}
      </p>
    );
  }
  if (!data) return null;
  const clock = data.myClock ?? null;
  if (!clock) {
    return (
      <p
        role="status"
        data-testid="clock-strip"
        data-running="false"
        className={cn('mb-4 flex min-h-11 items-center gap-2 rounded-lg border bg-muted/50 px-3 text-sm text-muted-foreground', className)}
      >
        <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-muted-foreground/60" />
        {messages.clockStripStopped}
      </p>
    );
  }
  return (
    <Link
      href={`/work-orders/${clock.workOrderId}`}
      data-testid="clock-strip"
      data-running="true"
      className={cn('mb-4 flex min-h-11 items-center gap-2 rounded-lg border border-success/40 bg-success/10 px-3 text-sm hover:bg-success/15', className)}
    >
      <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-success" />
      <span className="min-w-0 flex-1 truncate">
        <b className="font-semibold">{messages.clockStripYourClock}</b>{' '}{messages.truckTitle(clock.truckNumber)}
      </span>
      <span className="flex shrink-0 items-center text-xs font-medium text-success"><span className="sr-only sm:not-sr-only">{messages.clockStripOpen}</span><ChevronRight aria-hidden="true" className="size-4" /></span>
    </Link>
  );
}
