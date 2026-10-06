'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  AppCapability,
  TruckOperationalStatus,
  WorkPlanInspectionOutcome,
  type AdminTruckDetailDto,
  type TruckWorkPlanDto,
} from '@ltl-shop/shared';
import { useSWRConfig } from 'swr';
import { ApiError } from '@/lib/api';
import { intlLocale } from '@/lib/shop-locale';
import { isYardRelatedListKey } from '@/lib/swr-cache-keys';
import { useAdminTruck } from '@/lib/admin-data';
import { formatAdminDate, formatAdminDateOnly } from '@/lib/admin-format';
import { formatVehicleYmm } from '@/lib/format';
import { adminPauseReasonLabel, type AdminLocale, type AdminMessages } from '@/lib/admin-messages';
import { fillPlaceholders } from '@/lib/admin-next-step';
import { adminTruckOrigin, type AdminTruckOrigin } from '@/lib/admin-truck-origin';
import { mechanicNamesLabel, openCurrentWork } from '@/lib/admin-work-summary';
import { adminPriorityLabel, workOrderStatusLabel } from '@/lib/status-chips';
import { workPlanPhaseLabel } from '@/lib/work-plan';
import { AdminContextSidebar, ContextBlock, ContextCard } from './admin-context-sidebar';
import { AdminOperationalHeader } from './admin-operational-header';
import { AdminTruckWorkPlan } from './admin-truck-work-plan';
import { AdminTruckNextStep } from './admin-truck-next-step';
import { useAuth } from '@/lib/auth-context';
import { AdminBackLink, Badge, Button, CollapsibleSection, CompactEmpty, EmptyState, LoadFailure, PageSkeleton, PriorityBadge, WorkOrderStatusBadge } from './ui';

export function AdminTruckDetail({ id, from = null, locale, messages }: { id: string; from?: string | null; locale: AdminLocale; messages: AdminMessages }) {
  const origin = adminTruckOrigin(from, messages);
  const { mutate: mutateRelated } = useSWRConfig();
  const { data, error, isLoading, mutate } = useAdminTruck(id);
  const { user } = useAuth();
  const canManageWorkOrders = !!user?.capabilities.includes(AppCapability.WORK_ORDERS_MANAGE);

  if (isLoading) return <PageSkeleton label={messages.loadingTruck} />;
  if (error instanceof ApiError && error.status === 404) return <TruckNotFound messages={messages} />;
  if (error || !data) return <LoadFailure message={messages.yardLoadError} retryLabel={messages.retryTruck} onRetry={() => void mutate()} />;

  async function handleWorkPlanUpdated(next: TruckWorkPlanDto) {
    await mutate((current) => (current ? { ...current, workPlan: next } : current), { revalidate: true });
    void mutateRelated(isYardRelatedListKey, undefined, { revalidate: true, populateCache: false });
  }

  return (
    <TruckDetailBody
      data={data}
      origin={origin}
      locale={locale}
      messages={messages}
      canManage={canManageWorkOrders}
      onChanged={() => mutate()}
      onPlanUpdated={handleWorkPlanUpdated}
    />
  );
}

/**
 * LTR-174: "Can this Truck leave, and if not, what blocks it?" — operational header (identity, Ready /
 * Not Ready, phase, counts, Next step, Add work / Open Work Order), then the Work Plan (readiness
 * tracker with the D14 inspection, Jobs summary) beside a context column (Current Work, Truck details
 * and Repair history folded). Phones: one column, same order.
 */
