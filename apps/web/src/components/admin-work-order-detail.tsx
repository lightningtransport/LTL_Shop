'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { AppCapability, OPEN_WORK_ORDER_STATUSES } from '@ltl-shop/shared';
import { ApiError } from '@/lib/api';
import { formatAdminDate, formatDuration, humanize } from '@/lib/admin-format';
import { addAdminWorkOrderMechanic, cancelAdminWorkOrder, completeAdminWorkOrder, removeAdminWorkOrderMechanic, reopenAdminWorkOrder, useAdminMechanics, useAdminRepairHistory, useAdminWorkOrder } from '@/lib/admin-data';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';
import { useCategories } from '@/lib/shop-data';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  LoadFailure,
  PageSkeleton,
  PriorityBadge,
  Select,
  Textarea,
} from './ui';

export function AdminWorkOrderDetail({ id, locale, messages }: { id: string; locale: AdminLocale; messages: AdminMessages }) {
  const { data, error, isLoading, mutate } = useAdminWorkOrder(id);
  const [historyCategory, setHistoryCategory] = useState('');
  const [selectedMechanic, setSelectedMechanic] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [reopenReason, setReopenReason] = useState('');
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const { data: categoryData } = useCategories(true);
  const historyQuery = useAdminRepairHistory(data?.truck.id ?? '', id, historyCategory || undefined);
  const { data: mechanicPages } = useAdminMechanics('');
  const assignableMechanics = useMemo(
    () => (mechanicPages?.flatMap((page) => page.items) ?? []).filter((mechanic) => mechanic.active && mechanic.capabilities.includes(AppCapability.MECHANIC_STANDARD)),
    [mechanicPages],
  );

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
  const canManageAssignments = isOpen && data.category.name !== 'PM';
  const canCancelWorkOrder = isOpen;
  const canCompleteWorkOrder = data.status === 'in_progress';
  const canReopenWorkOrder = data.status === 'completed' || data.status === 'cancelled';
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
        <div><p className="section-label">{messages.readOnly}</p><h1 className="mt-2 font-display text-3xl font-bold">{data.displayId}</h1><p className="mt-2 text-muted-foreground"><Link className="text-primary hover:underline" href={`/admin/trucks/${truck.id}`}>{truck.truckNumber}</Link> · {data.category.name}</p><p className="mt-1 text-xs text-muted-foreground">{messages.updated}: {formatAdminDate(data.updatedAt, locale)}</p></div>
        <div className="flex gap-2"><PriorityBadge priority={data.priority} /><Badge variant="outline">{humanize(data.status)}</Badge></div>
      </div>
    </header>

    <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]" aria-label={messages.operationalSummary}>
      <Card>
        <CardHeader><CardTitle>{messages.operationalSummary}</CardTitle><CardDescription>{messages.operationalSummaryDescription}</CardDescription></CardHeader>
        <CardContent><dl className="grid gap-4 sm:grid-cols-2">
          <Info label={messages.status} value={humanize(data.status)} />
          <Info label={messages.priority} value={humanize(data.priority)} />
          <Info label={messages.age} value={formatAge(data.createdAt, locale)} />
          <Info label={messages.progress} value={`${data.jobsCompleted}/${data.jobsTotal}`} />
          <Info label={messages.mechanicsLabel} value={activeMechanics.map((mechanic) => mechanic.mechanicName).join(', ') || messages.noValue} />
          <Info label={messages.currentPause} value={data.currentPause ? `${humanize(data.currentPause.reason)} · ${formatAdminDate(data.currentPause.startedAt, locale)}` : messages.noCurrentPause} />
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
        </dl></CardContent>
      </Card>
    </section>

    <Card>
      <CardHeader>
        <CardTitle>{messages.assignmentsTitle}</CardTitle>
        <CardDescription>{canManageAssignments ? messages.assignmentsDescription : data.category.name === 'PM' ? messages.pmAssignmentsLocked : messages.closedAssignmentsLocked}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {feedback ? <p className={feedback.kind === 'error' ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'} role="status">{feedback.message}</p> : null}
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

    <Card><CardHeader><CardTitle>{messages.jobs} ({data.jobsCompleted}/{data.jobsTotal})</CardTitle></CardHeader><CardContent>{data.jobs.length ? <ul className="divide-y">{data.jobs.map((job) => <li key={job.id} className="flex items-start justify-between gap-3 py-3 first:pt-0"><div><p className="font-medium">{job.displayName}</p><p className="text-xs text-muted-foreground">{job.category.name}</p>{job.customDescription ? <p className="mt-1 text-sm text-muted-foreground">{job.customDescription}</p> : null}</div><Badge variant={job.status === 'completed' ? 'success' : 'outline'}>{humanize(job.status)}</Badge></li>)}</ul> : <EmptyState>{messages.noJobs}</EmptyState>}</CardContent></Card>

    <Card>
      <CardHeader className="gap-3 sm:flex sm:flex-row sm:items-start sm:justify-between"><div><CardTitle>{messages.recentRepairHistory}</CardTitle><CardDescription>{messages.repairHistoryDescription}</CardDescription></div><label className="w-full space-y-1 sm:w-56"><span className="text-xs font-medium text-muted-foreground">{messages.filterByCategory}</span><Select aria-label={messages.filterByCategory} value={historyCategory} onChange={(event) => setHistoryCategory(event.target.value)}><option value="">{messages.allCategories}</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</Select></label></CardHeader>
      <CardContent>{historyQuery.error ? <LoadFailure message={messages.repairHistoryLoadError} retryLabel={messages.retry} onRetry={() => void historyQuery.mutate()} /> : historyQuery.isLoading ? <p className="text-sm text-muted-foreground" role="status">{messages.loadingRepairHistory}…</p> : historyItems.length ? <><ul className="divide-y">{historyItems.map((item) => <li key={item.workOrderId} className="py-3 first:pt-0"><div className="flex flex-wrap items-start justify-between gap-2"><div><Link href={`/admin/work-orders/${item.workOrderId}`} className="font-semibold text-primary hover:underline">{item.displayId}</Link><p className="text-sm text-muted-foreground">{item.primaryCategoryName} · {formatAdminDate(item.date, locale)}</p></div>{item.mileage !== null ? <Badge variant="outline">{messages.mileage}: {new Intl.NumberFormat(locale === 'es' ? 'es-US' : 'en-US').format(item.mileage)}</Badge> : null}</div>{item.mechanicNames.length ? <p className="mt-1 text-sm text-muted-foreground">{messages.performedBy}: {item.mechanicNames.join(', ')}</p> : null}{item.jobDetails.length ? <p className="mt-1 text-sm">{messages.repairJobs}: {item.jobDetails.map((job) => `${job.category.name}: ${job.displayName}`).join(' · ')}</p> : item.jobs.length ? <p className="mt-1 text-sm">{messages.repairJobs}: {item.jobs.join(', ')}</p> : null}</li>)}</ul>{historyHasMore ? <Button variant="outline" className="mt-4 w-full" disabled={historyQuery.isValidating} onClick={() => void historyQuery.setSize(historyQuery.size + 1)}>{historyQuery.isValidating ? `${messages.loadMoreRepairs}…` : messages.loadMoreRepairs}</Button> : null}</> : <EmptyState>{messages.noRepairHistory}</EmptyState>}</CardContent>
    </Card>

    <Card><CardHeader><CardTitle>{messages.workOrderTimes}</CardTitle></CardHeader><CardContent><dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4"><Info label={messages.created} value={formatAdminDate(data.createdAt, locale)} /><Info label={messages.started} value={formatAdminDate(data.startedAt, locale)} /><Info label={messages.completed} value={formatAdminDate(data.completedAt, locale)} /><Info label={messages.updated} value={formatAdminDate(data.updatedAt, locale)} /><Info label={messages.activeLabor} value={formatDuration(data.totalActiveLaborMs)} /><Info label={messages.waitingTime} value={formatDuration(data.totalWaitingMs)} /></dl></CardContent></Card>
    <section className="grid gap-4 lg:grid-cols-2">
      <Card><CardHeader><CardTitle>{messages.currentPause}</CardTitle></CardHeader><CardContent>{data.currentPause ? <Pause pause={data.currentPause} locale={locale} /> : <CompactEmpty>{messages.noCurrentPause}</CompactEmpty>}</CardContent></Card>
      <Card><CardHeader><CardTitle>{messages.pauseHistory}</CardTitle></CardHeader><CardContent>{data.pauseHistory.length ? <ul className="divide-y">{data.pauseHistory.map((pause) => <li key={pause.id} className="py-3 first:pt-0"><Pause pause={pause} locale={locale} /><p className="mt-1 text-xs text-muted-foreground">{pause.createdBy.name}</p></li>)}</ul> : <CompactEmpty>{messages.noPauseHistory}</CompactEmpty>}</CardContent></Card>
    </section>
    <Card><CardHeader><CardTitle>{messages.activityLog}</CardTitle></CardHeader><CardContent>{data.activityLog.length ? <ol className="divide-y">{data.activityLog.map((entry) => <li key={entry.id} className="py-3 first:pt-0"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">{humanize(entry.eventType)}</p><time className="text-xs text-muted-foreground">{formatAdminDate(entry.createdAt, locale)}</time></div><p className="mt-1 text-sm text-muted-foreground">{entry.user.name} · {entry.entityType}</p>{entry.relevantValue !== null ? <pre className="mt-2 max-w-full overflow-x-auto rounded-lg bg-muted p-2 text-xs">{JSON.stringify(entry.relevantValue)}</pre> : null}</li>)}</ol> : <CompactEmpty>{messages.noActivity}</CompactEmpty>}</CardContent></Card>
    <Card><CardHeader><CardTitle>{messages.notes}</CardTitle></CardHeader><CardContent>{data.notes ? <p className="whitespace-pre-wrap text-sm">{data.notes}</p> : <CompactEmpty>{messages.noNotes}</CompactEmpty>}</CardContent></Card>
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
function Info({ label, value }: { label: string; value: string }) { return <div><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 font-medium">{value}</dd></div>; }
function CompactEmpty({ children }: { children: React.ReactNode }) { return <p className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">{children}</p>; }
function formatAge(value: string, locale: AdminLocale) { const elapsed = Math.max(0, Date.now() - new Date(value).getTime()); const hours = Math.floor(elapsed / 3_600_000); const number = new Intl.NumberFormat(locale === 'es' ? 'es-US' : 'en-US'); if (hours < 24) return `${number.format(hours)}h`; const days = Math.floor(hours / 24); return `${number.format(days)}d ${number.format(hours % 24)}h`; }
function Pause({ pause, locale }: { pause: { reason: string; notes: string | null; startedAt: string; endedAt: string | null; durationMs: number | null }; locale: AdminLocale }) { return <div><p className="font-medium">{humanize(pause.reason)}</p><p className="text-sm text-muted-foreground">{formatAdminDate(pause.startedAt, locale)} → {formatAdminDate(pause.endedAt, locale)}{pause.durationMs !== null ? ` · ${formatDuration(pause.durationMs)}` : ''}</p>{pause.notes ? <p className="mt-1 text-sm">{pause.notes}</p> : null}</div>; }
function NotFound({ messages }: { messages: AdminMessages }) { return <EmptyState><p>{messages.workOrderNotFound}</p><Button asChild variant="outline" className="mt-4"><Link href="/admin/work-orders">{messages.backToWorkOrders}</Link></Button></EmptyState>; }
