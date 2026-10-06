'use client';

import type { AdminWorkOrderDetailDto } from '@ltl-shop/shared';
import { formatDuration } from '@/lib/admin-format';
import type { AdminMessages } from '@/lib/admin-messages';
import { fillPlaceholders } from '@/lib/admin-next-step';
import { formatAge, workOrderMechanics, workOrderProgress } from '@/lib/work-order-view';
import { MechanicAvatarStack } from './mechanic-avatar';

/**
 * Stage 8 (F7, mockup): the Work Order metrics strip — progress with a split bar (done, blocked, at an
 * external shop), active labor, waiting, age and the mechanics. A compact card on phones.
 * `operational-counts` stays on it for the tests and the screen reader summary.
 */
export function WorkOrderMetrics({ data, messages }: { data: AdminWorkOrderDetailDto; messages: AdminMessages }) {
  const progress = workOrderProgress(data);
  const mechanics = workOrderMechanics(data);
  const pct = (value: number) => (progress.total ? `${(value / progress.total) * 100}%` : '0%');
  const bar = (
    <div
      className="flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-muted-foreground/20"
      role="img"
      aria-label={fillPlaceholders(messages.progressAria, { done: String(progress.done), total: String(progress.total), blocked: String(progress.blocked), external: String(progress.external) })}
    >
      <span className="bg-success" style={{ width: pct(progress.done) }} />
      <span className="bg-warning" style={{ width: pct(progress.blocked) }} />
      <span className="bg-primary/70" style={{ width: pct(progress.external) }} />
    </div>
  );
  const jobs = (
    <span className="tnum">
      {progress.done}
      <span className="text-muted-foreground">{fillPlaceholders(messages.metricsJobsOf, { total: String(progress.total) })}</span>
    </span>
  );
  const labor = formatDuration(data.totalActiveLaborMs);
  const waiting = formatDuration(data.totalWaitingMs);
  const age = formatAge(data.createdAt);

  return (
    <div data-testid="operational-counts">
      {/* Phones: one compact card. */}
      <div className="space-y-3 rounded-xl border bg-card p-4 sm:hidden">
        <div className="flex items-center justify-between gap-3">
          <p className="text-lg font-semibold">{jobs}</p>
          <MechanicAvatarStack mechanics={mechanics} max={4} />
        </div>
        {bar}
        <dl className="grid grid-cols-3 divide-x border-t pt-3 text-center">
          <div><dt className="text-xs text-muted-foreground">{messages.metricsLabor}</dt><dd className="tnum font-semibold">{labor}</dd></div>
          <div><dt className="text-xs text-muted-foreground">{messages.metricsWaiting}</dt><dd className="tnum font-semibold">{waiting}</dd></div>
          <div><dt className="text-xs text-muted-foreground">{messages.metricsAge}</dt><dd className="tnum font-semibold">{age}</dd></div>
        </dl>
      </div>
      {/* From `sm`: five cells (Age hides under `lg`). */}
      <dl className="hidden overflow-hidden rounded-xl border bg-card sm:grid sm:grid-cols-3 lg:grid-cols-5 [&>div]:p-4">
        <div className="space-y-2 max-lg:col-span-3 max-lg:border-b lg:border-r">
          <dt className="text-xs text-muted-foreground">{messages.metricsProgress}</dt>
          <dd className="text-xl font-semibold">{jobs}</dd>
          {bar}
        </div>
        <div className="space-y-1 border-r"><dt className="text-xs text-muted-foreground">{messages.activeLabor}</dt><dd className="tnum text-xl font-semibold">{labor}</dd></div>
        <div className="space-y-1 border-r"><dt className="text-xs text-muted-foreground">{messages.metricsWaiting}</dt><dd className="tnum text-xl font-semibold">{waiting}</dd></div>
        <div className="space-y-1 max-lg:hidden lg:border-r"><dt className="text-xs text-muted-foreground">{messages.metricsAge}</dt><dd className="tnum text-xl font-semibold">{age}</dd></div>
        <div className="space-y-1.5">
          <dt className="text-xs text-muted-foreground">{messages.mechanicsLabel}</dt>
          <dd className="flex items-center gap-2"><MechanicAvatarStack mechanics={mechanics} max={4} /><span className="text-muted-foreground">{mechanics.length}</span></dd>
        </div>
      </dl>
    </div>
  );
}
