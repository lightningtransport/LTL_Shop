'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AppCapability, OPEN_WORK_ORDER_STATUSES, PauseReason, Priority, type AdminWorkOrderDetailDto } from '@ltl-shop/shared';
import { ApiError } from '@/lib/api';
import { formatAdminDate, formatAdminDateOnly, formatDuration, humanize } from '@/lib/admin-format';
import { addAdminWorkOrderJob, addAdminWorkOrderMechanic, assignAdminWorkOrderJob, cancelAdminJob, cancelAdminWorkOrder, completeAdminWorkOrder, correctAdminTime, patchAdminWorkOrder, pauseAdminWorkOrder, removeAdminWorkOrderMechanic, reopenAdminJob, reopenAdminWorkOrder, resumeAdminWorkOrder, returnAdminWorkOrderToService, unassignAdminWorkOrderJob, useAdminMechanics, useAdminRepairHistory, useAdminWorkOrder } from '@/lib/admin-data';
import { adminPauseReasonLabel, type AdminLocale, type AdminMessages } from '@/lib/admin-messages';
import { useAuth } from '@/lib/auth-context';
import { useCategories } from '@/lib/shop-data';
import { JobPickerDialog } from './job-picker-dialog';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CompactEmpty,
  EmptyState,
  LoadFailure,
  PageSkeleton,
  PriorityBadge,
  Input,
  Select,
  Textarea,
} from './ui';

