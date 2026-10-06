'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  AppCapability,
  TruckOperationalStatus,
  WorkPlanInspectionOutcome,
  type AdminTruckDetailDto,
  type RecordWorkPlanInspectionInput,
  type TruckWorkPlanDto,
} from '@ltl-shop/shared';
import { useSWRConfig } from 'swr';
import { ArrowUpRight, Copy } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { apiErrorMessage } from '@/lib/api-error-message';
import { intlLocale } from '@/lib/shop-locale';
import { isYardRelatedListKey } from '@/lib/swr-cache-keys';
import { recordAdminWorkPlanInspection, useAdminRepairHistory, useAdminTruck } from '@/lib/admin-data';
import { formatAdminDate, formatAdminDateOnly } from '@/lib/admin-format';
import { formatVehicleYmm } from '@/lib/format';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';
import { fillPlaceholders } from '@/lib/admin-next-step';
import { adminTruckOrigin, type AdminTruckOrigin } from '@/lib/admin-truck-origin';
import { workOrderStatusLabel } from '@/lib/status-chips';
import { truckStatusChip, truckSteps, truckStepStartsOpen, type TruckStep, type TruckStepKey } from '@/lib/truck-stepper';
import { AdminContextSidebar, ContextCard, ContextFacts } from './admin-context-sidebar';
import { AdminOperationalHeader } from './admin-operational-header';
import { AdminTruckWorkPlan } from './admin-truck-work-plan';
import { AdminTruckNextStep } from './admin-truck-next-step';
import { NewWorkOrderDialog } from './new-work-order-dialog';
import { TruckActionsMenu } from './truck-actions-menu';
import { TruckStepper } from './truck-stepper';
import { useActionToast } from './action-toast';
import { useAuth } from '@/lib/auth-context';
import { AdminBackLink, Badge, Button, CompactEmpty, EmptyState, InlineAlert, LoadFailure, PageSkeleton, type BadgeProps } from './ui';

export function AdminTruckDetail({ id, from = null, locale, messages }: { id: string; from?: string | null; locale: AdminLocale; messages: AdminMessages }) {
  const origin = adminTruckOrigin(from, messages);
  const { mutate: mutateRelated } = useSWRConfig();
  const { data, error, isLoading, mutate } = useAdminTruck(id);
  const { user } = useAuth();
  const canManageWorkOrders = !!user?.capabilities.includes(AppCapability.WORK_ORDERS_MANAGE);

  if (isLoading) return <PageSkeleton label={messages.loadingTruck} />;
  if (error instanceof ApiError && error.status === 404) return <TruckNotFound messages={messages} />;
  // T7: the Truck's own load error, not the Yard's.
  if (error || !data) return <LoadFailure message={messages.truckLoadError} retryLabel={messages.retryTruck} onRetry={() => void mutate()} />;

  async function handleWorkPlanUpdated(next: TruckWorkPlanDto) {
    await mutate((current) => (current ? { ...current, workPlan: next } : current), { revalidate: true });
    void mutateRelated(isYardRelatedListKey, undefined, { revalidate: true, populateCache: false });
  }

  return (
    <TruckDetailBody
      data={data}
      origin={origin}
      from={from}
      locale={locale}
      messages={messages}
      canManage={canManageWorkOrders}
      onChanged={async () => {
        await mutate();
        void mutateRelated(isYardRelatedListKey, undefined, { revalidate: true, populateCache: false });
      }}
      onPlanUpdated={handleWorkPlanUpdated}
    />
  );
}

const STATUS_CHIP: Record<ReturnType<typeof truckStatusChip>, BadgeProps['variant']> = {
  ready_to_go: 'success',
  ready_to_close: 'default',
  not_ready: 'warning',
  in_service: 'secondary',
  no_work_order: 'secondary',
};

/**
 * Stage 4 — "Can this Truck leave, and if not, what holds it?" (truck-detail-redesign §4):
 * one status chip, the Work Order chip, Add work and "…"; the steps to leave the shop; the one Next
 * step (acts here, D26); the Work Plan by step with read-only Jobs; and the Truck's data and repair
 * history beside it. Phones: one column, same order.
 */
