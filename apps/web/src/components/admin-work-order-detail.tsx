'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSWRConfig } from 'swr';
import { MoreHorizontal } from 'lucide-react';
import { AppCapability, OPEN_WORK_ORDER_STATUSES, PauseReason, Priority, WorkOrderNoteKind, type AdminWorkOrderDetailDto } from '@ltl-shop/shared';
import { adminTruckHref } from '@/lib/admin-truck-origin';
import { ApiError } from '@/lib/api';
import { intlLocale } from '@/lib/shop-locale';
import { formatAdminDate, formatAdminDateOnly, formatDuration } from '@/lib/admin-format';
import { formatVehicleYmm } from '@/lib/format';
import { laborByMechanic } from '@/lib/labor-by-mechanic';
import { adminActivityEventDetail, adminActivityEventLabel, adminPriorityLabel, workOrderStatusLabel } from '@/lib/status-chips';
import { addAdminHelperJob, returnAdminJobExternal, sendAdminJobExternal, changeAdminPmService, addAdminWorkOrderNote, handleAdminWorkRequest, assignAdminWorkOrderJob, cancelAdminJob, cancelAdminWorkOrder, completeAdminJob, completeAdminWorkOrder, correctAdminTime, patchAdminWorkOrder, pauseAdminWorkOrder, reopenAdminJob, reopenAdminWorkOrder, resumeAdminWorkOrder, returnAdminWorkOrderToService, unassignAdminWorkOrderJob, useAdminAssignableMechanics, useAdminRepairHistory, useAdminWorkOrder } from '@/lib/admin-data';
import { adminPauseReasonLabel, type AdminLocale, type AdminMessages } from '@/lib/admin-messages';
import { AdminBlockerResolve } from './admin-blocker-resolve';
import { AdminContextSidebar, ContextBlock, ContextCard, ContextFacts } from './admin-context-sidebar';
import { AdminJobTable } from './admin-job-table';
import { apiErrorCode } from '@/lib/api-error-message';
import { AdminOperationalHeader } from './admin-operational-header';
import { pauseResumeError } from './pause-resume-error';
import { canOfficiallyPauseWorkOrder } from '@/lib/work-order-pause';
import { isAdminWorkOrderReadyToClose } from '@/lib/admin-work-order-close';
import { mechanicNamesLabel } from '@/lib/admin-work-summary';
import { fillPlaceholders } from '@/lib/admin-next-step';
import { truckNextStepActionLabel, truckNextStepText } from '@/lib/truck-next-step';
import { useAuth } from '@/lib/auth-context';
import { isWorkOrderRelatedListKey } from '@/lib/swr-cache-keys';
import { useCategories } from '@/lib/shop-data';
import { useActionToast } from './action-toast';
import {
  AdminBackLink,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardListSkeleton,
  CardTitle,
  CollapsibleSection,
  CompactEmpty,
  EmptyState,
  LoadFailure,
  Modal,
  PageSkeleton,
  PriorityBadge,
  SectionBlock,
  WorkOrderStatusBadge,
  Input,
  Select,
  Textarea,
} from './ui';

type WorkOrderDialog = 'pause' | 'menu' | 'cancel' | 'reopen' | 'return' | null;

/**
 * LTR-174: "What work are we executing, who, what remains, what's next?" — operational header (Truck,
 * WO id, badges, counts, Next step, Pause / Resume and "…"), Confirm completion when the Work Order can
 * close, then the Jobs table, blockers and notes beside a context column (Truck, times, mechanics,
 * priority; summary, Truck details and repair history folded). History and audit stays at the bottom.
 */
