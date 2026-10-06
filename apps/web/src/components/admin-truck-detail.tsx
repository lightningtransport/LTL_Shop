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
import { ArrowUpRight, CircleAlert, ClipboardList, Copy, Eye, FileClock, FilePlus, Link2, MapPin, MoreHorizontal, Pause, Plus } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { apiErrorMessage } from '@/lib/api-error-message';
import { intlLocale } from '@/lib/shop-locale';
import { isYardRelatedListKey } from '@/lib/swr-cache-keys';
import { recordAdminWorkPlanInspection, useAdminRepairHistory, useAdminTruck } from '@/lib/admin-data';
import { formatAdminDateOnly } from '@/lib/admin-format';
import { formatDay } from '@/lib/work-order-view';
import { useCategories } from '@/lib/shop-data';
import { formatVehicleYmm } from '@/lib/format';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';
import { fillPlaceholders } from '@/lib/admin-next-step';
import { adminTruckOrigin, type AdminTruckOrigin } from '@/lib/admin-truck-origin';
import { useAdminBreadcrumb } from './admin-breadcrumb';
import { MechanicAvatarStack } from './mechanic-avatar';
import { ResponsiveMenu, type MenuItem } from './responsive-menu';
import { adminPriorityLabel, workOrderStatusLabel } from '@/lib/status-chips';
import { truckStatusChip, truckSteps, truckStepStartsOpen, type TruckStep, type TruckStepKey } from '@/lib/truck-stepper';
import { AdminTruckWorkPlan } from './admin-truck-work-plan';
import { AdminTruckNextStep } from './admin-truck-next-step';
import { NewWorkOrderDialog } from './new-work-order-dialog';
import { TruckStepper, truckStepLabel } from './truck-stepper';
import { useActionToast } from './action-toast';
import { useAuth } from '@/lib/auth-context';
import { Badge, Button, CardListSkeleton, EmptyState, LoadFailure, PageSkeleton, SectionCard, Select, type BadgeProps } from './ui';