function TruckDetailBody({
  data,
  origin,
  from,
  locale,
  messages,
  canManage,
  onChanged,
  onPlanUpdated,
}: {
  data: AdminTruckDetailDto;
  origin: AdminTruckOrigin;
  from: string | null;
  locale: AdminLocale;
  messages: AdminMessages;
  canManage: boolean;
  onChanged: () => Promise<unknown> | void;
  onPlanUpdated: (next: TruckWorkPlanDto) => Promise<void> | void;
}) {
  const { showToast } = useActionToast();
  const truckId = data.truck.id;
  const workPlan = data.workPlan;
  const workOrder = workPlan.workOrder;
  const canAddWork = workPlan.capabilities.canAddWork;
  const fromPath = `/admin/trucks/${truckId}${from ? `?from=${encodeURIComponent(from)}` : ''}`;
  // Issues found with no Jobs yet: the Add work panel starts open (D14) — unless the Next step asks for
  // something that comes first (closing, Return to Service, a blocker or a pause): the panel would cover it.
  const [addWorkOpen, setAddWorkOpen] = useState(
    () => workPlan.inspection.outcome === WorkPlanInspectionOutcome.ISSUES_FOUND && workPlan.jobs.length === 0 && canAddWork
      && !['close', 'return_to_service', 'resolve_blocker', 'resume'].includes(data.nextStep?.kind ?? ''),
  );
  const [newWorkOrderOpen, setNewWorkOrderOpen] = useState(false);
  const [inspectionPending, setInspectionPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [stepOverrides, setStepOverrides] = useState<Partial<Record<TruckStepKey, boolean>>>({});
  const steps = useMemo(() => truckSteps(workPlan), [workPlan]);
  // Without a Work Order the inspection is the only step: it stays open.
  const isStepOpen = (step: TruckStep) => stepOverrides[step.key] ?? (steps.length === 1 || truckStepStartsOpen(step));

  // LTR-119 / T5: "Add work in the Work Plan" from a Work Order opens the panel; older links land on the Work Plan.
  useEffect(() => {
    const hash = window.location.hash;
    if (hash === '#add-work' && canAddWork) setAddWorkOpen(true);
    if (hash === '#truck-work-plan-title' || hash === '#add-work') {
      document.getElementById('truck-work-plan-title')?.scrollIntoView({ block: 'start' });
    }
    // Only on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectStep(key: TruckStepKey) {
    setStepOverrides((current) => ({ ...current, [key]: true }));
    window.requestAnimationFrame(() => document.getElementById(`truck-step-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  async function recordInspection(outcome: RecordWorkPlanInspectionInput['outcome']) {
    if (inspectionPending) return;
    setInspectionPending(true);
    setActionError(null);
    try {
      const next = await recordAdminWorkPlanInspection(truckId, outcome);
      await onPlanUpdated(next);
      showToast('success', messages.workPlanInspectionRecorded);
      if (outcome === WorkPlanInspectionOutcome.ISSUES_FOUND && canAddWork) setAddWorkOpen(true);
    } catch (failure) {
      let message: string = messages.workPlanInspectionFailed;
      if (failure instanceof ApiError) {
        if (failure.status === 403) message = messages.workPlanInspectionForbidden;
        else if (failure.status === 409) message = messages.mutationConflict;
        else if (failure.status === 400) message = apiErrorMessage(failure, messages, messages.mutationBadRequest);
      }
      setActionError(message);
      showToast('error', message);
    } finally {
      setInspectionPending(false);
    }
  }

  async function copyText(text: string, done: string) {
    try {
      await navigator.clipboard.writeText(text);
      showToast('success', done);
    } catch {
      showToast('error', messages.copyFailed);
    }
  }

  const chip = truckStatusChip(workPlan, data.operationalStatus);
  const chipLabel = {
    ready_to_go: messages.workPlanReady,
    ready_to_close: messages.readinessReadyToClose,
    not_ready: messages.workPlanNotReady,
    in_service: messages.operationalStatusInService,
    no_work_order: messages.noOpenWorkOrder,
  }[chip];
  const workOrderHref = workOrder ? `/admin/work-orders/${workOrder.id}?from=${encodeURIComponent(fromPath)}` : null;
  const ownerCount = new Set(workPlan.jobs.map((job) => job.assignedMechanic?.id).filter(Boolean)).size;
  // T1: a completed Work Order has nothing left; "0 Jobs left · N mechanics" is not shown for it.
  const counts = workOrder && workOrder.status !== 'completed'
    ? fillPlaceholders(messages.operationalCounts, { jobs: String(workPlan.remainingJobCount), mechanics: String(ownerCount) })
    : null;
  const subtitle = [formatVehicleYmm(data.truck), data.truck.company].filter(Boolean).join(' · ') || messages.noValue;

  return <div className="space-y-5">
    <AdminBackLink href={origin.href}>{origin.backLabel}</AdminBackLink>
    <AdminOperationalHeader
      title={data.truck.truckNumber}
      subtitle={subtitle}
      badges={(
        <>
          <Badge variant={STATUS_CHIP[chip]} data-testid="truck-status-chip">{chipLabel}</Badge>
          {workOrder && workOrderHref ? (
            // UX-5-001: the Work Order chip says what it is ("WO-002 · Completed").
            <Link
              href={workOrderHref}
              data-testid="truck-work-order-chip"
              className="tap-inline inline-flex min-h-6 items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium text-primary hover:bg-accent"
            >
              {fillPlaceholders(messages.truckWorkOrderChip, { workOrder: workOrder.displayId, status: workOrderStatusLabel(workOrder.status, messages) })}
              <ArrowUpRight aria-hidden="true" className="size-3.5" />
            </Link>
          ) : null}
        </>
      )}
      counts={counts}
      actions={(
        <>
          {canAddWork ? (
            <Button type="button" onClick={() => setAddWorkOpen(true)} aria-controls="work-plan-add-work">{messages.workPlanAddWork}</Button>
          ) : null}
          <TruckActionsMenu
            messages={messages}
            workOrder={workOrder && workOrderHref ? { href: workOrderHref, displayId: workOrder.displayId } : null}
            pauseHref={canManage && workOrder?.status === 'in_progress' ? `${workOrderHref}&action=pause` : null}
            onNewWorkOrder={canManage && (!workOrder || workOrder.status === 'completed') ? () => setNewWorkOrderOpen(true) : null}
            onCopyLink={() => void copyText(`${window.location.origin}/admin/trucks/${truckId}`, messages.linkCopied)}
          />
        </>
      )}
      note={(
        <>
          <TruckStepper steps={steps} messages={messages} onSelect={selectStep} />
          {actionError ? (
            <InlineAlert>
              <span>{actionError}</span>
              {actionError === messages.mutationConflict ? (
                <Button type="button" variant="outline" size="sm" className="ml-3" onClick={() => { setActionError(null); void onChanged(); }}>
                  {messages.reloadTruck}
                </Button>
              ) : null}
            </InlineAlert>
          ) : null}
        </>
      )}
      nextStep={(
        /* LTR-158 / D14: the one thing to do next (blocker first). Same rule as the Work Order, Dashboard and Yard. */
        <AdminTruckNextStep
          truck={data}
          locale={locale}
          messages={messages}
          canManage={canManage}
          fromPath={fromPath}
          inspectionPending={inspectionPending}
          onRecordInspection={(outcome) => void recordInspection(outcome)}
          onAddWork={() => setAddWorkOpen(true)}
          onNewWorkOrder={() => setNewWorkOrderOpen(true)}
          onChanged={onChanged}
        />
      )}
    />

    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
      <div className="min-w-0 space-y-5">
        <AdminTruckWorkPlan
          truckId={truckId}
          truckNumber={data.truck.truckNumber}
          fromPath={fromPath}
          plan={workPlan}
          steps={steps}
          isStepOpen={isStepOpen}
          onToggleStep={(key, open) => setStepOverrides((current) => ({ ...current, [key]: open }))}
          messages={messages}
          addWorkOpen={addWorkOpen}
          onAddWorkOpenChange={setAddWorkOpen}
          inspectionPending={inspectionPending}
          inspectionInNextStep={data.nextStep?.kind === 'inspect'}
          onRecordInspection={(outcome) => void recordInspection(outcome)}
          onPlanUpdated={onPlanUpdated}
          onError={setActionError}
        />
      </div>

      <AdminContextSidebar label={messages.contextSidebarLabel}>
        {/* Stage 4: the Truck's data open (Current Work is gone: it is the Work Order chip). One surface, two blocks. */}
        <ContextCard>
          <section className="space-y-3 p-4" data-testid="truck-details" aria-labelledby="truck-details-title">
            <h2 id="truck-details-title" className="group-title">{messages.truckDetailsSection}</h2>
            <ContextFacts
              items={[
                { key: 'mileage', label: messages.mileage, value: formatNumber(data.truck.mileage, locale, messages) },
                { key: 'company', label: messages.company, value: data.truck.company ?? messages.noValue },
                { key: 'owner', label: messages.owner, value: data.truck.owner ?? messages.noValue },
                {
                  key: 'vin',
                  label: messages.vin,
                  value: data.truck.vin ? (
                    <span className="inline-flex items-center gap-1">
                      <span className="break-all font-mono text-[0.8125rem]">{data.truck.vin}</span>
                      <Button type="button" variant="ghost" size="icon" className="size-8 shrink-0" aria-label={messages.copyVin} onClick={() => void copyText(data.truck.vin!, messages.vinCopied)}>
                        <Copy aria-hidden="true" className="size-4" />
                      </Button>
                    </span>
                  ) : messages.noValue,
                },
                { key: 'status', label: messages.operationalStatus, value: operationalStatusLabel(data.operationalStatus, messages) },
                {
                  key: 'location',
                  label: messages.lastReportedLocation,
                  value: data.truck.location ? `${data.truck.location}${data.truck.locationUpdatedOn ? ` · ${formatAdminDateOnly(data.truck.locationUpdatedOn, locale)}` : ''}` : messages.noValue,
                },
              ]}
            />
          </section>
          <RepairHistory truckId={truckId} excludeWorkOrderId={workOrder && workOrder.status !== 'completed' ? workOrder.id : ''} first={data.repairHistory} locale={locale} messages={messages} />
        </ContextCard>
      </AdminContextSidebar>
    </div>

    {canManage ? (
      <NewWorkOrderDialog
        open={newWorkOrderOpen}
        truck={{ id: truckId, truckNumber: data.truck.truckNumber }}
        messages={messages}
        onClose={() => setNewWorkOrderOpen(false)}
        onCreated={onChanged}
      />
    ) : null}
  </div>;
}

/** T10: the repair history pages with "Load more" instead of showing only the first ones. */
function RepairHistory({
  truckId,
  excludeWorkOrderId,
  first,
  locale,
  messages,
}: {
  truckId: string;
  excludeWorkOrderId: string;
  first: AdminTruckDetailDto['repairHistory'];
  locale: AdminLocale;
  messages: AdminMessages;
}) {
  const [more, setMore] = useState(false);
  const pages = useAdminRepairHistory(more ? truckId : '', excludeWorkOrderId);
  const loaded = more && pages.data ? pages.data.flatMap((page) => page.items) : null;
  const items = loaded && loaded.length >= first.items.length ? loaded : first.items;
  const nextCursor = loaded ? pages.data?.[pages.data.length - 1]?.nextCursor ?? null : first.nextCursor;

  function loadMore() {
    if (!more) {
      setMore(true);
      void pages.setSize(2);
      return;
    }
    void pages.setSize(pages.size + 1);
  }

  return (
    <section className="space-y-3 p-4" data-testid="truck-history" aria-labelledby="truck-history-title">
      <div>
        <h2 id="truck-history-title" className="group-title">{messages.repairHistorySection}</h2>
        <p className="text-sm text-muted-foreground">{messages.repairHistorySectionDescription}</p>
      </div>
      {items.length ? (
        <ul className="divide-y">
          {items.map((item) => (
            <li key={item.workOrderId} className="flex items-start justify-between gap-3 py-3 first:pt-0">
              <div className="min-w-0 flex-1">
                <Link className="tap-inline font-semibold text-primary hover:underline" href={`/admin/work-orders/${item.workOrderId}`}>{item.displayId}</Link>
                <p className="text-sm text-muted-foreground">{item.primaryCategoryName} · {formatAdminDate(item.date, locale)}</p>
                {item.jobDetails?.length ? <p className="mt-1 text-xs text-muted-foreground">{item.jobDetails.map((job) => job.displayName).join(' · ')}</p> : null}
              </div>
              {item.mileage === null ? null : (
                <div className="shrink-0 text-right text-xs text-muted-foreground">
                  <span className="block">{messages.mileage}</span>
                  <span className="mt-1 block font-medium text-foreground">{formatNumber(item.mileage, locale, messages)}</span>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : <CompactEmpty>{messages.noRepairHistoryForTruck}</CompactEmpty>}
      {nextCursor ? (
        <Button type="button" variant="outline" size="sm" className="w-full" disabled={pages.isValidating && more} onClick={loadMore}>
          {messages.loadMoreRepairs}
        </Button>
      ) : null}
    </section>
  );
}

function operationalStatusLabel(status: TruckOperationalStatus, messages: AdminMessages) {
  if (status === TruckOperationalStatus.IN_SERVICE) return messages.operationalStatusInService;
  if (status === TruckOperationalStatus.OFF_DUTY) return messages.operationalStatusOffDuty;
  return messages.operationalStatusUnknown;
}

function formatNumber(value: number | null, locale: AdminLocale, messages: AdminMessages) {
  return value === null ? messages.noValue : new Intl.NumberFormat(intlLocale(locale)).format(value);
}

function TruckNotFound({ messages }: { messages: AdminMessages }) { return <EmptyState><p>{messages.notFoundTruck}</p><Button asChild variant="outline" className="mt-4"><Link href="/admin/yard-operations">{messages.backToYardOperations}</Link></Button></EmptyState>; }
