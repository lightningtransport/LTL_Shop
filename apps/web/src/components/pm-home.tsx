'use client';

import Link from 'next/link';
import { ChevronRight, CircleCheck, Play, Plus } from 'lucide-react';
import type { WorkOrderSummaryDto } from '@ltl-shop/shared';
import { formatMileage, pauseLabel } from '@/lib/format';
import { useShopLocale } from '@/lib/locale-context';
import type { HomeLists } from '@/lib/shop-data';
import { intlLocale } from '@/lib/shop-locale';
import { vehicleLine } from '@/lib/work-order-identity';
import { PmInProgressNotice } from './pm-in-progress-notice';
import { Button, CardListSkeleton, CountChip, EmptyState, PriorityBadge } from './ui';

type Wo = WorkOrderSummaryDto;

/** "3 d", "5 h" or "40 min": how long a truck has waited, from when its Work Order was opened. */
function age(iso: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} h` : `${Math.round(hours / 24)} d`;
}

/**
 * Stage PM-3 (docs/proposals/mechanic-pm-redesign §4.2): the PM mechanic's home. The PM in progress first;
 * then "Waiting for PM" by priority and age, where only the first ("Next up") offers Start (D-PM3, D-PM4);
 * "Paused by the Manager" only when there is some; nothing offers a second PM while one runs (LTR-95).
 */
export function PmHome({ data, loading }: { data: HomeLists | undefined; loading: boolean }) {
  const { messages } = useShopLocale();
  const shortDate = (iso: string) => new Intl.DateTimeFormat(intlLocale(messages.locale), { month: 'short', day: 'numeric' }).format(new Date(iso));
  const running = data?.active[0] ?? null;
  const waiting = data?.created ?? [];

  if (!data) {
    // Until the list answers, the app does not know whether a PM runs, so Create waits (block A, PM5).
    return (
      <>
        <Button className="mb-6 w-full" variant="outline" disabled>{messages.createPmService}</Button>
        {loading ? <CardListSkeleton /> : null}
      </>
    );
  }

  return (
    <div className="space-y-6" data-testid="pm-home">
      {running ? (
        <section>
          <h2 className="section-title mb-2">{messages.pmActiveTitle}</h2>
          <RunningCard wo={running} />
          <PmInProgressNotice running={running} className="mt-3" showLink={false} />
          <Button className="mt-2 w-full" variant="outline" disabled>{messages.createPmService}</Button>
          <p className="mt-1 text-center text-xs text-muted-foreground">{messages.pmCreateAfter(running.truckNumber)}</p>
        </section>
      ) : (
        <Button asChild variant="outline" className="w-full">
          <Link href="/mechanic/pm/new"><Plus aria-hidden="true" />{messages.createPmService}</Link>
        </Button>
      )}

      <section data-testid="pm-waiting">
        <h2 className="section-title mb-1 flex items-center gap-2">{messages.pmWaitingTitle}<CountChip>{waiting.length}</CountChip></h2>
        <p className="mb-2 text-sm text-muted-foreground">{messages.mostUrgentFirst}</p>
        {waiting.length ? (
          // D54: two per row on an iPad; the next-up card takes the whole row.
          <ul className="grid gap-2 md:grid-cols-2">
            {waiting.map((wo, index) => {
              const next = !running && index === 0;
              const href = `/work-orders/${wo.id}${wo.pmJob ? '?view=pm' : ''}`;
              return (
                <li key={wo.id} className={`flex flex-col rounded-xl border bg-card ${next ? 'border-primary ring-1 ring-primary md:col-span-2' : ''}`} data-testid={`pm-waiting-${wo.truckNumber}`}>
                  <div className="flex-1 space-y-1 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-lg font-semibold">{messages.truckTitle(wo.truckNumber)}</span>
                      {wo.priority === 'high' || wo.priority === 'critical' ? (
                        <PriorityBadge priority={wo.priority}>{messages.priority[wo.priority] ?? wo.priority}</PriorityBadge>
                      ) : null}
                      {next ? <span className="text-xs font-semibold text-primary">{messages.nextUp}</span> : null}
                      <span className="tnum ml-auto text-xs text-muted-foreground">{messages.pmWaitingFor(age(wo.createdAt))}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {[wo.pmJob?.displayName ? messages.pmJobOnWorkOrder(wo.pmJob.displayName, wo.displayId) : wo.displayId, vehicleLine(wo.truckVehicle)].filter(Boolean).join(' · ')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {wo.lastPm ? messages.lastPmLine(wo.lastPm.observedMileage === null ? messages.mileageNotRecorded : formatMileage(wo.lastPm.observedMileage), shortDate(wo.lastPm.completedAt)) : messages.noPmOnRecord}
                    </p>
                  </div>
                  <div className="border-t p-2">
                    {next ? (
                      <Button asChild className="w-full">
                        <Link href={href} aria-label={messages.workOrderAction(messages.startPmOn(wo.truckNumber), wo.displayId, wo.truckNumber)}>
                          <Play aria-hidden="true" />{messages.startPmOn(wo.truckNumber)}
                        </Link>
                      </Button>
                    ) : (
                      <Button asChild variant="ghost" className="w-full justify-between">
                        <Link href={href} aria-label={messages.workOrderAction(messages.viewShort, wo.displayId, wo.truckNumber)}>
                          {messages.viewShort}<ChevronRight aria-hidden="true" />
                        </Link>
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState>
            <p className="font-medium text-foreground">{messages.pmEmptyTitle}</p>
            <p className="mt-1">{messages.pmEmptyHint}</p>
          </EmptyState>
        )}
      </section>

      {data.paused.length ? (
        <section data-testid="pm-paused">
          <h2 className="section-title mb-2 flex items-center gap-2">{messages.pmPausedTitle}<CountChip>{data.paused.length}</CountChip></h2>
          <ul className="space-y-2">
            {data.paused.map((wo) => (
              <li key={wo.id}>
                <Link href={`/work-orders/${wo.id}${wo.pmJob ? '?view=pm' : ''}`} className="block space-y-1 rounded-xl border border-warning/50 bg-warning-surface p-3 text-sm">
                  <span className="font-display text-lg font-semibold">{messages.truckTitle(wo.truckNumber)}</span>
                  <span className="block text-warning-foreground dark:text-warning">
                    {messages.pmPausedSince(pauseLabel(wo.currentPauseReason, messages.pauseReason) ?? '', wo.pausedAt ? shortDate(wo.pausedAt) : '—')}
                  </span>
                  {wo.pauseNote ? <span className="block italic">“{wo.pauseNote}”</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.completed.length ? (
        <Button asChild variant="secondary" className="w-full">
          <Link href="/mechanic/pm/completed">{messages.viewCompletedWork(data.completed.length)}</Link>
        </Button>
      ) : null}
    </div>
  );
}

function RunningCard({ wo }: { wo: Wo }) {
  const { messages } = useShopLocale();
  const service = wo.pmJob?.displayName ?? messages.pmServiceLabel;
  const mileage = wo.pmJob?.observedMileage ?? null;
  const parts = wo.pmJob?.partsCount ?? 0;
  return (
    <div className="rounded-xl border border-primary bg-card ring-1 ring-primary" data-testid={`pm-running-${wo.truckNumber}`}>
      <div className="space-y-1 p-3">
        <p className="font-display text-lg font-semibold">{messages.truckTitle(wo.truckNumber)}</p>
        <p className="text-sm text-muted-foreground">{messages.pmStartedLine(service)} · <span className="font-mono">{wo.displayId}</span></p>
        <p className="flex flex-wrap items-center gap-x-2 text-sm">
          <span className={`flex items-center gap-1 ${mileage !== null ? 'text-success' : 'text-muted-foreground'}`}>
            {mileage !== null ? <CircleCheck aria-hidden="true" className="size-4" /> : null}
            {mileage !== null ? messages.pmSummaryMileage(formatMileage(mileage)) : messages.pmSummaryMileageMissing}
          </span>
          <span aria-hidden="true" className="text-muted-foreground">·</span>
          <span className={parts ? 'text-success' : 'text-muted-foreground'}>{messages.pmPartsLabel} {parts}</span>
        </p>
      </div>
      <div className="border-t p-2">
        <Button asChild className="w-full">
          <Link href={`/work-orders/${wo.id}${wo.pmJob ? '?view=pm' : ''}`} aria-label={messages.workOrderAction(messages.continuePmService, wo.displayId, wo.truckNumber)}>
            {messages.continuePmService}
          </Link>
        </Button>
      </div>
    </div>
  );
}