export function AdminTruckDetail({ id, from = null, locale, messages }: { id: string; from?: string | null; locale: AdminLocale; messages: AdminMessages }) {
  const origin = adminTruckOrigin(from, messages);
  const { mutate: mutateRelated } = useSWRConfig();
  const { data, error, isLoading, mutate } = useAdminTruck(id);
  const { user } = useAuth();
  const canManageWorkOrders = !!user?.capabilities.includes(AppCapability.WORK_ORDERS_MANAGE);
  // Stage 8 (F6, mockup): "Trucks › 601", or where the Truck was opened from (Yard, Dashboard…).
  useAdminBreadcrumb(data ? [{ label: originCrumb(origin.href, messages), href: origin.href }, { label: data.truck.truckNumber }] : null);

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
  ready_to_close: 'warning',
  not_ready: 'warning',
  in_service: 'success',
  no_work_order: 'outline',
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
  // Stage 8 (mockup): "Not Ready · PM" names the step that holds the Truck.
  const current = steps.find((step) => step.state !== 'done' && step.state !== 'not_applicable');
  const chipLabel = {
    ready_to_go: messages.workPlanReady,
    ready_to_close: messages.readinessReadyToClose,
    not_ready: current && current.key !== 'close' ? fillPlaceholders(messages.truckNotReadyStep, { step: truckStepLabel(current.key, messages) }) : messages.workPlanNotReady,
    in_service: messages.operationalStatusInService,
    no_work_order: messages.noOpenWorkOrder,
  }[chip];
  const workOrderHref = workOrder ? `/admin/work-orders/${workOrder.id}?from=${encodeURIComponent(fromPath)}` : null;
  const owners = uniqueOwners(workPlan.jobs);
  const left = workPlan.remainingJobCount;
  const vehicle = formatVehicleYmm(data.truck);
  const subtitle = [vehicle, data.truck.company].filter(Boolean).join(' · ') || messages.noValue;
  const menuItems: MenuItem[] = [];
  if (workOrder && workOrderHref) menuItems.push({ key: 'open', label: fillPlaceholders(messages.truckMenuOpenWorkOrder, { workOrder: workOrder.displayId }), icon: ClipboardList, href: workOrderHref });
  if (canManage && workOrder?.status === 'in_progress' && workOrderHref) menuItems.push({ key: 'pause', label: messages.truckMenuPause, icon: Pause, href: `${workOrderHref}&action=pause` });
  if (canManage && (!workOrder || workOrder.status === 'completed')) menuItems.push({ key: 'new', label: messages.truckNextStepCreateAction, icon: FilePlus, onSelect: () => setNewWorkOrderOpen(true) });
  menuItems.push({ key: 'copy', label: messages.copyLink, icon: Link2, separatorBefore: menuItems.length > 0, onSelect: () => void copyText(`${window.location.origin}/admin/trucks/${truckId}`, messages.linkCopied) });

  return <div className="space-y-5">
    {/* Stage 8 (mockup): "Truck 601" with one status chip, the vehicle and the Work Order chip; Add work and "…". */}
    <section className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="page-title">{fillPlaceholders(messages.woTitle, { truck: data.truck.truckNumber })}</h1>
            <Badge dot variant={STATUS_CHIP[chip]} data-testid="truck-status-chip">{chipLabel}</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-muted-foreground">
            <span>{subtitle}</span>
            {workOrder && workOrderHref ? (
              // UX-5-001: the Work Order chip says what it is ("WO-002 · Completed").
              <Link
                href={workOrderHref}
                data-testid="truck-work-order-chip"
                className="inline-flex h-8 items-center gap-2 rounded-md border bg-card px-2.5 text-foreground hover:bg-accent"
              >
                <ClipboardList aria-hidden="true" className="size-3.5 text-muted-foreground" />
                <span className="font-mono text-[13px]">{workOrder.displayId}</span>
                <span className={WO_TONE[workOrder.status] ?? 'text-muted-foreground'}>· {workOrderStatusLabel(workOrder.status, messages)}</span>
                {workOrder.priority && workOrder.priority !== 'normal' ? <span className="text-muted-foreground">· {adminPriorityLabel(workOrder.priority, messages)}</span> : null}
                <ArrowUpRight aria-hidden="true" className="size-3.5 text-muted-foreground" />
              </Link>
            ) : null}
          </div>
          {!canManage ? <p className="flex items-center gap-1.5 text-muted-foreground"><Eye aria-hidden="true" className="size-3.5" />{messages.truckViewOnly}</p> : null}
        </div>
        {canAddWork || canManage ? (
          <div className="flex items-center gap-2 sm:shrink-0">
            {canAddWork ? (
              <Button type="button" className="flex-1 sm:flex-none" onClick={() => setAddWorkOpen(true)} aria-controls="work-plan-add-work" aria-haspopup="dialog">
                <Plus aria-hidden="true" />{messages.workPlanAddWork}
              </Button>
            ) : null}
            {canManage ? (
              <ResponsiveMenu
                label={fillPlaceholders(messages.woTitle, { truck: data.truck.truckNumber })}
                items={menuItems}
                contentTestId="truck-actions-menu"
                trigger={(
                  <Button type="button" variant="outline" size="icon" aria-label={messages.moreActions}>
                    <MoreHorizontal aria-hidden="true" />
                  </Button>
                )}
              />
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <TruckStepper steps={steps} messages={messages} onSelect={selectStep} />
          {workOrder ? (
            workOrder.status !== 'completed' ? (
              // T1: a completed Work Order has nothing left; no "0 jobs left".
              <div className="flex shrink-0 items-center justify-between gap-3 text-muted-foreground sm:justify-start" data-testid="operational-counts">
                <span className="tnum"><b className="font-semibold text-foreground">{left}</b> {left === 1 ? messages.truckJobsLeftOne : messages.truckJobsLeftMany}</span>
                <span aria-hidden="true" className="h-4 w-px bg-border" />
                <span className="flex items-center gap-2">
                  <MechanicAvatarStack mechanics={owners} max={3} />
                  {owners.length === 1 ? messages.truckMechanicsOne : fillPlaceholders(messages.truckMechanicsMany, { count: String(owners.length) })}
                </span>
              </div>
            ) : null
          ) : <p className="text-muted-foreground">{messages.truckPlanStarts}</p>}
        </div>
      </div>
    </section>

    {actionError ? (
      <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-destructive/40 bg-destructive/15 px-4 py-3 text-destructive-text">
        <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <p className="flex-1">{actionError}</p>
        <button type="button" className="font-medium underline-offset-2 hover:underline" onClick={() => { setActionError(null); void onChanged(); }}>
          {messages.reloadTruck}
        </button>
      </div>
    ) : null}

    {/* LTR-158 / D14: the one thing to do next (blocker first). Same rule as the Work Order, Dashboard and Yard. */}
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

    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-5">
        <AdminTruckWorkPlan
          truckId={truckId}
          truckNumber={data.truck.truckNumber}
          fromPath={fromPath}
          plan={workPlan}
          steps={steps}
          isStepOpen={isStepOpen}
          onToggleStep={(key, open) => setStepOverrides((state) => ({ ...state, [key]: open }))}
          locale={locale}
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

      <aside className="min-w-0 space-y-5" aria-label={messages.contextSidebarLabel}>
        <SectionCard title={messages.truck} data-testid="truck-details">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 p-4">
            <dt className="text-muted-foreground">{messages.vehicleLabel}</dt><dd className="text-right font-medium">{vehicle || messages.noValue}</dd>
            <dt className="text-muted-foreground">{messages.mileage}</dt>
            <dd className="tnum text-right font-medium">{data.truck.mileage === null ? messages.noValue : fillPlaceholders(messages.mileageMi, { value: formatNumber(data.truck.mileage, locale, messages) })}</dd>
            <dt className="text-muted-foreground">{messages.vin}</dt>
            <dd className="flex min-w-0 items-center justify-end gap-1.5 font-mono text-[13px]">
              <span className="break-all">{data.truck.vin ?? messages.noValue}</span>
              {data.truck.vin ? (
                <button type="button" className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground" aria-label={messages.copyVin} onClick={() => void copyText(data.truck.vin!, messages.vinCopied)}>
                  <Copy aria-hidden="true" className="size-3.5" />
                </button>
              ) : null}
            </dd>
            <dt className="text-muted-foreground">{messages.company}</dt>
            <dd className="text-right font-medium">
              {data.truck.company ?? messages.noValue}
              {data.truck.owner ? <span className="block text-xs font-normal text-muted-foreground">{fillPlaceholders(messages.ownerLine, { owner: data.truck.owner })}</span> : null}
            </dd>
            <dt className="text-muted-foreground">{messages.operationalShort}</dt>
            <dd className={`text-right font-medium ${data.operationalStatus === TruckOperationalStatus.IN_SERVICE ? 'text-success' : 'text-muted-foreground'}`}>{operationalStatusLabel(data.operationalStatus, messages)}</dd>
          </dl>
          <div className="flex items-start gap-2.5 border-t px-4 py-3 text-muted-foreground">
            <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <p>
              <span className="sr-only">{messages.lastReportedLocation}: </span>
              <span className="text-foreground">{data.truck.location ?? messages.noValue}</span>
              {data.truck.location && data.truck.locationUpdatedOn ? <><br /><span className="text-xs">{fillPlaceholders(messages.reportedOn, { date: formatAdminDateOnly(data.truck.locationUpdatedOn, locale) })}</span></> : null}
            </p>
          </div>
        </SectionCard>
        <RepairHistory truckId={truckId} excludeWorkOrderId={workOrder && workOrder.status !== 'completed' ? workOrder.id : ''} first={data.repairHistory} locale={locale} messages={messages} />
      </aside>
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

const WO_TONE: Record<string, string> = {
  created: 'text-muted-foreground',
  in_progress: 'text-primary',
  waiting_paused: 'text-warning-foreground dark:text-warning',
  completed: 'text-success',
  cancelled: 'text-muted-foreground',
};

/** The owners of the Work Plan's live Jobs, once each (the avatars). */
function uniqueOwners(jobs: TruckWorkPlanDto['jobs']) {
  const seen = new Map<string, { id: string; name: string }>();
  for (const job of jobs) {
    if (job.status !== 'cancelled' && job.assignedMechanic && !seen.has(job.assignedMechanic.id)) seen.set(job.assignedMechanic.id, job.assignedMechanic);
  }
  return [...seen.values()];
}

/** T10 / Stage 8 (mockup): the repair history card — filter by category in its header, "Load more". */
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
  const [category, setCategory] = useState('');
  const { data: categoryData } = useCategories(true);
  const live = more || Boolean(category);
  const pages = useAdminRepairHistory(live ? truckId : '', excludeWorkOrderId, category || undefined);
  const loaded = live && pages.data ? pages.data.flatMap((page) => page.items) : null;
  const items = category ? loaded ?? [] : loaded && loaded.length >= first.items.length ? loaded : first.items;
  const nextCursor = loaded ? pages.data?.[pages.data.length - 1]?.nextCursor ?? null : category ? null : first.nextCursor;
  const number = new Intl.NumberFormat(intlLocale(locale));

  function loadMore() {
    if (!live) {
      setMore(true);
      void pages.setSize(2);
      return;
    }
    void pages.setSize(pages.size + 1);
  }

  return (
    <SectionCard
      data-testid="truck-history"
      titleId="truck-history-title"
      title={<span className="flex flex-col"><span>{messages.repairHistorySection}</span><span className="hidden text-xs font-normal text-muted-foreground sm:block">{messages.repairHistorySectionDescription}</span></span>}
      action={(
        <div className="w-40 shrink-0">
          <Select aria-label={messages.filterByCategory} className="h-10 pl-2.5 text-sm text-muted-foreground sm:h-9" value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">{messages.repairAll}</option>
            {(categoryData ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </Select>
        </div>
      )}
    >
      {live && pages.isLoading && !loaded ? (
        <div className="p-4"><CardListSkeleton count={2} /></div>
      ) : items.length ? (
        <ul className="divide-y">
          {items.map((item) => {
            const jobs = item.jobDetails?.length ? item.jobDetails.map((job) => job.displayName) : item.jobs ?? [];
            return (
              <li key={item.workOrderId} className="space-y-1 px-4 py-3">
                <div className="flex items-baseline justify-between gap-2">
                  <Link className="font-mono text-[13px] font-medium text-primary hover:underline" href={`/admin/work-orders/${item.workOrderId}`}>{item.displayId}</Link>
                  {item.mileage === null ? null : <span className="tnum text-xs text-muted-foreground">{fillPlaceholders(messages.mileageMi, { value: number.format(item.mileage) })}</span>}
                </div>
                <p className="text-muted-foreground">{item.primaryCategoryName} · {formatDay(item.date, locale)}{item.mechanicNames.length ? ` · ${item.mechanicNames.join(', ')}` : ''}</p>
                {jobs.length ? (
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {jobs.map((job) => <span key={`${item.workOrderId}-${job}`} className="rounded-md border px-1.5 py-px text-xs text-muted-foreground">{job}</span>)}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="flex flex-col items-center gap-1 px-4 py-6 text-center text-muted-foreground">
          <FileClock aria-hidden="true" className="size-5" />
          <p>{messages.noRepairHistoryForTruck}</p>
        </div>
      )}
      {nextCursor ? (
        <div className="border-t p-2">
          <Button type="button" variant="ghost" className="w-full" disabled={pages.isValidating && live} onClick={loadMore}>
            {messages.loadMoreRepairs}
          </Button>
        </div>
      ) : null}
    </SectionCard>
  );
}

/** The breadcrumb's parent: the screen the Truck was opened from. */
function originCrumb(href: string, messages: AdminMessages) {
  const path = href.split(/[?#]/)[0];
  if (path === '/admin/trucks') return messages.trucks;
  if (path === '/admin/work-orders') return messages.workOrders;
  if (path.startsWith('/admin/work-orders/')) return messages.workOrder;
  if (path === '/admin') return messages.dashboard;
  return messages.yardOperations;
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