function TruckDetailBody({
  data,
  origin,
  locale,
  messages,
  canManage,
  onChanged,
  onPlanUpdated,
}: {
  data: AdminTruckDetailDto;
  origin: AdminTruckOrigin;
  locale: AdminLocale;
  messages: AdminMessages;
  canManage: boolean;
  onChanged: () => Promise<unknown> | void;
  onPlanUpdated: (next: TruckWorkPlanDto) => Promise<void> | void;
}) {
  const truckId = data.truck.id;
  const workPlan = data.workPlan;
  const currentWork = openCurrentWork(data.activeWorkOrder);
  const canAddWork = workPlan.capabilities.canAddWork;
  // Issues found with no Jobs yet: the add form starts open (D14).
  const [addWorkOpen, setAddWorkOpen] = useState(
    () => workPlan.inspection.outcome === WorkPlanInspectionOutcome.ISSUES_FOUND && workPlan.jobs.length === 0,
  );

  // LTR-119: "Add work in the Work Plan" from a Work Order lands on the Work Plan once it has loaded.
  useEffect(() => {
    if (window.location.hash !== '#truck-work-plan-title') return;
    document.getElementById('truck-work-plan-title')?.scrollIntoView({ block: 'start' });
  }, []);

  const ownerCount = new Set(workPlan.jobs.map((job) => job.assignedMechanic?.id).filter(Boolean)).size;
  // T1: a completed Work Order has nothing left; "0 Jobs left · N mechanics" is not shown for it.
  const counts = workPlan.workOrder && workPlan.workOrder.status !== 'completed'
    ? fillPlaceholders(messages.operationalCounts, { jobs: String(workPlan.remainingJobCount), mechanics: String(ownerCount) })
    : null;

  return <div className="space-y-5">
    <AdminBackLink href={origin.href}>{origin.backLabel}</AdminBackLink>
    <AdminOperationalHeader
      title={data.truck.truckNumber}
      subtitle={formatVehicleYmm(data.truck) || messages.noValue}
      badges={(
        <>
          {/* LTR-51 (#14): a truck back in service with no Work Order is not "Not Ready". */}
          {!workPlan.workOrder && workPlan.readiness !== 'ready' ? (
            <Badge variant="secondary">
              {data.operationalStatus === TruckOperationalStatus.IN_SERVICE ? messages.operationalStatusInService : messages.noOpenWorkOrder}
            </Badge>
          ) : (
            <>
              <Badge variant={workPlan.readiness === 'ready' ? 'success' : 'warning'}>
                {workPlan.readiness === 'ready' ? messages.workPlanReady : messages.workPlanNotReady}
              </Badge>
              {/* The phase is only a badge in the header (SYSTEM.md §6), and only once there is a Work Order.
                  T9: at Ready to Go the readiness badge already says it, so the phase is not repeated. */}
              {workPlan.phase === 'ready_to_go' ? null : <Badge variant="outline">{workPlanPhaseLabel(workPlan.phase, messages)}</Badge>}
            </>
          )}
        </>
      )}
      counts={counts}
      actions={(
        <>
          {workPlan.workOrder ? (
            <Button asChild variant="outline">
              <Link href={`/admin/work-orders/${workPlan.workOrder.id}`}>
                {/* T1 / UX-5-001: a completed Work Order is not "open"; the link says what it is. */}
                {workPlan.workOrder.status === 'completed'
                  ? fillPlaceholders(messages.workPlanCompletedWorkOrder, { workOrder: workPlan.workOrder.displayId })
                  : `${messages.workPlanOpenWorkOrder}: ${workPlan.workOrder.displayId}`}
              </Link>
            </Button>
          ) : null}
          {canAddWork ? (
            <Button
              type="button"
              variant={addWorkOpen ? 'outline' : 'default'}
              onClick={() => setAddWorkOpen(!addWorkOpen)}
              aria-expanded={addWorkOpen}
              aria-controls="work-plan-add-work"
            >
              {addWorkOpen ? messages.workPlanHideAddWork : messages.workPlanAddWork}
            </Button>
          ) : null}
        </>
      )}
      nextStep={
        /* LTR-158 / D14: the one thing to do next (blocker first). Same rule as the Work Order, Dashboard and Yard. */
        <AdminTruckNextStep truck={data} locale={locale} messages={messages} canManage={canManage} onChanged={onChanged} />
      }
    />

    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
      <div className="min-w-0 space-y-5">
        <AdminTruckWorkPlan
          truckId={truckId}
          plan={workPlan}
          messages={messages}
          addWorkOpen={addWorkOpen}
          onAddWorkOpenChange={setAddWorkOpen}
          onPlanUpdated={onPlanUpdated}
        />
      </div>

      <AdminContextSidebar label={messages.contextSidebarLabel}>
        <ContextCard>
          <ContextBlock title={messages.currentWork}>
            {currentWork ? (
              <div className="space-y-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link className="tap-inline font-semibold text-primary hover:underline" href={`/admin/work-orders/${currentWork.id}`}>{currentWork.displayId}</Link>
                  <div className="flex gap-2">
                    <WorkOrderStatusBadge status={currentWork.status}>{workOrderStatusLabel(currentWork.status, messages)}</WorkOrderStatusBadge>
                    <PriorityBadge priority={currentWork.priority}>{adminPriorityLabel(currentWork.priority, messages)}</PriorityBadge>
                  </div>
                </div>
                <dl><Info label={messages.mechanicsLabel} value={mechanicNamesLabel(currentWork.mechanics, messages)} /></dl>
                {currentWork.currentPause ? (
                  <p className="rounded-lg bg-muted px-3 py-2 text-muted-foreground">
                    {messages.currentPause}: {adminPauseReasonLabel(currentWork.currentPause.reason, messages)} · {formatAdminDate(currentWork.currentPause.startedAt, locale)}
                  </p>
                ) : null}
              </div>
            ) : <CompactEmpty>{messages.noCurrentWork}</CompactEmpty>}
          </ContextBlock>
        </ContextCard>

        {/* LTR-168: one surface per folded section; no Card inside. */}
        <CollapsibleSection testId="truck-details" title={messages.truckDetailsSection}>
          <div className="p-4">
            <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-1"><Info label={messages.truckNumber} value={data.truck.truckNumber} /><Info label={messages.make} value={data.truck.make ?? messages.noValue} /><Info label={messages.model} value={data.truck.model ?? messages.noValue} /><Info label={messages.year} value={data.truck.year ? String(data.truck.year) : messages.noValue} /><Info label={messages.mileage} value={formatNumber(data.truck.mileage, locale, messages)} /><Info label={messages.company} value={data.truck.company ?? messages.noValue} /><Info label={messages.owner} value={data.truck.owner ?? messages.noValue} /><Info label={messages.vin} value={data.truck.vin ?? messages.noValue} /><Info label={messages.lastReportedLocation} value={data.truck.location ?? messages.noValue} /><Info label={messages.locationUpdatedOn} value={formatAdminDateOnly(data.truck.locationUpdatedOn, locale)} /><Info label={messages.operationalStatus} value={operationalStatusLabel(data.operationalStatus, messages)} /></dl>
          </div>
        </CollapsibleSection>

        <CollapsibleSection testId="truck-history" title={messages.repairHistorySection} description={messages.repairHistorySectionDescription}>
          <section className="p-4" aria-label={messages.repairHistorySection}>{data.repairHistory.items.length ? <ul className="divide-y">{data.repairHistory.items.map((item) => <li key={item.workOrderId} className="flex items-start justify-between gap-3 py-3 first:pt-0"><div className="min-w-0 flex-1"><Link className="tap-inline font-semibold text-primary hover:underline" href={`/admin/work-orders/${item.workOrderId}`}>{item.displayId}</Link><p className="text-sm text-muted-foreground">{item.primaryCategoryName} · {formatAdminDate(item.date, locale)}</p>{item.jobDetails?.length ? <div className="mt-1 flex flex-wrap gap-1">{item.jobDetails.map((job) => <Badge key={`${item.workOrderId}-${job.displayName}`} variant="outline">{job.displayName}</Badge>)}</div> : null}</div><div className="shrink-0 text-right text-xs text-muted-foreground">{item.mileage === null ? messages.noValue : <><span className="block">{messages.mileage}</span><span className="mt-1 block font-medium text-foreground">{formatNumber(item.mileage, locale, messages)}</span></>}</div></li>)}</ul> : <CompactEmpty>{messages.noRepairHistoryForTruck}</CompactEmpty>}
          </section>
        </CollapsibleSection>
      </AdminContextSidebar>
    </div>
  </div>;
}

function operationalStatusLabel(status: TruckOperationalStatus, messages: AdminMessages) {
  if (status === TruckOperationalStatus.IN_SERVICE) return messages.operationalStatusInService;
  if (status === TruckOperationalStatus.OFF_DUTY) return messages.operationalStatusOffDuty;
  return messages.operationalStatusUnknown;
}

function formatNumber(value: number | null, locale: AdminLocale, messages: AdminMessages) {
  return value === null ? messages.noValue : new Intl.NumberFormat(intlLocale(locale)).format(value);
}

function Info({ label, value }: { label: string; value: string }) { return <div className="min-w-0"><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 break-words font-medium">{value}</dd></div>; }
function TruckNotFound({ messages }: { messages: AdminMessages }) { return <EmptyState><p>{messages.notFoundTruck}</p><Button asChild variant="outline" className="mt-4"><Link href="/admin/yard-operations">{messages.backToYardOperations}</Link></Button></EmptyState>; }
