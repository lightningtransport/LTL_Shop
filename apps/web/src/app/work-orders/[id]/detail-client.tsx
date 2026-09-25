'use client';

import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { useSWRConfig } from 'swr';
import {
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
import { isMyAssignedOrInheritedJob, isStandardWorkWaitingOnManager, jobAssignmentLabel, jobPersonLabel } from '@/lib/job-assignment';
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
  const [notes, setNotes] = useState('');
  const [notesDirty, setNotesDirty] = useState(false);
  const pauseTriggerRef = useRef<HTMLButtonElement>(null);
  const finishJobTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!sessionLoading && !token) replaceAppLocation('/login', router);
  }, [sessionLoading, token, router]);

  useEffect(() => {
    const action = search.get('action');
    if (action === 'pause' && wo?.primaryCategoryName !== 'PM' && wo?.status === 'in_progress') {
      setPauseOpen(true);
    }
  }, [search, wo]);

  useEffect(() => {
    if (!wo || notesDirty) return;
    setNotes(wo.notes ?? '');
  }, [wo, notesDirty]);

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
  const myTodo = todo.filter((job) => isMyAssignedOrInheritedJob(job.assignedMechanic, user?.id ?? ''));
  const otherTodo = todo.filter((job) => !isMyAssignedOrInheritedJob(job.assignedMechanic, user?.id ?? ''));
  const waitingOnManager = isStandardWorkWaitingOnManager(wo);
  // LTR-124: labor stops after the last Job; a Job added later needs Start Work.
  // `laborRunning === false` keeps older API responses (field absent) unchanged.
  const laborStopped = wo.status === 'in_progress' && wo.laborRunning === false;
  const needsStart = wo.status === 'created' || (laborStopped && todo.length > 0);

  return (
    <div>
      <WorkspaceNav mode={MechanicMode.STANDARD} />
      <ScreenHeader
        title={`#${wo.truckNumber}`}
        subtitle={`${messages.workOrder} ${wo.displayId} · ${messages.status[wo.status] ?? statusLabel(wo.status, messages.status)}`}
        backHref="/mechanic/standard"
      />

      <div className="card mb-4 space-y-2">
        <div className="flex items-center justify-between">
          <PriorityBadge priority={wo.priority}>{messages.priority[wo.priority] ?? wo.priority}</PriorityBadge>
          <span className="text-sm text-shop-muted">
            {wo.primaryCategoryName} · {messages.jobsDone(wo.jobsCompleted, wo.jobsTotal)}
          </span>
        </div>
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

      <section className="card space-y-3">
        <div>
          <Label className="section-label" htmlFor="wo-notes">
            {messages.notes}
          </Label>
          <Textarea
            id="wo-notes"
            className="mt-2"
            placeholder={messages.additionalWorkHint}
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              setNotesDirty(true);
            }}
          />
          {notesDirty ? (
            <Button
              variant="secondary"
              className="mt-2 w-full"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const updated = await apiFetch<WorkOrderDetailDto>(
                    `/api/work-orders/${wo.id}/notes`,
                    {
                    method: 'POST',
                    body: JSON.stringify({ notes: notes || undefined }),
                    },
                  );
                  setNotesDirty(false);
                  return updated;
                })
              }
            >
              {messages.saveNotes}
            </Button>
          ) : null}
        </div>
      </section>

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
  const [notes, setNotes] = useState(wo.notes ?? '');
  const [notesDirty, setNotesDirty] = useState(false);
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
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

  useEffect(() => {
    if (!notesDirty) setNotes(wo.notes ?? '');
  }, [notesDirty, wo.notes]);

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

  async function saveNotes() {
    if (!notesDirty || notesSaving || wo.status === 'completed' || wo.status === 'cancelled') return;
    setNotesSaving(true);
    setNotesError(null);
    try {
      const updated = await apiFetch<WorkOrderDetailDto>(`/api/work-orders/${wo.id}/notes`, {
        method: 'POST',
        body: JSON.stringify({ notes: notes || undefined }),
      });
      setNotesDirty(false);
      await onUpdated(updated);
    } catch (err) {
      setNotesError(err instanceof Error ? err.message : messages.unableToSaveNotes);
    } finally {
      setNotesSaving(false);
    }
  }

  useEffect(() => {
    if (!notesDirty || notesSaving || notesError) return;
    const timer = window.setTimeout(() => void saveNotes(), 600);
    return () => window.clearTimeout(timer);
  }, [notes, notesDirty, notesSaving, notesError]);

  const mileage = Number(draft.observedMileage);
  const validMileage =
    draft.observedMileage.trim() !== '' && Number.isInteger(mileage) && mileage >= 0;
  const finishBlocked =
    busy ||
    !draft.ready ||
    draft.pending ||
    draft.hasError ||
    notesDirty ||
    notesSaving ||
    !!notesError ||
    !validMileage ||
    draft.selectedParts < 1;
  const mileageChangesTruck = validMileage && mileage !== wo.truck.mileage;

  return (
    <div>
      <WorkspaceNav mode={MechanicMode.PM} />
      <ScreenHeader
        title={`#${wo.truckNumber}`}
        subtitle={`${messages.workOrder} ${wo.displayId} · ${messages.status[wo.status] ?? statusLabel(wo.status, messages.status)}`}
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

      <section className="card mb-4 space-y-2">
        <Label className="section-label" htmlFor="pm-notes">{messages.notes}</Label>
        <Textarea
          id="pm-notes"
          placeholder={messages.pmNotesPlaceholder}
          disabled={wo.status === 'completed' || wo.status === 'cancelled'}
          value={notes}
          onChange={(event) => {
            setNotes(event.target.value);
            setNotesDirty(true);
            setNotesError(null);
          }}
          onBlur={() => void saveNotes()}
        />
        <p className="min-h-5 text-sm text-muted-foreground" aria-live="polite">
          {notesSaving ? messages.saving : notesError ? <><span className="text-destructive">{notesError} </span><Button variant="ghost" className="px-1 underline" onClick={() => void saveNotes()}>{messages.retry}</Button></> : notesDirty ? messages.saving : messages.saved}
        </p>
      </section>

      {wo.currentPauseReason ? (
        <p className="mb-3 text-sm font-medium text-warning-foreground">{pauseLabel(wo.currentPauseReason, messages.pauseReason)}</p>
      ) : null}

      <section className="mb-4 space-y-2" aria-label="PM work actions">
        {wo.status === 'in_progress' ? (
          <div className="grid grid-cols-2 gap-2">
            <Button ref={pauseTriggerRef} variant="secondary" disabled={busy} onClick={() => setPauseOpen(true)}>{messages.pauseWorkOrder}</Button>
            <Button disabled={finishBlocked} onClick={() => setFinishOpen(true)}>{messages.finishWork}</Button>
          </div>
        ) : null}
        {wo.status === 'waiting_paused' ? (
          <Button className="w-full" disabled={busy} onClick={() => run(() => apiFetch<WorkOrderDetailDto>(`/api/work-orders/${wo.id}/resume`, { method: 'POST' }))}>Resume Work</Button>
        ) : null}
        {wo.status === 'in_progress' && finishBlocked ? (
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
          <Button disabled={!pauseReason || busy} onClick={() => {
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
  onSelect,
}: {
  job: WorkOrderJobDto;
  currentUserId: string;
  disabled: boolean;
  onSelect: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const { messages } = useShopLocale();
  return (
    <Button
      variant="outline"
      className="h-auto w-full justify-start gap-3 p-4 text-left font-normal"
      disabled={disabled}
      onClick={onSelect}
    >
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
    </Button>
  );
}
