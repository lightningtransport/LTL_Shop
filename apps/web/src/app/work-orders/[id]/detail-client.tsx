'use client';

import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { useSWRConfig } from 'swr';
import {
  AppCapability,
  JobStatus,
  MechanicMode,
  PauseReason,
  type WorkOrderDetailDto,
  type WorkOrderJobDto,
} from '@ltl-shop/shared';
import { useAuth } from '@/lib/auth-context';
import { useActionToast } from '@/components/action-toast';
import { SessionSignInFallback } from '@/components/session-sign-in-fallback';
import { replaceAppLocation } from '@/lib/session-restore';
import { ApiError, apiFetch } from '@/lib/api';
import { useShopLocale } from '@/lib/locale-context';
import { formatMileage, pauseLabel, statusLabel } from '@/lib/format';
import { TruckInformationFields } from '@/components/truck-information-fields';
import { canCompleteJobFromWorkOrder, isMyAssignedOrInheritedJob, isStandardWorkWaitingOnManager, jobAssignmentLabel, jobPersonLabel } from '@/lib/job-assignment';
import { canOfficiallyPauseWorkOrder } from '@/lib/work-order-pause';
import { shopKeys, useWorkOrder } from '@/lib/shop-data';
import { isWorkOrderRelatedListKey } from '@/lib/swr-cache-keys';
import {
  Button,
  Card,
  EmptyState,
  InlineAlert,
  Label,
  LoadFailure,
  Modal,
  PageSkeleton,
  PriorityBadge,
  ScreenHeader,
  Select,
  Textarea,
  WorkspaceNav,
} from '@/components/ui';
import { PmServiceCard, type PmDraftState } from '@/components/pm-service-card';
import { PmJobDetail } from '@/components/pm-job-detail';
import { WorkOrderNotesThread } from '@/components/work-order-notes-thread';
import { jobCategoriesLine, liveLaborMs, vehicleLine } from '@/lib/work-order-identity';

function formatLaborDuration(milliseconds: number) {
  const minutes = Math.max(0, Math.floor(milliseconds / 60_000));
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}

