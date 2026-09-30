'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import {
  AppCapability,
  TruckOperationalStatus,
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
import { adminTruckOrigin } from '@/lib/admin-truck-origin';
import { mechanicNamesLabel, openCurrentWork } from '@/lib/admin-work-summary';
import { adminPriorityLabel, workOrderStatusLabel } from '@/lib/status-chips';
import { AdminTruckWorkPlan } from './admin-truck-work-plan';
import { AdminTruckNextStep } from './admin-truck-next-step';
import { useAuth } from '@/lib/auth-context';
import { AdminBackLink, PageHeader, Badge, Button, Card, CardContent, CardHeader, CardTitle, CollapsibleSection, CompactEmpty, EmptyState, LoadFailure, PageSkeleton, PriorityBadge, WorkOrderStatusBadge } from './ui';

export function AdminTruckDetail({ id, from = null, locale, messages }: { id: string; from?: string | null; locale: AdminLocale; messages: AdminMessages }) {
  const origin = adminTruckOrigin(from, messages);
  const { mutate: mutateRelated } = useSWRConfig();
  const { data, error, isLoading, mutate } = useAdminTruck(id);
  const { user } = useAuth();
  const canManageWorkOrders = !!user?.capabilities.includes(AppCapability.WORK_ORDERS_MANAGE);
  const workPlanLoaded = Boolean(data?.workPlan);

  // LTR-119: "Add work in the Work Plan" from a Work Order lands on the Work Plan once it has loaded.
  useEffect(() => {
    if (!workPlanLoaded || window.location.hash !== '#truck-work-plan-title') return;
    document.getElementById('truck-work-plan-title')?.scrollIntoView({ block: 'start' });
  }, [workPlanLoaded]);

  if (isLoading) return <PageSkeleton label={messages.loadingTruck} />;
  if (error instanceof ApiError && error.status === 404) return <TruckNotFound messages={messages} />;
  if (error || !data) return <LoadFailure message={messages.yardLoadError} retryLabel={messages.retryTruck} onRetry={() => void mutate()} />;

  const truckId = data.truck.id;
  const workPlan = data.workPlan;
  const currentWork = openCurrentWork(data.activeWorkOrder);

  async function handleWorkPlanUpdated(next: TruckWorkPlanDto) {
    await mutate((current) => (current ? { ...current, workPlan: next } : current), { revalidate: true });
    void mutateRelated(isYardRelatedListKey, undefined, { revalidate: true, populateCache: false });
  }

  return <div className="space-y-6">
    <AdminBackLink href={origin.href}>{origin.backLabel}</AdminBackLink>
    <PageHeader
      title={data.truck.truckNumber}
      subtitle={formatVehicleYmm(data.truck) || messages.noValue}
      badges={(
        // LTR-51 (#14): a truck back in service with no Work Order is not "Not Ready".
        workPlan.readiness !== 'ready' && !workPlan.workOrder && data.operationalStatus === TruckOperationalStatus.IN_SERVICE ? (
          <Badge variant="secondary">{messages.operationalStatusInService}</Badge>
        ) : (
          <Badge variant={workPlan.readiness === 'ready' ? 'success' : 'warning'}>
            {workPlan.readiness === 'ready' ? messages.workPlanReady : messages.workPlanNotReady}
          </Badge>
        )
      )}
    />

    {/* LTR-158 / D14: the one thing to do next, then inspection and the Work Plan; truck data folded below. */}
    <AdminTruckNextStep truck={data} locale={locale} messages={messages} canManage={canManageWorkOrders} onChanged={() => mutate()} />

    <AdminTruckWorkPlan
      truckId={truckId}
      plan={workPlan}
      messages={messages}
      onPlanUpdated={handleWorkPlanUpdated}
    />

      <Card><CardHeader><CardTitle>{messages.currentWork}</CardTitle></CardHeader><CardContent>{currentWork ? <div className="space-y-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><Link className="tap-inline font-semibold text-primary hover:underline" href={`/admin/work-orders/${currentWork.id}`}>{currentWork.displayId}</Link><div className="flex gap-2"><WorkOrderStatusBadge status={currentWork.status}>{workOrderStatusLabel(currentWork.status, messages)}</WorkOrderStatusBadge><PriorityBadge priority={currentWork.priority}>{adminPriorityLabel(currentWork.priority, messages)}</PriorityBadge></div></div><Info label={messages.mechanicsLabel} value={mechanicNamesLabel(currentWork.mechanics, messages)} />{currentWork.currentPause ? <p className="rounded-lg bg-muted px-3 py-2 text-muted-foreground">{messages.currentPause}: {adminPauseReasonLabel(currentWork.currentPause.reason, messages)} · {formatAdminDate(currentWork.currentPause.startedAt, locale)}</p> : null}</div> : <CompactEmpty>{messages.noCurrentWork}</CompactEmpty>}</CardContent></Card>

    {/* LTR-168: one surface per folded section; no Card inside. */}
    <CollapsibleSection testId="truck-details" title={messages.truckDetailsSection}>
      <div className="p-4">
      <dl className="grid gap-4 text-sm sm:grid-cols-2"><Info label={messages.truckNumber} value={data.truck.truckNumber} /><Info label={messages.make} value={data.truck.make ?? messages.noValue} /><Info label={messages.model} value={data.truck.model ?? messages.noValue} /><Info label={messages.year} value={data.truck.year ? String(data.truck.year) : messages.noValue} /><Info label={messages.mileage} value={formatNumber(data.truck.mileage, locale, messages)} /><Info label={messages.company} value={data.truck.company ?? messages.noValue} /><Info label={messages.owner} value={data.truck.owner ?? messages.noValue} /><Info label={messages.vin} value={data.truck.vin ?? messages.noValue} /><Info label={messages.lastReportedLocation} value={data.truck.location ?? messages.noValue} /><Info label={messages.locationUpdatedOn} value={formatAdminDateOnly(data.truck.locationUpdatedOn, locale)} /><Info label={messages.operationalStatus} value={operationalStatusLabel(data.operationalStatus, messages)} /></dl>
      </div>
    </CollapsibleSection>

    <CollapsibleSection testId="truck-history" title={messages.repairHistorySection} description={messages.repairHistorySectionDescription}>
      <section className="p-4" aria-label={messages.repairHistorySection}>{data.repairHistory.items.length ? <ul className="divide-y">{data.repairHistory.items.map((item) => <li key={item.workOrderId} className="flex items-start justify-between gap-3 py-3 first:pt-0"><div className="min-w-0 flex-1"><Link className="tap-inline font-semibold text-primary hover:underline" href={`/admin/work-orders/${item.workOrderId}`}>{item.displayId}</Link><p className="text-sm text-muted-foreground">{item.primaryCategoryName} · {formatAdminDate(item.date, locale)}</p>{item.jobDetails?.length ? <div className="mt-1 flex flex-wrap gap-1">{item.jobDetails.map((job) => <Badge key={`${item.workOrderId}-${job.displayName}`} variant="outline">{job.displayName}</Badge>)}</div> : null}</div><div className="shrink-0 text-right text-xs text-muted-foreground">{item.mileage === null ? messages.noValue : <><span className="block">{messages.mileage}</span><span className="mt-1 block font-medium text-foreground">{formatNumber(item.mileage, locale, messages)}</span></>}</div></li>)}</ul> : <CompactEmpty>{messages.noRepairHistoryForTruck}</CompactEmpty>}
      </section>
    </CollapsibleSection>
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