export function AdminWorkOrderDetail({ id, locale, messages }: { id: string; locale: AdminLocale; messages: AdminMessages }) {
  const { user } = useAuth();
  const { data, error, isLoading, mutate } = useAdminWorkOrder(id);
  const canManageWorkOrders = !!user?.capabilities.includes(AppCapability.WORK_ORDERS_MANAGE);
  const [addJobOpen, setAddJobOpen] = useState(false);
  const [historyCategory, setHistoryCategory] = useState('');
  const [selectedMechanic, setSelectedMechanic] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [reopenReason, setReopenReason] = useState('');
  const [returnReason, setReturnReason] = useState('');
  const [jobReason, setJobReason] = useState('');
  const [pauseReason, setPauseReason] = useState<PauseReason>(PauseReason.WAITING_FOR_PARTS);
  const [assignDrafts, setAssignDrafts] = useState<Record<string, string>>({});
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
  const { data: mechanicPages } = useAdminMechanics('');
  const assignableMechanics = useMemo(
    () => (mechanicPages?.flatMap((page) => page.items) ?? []).filter((mechanic) => mechanic.active && mechanic.capabilities.includes(AppCapability.MECHANIC_STANDARD)),
    [mechanicPages],
  );

  useEffect(() => {
    if (!data) return;
    setDraftPriority(data.priority);
    setDraftNotes(data.notes ?? '');
  }, [data]);

  if (isLoading) return <PageSkeleton label={messages.workOrdersTitle} />;
  if (error instanceof ApiError && error.status === 404) return <NotFound messages={messages} />;
  if (error || !data) return <LoadFailure message={messages.loadError} retryLabel={messages.retry} onRetry={() => void mutate()} />;

  const historyItems = historyQuery.data?.flatMap((page) => page.items) ?? [];
  const historyHasMore = Boolean(historyQuery.data?.[historyQuery.data.length - 1]?.nextCursor);
  const values = categoryData ?? [data.category, ...data.jobs.map((job) => job.category)];
  const categories = values.filter((category, index) => values.findIndex((candidate) => candidate.id === category.id) === index);
  const activeMechanics = data.mechanics.filter((mechanic) => !mechanic.removedAt);
  const truck = data.truck;
  const isOpen = (OPEN_WORK_ORDER_STATUSES as string[]).includes(data.status);
  const canManageAssignments = canManageWorkOrders && isOpen && data.category.name !== 'PM';
  const canCancelWorkOrder = canManageWorkOrders && isOpen;
  const canCompleteWorkOrder = canManageWorkOrders && data.status === 'in_progress';
  const canReopenWorkOrder = data.status === 'completed' || data.status === 'cancelled';
  const canReturnToService = data.status === 'completed' && !data.returnedToServiceAt;
  const canManageJobs = canManageWorkOrders && isOpen && data.category.name !== 'PM';
  const canReopenJob = isOpen && data.category.name !== 'PM';
  const canEditFields = canManageWorkOrders && isOpen;
  const canOfficialPause = canManageWorkOrders && isOpen && data.category.name !== 'PM';
  const hasIncompleteJobs = data.category.name !== 'PM' && data.jobs.some((job) => job.status === 'to_do');
  const availableMechanics = assignableMechanics.filter((mechanic) => !activeMechanics.some((assigned) => assigned.mechanicId === mechanic.id));

  async function runMutation(action: string, successMessage: string, operation: () => Promise<unknown>, onError: (failure: unknown) => string) {
    if (pendingAction) return;
    setPendingAction(action);
    setFeedback(null);
    try {
      await operation();
      await mutate();
      setFeedback({ kind: 'success', message: successMessage });
    } catch (failure) {
      setFeedback({ kind: 'error', message: onError(failure) });
    } finally {
      setPendingAction(null);
    }
  }

  return <div className="space-y-5">
    <header>
      <Button asChild variant="ghost" size="sm" className="mb-3"><Link href="/admin/work-orders">← {messages.backToWorkOrders}</Link></Button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="section-label">{messages.eyebrow}</p><h1 className="mt-2 font-display text-3xl font-bold">{data.displayId}</h1><p className="mt-2 text-muted-foreground"><Link className="text-primary hover:underline" href={`/admin/trucks/${truck.id}`}>{truck.truckNumber}</Link> · {data.category.name}</p><p className="mt-1 text-xs text-muted-foreground">{messages.updated}: {formatAdminDate(data.updatedAt, locale)}</p></div>
        <div className="flex gap-2"><PriorityBadge priority={data.priority} /><Badge variant="outline">{humanize(data.status)}</Badge></div>
      </div>
    </header>
    {feedback ? <p className={feedback.kind === 'error' ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'} role="status">{feedback.message}</p> : null}

    <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]" aria-label={messages.operationalSummary}>
      <Card>
        <CardHeader><CardTitle>{messages.operationalSummary}</CardTitle><CardDescription>{messages.operationalSummaryDescription}</CardDescription></CardHeader>
        <CardContent><dl className="grid gap-4 sm:grid-cols-2">
          <Info label={messages.status} value={humanize(data.status)} />
          <Info label={messages.priority} value={humanize(data.priority)} />
          <Info label={messages.age} value={formatAge(data.createdAt, locale)} />
          <Info label={messages.progress} value={`${data.jobsCompleted}/${data.jobsTotal}`} />
          <Info label={messages.mechanicsLabel} value={activeMechanics.map((mechanic) => mechanic.mechanicName).join(', ') || messages.noValue} />
          <Info label={messages.currentPause} value={data.currentPause ? `${adminPauseReasonLabel(data.currentPause.reason, messages)} · ${formatAdminDate(data.currentPause.startedAt, locale)}` : messages.noCurrentPause} />
          <Info label={messages.latestReportedBlocker} value={data.latestReportedBlocker ? `${adminPauseReasonLabel(data.latestReportedBlocker.reason, messages)}${data.latestReportedBlocker.reportedBy ? ` · ${data.latestReportedBlocker.reportedBy.name}` : ''}` : messages.noLatestReportedBlocker} />
        </dl></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>{messages.truckDetails}</CardTitle></CardHeader>
        <CardContent><dl className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
          <Info label={messages.truck} value={truck.truckNumber} />
          <Info label={messages.make} value={truck.make ?? messages.noValue} />
          <Info label={messages.model} value={truck.model ?? messages.noValue} />
          <Info label={messages.year} value={truck.year ? String(truck.year) : messages.noValue} />
          <Info label={messages.mileage} value={truck.mileage === null ? messages.noValue : new Intl.NumberFormat(locale === 'es' ? 'es-US' : 'en-US').format(truck.mileage)} />
          <Info label={messages.company} value={truck.company ?? messages.noValue} />
          <Info label={messages.owner} value={truck.owner ?? messages.noValue} />
          <Info label={messages.vin} value={truck.vin ?? messages.noValue} />
          <Info label={messages.lastReportedLocation} value={truck.location ?? messages.noValue} />
          <Info label={messages.locationUpdatedOn} value={formatAdminDateOnly(truck.locationUpdatedOn, locale)} />
        </dl></CardContent>
      </Card>
    </section>

    <Card>
      <CardHeader>
        <CardTitle>{messages.assignmentsTitle}</CardTitle>
        <CardDescription>{canManageAssignments ? messages.assignmentsDescription : data.category.name === 'PM' ? messages.pmAssignmentsLocked : messages.closedAssignmentsLocked}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {activeMechanics.length ? (
          <ul className="divide-y rounded-xl border">
            {activeMechanics.map((mechanic) => (
              <li key={mechanic.mechanicId} className="flex min-h-11 items-center justify-between gap-3 px-3 py-2">
                <p className="font-medium">{mechanic.mechanicName}</p>
                {canManageAssignments ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={Boolean(pendingAction) || activeMechanics.length <= 1}
                    onClick={() => void runMutation(`remove:${mechanic.mechanicId}`, messages.assignmentRemoved, () => removeAdminWorkOrderMechanic(data.id, mechanic.mechanicId, data.version), (failure) => assignmentError(failure, messages))}
                  >
                    {messages.removeMechanic}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : <EmptyState>{messages.noMechanics}</EmptyState>}
        {canManageAssignments ? (
          <form
            className="flex flex-col gap-3 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              if (!selectedMechanic) return;
              void runMutation('add', messages.assignmentAdded, async () => {
                await addAdminWorkOrderMechanic(data.id, { mechanicId: selectedMechanic, expectedVersion: data.version });
                setSelectedMechanic('');
              }, (failure) => assignmentError(failure, messages));
            }}
          >
            <Select aria-label={messages.selectMechanic} value={selectedMechanic} onChange={(event) => setSelectedMechanic(event.target.value)}>
              <option value="">{messages.selectMechanic}</option>
              {availableMechanics.map((mechanic) => (
                <option key={mechanic.id} value={mechanic.id}>{mechanic.name}</option>
              ))}
            </Select>
            <Button type="submit" disabled={!selectedMechanic || Boolean(pendingAction)}>{messages.addMechanic}</Button>
          </form>
        ) : null}
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>{messages.reportedBlockers}</CardTitle>
        <CardDescription>{messages.reportedBlockersDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        {(data.reportedBlockers ?? []).length ? (
          <ul className="divide-y">
            {(data.reportedBlockers ?? []).map((blocker) => (
              <li key={blocker.id} className="py-3 first:pt-0">
                <Pause pause={blocker} locale={locale} messages={messages} />
                <p className="mt-1 text-xs text-muted-foreground">{blocker.reportedBy?.name ?? blocker.createdBy.name}</p>
              </li>
            ))}
          </ul>
        ) : <CompactEmpty>{messages.noReportedBlockers}</CompactEmpty>}
      </CardContent>
    </Card>

    {canOfficialPause ? (
      <Card>
        <CardHeader>
          <CardTitle>{data.status === 'waiting_paused' ? messages.resumeWorkOrderAction : messages.pauseWorkOrderAction}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.status === 'waiting_paused' ? (
            <Button
              type="button"
              disabled={Boolean(pendingAction)}
              onClick={() => void runMutation('resume-wo', messages.resumeWorkOrderSuccess, () => resumeAdminWorkOrder(data.id), (failure) => assignmentError(failure, messages))}
            >
              {messages.resumeWorkOrderAction}
            </Button>
          ) : (
            <form
              className="flex flex-col gap-3 sm:flex-row"
              onSubmit={(event) => {
                event.preventDefault();
                void runMutation('pause-wo', messages.pauseWorkOrderSuccess, () => pauseAdminWorkOrder(data.id, { reason: pauseReason }), (failure) => assignmentError(failure, messages));
              }}
            >
              <Select aria-label={messages.pauseReasonLabel} value={pauseReason} onChange={(event) => setPauseReason(event.target.value as PauseReason)}>
                {Object.values(PauseReason).map((reason) => (
                  <option key={reason} value={reason}>{adminPauseReasonLabel(reason, messages)}</option>
                ))}
              </Select>
              <Button type="submit" disabled={Boolean(pendingAction)}>{messages.pauseWorkOrderAction}</Button>
            </form>
          )}
        </CardContent>
      </Card>
    ) : null}

    {canCompleteWorkOrder ? (
      <Card>
        <CardHeader>
          <CardTitle>{messages.completeWorkOrderTitle}</CardTitle>
          <CardDescription>{messages.completeWorkOrderDescription}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.category.name === 'PM' ? <p className="text-sm text-muted-foreground">{messages.completeWorkOrderPmHelp}</p> : null}
          {hasIncompleteJobs ? <p className="text-sm text-destructive">{messages.completeWorkOrderIncompleteJobs}</p> : null}
          <Button
            type="button"
            disabled={Boolean(pendingAction) || hasIncompleteJobs}
            onClick={() => void runMutation('complete', messages.completeWorkOrderSuccess, () => completeAdminWorkOrder(data.id, data.version), (failure) => completeError(failure, messages))}
          >
            {messages.completeWorkOrderConfirm}
          </Button>
        </CardContent>
      </Card>
    ) : null}

    {canCancelWorkOrder ? (
      <Card>
        <CardHeader>
          <CardTitle>{messages.cancelWorkOrderTitle}</CardTitle>
          <CardDescription>{messages.cancelWorkOrderDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              const reason = cancelReason.trim();
              if (!reason) {
                setFeedback({ kind: 'error', message: messages.cancelWorkOrderReasonRequired });
                return;
              }
              void runMutation('cancel', messages.cancelWorkOrderSuccess, async () => {
                await cancelAdminWorkOrder(data.id, { reason, expectedVersion: data.version });
                setCancelReason('');
              }, (failure) => cancelError(failure, messages));
            }}
          >
            <label className="block space-y-1">
              <span className="text-sm font-medium">{messages.cancelWorkOrderReason}</span>
              <Textarea
                aria-label={messages.cancelWorkOrderReason}
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                maxLength={1000}
                required
              />
              <span className="text-xs text-muted-foreground">{messages.cancelWorkOrderReasonHelp}</span>
            </label>
            <Button type="submit" variant="destructive" disabled={Boolean(pendingAction)}>
              {messages.cancelWorkOrderConfirm}
            </Button>
          </form>
      </CardContent>
    </Card>
    ) : null}

    {data.status === 'completed' ? (
      <Card>
        <CardHeader>
          <CardTitle>{messages.returnToServiceTitle}</CardTitle>
          <CardDescription>{messages.returnToServiceDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          {canReturnToService ? (
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                const reason = returnReason.trim();
                if (!reason) {
                  setFeedback({ kind: 'error', message: messages.returnToServiceReasonRequired });
                  return;
                }
                void runMutation('return-to-service', messages.returnToServiceSuccess, async () => {
                  await returnAdminWorkOrderToService(data.id, { reason, expectedVersion: data.version });
                  setReturnReason('');
                }, (failure) => returnToServiceError(failure, messages));
              }}
            >
              <label className="block space-y-1">
                <span className="text-sm font-medium">{messages.returnToServiceReason}</span>
                <Textarea
                  aria-label={messages.returnToServiceReason}
                  value={returnReason}
                  onChange={(event) => setReturnReason(event.target.value)}
                  maxLength={1000}
                  required
                />
                <span className="text-xs text-muted-foreground">{messages.returnToServiceReasonHelp}</span>
              </label>
              <Button type="submit" disabled={Boolean(pendingAction)}>
                {messages.returnToServiceConfirm}
              </Button>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">
              {messages.returnToServiceAlready}
              {data.returnedToServiceAt ? ` ${formatAdminDate(data.returnedToServiceAt, locale)}` : ''}
            </p>
          )}
        </CardContent>
      </Card>
    ) : null}

    {canReopenWorkOrder ? (
      <Card>
        <CardHeader>
          <CardTitle>{messages.reopenWorkOrderTitle}</CardTitle>
          <CardDescription>{messages.reopenWorkOrderDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              const reason = reopenReason.trim();
              if (!reason) {
                setFeedback({ kind: 'error', message: messages.reopenWorkOrderReasonRequired });
                return;
              }
              void runMutation('reopen', messages.reopenWorkOrderSuccess, async () => {
                await reopenAdminWorkOrder(data.id, { reason, expectedVersion: data.version });
                setReopenReason('');
              }, (failure) => reopenError(failure, messages));
            }}
          >
            <label className="block space-y-1">
              <span className="text-sm font-medium">{messages.reopenWorkOrderReason}</span>
              <Textarea
                aria-label={messages.reopenWorkOrderReason}
                value={reopenReason}
                onChange={(event) => setReopenReason(event.target.value)}
                maxLength={1000}
                required
              />
              <span className="text-xs text-muted-foreground">{messages.reopenWorkOrderReasonHelp}</span>
            </label>
            <Button type="submit" disabled={Boolean(pendingAction)}>
              {messages.reopenWorkOrderConfirm}
            </Button>
          </form>
        </CardContent>
      </Card>
    ) : null}

    {canEditFields ? (
      <Card>
        <CardHeader>
          <CardTitle>{messages.fieldUpdatesTitle}</CardTitle>
          <CardDescription>
            {data.category.name === 'PM' ? `${messages.fieldUpdatesDescription} ${messages.fieldUpdatesPmPriorityLocked}` : messages.fieldUpdatesDescription}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void runMutation('fields', messages.fieldUpdatesSuccess, async () => {
                await patchAdminWorkOrder(data.id, {
                  expectedVersion: data.version,
                  priority: draftPriority,
                  notes: draftNotes.trim() || null,
                });
              }, (failure) => fieldUpdateError(failure, messages));
            }}
          >
            <label className="block space-y-1">
              <span className="text-sm font-medium">{messages.priority}</span>
              <Select
                aria-label={messages.priority}
                value={draftPriority}
                disabled={data.category.name === 'PM' || Boolean(pendingAction)}
                onChange={(event) => setDraftPriority(event.target.value as Priority)}
              >
                <option value={Priority.LOW}>{messages.lowPriority}</option>
                <option value={Priority.NORMAL}>{messages.normalPriority}</option>
                <option value={Priority.HIGH}>{messages.highPriority}</option>
                <option value={Priority.CRITICAL}>{messages.criticalPriority}</option>
              </Select>
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-medium">{messages.notes}</span>
              <Textarea
                aria-label={messages.workOrderNotes}
                value={draftNotes}
                onChange={(event) => setDraftNotes(event.target.value)}
                maxLength={2000}
              />
            </label>
            <Button type="submit" disabled={Boolean(pendingAction)}>
              {messages.updatePriorityAndNotes}
            </Button>
          </form>
        </CardContent>
      </Card>
    ) : (
      <Card><CardHeader><CardTitle>{messages.notes}</CardTitle></CardHeader><CardContent>{data.notes ? <p className="whitespace-pre-wrap text-sm">{data.notes}</p> : <CompactEmpty>{messages.noNotes}</CompactEmpty>}</CardContent></Card>
    )}

    <Card>
      <CardHeader>
        <CardTitle>{messages.jobs} ({data.jobsCompleted}/{data.jobsTotal})</CardTitle>
        <CardDescription>
          {canManageJobs ? messages.jobsDescription : data.category.name === 'PM' ? messages.jobsPmLocked : messages.jobsClosedLocked}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.jobs.length ? (
          <ul className="divide-y">
            {data.jobs.map((job) => (
              <li key={job.id} className="flex flex-col gap-3 py-3 first:pt-0 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-medium">{job.displayName}</p>
                  <p className="text-xs text-muted-foreground">{job.category.name}</p>
                  {job.customDescription ? <p className="mt-1 text-sm text-muted-foreground">{job.customDescription}</p> : null}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {job.assignedMechanic
                      ? `${messages.jobAssignee}: ${job.assignedMechanic.name}`
                      : messages.jobUnassignedInheritsTeam}
                  </p>
                  {canManageJobs && job.status !== 'cancelled' ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {job.assignedMechanic ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={Boolean(pendingAction)}
                          onClick={() => {
                            void runMutation(`unassign-job-${job.id}`, messages.unassignJobSuccess, async () => {
                              await unassignAdminWorkOrderJob(id, job.id, data.version);
                            }, (failure) => jobChangeError(failure, messages));
                          }}
                        >
                          {messages.unassignJobAction}
                        </Button>
                      ) : (
                        <>
                          <Select
                            aria-label={messages.assignJobPlaceholder}
                            className="w-48"
                            value={assignDrafts[job.id] ?? ''}
                            onChange={(event) => setAssignDrafts((prev) => ({ ...prev, [job.id]: event.target.value }))}
                          >
                            <option value="">{messages.assignJobPlaceholder}</option>
                            {assignableMechanics.map((mechanic) => (
                              <option key={mechanic.id} value={mechanic.id}>{mechanic.name}</option>
                            ))}
                          </Select>
                          <Button
                            type="button"
                            size="sm"
                            disabled={Boolean(pendingAction) || !assignDrafts[job.id]}
                            onClick={() => {
                              const mechanicId = assignDrafts[job.id];
                              if (!mechanicId) return;
                              void runMutation(`assign-job-${job.id}`, messages.assignJobSuccess, async () => {
                                await assignAdminWorkOrderJob(id, job.id, { mechanicId, expectedVersion: data.version });
                                setAssignDrafts((prev) => ({ ...prev, [job.id]: '' }));
                              }, (failure) => jobChangeError(failure, messages));
                            }}
                          >
                            {messages.assignJobAction}
                          </Button>
                        </>
                      )}
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={job.status === 'completed' ? 'success' : 'outline'}>{humanize(job.status)}</Badge>
                  {canManageJobs && job.status === 'to_do' ? (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={Boolean(pendingAction)}
                      onClick={() => {
                        const reason = jobReason.trim();
                        if (!reason) {
                          setFeedback({ kind: 'error', message: messages.jobChangeReasonRequired });
                          return;
                        }
                        void runMutation(`cancel-job-${job.id}`, messages.cancelJobSuccess, async () => {
                          await cancelAdminJob(job.id, { reason, expectedVersion: data.version });
                          setJobReason('');
                        }, (failure) => jobChangeError(failure, messages));
                      }}
                    >
                      {messages.cancelJobConfirm}
                    </Button>
                  ) : null}
                  {canReopenJob && job.status === 'cancelled' ? (
                    <Button
                      type="button"
                      size="sm"
                      disabled={Boolean(pendingAction)}
                      onClick={() => {
                        const reason = jobReason.trim();
                        if (!reason) {
                          setFeedback({ kind: 'error', message: messages.jobChangeReasonRequired });
                          return;
                        }
                        void runMutation(`reopen-job-${job.id}`, messages.reopenJobSuccess, async () => {
                          await reopenAdminJob(job.id, { reason, expectedVersion: data.version });
                          setJobReason('');
                        }, (failure) => jobChangeError(failure, messages));
                      }}
                    >
                      {messages.reopenJobConfirm}
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState>{messages.noJobs}</EmptyState>
        )}
        {canManageJobs ? (
          <Button type="button" variant="outline" onClick={() => setAddJobOpen(true)}>
            {messages.addJobAction}
          </Button>
        ) : null}
        {canManageJobs || canReopenJob ? (
          <label className="block space-y-1">
            <span className="text-sm font-medium">{messages.jobChangeReason}</span>
            <Textarea
              aria-label={messages.jobChangeReason}
              value={jobReason}
              onChange={(event) => setJobReason(event.target.value)}
              maxLength={1000}
            />
            <span className="text-xs text-muted-foreground">{messages.jobChangeReasonHelp}</span>
          </label>
        ) : null}
      </CardContent>
    </Card>

    <Card>
      <CardHeader className="gap-3 sm:flex sm:flex-row sm:items-start sm:justify-between"><div><CardTitle>{messages.recentRepairHistory}</CardTitle><CardDescription>{messages.repairHistoryDescription}</CardDescription></div><label className="w-full space-y-1 sm:w-56"><span className="text-xs font-medium text-muted-foreground">{messages.filterByCategory}</span><Select aria-label={messages.filterByCategory} value={historyCategory} onChange={(event) => setHistoryCategory(event.target.value)}><option value="">{messages.allCategories}</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</Select></label></CardHeader>
      <CardContent>{historyQuery.error ? <LoadFailure message={messages.repairHistoryLoadError} retryLabel={messages.retry} onRetry={() => void historyQuery.mutate()} /> : historyQuery.isLoading ? <p className="text-sm text-muted-foreground" role="status">{messages.loadingRepairHistory}…</p> : historyItems.length ? <><ul className="divide-y">{historyItems.map((item) => <li key={item.workOrderId} className="py-3 first:pt-0"><div className="flex flex-wrap items-start justify-between gap-2"><div><Link href={`/admin/work-orders/${item.workOrderId}`} className="font-semibold text-primary hover:underline">{item.displayId}</Link><p className="text-sm text-muted-foreground">{item.primaryCategoryName} · {formatAdminDate(item.date, locale)}</p></div>{item.mileage !== null ? <Badge variant="outline">{messages.mileage}: {new Intl.NumberFormat(locale === 'es' ? 'es-US' : 'en-US').format(item.mileage)}</Badge> : null}</div>{item.mechanicNames.length ? <p className="mt-1 text-sm text-muted-foreground">{messages.performedBy}: {item.mechanicNames.join(', ')}</p> : null}{item.jobDetails?.length ? <p className="mt-1 text-sm">{messages.repairJobs}: {item.jobDetails.map((job) => `${job.category.name}: ${job.displayName}`).join(' · ')}</p> : item.jobs?.length ? <p className="mt-1 text-sm">{messages.repairJobs}: {item.jobs.join(', ')}</p> : null}</li>)}</ul>{historyHasMore ? <Button variant="outline" className="mt-4 w-full" disabled={historyQuery.isValidating} onClick={() => void historyQuery.setSize(historyQuery.size + 1)}>{historyQuery.isValidating ? `${messages.loadMoreRepairs}…` : messages.loadMoreRepairs}</Button> : null}</> : <EmptyState>{messages.noRepairHistory}</EmptyState>}</CardContent>
    </Card>

    <Card><CardHeader><CardTitle>{messages.workOrderTimes}</CardTitle></CardHeader><CardContent><dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4"><Info label={messages.created} value={formatAdminDate(data.createdAt, locale)} /><Info label={messages.started} value={formatAdminDate(data.startedAt, locale)} /><Info label={messages.completed} value={formatAdminDate(data.completedAt, locale)} /><Info label={messages.updated} value={formatAdminDate(data.updatedAt, locale)} /><Info label={messages.activeLabor} value={formatDuration(data.totalActiveLaborMs)} /><Info label={messages.waitingTime} value={formatDuration(data.totalWaitingMs)} /></dl></CardContent></Card>
    <Card>
      <CardHeader>
        <CardTitle>{messages.timeCorrectionTitle}</CardTitle>
        <CardDescription>{messages.timeCorrectionDescription}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
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
                    {segment.targetType === 'work_session' ? messages.activeLabor : messages.waitingTime} · {formatAdminDate(segment.startedAt, locale)}
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
      </CardContent>
    </Card>
    <section className="grid gap-4 lg:grid-cols-2">
      <Card><CardHeader><CardTitle>{messages.currentPause}</CardTitle></CardHeader><CardContent>{data.currentPause ? <Pause pause={data.currentPause} locale={locale} messages={messages} /> : <CompactEmpty>{messages.noCurrentPause}</CompactEmpty>}</CardContent></Card>
      <Card><CardHeader><CardTitle>{messages.pauseHistory}</CardTitle></CardHeader><CardContent>{data.pauseHistory.length ? <ul className="divide-y">{data.pauseHistory.map((pause) => <li key={pause.id} className="py-3 first:pt-0"><Pause pause={pause} locale={locale} messages={messages} /><p className="mt-1 text-xs text-muted-foreground">{pause.createdBy.name}</p></li>)}</ul> : <CompactEmpty>{messages.noPauseHistory}</CompactEmpty>}</CardContent></Card>
    </section>
    <Card><CardHeader><CardTitle>{messages.activityLog}</CardTitle></CardHeader><CardContent>{data.activityLog.length ? <ol className="divide-y">{data.activityLog.map((entry) => <li key={entry.id} className="py-3 first:pt-0"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">{humanize(entry.eventType)}</p><time className="text-xs text-muted-foreground">{formatAdminDate(entry.createdAt, locale)}</time></div><p className="mt-1 text-sm text-muted-foreground">{entry.user.name} · {entry.entityType}</p>{activityValue(entry) !== null ? <pre className="mt-2 max-w-full overflow-x-auto rounded-lg bg-muted p-2 text-xs">{JSON.stringify(activityValue(entry))}</pre> : null}</li>)}</ol> : <CompactEmpty>{messages.noActivity}</CompactEmpty>}</CardContent></Card>
    {canManageJobs ? (
      <JobPickerDialog
        open={addJobOpen}
        defaultCategoryId={data.category.id}
        primaryCategoryName={data.category.name}
        categories={categoryData?.length ? categoryData : categories.map((category) => ({ ...category, sortOrder: 0 }))}
        existingCatalogJobIds={data.jobs
          .filter((job) => job.status !== 'cancelled' && job.catalogJobId)
          .map((job) => job.catalogJobId!)}
        existingCustomDisplayNames={data.jobs
          .filter((job) => job.status !== 'cancelled' && !job.catalogJobId)
          .map((job) => job.displayName)}
        messages={messages}
        onClose={() => setAddJobOpen(false)}
        onAdd={async (body) => {
          await runMutation('add-job', messages.addJobSuccess, () => addAdminWorkOrderJob(data.id, {
            ...body,
            expectedVersion: data.version,
          }), () => messages.addJobFailed);
          setAddJobOpen(false);
        }}
      />
    ) : null}
  </div>;
}

function assignmentError(errorValue: unknown, messages: AdminMessages) {
  if (errorValue instanceof ApiError) {
    if (errorValue.status === 400) return messages.assignmentBadRequest;
    if (errorValue.status === 409) return messages.assignmentConflict;
  }
  return messages.assignmentGenericError;
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
function closedTimeSegments(data: AdminWorkOrderDetailDto) {
  const sessions = (data.laborSessions ?? [])
    .filter((session) => session.endedAt)
    .map((session) => ({ ...session, targetType: 'work_session' as const, endedAt: session.endedAt! }));
  const pauses = data.pauseHistory
    .filter((pause) => pause.endedAt && pause.isOfficialPause !== false)
    .map((pause) => ({ id: pause.id, startedAt: pause.startedAt, endedAt: pause.endedAt!, targetType: 'pause_event' as const }));
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
  if (errorValue instanceof ApiError) {
    if (errorValue.status === 400) return messages.jobChangeBadRequest;
    if (errorValue.status === 409) return messages.assignmentConflict;
  }
  return messages.jobChangeGenericError;
}
function activityValue(entry: AdminWorkOrderDetailDto['activityLog'][number]) {
  if (entry.relevantValue !== null && entry.relevantValue !== undefined) return entry.relevantValue;
  if (entry.newValue !== null && entry.newValue !== undefined) return entry.newValue;
  return null;
}
function Info({ label, value }: { label: string; value: string }) { return <div><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 font-medium">{value}</dd></div>; }
function formatAge(value: string, locale: AdminLocale) { const elapsed = Math.max(0, Date.now() - new Date(value).getTime()); const hours = Math.floor(elapsed / 3_600_000); const number = new Intl.NumberFormat(locale === 'es' ? 'es-US' : 'en-US'); if (hours < 24) return `${number.format(hours)}h`; const days = Math.floor(hours / 24); return `${number.format(days)}d ${number.format(hours % 24)}h`; }
function Pause({ pause, locale, messages }: { pause: { reason: string; notes: string | null; startedAt: string; endedAt: string | null; durationMs: number | null }; locale: AdminLocale; messages: AdminMessages }) { return <div><p className="font-medium">{adminPauseReasonLabel(pause.reason, messages)}</p><p className="text-sm text-muted-foreground">{formatAdminDate(pause.startedAt, locale)} → {formatAdminDate(pause.endedAt, locale)}{pause.durationMs !== null ? ` · ${formatDuration(pause.durationMs)}` : ''}</p>{pause.notes ? <p className="mt-1 text-sm">{pause.notes}</p> : null}</div>; }
function NotFound({ messages }: { messages: AdminMessages }) { return <EmptyState><p>{messages.workOrderNotFound}</p><Button asChild variant="outline" className="mt-4"><Link href="/admin/work-orders">{messages.backToWorkOrders}</Link></Button></EmptyState>; }