export default function WorkOrderDetailPage() {
  const { user, token, sessionLoading } = useAuth();
  const { messages } = useShopLocale();
  const { showToast } = useActionToast();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const id = params.id;
  const { mutate: mutateGlobal } = useSWRConfig();
  const {
    data: wo,
    error: loadError,
    mutate: mutateWorkOrder,
  } = useWorkOrder(id, !!token);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [truckOpen, setTruckOpen] = useState(false);
  const [finishJob, setFinishJob] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [finishNotes, setFinishNotes] = useState('');
  const [pauseOpen, setPauseOpen] = useState(false);
  const [pauseReason, setPauseReason] = useState<PauseReason | ''>('');
  const [pauseNotes, setPauseNotes] = useState('');
  const pauseTriggerRef = useRef<HTMLButtonElement>(null);
  const finishJobTriggerRef = useRef<HTMLButtonElement>(null);
  // LTR-131: live labor clock (API total at fetch time + elapsed while running).
  const fetchedAt = useMemo(() => Date.now(), [wo]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!wo?.laborRunning) return;
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [wo?.laborRunning]);

  useEffect(() => {
    if (!sessionLoading && !token) replaceAppLocation('/login', router);
  }, [sessionLoading, token, router]);

  useEffect(() => {
    const action = search.get('action');
    if (action === 'pause' && wo?.primaryCategoryName !== 'PM' && wo?.status === 'in_progress') {
      setPauseOpen(true);
    }
  }, [search, wo]);

  async function run(
    action: () => Promise<WorkOrderDetailDto>,
    optimisticUpdate?: (
      current: WorkOrderDetailDto,
    ) => WorkOrderDetailDto,
    onSuccess?: () => void,
  ): Promise<boolean> {
    const snapshot = wo;
    setBusy(true);
    setError(null);
    if (snapshot && optimisticUpdate) {
      await mutateWorkOrder(optimisticUpdate(snapshot), {
        revalidate: false,
      });
    }
    try {
      const updated = await action();
      await mutateWorkOrder(updated, { revalidate: false });
      void Promise.all([
        mutateGlobal(isWorkOrderRelatedListKey, undefined, { revalidate: true, populateCache: false }),
        mutateGlobal(
          (key) =>
            typeof key === 'string' && key.includes('/repair-history'),
          undefined,
          { revalidate: true, populateCache: false },
        ),
      ]).catch(() => undefined);
      onSuccess?.();
      return true;
    } catch (e) {
      if (snapshot && optimisticUpdate) {
        await mutateWorkOrder(snapshot, { revalidate: false });
      }
      setError(e instanceof Error ? e.message : 'Action failed');
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (!sessionLoading && !token) {
    return <SessionSignInFallback />;
  }

  if (sessionLoading || !token || !wo) {
    if (error) return <p className="text-shop-muted" role="alert">{error}</p>;
    if (loadError instanceof ApiError && loadError.status === 403) {
      return (
        <div className="space-y-3">
          <InlineAlert>{messages.noAccessToPmWorkOrder}</InlineAlert>
          <p className="text-sm text-muted-foreground">
            {messages.chooseAnotherOrHome}
          </p>
          <Button asChild variant="secondary" className="w-full">
            <Link href="/">{messages.backToHome}</Link>
          </Button>
        </div>
      );
    }
    if (loadError instanceof Error) {
      return <LoadFailure message={loadError.message} onRetry={() => void mutateWorkOrder()} retryLabel={messages.retryWorkOrder} />;
    }
    return <PageSkeleton label={messages.loadingWorkOrder} />;
  }

  // LTR-146: the assigned PM mechanic sees only the PM job of a truck Work Order.
  const canStandard = Boolean(user?.capabilities.includes(AppCapability.MECHANIC_STANDARD));
  if (wo.pmJob && wo.pmJob.assignedMechanic?.id === user?.id && (!canStandard || search.get('view') === 'pm')) {
    return (
      <PmJobDetail
        wo={wo}
        onUpdated={async (updated) => {
          await mutateWorkOrder(updated, { revalidate: false });
          void mutateGlobal(isWorkOrderRelatedListKey).catch(() => undefined);
        }}
      />
    );
  }

  if (wo.primaryCategoryName === 'PM') {
    return (
      <PmWorkOrderDetail
        wo={wo}
        onUpdated={async (updated) => {
          await mutateWorkOrder(updated, { revalidate: false });
          void Promise.all([
            mutateGlobal(isWorkOrderRelatedListKey),
            mutateGlobal(
              (key) => typeof key === 'string' && key.includes('/repair-history'),
            ),
            mutateGlobal(shopKeys.pmService(wo.id)),
          ]).catch(() => undefined);
        }}
      />
    );
  }

  const todo = wo.jobs.filter((j) => j.status === 'to_do');
  const done = wo.jobs.filter((j) => j.status === 'completed');
  const canComplete = (job: WorkOrderJobDto) => canCompleteJobFromWorkOrder(job, wo.pmJob?.id, user?.id ?? '');
  const isMyTodo = (job: WorkOrderJobDto) => isMyAssignedOrInheritedJob(job.assignedMechanic, user?.id ?? '') && canComplete(job);
  const myTodo = todo.filter(isMyTodo);
  const otherTodo = todo.filter((job) => !isMyTodo(job));
  const waitingOnManager = isStandardWorkWaitingOnManager(wo);
  // LTR-124: labor stops after the last Job; a Job added later needs Start Work.
  // `laborRunning === false` keeps older API responses (field absent) unchanged.
  const laborStopped = wo.status === 'in_progress' && wo.laborRunning === false;
  const needsStart = wo.status === 'created' || (laborStopped && todo.length > 0);
  const laborMs = liveLaborMs(wo.totalActiveLaborMs, wo.laborRunning, fetchedAt, now);

  return (
    <div>
      <WorkspaceNav mode={MechanicMode.STANDARD} />
      <ScreenHeader
        title={messages.truckTitle(wo.truckNumber)}
        subtitle={[vehicleLine(wo.truck), `${messages.workOrder} ${wo.displayId}`, messages.status[wo.status] ?? statusLabel(wo.status, messages.status)].filter(Boolean).join(' · ')}
        backHref="/mechanic/standard"
      />

      <div className="card mb-4 space-y-2">
        <div className="flex items-center justify-between">
          <PriorityBadge priority={wo.priority}>{messages.priority[wo.priority] ?? wo.priority}</PriorityBadge>
          <span className="text-sm text-shop-muted">
            {[jobCategoriesLine(wo.jobs), messages.jobsDone(wo.jobsCompleted, wo.jobsTotal)].filter(Boolean).join(' · ')}
          </span>
        </div>
        {/* LTR-131: the mechanic sees how long labor has run on this Work Order. */}
        {wo.status !== 'created' ? (
          <p className="text-sm text-shop-muted" aria-live="off">
            {messages.laborTime(formatLaborDuration(laborMs))}
            {wo.laborRunning ? ` · ${messages.laborRunningLabel}` : ''}
          </p>
        ) : null}
        {wo.currentPauseReason ? (
          <p className="text-sm font-medium text-warning-foreground">
            {pauseLabel(wo.currentPauseReason, messages.pauseReason)}
          </p>
        ) : null}
      </div>

      {waitingOnManager ? (
        <p className="mb-4 rounded-xl border border-shop-accent/40 bg-shop-accent/10 px-3 py-2 text-sm" role="status">
          {messages.waitingOnManagerBody}
        </p>
      ) : null}

      {error && !finishJob && !pauseOpen ? (
        <InlineAlert className="mb-3">{error}</InlineAlert>
      ) : null}

      {wo.primaryCategoryName === 'PM' ? <PmServiceCard workOrderId={wo.id} /> : null}

      {(wo.activeBlockers ?? []).length ? (
        // LTR-128: the mechanic sees what they already reported and can mark it resolved.
        <section className="mb-4 space-y-2" aria-labelledby="active-blockers-title">
          <p id="active-blockers-title" className="section-label">{messages.activeBlockers}</p>
          <ul className="space-y-2">
            {(wo.activeBlockers ?? []).map((blocker) => (
              <li key={blocker.id} className="rounded-xl bg-warning-surface px-3 py-2 text-sm text-warning-foreground">
                <p className="font-medium">{pauseLabel(blocker.reason, messages.pauseReason)}</p>
                {blocker.notes ? <p>{blocker.notes}</p> : null}
                <Button
                  type="button"
                  variant="secondary"
                  className="mt-2"
                  disabled={busy}
                  onClick={() =>
                    run(
                      () => apiFetch<WorkOrderDetailDto>(`/api/work-orders/${wo.id}/blockers/${blocker.id}/resolve`, { method: 'POST' }),
                      undefined,
                      () => showToast('success', messages.blockerResolved),
                    )
                  }
                >
                  {messages.markBlockerResolved}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mb-4 space-y-2">
        <p className="section-label">{messages.workOptions}</p>
        {needsStart ? (
          <Button
            className="w-full"
            disabled={busy}
            onClick={() =>
              run(
                () =>
                  apiFetch<WorkOrderDetailDto>(`/api/work-orders/${wo.id}/start`, {
                    method: 'POST',
                  }),
                undefined,
                () => showToast('success', messages.workStartedSuccess),
              )
            }
          >
            {busy ? messages.startingWork : messages.startWork}
          </Button>
        ) : null}
        {wo.status === 'in_progress' ? (
          <Button
            ref={pauseTriggerRef}
            variant="secondary"
            className="w-full"
            disabled={busy}
            onClick={() => setPauseOpen(true)}
          >
            {messages.reportBlocker}
          </Button>
        ) : null}
        {wo.status === 'waiting_paused' ? (
          <p className="text-sm text-muted-foreground">{messages.pausedAskManager}</p>
        ) : null}
      </section>

      <section className="card mb-4">
        <Button
          variant="ghost"
          className="w-full justify-between px-0"
          onClick={() => setTruckOpen((v) => !v)}
          aria-expanded={truckOpen}
          aria-controls="truck-information-panel"
        >
          <span className="section-label">{messages.truckInformation}</span>
          <ChevronDown
            className={`h-5 w-5 transition-transform ${truckOpen ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </Button>
        {truckOpen ? (
          <div id="truck-information-panel" className="mt-3 space-y-3">
            <TruckInformationFields truck={wo.truck} locale={messages.locale} />
            <Button asChild variant="secondary" className="w-full">
              <Link href={`/trucks/${wo.truckId}/history?from=${encodeURIComponent(`/work-orders/${wo.id}`)}`}>
                {messages.repairHistory}
              </Link>
            </Button>
          </div>
        ) : null}
      </section>

      <section className="mb-4">
        <p className="section-label mb-2">{messages.workOrderTeam}</p>
        <p className="mb-3 text-sm text-muted-foreground">
          {wo.mechanics.length
            ? wo.mechanics.map((assignment) => assignment.mechanicName).join(' / ')
            : messages.noWorkOrderTeam}
        </p>
        <p className="section-label mb-2">{messages.myJobs}</p>
        {/* LTR-131: say why Jobs are disabled before Start Work. */}
        {needsStart && todo.length > 0 ? (
          <p className="mb-2 text-sm text-muted-foreground">{messages.startWorkToCompleteJobs}</p>
        ) : null}
        {myTodo.length === 0 ? (
          <EmptyState>{todo.length === 0 ? messages.noPendingJobs : messages.noMyJobs}</EmptyState>
        ) : (
          <ul className="mb-3 space-y-2">
            {myTodo.map((job) => (
              <li key={job.id}>
                <JobTodoButton
                  job={job}
                  currentUserId={user?.id ?? ''}
                  disabled={busy || wo.status !== 'in_progress' || laborStopped}
                  onSelect={(event) => {
                    finishJobTriggerRef.current = event.currentTarget;
                    setFinishNotes('');
                    setFinishJob({ id: job.id, name: job.displayName });
                  }}
                />
              </li>
            ))}
          </ul>
        )}
        {otherTodo.length ? (
          <>
            <p className="section-label mb-2">{messages.otherWorkOnThisTruck}</p>
            <ul className="mb-3 space-y-2">
              {otherTodo.map((job) => (
                <li key={job.id}>
                  <JobTodoButton
                    job={job}
                    currentUserId={user?.id ?? ''}
                    readOnly={!canComplete(job)}
                    disabled={busy || wo.status !== 'in_progress' || laborStopped}
                    onSelect={(event) => {
                      finishJobTriggerRef.current = event.currentTarget;
                      setFinishNotes('');
                      setFinishJob({ id: job.id, name: job.displayName });
                    }}
                  />
                </li>
              ))}
            </ul>
          </>
        ) : null}
        {wo.status !== 'completed' && wo.status !== 'cancelled' ? (
          <p className="text-sm text-muted-foreground">{messages.additionalWorkHint}</p>
        ) : null}
      </section>

      <section className="mb-4">
        <p className="section-label mb-2">{messages.jobStatus.completed}</p>
        {done.length === 0 ? (
          <EmptyState>{messages.noCompletedJobs}</EmptyState>
        ) : (
          <ul className="space-y-2">
            {done.map((job) => (
              <li
                key={job.id}
                className="card flex items-start gap-3 text-shop-success"
              >
                <span className="mt-0.5">✓</span>
                <span className="min-w-0">
                  <span className="block">{job.displayName}</span>
                  <span className="block text-xs text-muted-foreground">{job.category.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {jobPersonLabel(job, user?.id ?? '', messages)}
                  </span>
                  {job.completionNotes ? (
                    <span className="mt-1 block text-sm text-foreground">{job.completionNotes}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <WorkOrderNotesThread
        wo={wo}
        onUpdated={async (updated) => {
          await mutateWorkOrder(updated, { revalidate: false });
        }}
      />

      <Modal
        open={!!finishJob}
        title={messages.jobFinishTitle}
        closeLabel={messages.closeDialog}
        onClose={() => {
          if (busy) return;
          setFinishJob(null);
          setFinishNotes('');
        }}
        returnFocusRef={finishJobTriggerRef}
      >
        {error ? <InlineAlert className="mb-3">{error}</InlineAlert> : null}
        <p className="mb-4 text-lg">{finishJob?.name}</p>
        <Label className="section-label mb-2 block" htmlFor="finish-job-notes">
          {messages.jobFinishNotes}
        </Label>
        <Textarea
          id="finish-job-notes"
          className="mb-4"
          placeholder={messages.jobFinishNotesPlaceholder}
          value={finishNotes}
          onChange={(event) => setFinishNotes(event.target.value)}
          maxLength={2000}
        />
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => {
              if (busy) return;
              setFinishJob(null);
              setFinishNotes('');
            }}
          >
            {messages.cancelAction}
          </Button>
          <Button
            disabled={busy}
            onClick={() => {
              if (!finishJob || busy) return;
              const jobId = finishJob.id;
              const notesToSave = finishNotes.trim() || undefined;
              void run(
                () =>
                  apiFetch<WorkOrderDetailDto>(
                    `/api/work-orders/${wo.id}/jobs/${jobId}/complete`,
                    {
                      method: 'POST',
                      body: JSON.stringify({ notes: notesToSave }),
                    },
                  ),
                (current) => {
                  const completedAt = new Date().toISOString();
                  const jobs = current.jobs.map((job) =>
                    job.id === jobId
                      ? {
                          ...job,
                          status: JobStatus.COMPLETED,
                          completedAt,
                          completedById: user?.id ?? null,
                          completionNotes: notesToSave ?? null,
                        }
                      : job,
                  );
                  return {
                    ...current,
                    jobs,
                    jobsCompleted: jobs.filter(
                      (job) => job.status === 'completed',
                    ).length,
                    version: current.version + 1,
                  };
                },
                () => {
                  setFinishJob(null);
                  setFinishNotes('');
                  showToast(
                    'success',
                    notesToSave ? messages.jobFinishedWithNoteSuccess : messages.jobFinishedSuccess,
                  );
                },
              );
            }}
          >
            {busy ? messages.completingJob : messages.jobFinishConfirm}
          </Button>
        </div>
      </Modal>

      <Modal
        open={pauseOpen}
        title={messages.reportBlocker}
        closeLabel={messages.closeDialog}
        onClose={() => {
          if (busy) return;
          setPauseOpen(false);
        }}
        returnFocusRef={pauseTriggerRef}
      >
        {error ? <InlineAlert className="mb-3">{error}</InlineAlert> : null}
        <Label className="section-label mb-2 block" htmlFor="pause-reason">
          {messages.blockerReason}
        </Label>
        <div className="mb-3">
          <Select
            id="pause-reason"
            value={pauseReason}
            onChange={(e) => setPauseReason(e.target.value as PauseReason)}
            disabled={busy}
          >
            <option value="">{messages.selectOption}</option>
            {Object.values(PauseReason).map((r) => (
              <option key={r} value={r}>
                {messages.pauseReason[r]}
              </option>
            ))}
          </Select>
        </div>
        {pauseReason === PauseReason.OTHER ? (
          <div className="mb-3">
            <Label className="section-label mb-2 block" htmlFor="pause-notes">
              {messages.additionalDetails}
            </Label>
            <Textarea
              id="pause-notes"
              placeholder={messages.reasonRequiredForOther}
              value={pauseNotes}
              onChange={(e) => setPauseNotes(e.target.value)}
              disabled={busy}
            />
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => {
              if (busy) return;
              setPauseOpen(false);
            }}
          >
            {messages.cancelAction}
          </Button>
          <Button
            disabled={!pauseReason || busy}
            onClick={() => {
              if (busy) return;
              void run(
                () =>
                  apiFetch<WorkOrderDetailDto>(`/api/work-orders/${wo.id}/blockers`, {
                    method: 'POST',
                    body: JSON.stringify({
                      reason: pauseReason,
                      notes: pauseNotes || undefined,
                    }),
                  }),
                undefined,
                () => {
                  setPauseOpen(false);
                  setPauseReason('');
                  setPauseNotes('');
                  showToast('success', messages.blockerReportedSuccess);
                },
              );
            }}
          >
            {busy ? messages.reportingBlocker : messages.reportBlocker}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function PmWorkOrderDetail({
  wo,
  onUpdated,
}: {
  wo: WorkOrderDetailDto;
  onUpdated: (updated: WorkOrderDetailDto) => Promise<void>;
}) {
  const { messages } = useShopLocale();
  const { showToast } = useActionToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<PmDraftState>({
    ready: false,
    pending: false,
    hasError: false,
    observedMileage: '',
    selectedParts: 0,
  });
  const [finishOpen, setFinishOpen] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [pauseReason, setPauseReason] = useState<PauseReason | ''>('');
  const [pauseNotes, setPauseNotes] = useState('');
  const [changeReason, setChangeReason] = useState<PauseReason | ''>('');
  const pauseTriggerRef = useRef<HTMLButtonElement>(null);

  async function run(
    action: () => Promise<WorkOrderDetailDto>,
    onSuccess?: () => void,
  ) {
    setBusy(true);
    setError(null);
    try {
      const updated = await action();
      await onUpdated(updated);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  const mileage = Number(draft.observedMileage);
  const validMileage =
    draft.observedMileage.trim() !== '' && Number.isInteger(mileage) && mileage >= 0;
  const finishBlocked =
    busy ||
    !draft.ready ||
    draft.pending ||
    draft.hasError ||
    !validMileage ||
    draft.selectedParts < 1;
  const mileageChangesTruck = validMileage && mileage !== wo.truck.mileage;

  return (
    <div>
      <WorkspaceNav mode={MechanicMode.PM} />
      <ScreenHeader
        title={messages.truckTitle(wo.truckNumber)}
        subtitle={[vehicleLine(wo.truck), `${messages.workOrder} ${wo.displayId}`, messages.status[wo.status] ?? statusLabel(wo.status, messages.status)].filter(Boolean).join(' · ')}
        backHref="/mechanic/pm"
      />

      {error ? <InlineAlert className="mb-3">{error}</InlineAlert> : null}

      <section className="card mb-4 space-y-3" aria-labelledby="pm-truck-information">
        <h2 id="pm-truck-information" className="section-label">{messages.truckInformation}</h2>
        <TruckInformationFields truck={wo.truck} locale={messages.locale} />
        <Button asChild variant="secondary" className="w-full">
          <Link href={`/trucks/${wo.truckId}/history?from=${encodeURIComponent(`/work-orders/${wo.id}`)}`}>
            {messages.repairHistory}
          </Link>
        </Button>
      </section>

      {wo.status === 'created' ? (
        <section className="mb-4">
          <Button
            className="w-full"
            disabled={busy}
            onClick={() =>
              run(() =>
                apiFetch<WorkOrderDetailDto>(`/api/work-orders/${wo.id}/start`, {
                  method: 'POST',
                }),
              )
            }
          >
            {messages.startWork}
          </Button>
        </section>
      ) : (
        <PmServiceCard workOrderId={wo.id} onDraftStateChange={setDraft} />
      )}

      {wo.status === 'waiting_paused' ? (
        <section className="card mb-4 space-y-3">
          <Label className="section-label" htmlFor="pm-change-pause-reason">Change Pause Reason</Label>
          <Select
              id="pm-change-pause-reason"
              value={changeReason || wo.currentPauseReason || ''}
              onChange={(event) => setChangeReason(event.target.value as PauseReason)}
            >
              {Object.values(PauseReason).map((reason) => (
                <option key={reason} value={reason}>{messages.pauseReason[reason]}</option>
              ))}
          </Select>
          <Button
            variant="secondary"
            className="w-full"
            disabled={busy}
            onClick={() => run(() => apiFetch<WorkOrderDetailDto>(`/api/work-orders/${wo.id}/pause-reason`, {
              method: 'POST',
              body: JSON.stringify({ reason: changeReason || wo.currentPauseReason }),
            }))}
          >
            Update Pause
          </Button>
        </section>
      ) : null}

      <WorkOrderNotesThread wo={wo} onUpdated={onUpdated} />

      {wo.currentPauseReason ? (
        <p className="mb-3 text-sm font-medium text-warning-foreground">{pauseLabel(wo.currentPauseReason, messages.pauseReason)}</p>
      ) : null}

      <section className="mb-4 space-y-2" aria-label="PM work actions">
        {wo.status === 'created' ? (
          <>
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              disabled
              aria-describedby="pm-pause-unavailable"
            >
              {messages.pauseWorkOrder}
            </Button>
            <p id="pm-pause-unavailable" className="text-sm text-muted-foreground">{messages.pauseUnavailableUntilInProgress}</p>
          </>
        ) : null}
        {canOfficiallyPauseWorkOrder(wo.status) ? (
          <div className="grid grid-cols-2 gap-2">
            <Button ref={pauseTriggerRef} variant="secondary" disabled={busy} onClick={() => setPauseOpen(true)}>{messages.pauseWorkOrder}</Button>
            <Button disabled={finishBlocked} onClick={() => setFinishOpen(true)}>{messages.finishWork}</Button>
          </div>
        ) : null}
        {wo.status === 'waiting_paused' ? (
          <Button className="w-full" disabled={busy} onClick={() => run(() => apiFetch<WorkOrderDetailDto>(`/api/work-orders/${wo.id}/resume`, { method: 'POST' }))}>Resume Work</Button>
        ) : null}
        {canOfficiallyPauseWorkOrder(wo.status) && finishBlocked ? (
          <p className="text-sm text-muted-foreground">Finish Work requires a saved observed mileage and at least one part.</p>
        ) : null}
      </section>

      <Modal open={finishOpen} title={messages.finishWork} closeLabel={messages.closeDialog} onClose={() => { if (!busy) setFinishOpen(false); }}>
        {error ? <InlineAlert className="mb-3">{error}</InlineAlert> : null}
        <p className="mb-4 text-sm text-muted-foreground">
          {mileageChangesTruck
            ? `This will update the truck mileage from ${formatMileage(wo.truck.mileage)} to ${formatMileage(mileage)} and create an audit record.`
            : 'This will complete the PM service.'}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" disabled={busy} onClick={() => { if (!busy) setFinishOpen(false); }}>{messages.cancelAction}</Button>
          <Button disabled={busy} onClick={() => {
            if (busy) return;
            void run(
              () => apiFetch<WorkOrderDetailDto>(`/api/work-orders/${wo.id}/complete`, { method: 'POST' }),
              () => {
                setFinishOpen(false);
                showToast('success', messages.pmFinishedSuccess);
                router.replace('/mechanic/pm', { scroll: true });
              },
            );
          }}>{busy ? messages.finishingWork : messages.finishWork}</Button>
        </div>
      </Modal>

      <Modal open={pauseOpen} title={messages.pauseWorkOrder} closeLabel={messages.closeDialog} onClose={() => setPauseOpen(false)} returnFocusRef={pauseTriggerRef}>
        <Label className="section-label mb-2 block" htmlFor="pm-pause-reason">{messages.pauseReasonLabel}</Label>
        <div className="mb-3">
          <Select id="pm-pause-reason" value={pauseReason} onChange={(event) => setPauseReason(event.target.value as PauseReason)}>
            <option value="">{messages.selectOption}</option>
            {Object.values(PauseReason).map((reason) => <option key={reason} value={reason}>{messages.pauseReason[reason]}</option>)}
          </Select>
        </div>
        {pauseReason === PauseReason.OTHER ? (
          <Textarea className="mb-3" placeholder={messages.reasonRequiredForOther} value={pauseNotes} onChange={(event) => setPauseNotes(event.target.value)} />
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => setPauseOpen(false)}>{messages.cancelAction}</Button>
          <Button disabled={!canOfficiallyPauseWorkOrder(wo.status) || !pauseReason || busy} onClick={() => {
            if (!canOfficiallyPauseWorkOrder(wo.status)) return;
            setPauseOpen(false);
            void run(() => apiFetch<WorkOrderDetailDto>(`/api/work-orders/${wo.id}/pause`, {
              method: 'POST',
              body: JSON.stringify({ reason: pauseReason, notes: pauseNotes || undefined }),
            }));
          }}>{messages.pauseWorkOrder}</Button>
        </div>
      </Modal>
    </div>
  );
}

function JobTodoButton({
  job,
  currentUserId,
  disabled,
  readOnly = false,
  onSelect,
}: {
  job: WorkOrderJobDto;
  currentUserId: string;
  disabled: boolean;
  /** LTR-151: someone else's PM job is listed without offering "Complete job". */
  readOnly?: boolean;
  onSelect: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const { messages } = useShopLocale();
  const content = (
    <>
      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-shop-border text-xs">
        ○
      </span>
      <span className="min-w-0">
        <span className="block">{job.displayName}</span>
        <span className="block text-xs text-muted-foreground">{job.category.name}</span>
        <span className="block text-xs text-muted-foreground">
          {jobAssignmentLabel(job.assignedMechanic, currentUserId, messages)}
        </span>
      </span>
    </>
  );
  if (readOnly) {
    return <div className="card flex items-start gap-3 text-left" data-testid="job-read-only">{content}</div>;
  }
  return (
    <Button
      variant="outline"
      className="h-auto w-full justify-start gap-3 p-4 text-left font-normal"
      disabled={disabled}
      onClick={onSelect}
    >
      {content}
    </Button>
  );
}
