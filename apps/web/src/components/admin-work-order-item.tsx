'use client';

import Link from 'next/link';
import { isPmCategory, type AdminWorkOrderSummaryDto } from '@ltl-shop/shared';
import { Button, PriorityBadge, WorkOrderStatusBadge } from './ui';
import { formatAdminDate } from '@/lib/admin-format';
import { adminPauseReasonLabel, type AdminLocale, type AdminMessages } from '@/lib/admin-messages';
import { adminAttentionReasonLabel, adminPriorityLabel, workOrderStatusLabel } from '@/lib/status-chips';
import { cn } from '@/lib/utils';
import { adminTruckHref } from '@/lib/admin-truck-origin';
import { mechanicNamesLabel, workOrderNextJobLine } from '@/lib/admin-work-summary';
import { AdminBlockerResolve } from './admin-blocker-resolve';

export function AdminWorkOrderItem({ item, locale, messages, compact = false, fromPath = '/admin/work-orders', onBlockerResolved }: {
  item: AdminWorkOrderSummaryDto; locale: AdminLocale; messages: AdminMessages; compact?: boolean; fromPath?: string;
  /** LTR-155 / D17: when set (Dashboard), the active blocker can be resolved in place. */
  onBlockerResolved?: () => Promise<unknown> | void;
}) {
  const statusChip = (
    <WorkOrderStatusBadge status={item.status}>{workOrderStatusLabel(item.status, messages)}</WorkOrderStatusBadge>
  );
  const priorityChip = (
    <PriorityBadge priority={item.priority}>{adminPriorityLabel(item.priority, messages)}</PriorityBadge>
  );

  // LTR-121: same reason and copy on the Dashboard and the Work Order list.
  const attention = adminAttentionReasonLabel(item.attentionReason, messages);

  return (
    <article className={cn('rounded-xl border bg-card p-4 shadow-sm', compact && 'bg-background p-3 shadow-none xl:grid xl:grid-cols-[minmax(180px,1.2fr)_minmax(220px,1fr)_auto] xl:items-center xl:gap-4')}>
      <div className="flex flex-wrap items-start justify-between gap-3 xl:block">
        <div>
          <Link className="font-display text-lg font-semibold text-primary hover:underline" href={adminTruckHref(item.truck.id, fromPath)}>{item.truck.truckNumber}</Link>
          <p className="mt-1 text-sm text-muted-foreground">
            {messages.workOrder}{' '}
            <Link className="font-medium text-foreground hover:underline" href={`/admin/work-orders/${item.id}`}>{item.displayId}</Link>
            {' · '}
            {workOrderNextJobLine(item, messages)}
          </p>
          {attention ? (
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-warning-foreground" data-testid="attention-reason">
              {messages.attentionReasonLabel}: {attention}
            </p>
          ) : null}
        </div>
        <div className={cn('flex flex-wrap gap-2', compact && 'xl:hidden')}>{priorityChip}{statusChip}</div>
      </div>
      <dl className={cn('mt-4 grid gap-3 text-sm sm:grid-cols-3', compact && 'grid-cols-2 xl:mt-0 xl:grid-cols-2')}>
        <div><dt className="text-muted-foreground">{messages.progress}</dt><dd className="font-medium">{isPmCategory(item.category.name) ? messages.pmServiceVariant : `${item.jobsCompleted} / ${item.jobsTotal}`}</dd></div>
        <div><dt className="text-muted-foreground">{messages.mechanicsLabel}</dt><dd className="font-medium">{mechanicNamesLabel(item.mechanics, messages)}</dd></div>
        <div className={cn(compact && 'col-span-2 sm:col-span-1 xl:hidden')}><dt className="text-muted-foreground">{messages.updated}</dt><dd className="font-medium">{formatAdminDate(item.updatedAt, locale)}</dd></div>
      </dl>
      {compact ? <div className="mt-3 hidden min-w-0 text-right xl:block"><div className="flex justify-end gap-2">{priorityChip}{statusChip}</div><p className="mt-2 text-xs text-muted-foreground">{formatAdminDate(item.updatedAt, locale)}</p></div> : null}
      {item.status === 'in_progress' && item.jobsTotal > 0 && item.jobsCompleted === item.jobsTotal ? (
        <p className={cn('mt-3 rounded-lg bg-shop-accent/10 px-3 py-2 text-sm font-medium', compact && 'xl:col-span-3 xl:mt-0')}>{messages.readyToCloseHint}</p>
      ) : null}
      {item.currentPause ? <p className={cn('mt-3 rounded-lg bg-warning-surface px-3 py-2 text-sm text-warning-foreground', compact && 'xl:col-span-3 xl:mt-0')}>{messages.currentPause}: {adminPauseReasonLabel(item.currentPause.reason, messages)}</p> : null}
      {!item.currentPause && item.latestReportedBlocker ? (
        <div className={cn('mt-3 rounded-lg bg-warning-surface px-3 py-2 text-sm text-warning-foreground', compact && 'xl:col-span-3 xl:mt-0')}>
          {onBlockerResolved ? (
            <AdminBlockerResolve
              workOrderId={item.id}
              blocker={item.latestReportedBlocker}
              locale={locale}
              messages={messages}
              canResolve
              onResolved={onBlockerResolved}
            />
          ) : (
            <p>
              {messages.reportedBlockerLabel}: {item.latestReportedBlocker.job ? `${item.latestReportedBlocker.job.displayName} · ` : ''}
              {adminPauseReasonLabel(item.latestReportedBlocker.blockerReason ?? item.latestReportedBlocker.reason, messages)}
            </p>
          )}
        </div>
      ) : null}
      {!compact ? <Button asChild variant="outline" size="sm" className="mt-4"><Link href={`/admin/work-orders/${item.id}`}>{messages.details}</Link></Button> : null}
    </article>
  );
}