export function AdminWorkOrderDetail({ id, locale, messages }: { id: string; locale: AdminLocale; messages: AdminMessages }) {
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
  const [noteOpen, setNoteOpen] = useState(false);
  // LTR-168: no preselected reason, so pausing is a choice and never a single accidental tap.
  const [pauseReason, setPauseReason] = useState<PauseReason | ''>('');
  const [draftPriority, setDraftPriority] = useState<Priority>(Priority.NORMAL);
  const [draftNotes, setDraftNotes] = useState('');
  const [timeTarget, setTimeTarget] = useState('');
  const [timeStartedAt, setTimeStartedAt] = useState('');
  const [timeEndedAt, setTimeEndedAt] = useState('');
  const [timeReason, setTimeReason] = useState('');
  const [pendingAction, setPendingAction] = useState<string | null>(null);
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

  if (isLoading) return <PageSkeleton label={messages.workOrdersTitle} />;
  if (error instanceof ApiError && error.status === 404) return <NotFound messages={messages} />;
  if (error || !data) return <LoadFailure message={messages.loadError} retryLabel={messages.retry} onRetry={() => void mutate()} />;

  const historyItems = historyQuery.data?.flatMap((page) => page.items) ?? [];
  const historyHasMore = Boolean(historyQuery.data?.[historyQuery.data.length - 1]?.nextCursor);
  const values = categoryData ?? [data.category, ...data.jobs.map((job) => job.category)];
  const categories = values.filter((category, index) => values.findIndex((candidate) => candidate.id === category.id) === index);
  const activeMechanics = data.mechanics.filter((mechanic) => !mechanic.removedAt);
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
  const hasMenu = canCancelWorkOrder || canReopenWorkOrder || canReturnToService;
  const readyToClose = isAdminWorkOrderReadyToClose({
    canManageWorkOrders,
    status: data.status,
    categoryName: data.category.name,
    jobs: data.jobs,
  });
  // LTR-159: the same Next step as the Truck, Dashboard and Yard (the API's one rule).
  const nextStep = data.nextStep ?? null;
  const nextStepText = truckNextStepText(nextStep, messages);
  const nextStepAction = truckNextStepActionLabel(nextStep, messages);
  // Everything except plain work in progress is the Shop Manager's to do.
  const nextStepManagerOwned = Boolean(nextStep && nextStep.kind !== 'work');
  // The "Confirm completion" card already covers closing.
  const showNextStep = Boolean(nextStepText) && !(readyToClose && nextStep?.kind === 'close');
  const jobsLeft = data.jobs.filter((job) => job.status === 'to_do').length;
  const counts = isPmWorkOrder ? null : fillPlaceholders(messages.operationalCounts, { jobs: String(jobsLeft), mechanics: String(activeMechanics.length) });
  const blockers = data.reportedBlockers ?? [];
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

  function closeDialog() {
    if (pendingAction) return;
    setDialog(null);
    setDialogError(null);
  }

  // LTR-189 (W2): the card only exists once the Work Order can actually close; before that the Next step says what is missing.
  const completeCard = readyToClose ? (
    <Card ref={setCompleteCardElement} className="border-shop-accent/50 bg-shop-accent/5">
      <CardHeader>
        <CardTitle>{messages.completeWorkOrderTitle}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isPmWorkOrder ? <p className="text-sm text-muted-foreground">{messages.completeWorkOrderPmHelp}</p> : null}
        <p className="text-sm font-medium">{messages.readyToCloseHint}</p>
        <CompleteWorkOrderButton
          messages={messages}
          pending={Boolean(pendingAction)}
          onConfirm={() => void runMutation('complete', messages.completeWorkOrderSuccess, () => completeAdminWorkOrder(data.id, data.version), (failure) => completeError(failure, messages))}
        />
      </CardContent>
    </Card>
  ) : null;

  const showStickyComplete = readyToClose && !completeCardInView;

  const dialogJob = jobDialog ? data.jobs.find((job) => job.id === jobDialog.jobId) : undefined;

  return <div className={showStickyComplete ? 'space-y-5 pb-28' : 'space-y-5'}>
    <AdminBackLink href="/admin/work-orders">{messages.backToWorkOrders}</AdminBackLink>
    <AdminOperationalHeader
      title={<Link className="tap-inline text-primary hover:underline" href={truckHref}>{truck.truckNumber}</Link>}
      subtitle={<>{messages.workOrder} {data.displayId}{formatVehicleYmm(truck) ? ` · ${formatVehicleYmm(truck)}` : ''}</>}
      meta={<>{messages.updated}: {formatAdminDate(data.updatedAt, locale)}</>}
      badges={<><PriorityBadge priority={data.priority}>{adminPriorityLabel(data.priority, messages)}</PriorityBadge><WorkOrderStatusBadge status={data.status}>{workOrderStatusLabel(data.status, messages)}</WorkOrderStatusBadge></>}
      counts={counts}
      actions={canOfficialPause || hasMenu ? (
        <>
          {canOfficialPause ? (
            isPaused ? (
              <Button
                type="button"
                disabled={Boolean(pendingAction)}
                onClick={() => void runMutation('resume-wo', messages.resumeWorkOrderSuccess, () => resumeAdminWorkOrder(data.id), (failure) => pauseResumeError(failure, messages))}
              >
                {messages.resumeWorkOrderAction}
              </Button>
            ) : (
              // Secondary: Confirm completion is the primary action on this page.
              <Button type="button" variant="outline" disabled={!pauseEnabled || Boolean(pendingAction)} onClick={() => setDialog('pause')}>
                {messages.pauseWorkOrderAction}
              </Button>
            )
          ) : null}
          {hasMenu ? (
            <Button type="button" variant="outline" size="icon" aria-label={messages.moreActions} data-testid="admin-wo-more-actions" disabled={Boolean(pendingAction)} onClick={() => setDialog('menu')}>
              <MoreHorizontal aria-hidden="true" className="size-5" />
            </Button>
          ) : null}
        </>
      ) : null}
      note={canOfficialPause && !isPaused && !pauseEnabled ? (
        <p className="text-sm text-muted-foreground">{messages.pauseUnavailableUntilInProgress}</p>
      ) : null}
      nextStep={showNextStep ? (
        <div
          className={nextStepManagerOwned && !canManageWorkOrders ? 'rounded-xl border border-warning bg-warning-surface px-4 py-3 text-sm text-warning-foreground' : 'rounded-xl border border-primary/40 bg-card px-4 py-3 text-sm shadow-soft'}
          role="status"
          data-testid="admin-wo-next-step"
          data-kind={nextStep?.kind}
        >
          <p className="group-title">{messages.nextStepTitle}</p>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium">{nextStepText}</p>
            {/* The action lives on the Truck, the Manager's workplace (LTR-158). */}
            {nextStepAction && canManageWorkOrders ? (
              <Button asChild size="sm" variant="outline">
                <Link href={truckHref}>{nextStepAction}</Link>
              </Button>
            ) : null}
          </div>
          {nextStepManagerOwned && !canManageWorkOrders ? <p className="mt-1">{messages.nextStepNoPermission}</p> : null}
        </div>
      ) : null}
    />
    {feedback ? (
      <p
        className={
          feedback.kind === 'error'
            ? 'rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive-text'
            : 'rounded-xl border border-shop-success/30 bg-shop-success/10 px-3 py-2 text-sm text-shop-success'
        }
        role={feedback.kind === 'error' ? 'alert' : 'status'}
        aria-live="polite"
      >
        {feedback.message}
      </p>
    ) : null}

    {completeCard}

    {/* LTR-109 / LTR-174: operational work first (Jobs, blockers, notes); context on the side on desktop. */}
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
      <div className="min-w-0 space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>{messages.jobs} ({data.jobsCompleted}/{data.jobsTotal})</CardTitle>
            {canManageJobs ? null : (
              <CardDescription>
                {isPmWorkOrder ? messages.jobsPmLocked : !isOpen ? messages.jobsClosedLocked : messages.jobsNoPermission}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <AdminJobTable
              data={data}
              locale={locale}
              messages={messages}
              canManageJobs={canManageJobs}
              canReopenJob={canReopenJob}
              pendingAction={pendingAction}
              pmMechanics={pmMechanics}
              assignableMechanics={assignableMechanics}
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
            {canManageJobs ? (
              // LTR-119 / D6: Jobs are added from the Truck Work Plan (the canonical place).
              <Button asChild variant="outline">
                <Link href={`${truckHref}#truck-work-plan-title`}>
                  {messages.addWorkInWorkPlan}
                </Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>

        {/* LTR-155 / D17: which Job, why, notes; only the Manager resolves (optional note). One line when there is none. */}
        {blockers.length ? (
          <section className="rounded-xl border border-warning bg-warning-surface p-4 text-warning-foreground" aria-labelledby="admin-wo-blockers-title">
            <h3 id="admin-wo-blockers-title" className="group-title text-warning-foreground">{messages.reportedBlockers}</h3>
            <ul className="mt-2 divide-y divide-warning/40">
              {blockers.map((blocker) => (
                <li key={blocker.id} className="py-3 first:pt-0 last:pb-0">
                  <AdminBlockerResolve
                    workOrderId={data.id}
                    blocker={blocker}
                    locale={locale}
                    messages={messages}
                    canResolve={canManageWorkOrders && isOpen}
                    onResolved={() => mutate()}
                  />
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <p className="flex items-center gap-2 px-1 text-sm">
            <span className="group-title" role="heading" aria-level={3}>{messages.reportedBlockers}</span>
            <span className="text-muted-foreground">· {messages.noneLabel}</span>
          </p>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{messages.notes}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data.noteEntries ?? []).length ? (
              <ul className="space-y-2">
                {(data.noteEntries ?? []).map((note) => {
                  const isRequest = note.kind === WorkOrderNoteKind.WORK_REQUEST;
                  return (
                    <li key={note.id} className={isRequest ? 'rounded-lg bg-warning-surface px-3 py-2 text-sm' : 'rounded-lg bg-muted px-3 py-2 text-sm'}>
                      <div className="flex flex-wrap items-center gap-2">
                        {isRequest ? (
                          <Badge variant={note.handledAt ? 'secondary' : 'warning'}>
                            {messages.workRequestLabel}{note.handledAt ? '' : ` · ${messages.workRequestOpen}`}
                          </Badge>
                        ) : null}
                        <span className="text-xs text-muted-foreground">
                          {messages.noteByAt
                            .replace('{name}', note.author.name)
                            .replace('{date}', formatAdminDate(note.createdAt, locale))}
                        </span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap">{note.body}</p>
                      {isRequest && note.handledAt ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {messages.workRequestHandledByAt
                            .replace('{name}', note.handledBy?.name ?? '—')
                            .replace('{date}', formatAdminDate(note.handledAt, locale))}
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
                          {messages.markWorkRequestHandled}
                        </Button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : <CompactEmpty>{messages.noNotes}</CompactEmpty>}
            {/* LTR-126 / D8: append-only. LTR-174: the composer opens from "Add note" and stays open to add another. */}
            {canEditFields ? (
              noteOpen ? (
                <form
                  className="space-y-2"
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
                  <Textarea
                    aria-label={messages.addNote}
                    placeholder={messages.adminNotePlaceholder}
                    value={draftNotes}
                    autoFocus
                    onChange={(event) => setDraftNotes(event.target.value)}
                    maxLength={2000}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" disabled={Boolean(pendingAction) || !draftNotes.trim()}>
                      {messages.saveNote}
                    </Button>
                    <Button type="button" variant="ghost" disabled={Boolean(pendingAction)} onClick={() => { setNoteOpen(false); setDraftNotes(''); }}>
                      {messages.cancel}
                    </Button>
                  </div>
                </form>
              ) : (
                <Button type="button" variant="outline" disabled={Boolean(pendingAction)} onClick={() => setNoteOpen(true)}>
                  {messages.addNote}
                </Button>
              )
            ) : null}
          </CardContent>
        </Card>
      </div>

      <AdminContextSidebar label={messages.contextSidebarLabel}>
        <ContextCard>
          <ContextBlock title={messages.truck}>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <div className="min-w-0">
                <p className="font-medium">{truck.truckNumber}</p>
                <p className="text-muted-foreground">{formatVehicleYmm(truck) || messages.noValue}</p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href={truckHref}>{messages.openTruckAction}</Link>
              </Button>
            </div>
            {data.status === 'completed' && data.returnedToServiceAt ? (
              <p className="text-sm text-muted-foreground">
                {messages.returnToServiceAlready} {formatAdminDate(data.returnedToServiceAt, locale)}
              </p>
            ) : null}
          </ContextBlock>
          <ContextBlock title={messages.workOrderTimes}>
            <ContextFacts
              items={[
                { key: 'active', label: messages.activeLabor, value: formatDuration(data.totalActiveLaborMs) },
                { key: 'waiting', label: messages.waitingTime, value: formatDuration(data.totalWaitingMs) },
                ...labor.map((entry) => ({ key: entry.key, label: entry.name ?? messages.laborUnattributed, value: formatDuration(entry.totalMs) })),
              ]}
            />
          </ContextBlock>
          <ContextBlock title={messages.mechanicsLabel}>
            {activeMechanics.length ? (
              <ul className="text-sm">
                {activeMechanics.map((mechanic) => <li key={mechanic.mechanicId}>{mechanic.mechanicName}</li>)}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">{messages.noMechanicsAssigned}</p>
            )}
          </ContextBlock>
          {canEditPriority ? (
            <ContextBlock title={messages.fieldUpdatesTitle}>
              <form
                className="flex flex-col gap-2 sm:flex-row sm:items-center lg:flex-col lg:items-stretch"
                onSubmit={(event) => {
                  event.preventDefault();
                  void runMutation('fields', messages.fieldUpdatesSuccess, async () => {
                    await patchAdminWorkOrder(data.id, {
                      expectedVersion: data.version,
                      priority: draftPriority,
                    });
                  }, (failure) => fieldUpdateError(failure, messages));
                }}
              >
                <Select
                  aria-label={messages.priority}
                  value={draftPriority}
                  disabled={Boolean(pendingAction)}
                  onChange={(event) => setDraftPriority(event.target.value as Priority)}
                >
                  <option value={Priority.LOW}>{messages.lowPriority}</option>
                  <option value={Priority.NORMAL}>{messages.normalPriority}</option>
                  <option value={Priority.HIGH}>{messages.highPriority}</option>
                  <option value={Priority.CRITICAL}>{messages.criticalPriority}</option>
                </Select>
                <Button type="submit" variant="outline" disabled={Boolean(pendingAction) || draftPriority === data.priority}>
                  {messages.updatePriority}
                </Button>
              </form>
            </ContextBlock>
          ) : null}
        </ContextCard>

        {/* LTR-168: context the Manager does not act on starts folded; status and priority are in the header. */}
        <section aria-label={messages.operationalSummary}>
          <CollapsibleSection title={messages.operationalSummary}>
            <div className="p-4"><dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-1">
              <Info label={messages.age} value={formatAge(data.createdAt, locale)} />
              <Info label={messages.progress} value={`${data.jobsCompleted}/${data.jobsTotal}`} />
              <Info label={messages.mechanicsLabel} value={mechanicNamesLabel(activeMechanics, messages)} />
              <Info label={messages.currentPause} value={data.currentPause ? `${adminPauseReasonLabel(data.currentPause.reason, messages)} · ${formatAdminDate(data.currentPause.startedAt, locale)}` : messages.noCurrentPause} />
              <Info label={messages.latestReportedBlocker} value={data.latestReportedBlocker ? `${adminPauseReasonLabel(data.latestReportedBlocker.reason, messages)}${data.latestReportedBlocker.reportedBy ? ` · ${data.latestReportedBlocker.reportedBy.name}` : ''}` : messages.noLatestReportedBlocker} />
            </dl></div>
          </CollapsibleSection>
        </section>
        <CollapsibleSection title={messages.truckDetails}>
          <div className="p-4"><dl className="grid gap-x-4 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-1">
            <Info label={messages.truck} value={truck.truckNumber} />
            <Info label={messages.make} value={truck.make ?? messages.noValue} />
            <Info label={messages.model} value={truck.model ?? messages.noValue} />
            <Info label={messages.year} value={truck.year ? String(truck.year) : messages.noValue} />
            <Info label={messages.mileage} value={truck.mileage === null ? messages.noValue : new Intl.NumberFormat(intlLocale(locale)).format(truck.mileage)} />
            <Info label={messages.company} value={truck.company ?? messages.noValue} />
            <Info label={messages.owner} value={truck.owner ?? messages.noValue} />
            <Info label={messages.vin} value={truck.vin ?? messages.noValue} />
            <Info label={messages.lastReportedLocation} value={truck.location ?? messages.noValue} />
            <Info label={messages.locationUpdatedOn} value={formatAdminDateOnly(truck.locationUpdatedOn, locale)} />
          </dl></div>
        </CollapsibleSection>

        <CollapsibleSection title={messages.recentRepairHistory}>
          <div className="space-y-4 p-4">
          <label className="block space-y-1 sm:w-56"><span className="text-sm font-medium">{messages.filterByCategory}</span><Select aria-label={messages.filterByCategory} value={historyCategory} onChange={(event) => setHistoryCategory(event.target.value)}><option value="">{messages.allCategories}</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</Select></label>{historyQuery.error ? <LoadFailure message={messages.repairHistoryLoadError} retryLabel={messages.retry} onRetry={() => void historyQuery.mutate()} /> : historyQuery.isLoading ? <CardListSkeleton count={2} /> : historyItems.length ? <><ul className="divide-y">{historyItems.map((item) => <li key={item.workOrderId} className="py-3 first:pt-0"><div className="flex flex-wrap items-start justify-between gap-2"><div><Link href={`/admin/work-orders/${item.workOrderId}`} className="font-semibold text-primary hover:underline">{item.displayId}</Link><p className="text-sm text-muted-foreground">{item.primaryCategoryName} · {formatAdminDate(item.date, locale)}</p></div>{item.mileage !== null ? <p className="text-xs text-muted-foreground">{messages.mileage}: {new Intl.NumberFormat(intlLocale(locale)).format(item.mileage)}</p> : null}</div>{item.mechanicNames.length ? <p className="mt-1 text-sm text-muted-foreground">{messages.performedBy}: {item.mechanicNames.join(', ')}</p> : null}{item.jobDetails?.length ? <div className="mt-1 flex flex-wrap gap-1">{item.jobDetails.map((job) => <Badge key={`${item.workOrderId}-${job.displayName}`} variant="outline">{job.displayName}</Badge>)}</div> : item.jobs?.length ? <div className="mt-1 flex flex-wrap gap-1">{item.jobs.map((job) => <Badge key={`${item.workOrderId}-${job}`} variant="outline">{job}</Badge>)}</div> : null}</li>)}</ul>{historyHasMore ? <Button variant="outline" className="mt-4 w-full" disabled={historyQuery.isValidating} onClick={() => void historyQuery.setSize(historyQuery.size + 1)}>{historyQuery.isValidating ? `${messages.loadMoreRepairs}…` : messages.loadMoreRepairs}</Button> : null}</> : <CompactEmpty>{messages.noRepairHistory}</CompactEmpty>}
          </div>
        </CollapsibleSection>
      </AdminContextSidebar>
    </div>

    <CollapsibleSection testId="admin-wo-history" title={messages.historyAndAudit} description={messages.historyAndAuditDescription}>
        <SectionBlock title={messages.workOrderTimes}><dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4"><Info label={messages.created} value={formatAdminDate(data.createdAt, locale)} /><Info label={messages.started} value={formatAdminDate(data.startedAt, locale)} /><Info label={messages.completed} value={formatAdminDate(data.completedAt, locale)} /><Info label={messages.updated} value={formatAdminDate(data.updatedAt, locale)} /><Info label={messages.activeLabor} value={formatDuration(data.totalActiveLaborMs)} /><Info label={messages.waitingTime} value={formatDuration(data.totalWaitingMs)} /></dl>{labor.length ? <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4" aria-label={messages.laborByMechanic}>{labor.map((entry) => <Info key={entry.key} label={entry.name ?? messages.laborUnattributed} value={formatDuration(entry.totalMs)} />)}</dl> : null}<LaborSegments data={data} locale={locale} messages={messages} /></SectionBlock>
        <SectionBlock title={messages.timeCorrectionTitle} description={messages.timeCorrectionDescription}>
            {closedTimeSegments(data).length ? (
              <form
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  const selected = closedTimeSegments(data).find((segment) => `${segment.targetType}:${segment.id}` === timeTarget);
                  if (!selected) {
                    setFeedback({ kind: 'error', message: messages.timeCorrectionSegmentRequired });
                    return;
                  }
                  const reason = timeReason.trim();
                  if (!reason) {
                    setFeedback({ kind: 'error', message: messages.timeCorrectionReasonRequired });
                    return;
                  }
                  void runMutation('time', messages.timeCorrectionSuccess, async () => {
                    await correctAdminTime({
                      workOrderId: data.id,
                      targetType: selected.targetType,
                      targetId: selected.id,
                      expectedVersion: data.version,
                      reason,
                      startedAt: timeStartedAt ? fromDatetimeLocal(timeStartedAt) : selected.startedAt,
                      endedAt: timeEndedAt ? fromDatetimeLocal(timeEndedAt) : selected.endedAt,
                    });
                    setTimeReason('');
                  }, (failure) => timeCorrectionError(failure, messages));
                }}
              >
                <label className="block space-y-1">
                  <span className="text-sm font-medium">{messages.timeCorrectionSegment}</span>
                  <Select
                    aria-label={messages.timeCorrectionSegment}
                    value={timeTarget}
                    onChange={(event) => {
                      const value = event.target.value;
                      setTimeTarget(value);
                      const selected = closedTimeSegments(data).find((segment) => `${segment.targetType}:${segment.id}` === value);
                      if (selected) {
                        setTimeStartedAt(toDatetimeLocal(selected.startedAt));
                        setTimeEndedAt(toDatetimeLocal(selected.endedAt));
                      }
                    }}
                  >
                    <option value="">{messages.timeCorrectionSegment}</option>
                    {closedTimeSegments(data).map((segment) => (
                      <option key={`${segment.targetType}:${segment.id}`} value={`${segment.targetType}:${segment.id}`}>
                        {segment.targetType === 'work_session' ? `${messages.activeLabor}${segment.mechanic ? ` · ${segment.mechanic.name}` : ''}` : messages.waitingTime} · {formatAdminDate(segment.startedAt, locale)}{laborEndLabel(segment.endReason, messages) ? ` · ${laborEndLabel(segment.endReason, messages)}` : ''}
                      </option>
                    ))}
                  </Select>
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block space-y-1">
                    <span className="text-sm font-medium">{messages.timeCorrectionStartedAt}</span>
                    <Input type="datetime-local" aria-label={messages.timeCorrectionStartedAt} value={timeStartedAt} onChange={(event) => setTimeStartedAt(event.target.value)} />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-sm font-medium">{messages.timeCorrectionEndedAt}</span>
                    <Input type="datetime-local" aria-label={messages.timeCorrectionEndedAt} value={timeEndedAt} onChange={(event) => setTimeEndedAt(event.target.value)} />
                  </label>
                </div>
                <label className="block space-y-1">
                  <span className="text-sm font-medium">{messages.timeCorrectionReason}</span>
                  <Textarea aria-label={messages.timeCorrectionReason} value={timeReason} onChange={(event) => setTimeReason(event.target.value)} maxLength={1000} required />
                  <span className="text-xs text-muted-foreground">{messages.timeCorrectionReasonHelp}</span>
                </label>
                <Button type="submit" disabled={Boolean(pendingAction) || !timeTarget}>{messages.timeCorrectionConfirm}</Button>
              </form>
            ) : (
              <CompactEmpty>{messages.timeCorrectionEmpty}</CompactEmpty>
            )}
        </SectionBlock>
          {data.currentPause ? <SectionBlock title={messages.currentPause}><Pause pause={data.currentPause} locale={locale} messages={messages} /></SectionBlock> : null}
          <SectionBlock title={messages.pauseHistory}>{data.pauseHistory.length ? <ul className="divide-y">{data.pauseHistory.map((pause) => <li key={pause.id} className="py-3 first:pt-0"><Pause pause={pause} locale={locale} messages={messages} /><p className="mt-1 text-xs text-muted-foreground">{pause.createdBy.name}</p></li>)}</ul> : <CompactEmpty>{messages.noPauseHistory}</CompactEmpty>}</SectionBlock>
        <SectionBlock title={messages.activityLog}>{data.activityLog.length ? <ol className="divide-y">{data.activityLog.map((entry) => {
          const detail = adminActivityEventDetail(entry);
          return <li key={entry.id} className="py-3 first:pt-0"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">{adminActivityEventLabel(entry.eventType, messages)}</p><time className="text-xs text-muted-foreground">{formatAdminDate(entry.createdAt, locale)}</time></div><p className="mt-1 text-sm text-muted-foreground">{entry.user.name}</p>{detail ? <p className="mt-1 whitespace-pre-wrap text-sm">{detail}</p> : null}</li>;
        })}</ol> : <CompactEmpty>{messages.noActivity}</CompactEmpty>}</SectionBlock>
    </CollapsibleSection>

    {/* LTR-189 (W1): cancel / reopen a Job asks the reason in a dialog. */}
    {jobDialog && dialogJob ? (() => {
      const isCancel = jobDialog.kind === 'cancel';
      const closeJobDialog = () => { if (!pendingAction) { setJobDialog(null); setJobReason(''); setJobDialogError(null); } };
      return (
        <Modal open title={isCancel ? messages.cancelJobTitle : messages.reopenJobTitle} closeLabel={messages.closeDialog} onClose={closeJobDialog}>
          <div className="space-y-4">
            <p className="text-base font-medium">{dialogJob.displayName}</p>
            <label className="block space-y-1">
              <span className="text-sm font-medium">{messages.jobChangeReason}</span>
              <Textarea aria-label={messages.jobChangeReason} value={jobReason} onChange={(event) => { setJobReason(event.target.value); setJobDialogError(null); }} maxLength={1000} />
              <span className="block text-xs text-muted-foreground">{messages.jobChangeReasonHelp}</span>
            </label>
            {jobDialogError ? <p className="text-sm font-medium text-destructive-text" role="alert">{jobDialogError}</p> : null}
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" disabled={Boolean(pendingAction)} onClick={closeJobDialog}>{messages.cancel}</Button>
              <Button
                type="button"
                variant={isCancel ? 'destructive' : 'default'}
                className="flex-1"
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
            </div>
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
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" disabled={Boolean(pendingAction)} onClick={closeDialog}>{messages.cancel}</Button>
            <Button type="submit" className="flex-1" disabled={!pauseEnabled || !pauseReason || Boolean(pendingAction)}>{messages.pauseWorkOrderConfirm}</Button>
          </div>
        </form>
      </Modal>
    ) : null}

    {/* LTR-158 / LTR-174: rare or destructive actions stay behind "…" and each opens its own dialog. */}
    {dialog === 'menu' ? (
      <Modal open title={messages.moreActions} closeLabel={messages.closeDialog} onClose={closeDialog}>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{messages.moreActionsHelp}</p>
          {canReturnToService ? (
            <Button type="button" variant="outline" className="w-full" onClick={() => setDialog('return')}>{messages.returnToServiceTitle}</Button>
          ) : null}
          {canReopenWorkOrder ? (
            <Button type="button" variant="outline" className="w-full" onClick={() => setDialog('reopen')}>{messages.reopenWorkOrderTitle}</Button>
          ) : null}
          {canCancelWorkOrder ? (
            <Button type="button" variant="outline" className="w-full" onClick={() => setDialog('cancel')}>{messages.cancelWorkOrderTitle}</Button>
          ) : null}
        </div>
      </Modal>
    ) : null}

    {dialog === 'cancel' && canCancelWorkOrder ? (
      <Modal open title={messages.cancelWorkOrderTitle} closeLabel={messages.closeDialog} onClose={closeDialog}>
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
          <p className="text-sm text-muted-foreground">{messages.cancelWorkOrderDescription}</p>
          <label className="block space-y-1">
            <span className="text-sm font-medium">{messages.cancelWorkOrderReason}</span>
            <Textarea
              aria-label={messages.cancelWorkOrderReason}
              value={cancelReason}
              onChange={(event) => { setCancelReason(event.target.value); setDialogError(null); }}
              maxLength={1000}
              required
            />
            <span className="text-xs text-muted-foreground">{messages.cancelWorkOrderReasonHelp}</span>
          </label>
          {dialogError ? <p className="text-sm font-medium text-destructive-text" role="alert">{dialogError}</p> : null}
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" disabled={Boolean(pendingAction)} onClick={closeDialog}>{messages.cancel}</Button>
            <Button type="submit" variant="destructive" className="flex-1" disabled={Boolean(pendingAction)}>{messages.cancelWorkOrderConfirm}</Button>
          </div>
        </form>
      </Modal>
    ) : null}

    {dialog === 'reopen' && canReopenWorkOrder ? (
      <Modal open title={messages.reopenWorkOrderTitle} closeLabel={messages.closeDialog} onClose={closeDialog}>
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
          <p className="text-sm text-muted-foreground">{messages.reopenWorkOrderDescription}</p>
          <label className="block space-y-1">
            <span className="text-sm font-medium">{messages.reopenWorkOrderReason}</span>
            <Textarea
              aria-label={messages.reopenWorkOrderReason}
              value={reopenReason}
              onChange={(event) => { setReopenReason(event.target.value); setDialogError(null); }}
              maxLength={1000}
              required
            />
            <span className="text-xs text-muted-foreground">{messages.reopenWorkOrderReasonHelp}</span>
          </label>
          {dialogError ? <p className="text-sm font-medium text-destructive-text" role="alert">{dialogError}</p> : null}
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" disabled={Boolean(pendingAction)} onClick={closeDialog}>{messages.cancel}</Button>
            <Button type="submit" className="flex-1" disabled={Boolean(pendingAction)}>{messages.reopenWorkOrderConfirm}</Button>
          </div>
        </form>
      </Modal>
    ) : null}

    {dialog === 'return' && canReturnToService ? (
      <Modal open title={messages.returnToServiceTitle} closeLabel={messages.closeDialog} onClose={closeDialog}>
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
          <p className="text-sm text-muted-foreground">{messages.returnToServiceDescription}</p>
          <label className="block space-y-1">
            <span className="text-sm font-medium">{messages.returnToServiceReason}</span>
            <Textarea
              aria-label={messages.returnToServiceReason}
              value={returnReason}
              onChange={(event) => setReturnReason(event.target.value)}
              maxLength={1000}
            />
            <span className="text-xs text-muted-foreground">{messages.returnToServiceReasonHelp}</span>
          </label>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" disabled={Boolean(pendingAction)} onClick={closeDialog}>{messages.cancel}</Button>
            <Button type="submit" className="flex-1" disabled={Boolean(pendingAction)}>{messages.returnToServiceConfirm}</Button>
          </div>
        </form>
      </Modal>
    ) : null}

    {showStickyComplete ? (
      <div
        role="region"
        aria-label={messages.completeWorkOrderTitle}
        className="fixed inset-x-0 bottom-0 z-30 border-t border-shop-accent/40 bg-card px-4 py-3 shadow-soft app-safe-bottom md:left-[var(--admin-aside)]"
        data-testid="admin-wo-next-action"
      >
        <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium">{messages.readyToCloseHint}</p>
          <CompleteWorkOrderButton
            messages={messages}
            pending={Boolean(pendingAction)}
            onConfirm={() => void runMutation('complete', messages.completeWorkOrderSuccess, () => completeAdminWorkOrder(data.id, data.version), (failure) => completeError(failure, messages))}
          />
        </div>
      </div>
    ) : null}
  </div>;
}

function CompleteWorkOrderButton({
  messages,
  pending,
  onConfirm,
}: {
  messages: AdminMessages;
  pending: boolean;
  onConfirm: () => void;
}) {
  return (
    <Button
      type="button"
      className="min-h-11 w-full sm:w-auto"
      disabled={pending}
      onClick={onConfirm}
    >
      {messages.completeWorkOrderConfirm}
    </Button>
  );
}

function cancelError(errorValue: unknown, messages: AdminMessages) {
  if (errorValue instanceof ApiError) {
    if (errorValue.status === 400) return messages.cancelWorkOrderBadRequest;
    if (errorValue.status === 409) return messages.assignmentConflict;
  }
  return messages.cancelWorkOrderGenericError;
}
function completeError(errorValue: unknown, messages: AdminMessages) {
  if (errorValue instanceof ApiError) {
    if (errorValue.status === 400) return messages.completeWorkOrderBadRequest;
    if (errorValue.status === 409) return messages.assignmentConflict;
  }
  return messages.completeWorkOrderGenericError;
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
/** LTR-186: why the app closed a labor segment — the day close (D20) or a Truck switch (D21). */
function laborEndLabel(endReason: string | null | undefined, messages: AdminMessages) {
  if (endReason === 'day_close') return messages.laborEndDayClose;
  if (endReason === 'switched_truck') return messages.laborEndSwitchedTruck;
  return null;
}
/** LTR-186: each mechanic's labor segments with a discreet "day close" / "switched truck" next to the end. */
function LaborSegments({ data, locale, messages }: { data: AdminWorkOrderDetailDto; locale: AdminLocale; messages: AdminMessages }) {
  const sessions = data.laborSessions ?? [];
  if (!sessions.length) return null;
  return (
    <div className="mt-4" data-testid="labor-segments">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{messages.laborSessions}</p>
      <ul className="mt-2 divide-y text-sm">
        {sessions.map((session) => {
          const label = laborEndLabel(session.endReason, messages);
          return (
            <li key={session.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2">
              <span className="min-w-0">{session.mechanic?.name ?? messages.laborUnattributed}</span>
              <span className="text-muted-foreground">
                {formatAdminDate(session.startedAt, locale)} → {session.endedAt ? formatAdminDate(session.endedAt, locale) : messages.laborSessionRunning}
                {label ? <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs" data-testid="labor-end-reason">{label}</span> : null}
                {session.durationMs !== null ? ` · ${formatDuration(session.durationMs)}` : ''}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
function closedTimeSegments(data: AdminWorkOrderDetailDto) {
  const sessions = (data.laborSessions ?? [])
    .filter((session) => session.endedAt)
    .map((session) => ({ ...session, targetType: 'work_session' as const, endedAt: session.endedAt!, mechanic: session.mechanic ?? null }));
  const pauses = data.pauseHistory
    .filter((pause) => pause.endedAt && pause.isOfficialPause !== false)
    .map((pause) => ({ id: pause.id, startedAt: pause.startedAt, endedAt: pause.endedAt!, targetType: 'pause_event' as const, mechanic: null, endReason: null }));
  return [...sessions, ...pauses];
}
function toDatetimeLocal(value: string) {
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function fromDatetimeLocal(value: string) {
  return new Date(value).toISOString();
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
function Info({ label, value }: { label: string; value: string }) { return <div><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 font-medium">{value}</dd></div>; }
function formatAge(value: string, locale: AdminLocale) { const elapsed = Math.max(0, Date.now() - new Date(value).getTime()); const hours = Math.floor(elapsed / 3_600_000); const number = new Intl.NumberFormat(intlLocale(locale)); if (hours < 24) return `${number.format(hours)}h`; const days = Math.floor(hours / 24); return `${number.format(days)}d ${number.format(hours % 24)}h`; }
function Pause({ pause, locale, messages }: { pause: { reason: string; notes: string | null; startedAt: string; endedAt: string | null; durationMs: number | null }; locale: AdminLocale; messages: AdminMessages }) { return <div><p className="font-medium">{adminPauseReasonLabel(pause.reason, messages)}</p><p className="text-sm text-muted-foreground">{formatAdminDate(pause.startedAt, locale)} → {formatAdminDate(pause.endedAt, locale)}{pause.durationMs !== null ? ` · ${formatDuration(pause.durationMs)}` : ''}</p>{pause.notes ? <p className="mt-1 text-sm">{pause.notes}</p> : null}</div>; }
function NotFound({ messages }: { messages: AdminMessages }) { return <EmptyState><p>{messages.workOrderNotFound}</p><Button asChild variant="outline" className="mt-4"><Link href="/admin/work-orders">{messages.backToWorkOrders}</Link></Button></EmptyState>; }
