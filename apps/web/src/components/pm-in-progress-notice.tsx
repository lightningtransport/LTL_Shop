'use client';

import Link from 'next/link';
import type { WorkOrderSummaryDto } from '@ltl-shop/shared';
import { useShopLocale } from '@/lib/locale-context';
import { cn } from '@/lib/utils';
import { buttonVariants } from './ui';

/**
 * Block A (PM5) / LTR-95: one running PM at a time. Wherever the PM mechanic could start another one,
 * say where the running PM is and lead back to it, instead of offering Start and answering with an error.
 */
export function PmInProgressNotice({ running, className, showLink = true }: { running: WorkOrderSummaryDto; className?: string; showLink?: boolean }) {
  const { messages } = useShopLocale();
  return (
    <div className={cn('space-y-2 rounded-lg bg-warning-surface px-3 py-2 text-sm text-warning-foreground', className)} role="status" data-testid="pm-in-progress-notice">
      <p>{messages.pmInProgressOn(running.truckNumber, running.displayId)}</p>
      {showLink ? <Link href={`/work-orders/${running.id}?view=pm`} className={cn(buttonVariants({ variant: 'default' }), 'w-full')}>
        {messages.continuePmOn(running.truckNumber)}
      </Link> : null}
    </div>
  );
}
