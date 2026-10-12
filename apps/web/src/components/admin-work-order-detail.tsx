'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSWRConfig } from 'swr';
import { ArrowUpRight, Check, CheckCheck, CircleAlert, CircleCheck, CircleX, Clock, Copy, Eye, FileClock, Lock, MapPin, MoreHorizontal, Pause, Play, Plus, RotateCcw, RotateCw, Truck as TruckIcon } from 'lucide-react';
import { AppCapability, OPEN_WORK_ORDER_STATUSES, PauseReason, Priority, WorkOrderNoteKind, formatCents } from '@ltl-shop/shared';
import { adminTruckCostsHref, adminTruckHref } from '@/lib/admin-truck-origin';
import { useAdminBreadcrumb } from './admin-breadcrumb';
import { ApiError } from '@/lib/api';
import { intlLocale } from '@/lib/shop-locale';
import { formatAdminDateOnly, formatDuration } from '@/lib/admin-format';
import { formatDay, formatShortDateTime } from '@/lib/work-order-view';
import { formatVehicleYmm } from '@/lib/format';
import { laborByMechanic } from '@/lib/labor-by-mechanic';
import { adminPriorityLabel, workOrderStatusLabel } from '@/lib/status-chips';
import { addAdminHelperJob, returnAdminJobExternal, sendAdminJobExternal, changeAdminPmService, addAdminWorkOrderNote, handleAdminWorkRequest, assignAdminWorkOrderJob, cancelAdminJob, cancelAdminWorkOrder, completeAdminJob, correctAdminTime, patchAdminWorkOrder, pauseAdminWorkOrder, reopenAdminJob, reopenAdminWorkOrder, resumeAdminWorkOrder, returnAdminWorkOrderToService, unassignAdminWorkOrderJob, useAdminAssignableMechanics, useAdminRepairHistory, useAdminWorkOrder } from '@/lib/admin-data';
import { adminPauseReasonLabel, type AdminLocale, type AdminMessages } from '@/lib/admin-messages';
import { AdminJobTable } from './admin-job-table';
import { timeSegments, WorkOrderHistory, type HistoryTab, type TimeSegment } from './work-order-history';
import { apiErrorCode } from '@/lib/api-error-message';
import { MechanicAvatar } from './mechanic-avatar';
import { ResponsiveMenu, type MenuItem } from './responsive-menu';
import { WorkOrderMetrics } from './work-order-metrics';
import { WorkOrderNextStep } from './work-order-next-step';
import { CloseWorkOrderDialog } from './close-work-order-dialog';
import { pauseResumeError } from './pause-resume-error';
import { canOfficiallyPauseWorkOrder } from '@/lib/work-order-pause';
import { isAdminWorkOrderReadyToClose } from '@/lib/admin-work-order-close';
import { fillPlaceholders } from '@/lib/admin-next-step';
import { useAuth } from '@/lib/auth-context';
import { isWorkOrderRelatedListKey } from '@/lib/swr-cache-keys';
import { useCategories } from '@/lib/shop-data';
import { useActionToast } from './action-toast';
import {
  Button,
  CardListSkeleton,
  DialogActions,
  EmptyState,
  LoadFailure,
  Modal,
  PageSkeleton,
  PriorityBadge,
  SectionCard,
  WorkOrderStatusBadge,
  Select,
  Textarea,
} from './ui';

type WorkOrderDialog = 'pause' | 'cancel' | 'reopen' | 'return' | null;

/**
 * LTR-174: "What work are we executing, who, what remains, what's next?" — operational header (Truck,
 * WO id, badges, counts, Next step, Pause / Resume and "…"), Confirm completion when the Work Order can
 * close, then the Jobs table, blockers and notes beside a context column (Truck, times, mechanics,
 * priority; summary, Truck details and repair history folded). History and audit stays at the bottom.
 */
