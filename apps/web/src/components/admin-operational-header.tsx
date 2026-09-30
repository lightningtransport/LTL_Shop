'use client';

import type { ReactNode } from 'react';
import { PageHeader } from './ui';

/**
 * LTR-174: the operational header shared by Truck Detail and the Admin Work Order detail — identity,
 * status badges, key counts, the one Next step and the primary actions on the right. Presentation
 * only: the Next step rule stays in the API (`nextStep`) and every action keeps its existing call.
 */
export function AdminOperationalHeader({
  title,
  subtitle,
  meta,
  badges,
  counts,
  actions,
  note,
  nextStep,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  badges?: ReactNode;
  /** Key counts from data already on screen ("2 Jobs left · 1 mechanics"). */
  counts?: string | null;
  actions?: ReactNode;
  /** One short line under the header (e.g. why Pause is not available yet). */
  note?: ReactNode;
  /** The Next step box (`AdminTruckNextStep` on the Truck, the `admin-wo-next-step` box on the Work Order). */
  nextStep?: ReactNode;
}) {
  return (
    <div className="space-y-3">
      {/* Phones: the identity keeps the full width and the actions go on their own row; desktop: side by side. */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <PageHeader className="min-w-0 flex-1" title={title} subtitle={subtitle} meta={meta} badges={badges} />
        {actions ? <div className="flex flex-wrap items-center gap-2 lg:shrink-0 lg:justify-end">{actions}</div> : null}
      </div>
      {counts ? <p className="text-sm text-muted-foreground" data-testid="operational-counts">{counts}</p> : null}
      {note}
      {nextStep}
    </div>
  );
}