export function AdminWorkOrderDetail({
  id,
  from = null,
  action = null,
  locale,
  messages,
}: {
  id: string;
  /** Stage 4 (T4): where the Work Order was opened from (its Truck), for the back link. */
  from?: string | null;
  /** Stage 4: `pause` opens the pause dialog ("Pause Work Order…" in the Truck's "…"). */
  action?: string | null;
  locale: AdminLocale;
  messages: AdminMessages;
}) {
  const { user } = useAuth();
  const { showToast } = useActionToast();
  const { mutate: mutateRelated } = useSWRConfig();
  const { data, error, isLoading, mutate } = useAdminWorkOrder(id);
  const canManageWorkOrders = !!user?.capabilities.includes(AppCapability.WORK_ORDERS_MANAGE);
  const [historyCategory, setHistoryCategory] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [reopenReason, setReopenReason] = useState('');
  const [returnReason, setReturnReason] = useState('');
  const [jobReason, setJobReason] = useState('');
  // LTR-189 (W1): cancel / reopen a Job from a dialog that asks the reason there, not from a red button on every row.
  const [jobDialog, setJobDialog] = useState<{ kind: 'cancel' | 'reopen'; jobId: string } | null>(null);
  const [jobDialogError, setJobDialogError] = useState<string | null>(null);
  // LTR-174: Pause, "…" (Cancel / Reopen / Return to Service) and their forms open as dialogs from the header.
  const [dialog, setDialog] = useState<WorkOrderDialog>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  // Owner decision (2026-10-05): "Confirm completion" confirms in a dialog (card and sticky bar).
  const [closeOpen, setCloseOpen] = useState(false);
  // LTR-168: no preselected reason, so pausing is a choice and never a single accidental tap.
  const [pauseReason, setPauseReason] = useState<PauseReason | ''>('');
  const [draftPriority, setDraftPriority] = useState<Priority>(Priority.NORMAL);
  const [draftNotes, setDraftNotes] = useState('');
  // Stage 5 (R4): History and audit as tabs; "Correct time…" in the "…" opens it on Times.
  const [historyTab, setHistoryTab] = useState<HistoryTab>('activity');
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  // Stage 8: "Returned" in the Next step opens the Job table's dialog for that Job.
  const [returnRequest, setReturnRequest] = useState<string | null>(null);
  const clearReturnRequest = useCallback(() => setReturnRequest(null), []);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const { data: categoryData } = useCategories(true);
  const historyQuery = useAdminRepairHistory(data?.truck.id ?? '', id, historyCategory || undefined);
  const { data: mechanicPages } = useAdminAssignableMechanics();
  // LTR-146: the PM job is assigned to a PM mechanic.
  const pmMechanics = useMemo(
    () => (mechanicPages?.flatMap((page) => page.items) ?? []).filter((mechanic) => mechanic.active && mechanic.capabilities.includes(AppCapability.MECHANIC_PM)),
    [mechanicPages],
  );
  const assignableMechanics = useMemo(
    () => (mechanicPages?.flatMap((page) => page.items) ?? []).filter((mechanic) => mechanic.active && mechanic.capabilities.includes(AppCapability.MECHANIC_STANDARD)),
    [mechanicPages],
  );

  useEffect(() => {
    if (!data) return;
    setDraftPriority(data.priority);
  }, [data]);

  // LTR-168: the fixed "Confirm completion" bar shows only while the inline card is off screen, so the action
  // is never on screen twice.
  const [completeCardElement, setCompleteCardElement] = useState<HTMLDivElement | null>(null);
  const [completeCardInView, setCompleteCardInView] = useState(true);
  useEffect(() => {
    if (!completeCardElement) {
      setCompleteCardInView(false);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => setCompleteCardInView(entry.isIntersecting));
    observer.observe(completeCardElement);
    return () => observer.disconnect();
  }, [completeCardElement]);

  // Stage 4: arriving from the Truck — "Pause Work Order…" opens the pause dialog; "Manage in Work
  // Order" (#job-<id>) brings the Job's row into view, highlighted.
  const arrivalHandled = useRef(false);
  const [highlightedJobId, setHighlightedJobId] = useState<string | null>(null);
  useEffect(() => {
    if (!data || !user || arrivalHandled.current) return;
    arrivalHandled.current = true;
    if (action === 'pause' && canManageWorkOrders && canOfficiallyPauseWorkOrder(data.status) && data.category.name !== 'PM') setDialog('pause');
    const hash = window.location.hash;
    if (hash.startsWith('#job-')) setHighlightedJobId(hash.slice('#job-'.length));
  }, [data, user, action, canManageWorkOrders]);

  // Stage 8 (F6, mockup): "Work Orders › WO-010", or "Trucks › 601 › WO-010" when opened from the Truck.
  const fromTruck = Boolean(data && from?.startsWith('/admin/trucks/'));
  useAdminBreadcrumb(data ? [
    ...(fromTruck ? [{ label: messages.trucks, href: '/admin/trucks' }, { label: data.truck.truckNumber, href: from! }] : [{ label: messages.workOrders, href: '/admin/work-orders' }]),
    { label: data.displayId },
  ] : null);

  if (isLoading) return <PageSkeleton label={messages.workOrdersTitle} />;
  if (error instanceof ApiError && error.status === 404) return <NotFound messages={messages} />;
  if (error || !data) return <LoadFailure message={messages.loadError} retryLabel={messages.retry} onRetry={() => void mutate()} />;

  const historyItems = historyQuery.data?.flatMap((page) => page.items) ?? [];
  const historyHasMore = Boolean(historyQuery.data?.[historyQuery.data.length - 1]?.nextCursor);
  const values = categoryData ?? [data.category, ...data.jobs.map((job) => job.category)];
  const categories = values.filter((category, index) => values.findIndex((candidate) => candidate.id === category.id) === index);
  const truck = data.truck;
  const truckHref = adminTruckHref(truck.id, `/admin/work-orders/${data.id}`);
  const isOpen = (OPEN_WORK_ORDER_STATUSES as string[]).includes(data.status);
  const isPmWorkOrder = data.category.name === 'PM';
  const canCancelWorkOrder = canManageWorkOrders && isOpen;
  const canReopenWorkOrder = data.status === 'completed' || data.status === 'cancelled';
  const canReturnToService = data.status === 'completed' && !data.returnedToServiceAt;
  const canManageJobs = canManageWorkOrders && isOpen && !isPmWorkOrder;
  const canReopenJob = isOpen && !isPmWorkOrder;
  const canEditFields = canManageWorkOrders && isOpen;
  const canEditPriority = canEditFields && !isPmWorkOrder;
  const canOfficialPause = canManageWorkOrders && isOpen && !isPmWorkOrder;
  const pauseEnabled = canOfficiallyPauseWorkOrder(data.status);
  const isPaused = data.status === 'waiting_paused';
  const canCorrectTime = canManageWorkOrders && timeSegments(data).some((segment) => segment.endedAt);
  const readyToClose = isAdminWorkOrderReadyToClose({
    canManageWorkOrders,
    status: data.status,
    categoryName: data.category.name,
    jobs: data.jobs,
  });
  const blockers = data.reportedBlockers ?? [];
  // Stage 5 (R2) / Stage 8: an active blocker is the Next step (callout); its Job row is tinted.
  const activeBlockers = blockers.filter((blocker) => !blocker.resolvedAt);
  const blockedJobIds = activeBlockers.flatMap((blocker) => (blocker.job ? [blocker.job.id] : []));
  const labor = laborByMechanic(data);

  async function runMutation(action: string, successMessage: string, operation: () => Promise<unknown>, onError: (failure: unknown) => string) {
    if (pendingAction) return;
    setPendingAction(action);
    setFeedback(null);
    try {
      await operation();
      await mutate();
      void mutateRelated(isWorkOrderRelatedListKey, undefined, { revalidate: true, populateCache: false });
      // LTR-168: success is the toast only (the status badge shows the result); errors also stay inline.
      showToast('success', successMessage);
    } catch (failure) {
      const message = onError(failure);
      setFeedback({ kind: 'error', message });
      showToast('error', message);
    } finally {
      setPendingAction(null);
    }
  }

  // Stage 2: refresh this Work Order and the lists after an action done by a shared component.
  async function refreshAfterAction() {
    await mutate();
    void mutateRelated(isWorkOrderRelatedListKey, undefined, { revalidate: true, populateCache: false });
  }

  async function correctTime(segment: TimeSegment, input: { startedAt: string; endedAt: string; reason: string }) {
    if (pendingAction) return false;
    setPendingAction('time');
    setFeedback(null);
    try {
      await correctAdminTime({
        workOrderId: data!.id,
        targetType: segment.targetType,
        targetId: segment.id,
        expectedVersion: data!.version,
        reason: input.reason,
        startedAt: input.startedAt,
        endedAt: input.endedAt,
      });
      await refreshAfterAction();
      showToast('success', messages.timeCorrectionSuccess);
      return true;
    } catch (failure) {
      const message = timeCorrectionError(failure, messages);
      setFeedback({ kind: 'error', message });
      showToast('error', message);
      return false;
    } finally {
      setPendingAction(null);
    }
  }

  function openTimes() {
    setHistoryTab('times');
    // After the menu has closed and given focus back to its button: then go to the Times tab (History is always open).
    window.setTimeout(() => {
      const history = document.getElementById('history');
      history?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      history?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus({ preventScroll: true });
    }, 50);
  }

  function closeDialog() {
    if (pendingAction) return;
    setDialog(null);
    setDialogError(null);
  }

  const showStickyComplete = readyToClose && !completeCardInView;
  const dialogJob = jobDialog ? data.jobs.find((job) => job.id === jobDialog.jobId) : undefined;
  const vehicle = formatVehicleYmm(truck);
  const number = new Intl.NumberFormat(intlLocale(locale));
  const menuItems: MenuItem[] = [];
  if (canCorrectTime) menuItems.push({ key: 'times', label: messages.menuCorrectTime, icon: Clock, onSelect: openTimes });
  if (canReopenWorkOrder) menuItems.push({ key: 'reopen', label: messages.reopenWorkOrderTitle, icon: RotateCcw, onSelect: () => setDialog('reopen') });
  if (canCancelWorkOrder) menuItems.push({ key: 'cancel', label: messages.cancelWorkOrderTitle, icon: CircleX, destructive: true, separatorBefore: menuItems.length > 0, onSelect: () => setDialog('cancel') });
  const notes = data.noteEntries ?? [];
  const laborMax = Math.max(1, ...labor.map((entry) => entry.totalMs));
  const copyVin = async () => {
    if (!truck.vin) return;
    try {
      await navigator.clipboard.writeText(truck.vin);
      showToast('success', messages.vinCopied);
    } catch {
      showToast('error', messages.loadError);
    }
  };

  return <div className={showStickyComplete ? 'space-y-5 pb-32' : 'space-y-5'}>
    {/* Stage 8 (mockup): "Truck 918", status then priority; one meta line; Open Truck, Pause / Resume and "…". */}
    <section className="space-y-5" data-testid="admin-operational-header">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="page-title">{fillPlaceholders(messages.woTitle, { truck: truck.truckNumber })}</h1>
            <WorkOrderStatusBadge status={data.status}>{workOrderStatusLabel(data.status, messages)}</WorkOrderStatusBadge>
            <PriorityBadge priority={data.priority}>{fillPlaceholders(messages.priorityChip, { priority: adminPriorityLabel(data.priority, messages) })}</PriorityBadge>
          </div>
          <p className="text-muted-foreground">
            <span className="font-mono text-[13px] text-foreground/90">{data.displayId}</span>
            {vehicle ? <><Dot />{vehicle}</> : null}
            <span className="hidden sm:inline"><Dot />{fillPlaceholders(messages.woOpened, { date: formatShortDateTime(data.createdAt, locale) })}</span>
            <Dot />{fillPlaceholders(messages.woUpdatedShort, { date: formatShortDateTime(data.updatedAt, locale) })}
          </p>
          {/* PCA10 (UX-5-005): what this Work Order has cost so far (Manager and System Admin only; the API sends it to nobody else). */}
          {data.costs ? (
            <p className="text-muted-foreground" data-testid="wo-costs-so-far">
              {fillPlaceholders(messages.pcWoCostsSoFar, { labor: formatCents(data.costs.laborCents, locale), outside: formatCents(data.costs.outsideCents, locale) })}
              <Dot />
              <Link href={adminTruckCostsHref(truck.id, `/admin/work-orders/${data.id}`)} className="text-primary hover:underline">{messages.pcWoOpenTruckCosts}</Link>
            </p>
          ) : null}
          {!canManageWorkOrders ? (
            <p className="flex items-center gap-1.5 pt-1 text-muted-foreground"><Eye aria-hidden="true" className="size-3.5" />{messages.woViewOnly}</p>
          ) : canOfficialPause && !isPaused && !pauseEnabled ? (
            <p className="pt-1 text-muted-foreground">{messages.pauseUnavailableUntilInProgress}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2 sm:shrink-0">
          <Button asChild variant="ghost" className="hidden sm:inline-flex">
            <Link href={truckHref}><TruckIcon aria-hidden="true" />{messages.openTruckAction}</Link>
          </Button>
          {canOfficialPause ? (
            isPaused ? (
              <Button
                type="button"
                className="flex-1 sm:flex-none"
                disabled={Boolean(pendingAction)}
                onClick={() => void runMutation('resume-wo', messages.resumeWorkOrderSuccess, () => resumeAdminWorkOrder(data.id), (failure) => pauseResumeError(failure, messages))}
              >
                <Play aria-hidden="true" />{pendingAction === 'resume-wo' ? messages.saving : messages.resumeShort}
              </Button>
            ) : (
              <Button type="button" variant="outline" className="flex-1 sm:flex-none" disabled={!pauseEnabled || Boolean(pendingAction)} onClick={() => setDialog('pause')}>
                <Pause aria-hidden="true" />{messages.pauseShort}
              </Button>
            )
          ) : null}
          {canManageWorkOrders && menuItems.length ? (
            // Stage 5 (R5) / Stage 8: a menu for the rare actions (Return to Service is in the Next step).
            <ResponsiveMenu
              label={messages.woMenuLabel}
              items={menuItems}
              contentTestId="admin-wo-more-menu"
              trigger={(
                <Button type="button" variant="outline" size="icon" aria-label={messages.moreActions} data-testid="admin-wo-more-actions" disabled={Boolean(pendingAction)}>
                  <MoreHorizontal aria-hidden="true" />
                </Button>
              )}
            />
          ) : null}
        </div>
      </div>
      <WorkOrderMetrics data={data} messages={messages} />
    </section>

    {feedback?.kind === 'error' ? (
      <div className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-destructive-text" role="alert">
        <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <p className="min-w-0 flex-1">{feedback.message}</p>
        <Button type="button" variant="ghost" size="sm" className="text-destructive-text" onClick={() => { setFeedback(null); void mutate(); }}>
          <RotateCw aria-hidden="true" />{messages.reload}
        </Button>
      </div>
    ) : null}

    <WorkOrderNextStep
      data={data}
      locale={locale}
      messages={messages}
      canManage={canManageWorkOrders}
      readyToClose={readyToClose}
      pending={Boolean(pendingAction)}
      calloutRef={setCompleteCardElement}
      onResume={() => void runMutation('resume-wo', messages.resumeWorkOrderSuccess, () => resumeAdminWorkOrder(data.id), (failure) => pauseResumeError(failure, messages))}
      onReturnToService={() => setDialog('return')}
      onConfirmCompletion={() => setCloseOpen(true)}
      onReturned={(jobId) => setReturnRequest(jobId)}
      onChanged={refreshAfterAction}
    />

    {/* LTR-109 / LTR-174: operational work first (Jobs, notes); context on the side on desktop. */}
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-5">
        <SectionCard
          title={messages.jobs}
          count={data.jobs.length}
          titleId="admin-wo-jobs-title"
          action={canManageJobs ? (
            // LTR-119 / D6: Jobs are added from the Truck Work Plan (the canonical place).
            <Button asChild variant="ghost" className="text-primary hover:text-primary">
              <Link href={`${truckHref}#truck-work-plan-title`} aria-label={messages.addWorkInWorkPlan}>
                <Plus aria-hidden="true" />
                <span className="sm:hidden">{messages.jobsAddWorkShort}</span>
                <span className="hidden sm:inline">{messages.jobsAddWorkLong}</span>
              </Link>
            </Button>
          ) : null}
        >
          {!canManageJobs ? (
            <p className="flex items-center gap-2 border-b bg-sunken px-4 py-2.5 text-muted-foreground">
              <Lock aria-hidden="true" className="size-3.5 shrink-0" />
              {isPmWorkOrder ? messages.jobsPmLocked : !isOpen ? messages.jobsClosedLocked : messages.jobsLockedNoPermission}
            </p>
          ) : null}
          <AdminJobTable
            highlightedJobId={highlightedJobId}
            blockedJobIds={blockedJobIds}
            data={data}
            locale={locale}
            messages={messages}
            canManageJobs={canManageJobs}
            canReopenJob={canReopenJob}
            pendingAction={pendingAction}
            pmMechanics={pmMechanics}
            assignableMechanics={assignableMechanics}
            returnRequest={returnRequest}
            onReturnRequestHandled={clearReturnRequest}
            onAssign={(jobId, mechanicId) => {
              if (mechanicId) {
                void runMutation(`assign-job-${jobId}`, messages.assignJobSuccess, () => assignAdminWorkOrderJob(id, jobId, { mechanicId, expectedVersion: data.version }), (failure) => jobChangeError(failure, messages));
              } else {
                void runMutation(`unassign-job-${jobId}`, messages.unassignJobSuccess, () => unassignAdminWorkOrderJob(id, jobId, data.version), (failure) => jobChangeError(failure, messages));
              }
            }}
            onComplete={(jobId) => void runMutation(`complete-job-${jobId}`, messages.completeJobSuccess, () => completeAdminJob(jobId, { expectedVersion: data.version }), (failure) => jobChangeError(failure, messages))}
            onPmServiceChange={(jobId, catalogJobId) => void runMutation(`pm-service-${jobId}`, messages.pmServiceChangedSuccess, () => changeAdminPmService(data.id, jobId, { catalogJobId, expectedVersion: data.version }), () => messages.pmServiceChangeFailed)}
            onJobDialog={(kind, jobId) => { setJobDialogError(null); setJobDialog({ kind, jobId }); }}
            // LTR-188 / D23, D24: helper Job and external shop, from the row's "…" and "Returned".
            onAddHelper={(jobId, mechanicId) => void runMutation(`add-helper-${jobId}`, messages.addHelperSuccess, () => addAdminHelperJob(id, jobId, { mechanicId, expectedVersion: data.version }), (failure) => jobChangeError(failure, messages))}
            onSendExternal={(jobId, input) => void runMutation(`send-external-${jobId}`, messages.sendExternalSuccess, () => sendAdminJobExternal(id, jobId, { ...input, expectedVersion: data.version }), (failure) => jobChangeError(failure, messages))}
            onReturnExternal={(jobId, input) => void runMutation(`return-external-${jobId}`, messages.externalReturnSuccess, () => returnAdminJobExternal(id, jobId, { ...input, expectedVersion: data.version }), (failure) => jobChangeError(failure, messages))}
          />
        </SectionCard>

        <SectionCard title={messages.notes} count={notes.length} titleId="admin-wo-notes-title">
          <div className="space-y-4 p-4">
            {notes.length ? (
              <ul className="space-y-4">
                {notes.map((note) => {
                  const isRequest = note.kind === WorkOrderNoteKind.WORK_REQUEST;
                  return (
                    <li key={note.id} className={isRequest ? 'flex gap-3 rounded-lg border border-warning/30 bg-warning-surface/40 p-3' : 'flex gap-3'}>
                      <MechanicAvatar id={note.author.id} name={note.author.name} size="lg" />
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="font-medium">{note.author.name}</span>
                          <span className="text-xs text-muted-foreground">{formatShortDateTime(note.createdAt, locale)}</span>
                          {isRequest ? (
                            <span className={note.handledAt ? 'rounded-md border px-1.5 py-px text-xs font-medium text-muted-foreground' : 'rounded-md border border-warning/40 px-1.5 py-px text-xs font-medium text-warning-foreground dark:text-warning'}>
                              {note.handledAt ? messages.workRequestLabel : messages.workRequestOpenChip}
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-0.5 whitespace-pre-wrap text-foreground/90">{note.body}</p>
                        {isRequest && note.handledAt ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {messages.workRequestHandledByAt
                              .replace('{name}', note.handledBy?.name ?? '—')
                              .replace('{date}', formatShortDateTime(note.handledAt, locale))}
                          </p>
                        ) : null}
                        {isRequest && !note.handledAt && canManageWorkOrders ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="mt-2"
                            disabled={Boolean(pendingAction)}
                            onClick={() => void runMutation(`handle-request-${note.id}`, messages.workRequestHandledSuccess, () => handleAdminWorkRequest(data.id, note.id), () => messages.workRequestHandleFailed)}
                          >
                            <Check aria-hidden="true" />{messages.markWorkRequestHandled}
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="rounded-lg border border-dashed px-3 py-4 text-center text-muted-foreground">{messages.noNotes}</p>}
            {/* LTR-126 / D8: append-only. Stage 8 (mockup): one line that grows, "Post" inside. */}
            {canEditFields ? (
              <>
                <form
                  className="flex items-end gap-2 rounded-lg border bg-background p-1.5 pl-3 focus-within:border-ring"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const body = draftNotes.trim();
                    if (!body) return;
                    void runMutation('add-note', messages.noteAddedSuccess, async () => {
                      await addAdminWorkOrderNote(data.id, body);
                      setDraftNotes('');
                    }, () => messages.noteAddFailed);
                  }}
                >
                  <textarea
                    aria-label={messages.addNote}
                    placeholder={messages.notePlaceholderShort}
                    value={draftNotes}
                    rows={1}
                    maxLength={2000}
                    onChange={(event) => {
                      setDraftNotes(event.target.value);
                      event.target.style.height = 'auto';
                      event.target.style.height = `${event.target.scrollHeight}px`;
                    }}
                    className="max-h-40 min-h-9 min-w-0 flex-1 resize-none bg-transparent py-1.5 text-base outline-none placeholder:text-muted-foreground"
                  />
                  <Button type="submit" disabled={Boolean(pendingAction) || !draftNotes.trim()}>
                    {pendingAction === 'add-note' ? messages.saving : messages.postNote}
                  </Button>
                </form>
                <p className="text-xs text-muted-foreground">{messages.notesHelp}</p>
              </>
            ) : null}
          </div>
        </SectionCard>
      </div>

      <aside className="min-w-0 space-y-5" aria-label={messages.contextSidebarLabel}>
        <SectionCard
          title={messages.truck}
          data-testid="admin-wo-truck-card"
          action={(
            <Link href={truckHref} className="inline-flex h-9 items-center gap-1 font-medium text-primary hover:underline">
              {messages.truckCardOpen}<ArrowUpRight aria-hidden="true" className="size-3.5" />
            </Link>
          )}
        >
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 p-4">
            <dt className="text-muted-foreground">{messages.unitLabel}</dt><dd className="text-right font-medium">{truck.truckNumber}</dd>
            <dt className="text-muted-foreground">{messages.vehicleLabel}</dt><dd className="text-right font-medium">{vehicle || messages.noValue}</dd>
            <dt className="text-muted-foreground">{messages.mileage}</dt>
            <dd className="tnum text-right font-medium">{truck.mileage === null ? messages.noValue : fillPlaceholders(messages.mileageMi, { value: number.format(truck.mileage) })}</dd>
            <dt className="text-muted-foreground">{messages.vin}</dt>
            <dd className="flex min-w-0 items-center justify-end gap-1.5 font-mono text-[13px]">
              <span className="break-all">{truck.vin ?? messages.noValue}</span>
              {truck.vin ? (
                <button type="button" onClick={() => void copyVin()} className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground" aria-label={messages.copyVin}>
                  <Copy aria-hidden="true" className="size-3.5" />
                </button>
              ) : null}
            </dd>
            <dt className="text-muted-foreground">{messages.company}</dt>
            <dd className="text-right font-medium">{truck.company ? (truck.owner ? fillPlaceholders(messages.companyOwner, { company: truck.company, owner: truck.owner }) : truck.company) : messages.noValue}</dd>
          </dl>
          {truck.location ? (
            <div className="flex items-start gap-2.5 border-t px-4 py-3 text-muted-foreground">
              <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <p>
                <span className="text-foreground">{truck.location}</span>
                {truck.locationUpdatedOn ? <><br /><span className="text-xs">{fillPlaceholders(messages.reportedOn, { date: formatAdminDateOnly(truck.locationUpdatedOn, locale) })}</span></> : null}
              </p>
            </div>
          ) : null}
          {data.status === 'completed' && data.returnedToServiceAt ? (
            <p className="flex items-center gap-2 border-t px-4 py-3 text-success">
              <CircleCheck aria-hidden="true" className="size-3.5" />
              {fillPlaceholders(messages.returnedToServiceOn, { date: formatShortDateTime(data.returnedToServiceAt, locale) })}
            </p>
          ) : null}
        </SectionCard>

        {canEditPriority ? (
          <SectionCard title={messages.priority}>
            <div className="space-y-3 p-4">
              <div className="grid grid-cols-4 gap-1 rounded-lg bg-sunken p-1 ring-1 ring-border" role="radiogroup" aria-label={messages.priority}>
                {([Priority.LOW, Priority.NORMAL, Priority.HIGH, Priority.CRITICAL] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={draftPriority === value}
                    disabled={Boolean(pendingAction)}
                    onClick={() => setDraftPriority(value)}
                    className="seg h-9 rounded-md text-muted-foreground hover:text-foreground"
                  >
                    {adminPriorityLabel(value, messages)}
                  </button>
                ))}
              </div>
              {draftPriority !== data.priority ? (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    className="flex-1"
                    disabled={Boolean(pendingAction)}
                    onClick={() => void runMutation('fields', messages.fieldUpdatesSuccess, async () => {
                      await patchAdminWorkOrder(data.id, { expectedVersion: data.version, priority: draftPriority });
                    }, (failure) => fieldUpdateError(failure, messages))}
                  >
                    {pendingAction === 'fields' ? messages.saving : messages.updatePriority}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setDraftPriority(data.priority)}>{messages.priorityReset}</Button>
                </div>
              ) : null}
            </div>
          </SectionCard>
        ) : null}

        <SectionCard title={messages.laborByMechanic}>
          {labor.length ? (
            <ul className="space-y-3 p-4" aria-label={messages.laborByMechanic}>
              {labor.map((entry) => (
                <li key={entry.key}>
                  <div className="flex justify-between gap-3">
                    <span className={entry.name ? 'min-w-0 truncate' : 'min-w-0 truncate text-muted-foreground'}>{entry.name ?? messages.laborUnattributed}</span>
                    <span className="tnum font-medium">{formatDuration(entry.totalMs)}</span>
                  </div>
                  <div aria-hidden="true" className="mt-1.5 h-1 rounded-full bg-muted-foreground/20">
                    <div className={entry.name ? 'h-1 rounded-full bg-primary' : 'h-1 rounded-full bg-muted-foreground/60'} style={{ width: `${Math.max(4, Math.round((entry.totalMs / laborMax) * 100))}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : <p className="px-4 py-4 text-muted-foreground">{messages.noValue}</p>}
        </SectionCard>

        <SectionCard
          title={messages.repairHistorySection}
          action={(
            <div className="w-44 shrink-0">
              <Select aria-label={messages.filterByCategory} className="h-10 pl-2.5 text-base text-muted-foreground sm:h-9 sm:text-sm" value={historyCategory} onChange={(event) => setHistoryCategory(event.target.value)}>
                <option value="">{messages.allCategories}</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </Select>
            </div>
          )}
        >
          {historyQuery.error ? (
            <div className="p-4"><LoadFailure message={messages.repairHistoryLoadError} retryLabel={messages.retry} onRetry={() => void historyQuery.mutate()} /></div>
          ) : historyQuery.isLoading ? (
            <div className="p-4"><CardListSkeleton count={2} /></div>
          ) : historyItems.length ? (
            <>
              <ul className="divide-y">
                {historyItems.map((item) => (
                  <li key={item.workOrderId} className="space-y-1 px-4 py-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <Link href={`/admin/work-orders/${item.workOrderId}`} className="font-mono text-[13px] font-medium text-primary hover:underline">{item.displayId}</Link>
                      {item.mileage !== null ? <span className="tnum text-xs text-muted-foreground">{fillPlaceholders(messages.mileageMi, { value: number.format(item.mileage) })}</span> : null}
                    </div>
                    <p className="text-muted-foreground">
                      {item.primaryCategoryName} · {formatDay(item.date, locale)}{item.mechanicNames.length ? ` · ${item.mechanicNames.join(', ')}` : ''}
                    </p>
                    {(item.jobDetails?.length ? item.jobDetails.map((job) => job.displayName) : item.jobs ?? []).length ? (
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {(item.jobDetails?.length ? item.jobDetails.map((job) => job.displayName) : item.jobs ?? []).map((job) => (
                          <span key={`${item.workOrderId}-${job}`} className="rounded-md border px-1.5 py-px text-xs text-muted-foreground">{job}</span>
                        ))}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
              {historyHasMore ? (
                <div className="border-t p-3">
                  <Button variant="outline" className="w-full" disabled={historyQuery.isValidating} onClick={() => void historyQuery.setSize(historyQuery.size + 1)}>
                    {historyQuery.isValidating ? `${messages.loadMoreRepairs}…` : messages.loadMoreRepairs}
                  </Button>
                </div>
              ) : null}
            </>
          ) : (
            <div className="flex flex-col items-center gap-1 px-4 py-6 text-center text-muted-foreground">
              <FileClock aria-hidden="true" className="size-5" />
              <p>{historyCategory ? fillPlaceholders(messages.repairEmptyFiltered, { category: categories.find((category) => category.id === historyCategory)?.name ?? '' }) : messages.repairEmpty}</p>
            </div>
          )}
        </SectionCard>
      </aside>
    </div>

    <WorkOrderHistory
      data={data}
      locale={locale}
      messages={messages}
      tab={historyTab}
      onTabChange={setHistoryTab}
      canCorrect={canManageWorkOrders}
      pending={Boolean(pendingAction)}
      onCorrect={correctTime}
    />

    {/* LTR-189 (W1): cancel / reopen a Job asks the reason in a dialog. */}
    {jobDialog && dialogJob ? (() => {
      const isCancel = jobDialog.kind === 'cancel';
      const closeJobDialog = () => { if (!pendingAction) { setJobDialog(null); setJobReason(''); setJobDialogError(null); } };
      return (
        <Modal open title={isCancel ? messages.cancelJobTitle : messages.reopenJobTitle} description={dialogJob.displayName} closeLabel={messages.closeDialog} onClose={closeJobDialog}>
          <div className="space-y-3">
            <label className="block space-y-1">
              <span className="text-sm font-medium">{messages.jobChangeReason}</span>
              <Textarea aria-label={messages.jobChangeReason} rows={2} value={jobReason} onChange={(event) => { setJobReason(event.target.value); setJobDialogError(null); }} maxLength={1000} />
              <span className="block text-xs text-muted-foreground">{messages.jobChangeReasonHelp}</span>
            </label>
            {jobDialogError ? <p className="text-sm font-medium text-destructive-text" role="alert">{jobDialogError}</p> : null}
            <DialogActions>
              <Button type="button" variant="outline" disabled={Boolean(pendingAction)} onClick={closeJobDialog}>{messages.dialogBack}</Button>
              <Button
                type="button"
                variant={isCancel ? 'destructive' : 'default'}
                disabled={Boolean(pendingAction)}
                onClick={() => {
                  const reason = jobReason.trim();
                  if (!reason) {
                    setJobDialogError(messages.jobChangeReasonRequired);
                    return;
                  }
                  setJobDialogError(null);
                  void runMutation(`${jobDialog.kind}-job-${dialogJob.id}`, isCancel ? messages.cancelJobSuccess : messages.reopenJobSuccess, async () => {
                    if (isCancel) await cancelAdminJob(dialogJob.id, { reason, expectedVersion: data.version });
                    else await reopenAdminJob(dialogJob.id, { reason, expectedVersion: data.version });
                    setJobReason('');
                    setJobDialog(null);
                  }, (failure) => jobChangeError(failure, messages));
                }}
              >
                {pendingAction ? messages.saving : isCancel ? messages.cancelJobConfirm : messages.reopenJobConfirm}
              </Button>
            </DialogActions>
          </div>
        </Modal>
      );
    })() : null}

    {/* LTR-174: Pause asks its reason in a dialog (LTR-168: none preselected). Same call as before. */}
    {dialog === 'pause' ? (
      <Modal open title={messages.pauseWorkOrderAction} closeLabel={messages.closeDialog} onClose={closeDialog}>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!pauseEnabled || !pauseReason) return;
            const reason = pauseReason;
            void runMutation('pause-wo', messages.pauseWorkOrderSuccess, async () => {
              await pauseAdminWorkOrder(data.id, { reason });
              setPauseReason('');
              setDialog(null);
            }, (failure) => pauseResumeError(failure, messages));
          }}
        >
          <Select aria-label={messages.pauseReasonLabel} value={pauseReason} disabled={!pauseEnabled || Boolean(pendingAction)} onChange={(event) => setPauseReason(event.target.value as PauseReason | '')}>
            <option value="" disabled>{messages.pauseReasonPlaceholder}</option>
            {Object.values(PauseReason).map((reason) => (
              <option key={reason} value={reason}>{adminPauseReasonLabel(reason, messages)}</option>
            ))}
          </Select>
          <DialogActions>
            <Button type="button" variant="outline" disabled={Boolean(pendingAction)} onClick={closeDialog}>{messages.dialogBack}</Button>
            <Button type="submit" disabled={!pauseEnabled || !pauseReason || Boolean(pendingAction)}>{messages.pauseWorkOrderConfirm}</Button>
          </DialogActions>
        </form>
      </Modal>
    ) : null}

    {dialog === 'cancel' && canCancelWorkOrder ? (
      <Modal open title={messages.cancelWorkOrderTitle} description={messages.cancelWorkOrderDescription} closeLabel={messages.closeDialog} onClose={closeDialog}>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            const reason = cancelReason.trim();
            if (!reason) {
              setDialogError(messages.cancelWorkOrderReasonRequired);
              return;
            }
            setDialogError(null);
            void runMutation('cancel', messages.cancelWorkOrderSuccess, async () => {
              await cancelAdminWorkOrder(data.id, { reason, expectedVersion: data.version });
              setCancelReason('');
              setDialog(null);
            }, (failure) => cancelError(failure, messages));
          }}
        >
          <label className="block space-y-1">
            <span className="text-sm font-medium">{messages.cancelWorkOrderReason}</span>
            <Textarea
              aria-label={messages.cancelWorkOrderReason}
              rows={2}
              value={cancelReason}
              onChange={(event) => { setCancelReason(event.target.value); setDialogError(null); }}
              maxLength={1000}
              required
            />
            <span className="text-xs text-muted-foreground">{messages.cancelWorkOrderReasonHelp}</span>
          </label>
          {dialogError ? <p className="text-sm font-medium text-destructive-text" role="alert">{dialogError}</p> : null}
          <DialogActions>
            <Button type="button" variant="outline" disabled={Boolean(pendingAction)} onClick={closeDialog}>{messages.dialogBack}</Button>
            <Button type="submit" variant="destructive" disabled={Boolean(pendingAction)}>{messages.cancelWorkOrderConfirm}</Button>
          </DialogActions>
        </form>
      </Modal>
    ) : null}

    {dialog === 'reopen' && canReopenWorkOrder ? (
      <Modal open title={messages.reopenWorkOrderTitle} description={messages.reopenWorkOrderDescription} closeLabel={messages.closeDialog} onClose={closeDialog}>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            const reason = reopenReason.trim();
            if (!reason) {
              setDialogError(messages.reopenWorkOrderReasonRequired);
              return;
            }
            setDialogError(null);
            void runMutation('reopen', messages.reopenWorkOrderSuccess, async () => {
              await reopenAdminWorkOrder(data.id, { reason, expectedVersion: data.version });
              setReopenReason('');
              setDialog(null);
            }, (failure) => reopenError(failure, messages));
          }}
        >
          <label className="block space-y-1">
            <span className="text-sm font-medium">{messages.reopenWorkOrderReason}</span>
            <Textarea
              aria-label={messages.reopenWorkOrderReason}
              rows={2}
              value={reopenReason}
              onChange={(event) => { setReopenReason(event.target.value); setDialogError(null); }}
              maxLength={1000}
              required
            />
            <span className="text-xs text-muted-foreground">{messages.reopenWorkOrderReasonHelp}</span>
          </label>
          {dialogError ? <p className="text-sm font-medium text-destructive-text" role="alert">{dialogError}</p> : null}
          <DialogActions>
            <Button type="button" variant="outline" disabled={Boolean(pendingAction)} onClick={closeDialog}>{messages.dialogBack}</Button>
            <Button type="submit" disabled={Boolean(pendingAction)}>{messages.reopenWorkOrderConfirm}</Button>
          </DialogActions>
        </form>
      </Modal>
    ) : null}

    {dialog === 'return' && canReturnToService ? (
      <Modal open title={messages.returnToServiceTitle} description={messages.returnToServiceDescription} closeLabel={messages.closeDialog} onClose={closeDialog}>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            // LTR-158: the reason is optional.
            const reason = returnReason.trim() || undefined;
            void runMutation('return-to-service', messages.returnToServiceSuccess, async () => {
              await returnAdminWorkOrderToService(data.id, { reason, expectedVersion: data.version });
              setReturnReason('');
              setDialog(null);
            }, (failure) => returnToServiceError(failure, messages));
          }}
        >
          <label className="block space-y-1">
            <span className="text-sm font-medium">{messages.returnToServiceReason}</span>
            <Textarea
              aria-label={messages.returnToServiceReason}
              rows={2}
              value={returnReason}
              onChange={(event) => setReturnReason(event.target.value)}
              maxLength={1000}
            />
            <span className="text-xs text-muted-foreground">{messages.returnToServiceReasonHelp}</span>
          </label>
          <DialogActions>
            <Button type="button" variant="outline" disabled={Boolean(pendingAction)} onClick={closeDialog}>{messages.dialogBack}</Button>
            <Button type="submit" disabled={Boolean(pendingAction)}>{messages.returnToServiceConfirm}</Button>
          </DialogActions>
        </form>
      </Modal>
    ) : null}

    <CloseWorkOrderDialog
      open={closeOpen}
      workOrderId={data.id}
      workOrderDisplayId={data.displayId}
      truckNumber={truck.truckNumber}
      expectedVersion={data.version}
      messages={messages}
      onClose={() => setCloseOpen(false)}
      onDone={refreshAfterAction}
    />

    {showStickyComplete ? (
      <div
        role="region"
        aria-label={messages.completeWorkOrderTitle}
        className="anim-sheet-in fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 px-4 py-3 shadow-2xl backdrop-blur app-safe-bottom md:left-[var(--admin-aside)]"
        data-testid="admin-wo-next-action"
      >
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-2 sm:flex-row sm:items-center sm:justify-between md:px-2">
          <p className="font-medium">{messages.readyToCloseHint}</p>
          <Button type="button" disabled={Boolean(pendingAction)} onClick={() => setCloseOpen(true)}>
            <CheckCheck aria-hidden="true" />{messages.completeWorkOrderConfirm}
          </Button>
        </div>
      </div>
    ) : null}
  </div>;
}

/** The meta line's separator. */
function Dot() {
  return <span aria-hidden="true" className="mx-1.5 text-muted-foreground">•</span>;
}

function cancelError(errorValue: unknown, messages: AdminMessages) {
  if (errorValue instanceof ApiError) {
    if (errorValue.status === 400) return messages.cancelWorkOrderBadRequest;
    if (errorValue.status === 409) return messages.assignmentConflict;
  }
  return messages.cancelWorkOrderGenericError;
}
function reopenError(errorValue: unknown, messages: AdminMessages) {
  if (errorValue instanceof ApiError) {
    if (errorValue.status === 400) return messages.reopenWorkOrderBadRequest;
    if (errorValue.status === 409) return messages.assignmentConflict;
  }
  return messages.reopenWorkOrderGenericError;
}
function returnToServiceError(errorValue: unknown, messages: AdminMessages) {
  if (errorValue instanceof ApiError) {
    if (errorValue.status === 400) return messages.returnToServiceBadRequest;
    if (errorValue.status === 409) return messages.assignmentConflict;
  }
  return messages.returnToServiceGenericError;
}
function fieldUpdateError(errorValue: unknown, messages: AdminMessages) {
  if (errorValue instanceof ApiError) {
    if (errorValue.status === 400) return messages.fieldUpdatesBadRequest;
    if (errorValue.status === 409) return messages.assignmentConflict;
  }
  return messages.fieldUpdatesGenericError;
}
function timeCorrectionError(errorValue: unknown, messages: AdminMessages) {
  if (errorValue instanceof ApiError) {
    if (errorValue.status === 400) return messages.timeCorrectionBadRequest;
    if (errorValue.status === 409) return messages.assignmentConflict;
  }
  return messages.timeCorrectionGenericError;
}
function jobChangeError(errorValue: unknown, messages: AdminMessages) {
  // LTR-181 / LTR-188: a known API code says exactly what went wrong (e.g. HELPER_ALREADY_ADDED).
  const code = errorValue instanceof ApiError && errorValue.status === 400 ? apiErrorCode(errorValue) : null;
  if (code && code in messages.apiError) return messages.apiError[code as keyof typeof messages.apiError];
  if (errorValue instanceof ApiError) {
    if (errorValue.status === 400) return messages.jobChangeBadRequest;
    if (errorValue.status === 409) return messages.assignmentConflict;
  }
  return messages.jobChangeGenericError;
}
function NotFound({ messages }: { messages: AdminMessages }) { return <EmptyState><p>{messages.workOrderNotFound}</p><Button asChild variant="outline" className="mt-4"><Link href="/admin/work-orders">{messages.backToWorkOrders}</Link></Button></EmptyState>; }
