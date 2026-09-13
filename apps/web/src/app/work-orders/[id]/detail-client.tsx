'use client';

import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { useSWRConfig } from 'swr';
import {
  JobStatus,
  MechanicMode,
  PAUSE_REASON_LABELS,
  PauseReason,
  type WorkOrderDetailDto,
  type WorkOrderJobDto,
} from '@ltl-shop/shared';
import { useAuth } from '@/lib/auth-context';
import { ApiError, apiFetch } from '@/lib/api';
import { useShopLocale } from '@/lib/locale-context';
import { formatIsoDate, formatMileage, pauseLabel, statusLabel } from '@/lib/format';
import { isMyAssignedOrInheritedJob, jobAssignmentLabel } from '@/lib/job-assignment';
import { shopKeys, useWorkOrder } from '@/lib/shop-data';
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

function isWorkOrderListKey(key: unknown): key is string {
  return typeof key === 'string' && (key === '/api/work-orders' || key.startsWith('/api/work-orders?'));
}

export default function WorkOrderDetailPage() {
  const { user, token, sessionLoading } = useAuth();
  const { messages } = useShopLocale();
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
  const [pauseOpen, setPauseOpen] = useState(false);
  const [pauseReason, setPauseReason] = useState<PauseReason | ''>('');
  const [pauseNotes, setPauseNotes] = useState('');
  const [notes, setNotes] = useState('');
  const [notesDirty, setNotesDirty] = useState(false);
  const pauseTriggerRef = useRef<HTMLButtonElement>(null);
  const finishJobTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!sessionLoading && !token) router.replace('/login');
  }, [sessionLoading, token, router]);

  useEffect(() => {
    const action = search.get('action');
    if (action === 'pause' && wo?.primaryCategoryName !== 'PM' && wo?.status === 'in_progress' && wo.jobs.some((job) => job.status === 'to_do')) {
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
        mutateGlobal(isWorkOrderListKey),
        mutateGlobal(
          (key) =>
            typeof key === 'string' && key.includes('/repair-history'),
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

  if (sessionLoading || !token || !wo) {
    if (error) return <p className="text-shop-muted" role="alert">{error}</p>;
    if (loadError instanceof ApiError && loadError.status === 403) {
      return (
        <div className="space-y-3">
          <InlineAlert>{messages.noAccessToPmWorkOrder}</InlineAlert>
          <p className="text-sm text-muted-foreground">
            {messages.locale === 'es' ? 'Elige otro Work Order o vuelve a Inicio.' : 'Choose another Work Order or return to Home.'}
          </p>
          <Button asChild variant="secondary" className="w-full">
            <Link href="/">{messages.backToHome}</Link>
          </Button>
        </div>
      );
    }
    if (loadError instanceof Error) {
      return <LoadFailure message={loadError.message} onRetry={() => void mutateWorkOrder()} retryLabel="Retry work order" />;
    }
    return <PageSkeleton label="Loading work order" />;
  }

  if (wo.primaryCategoryName === 'PM') {
    return (
      <PmWorkOrderDetail
        wo={wo}
        onUpdated={async (updated) => {
          await mutateWorkOrder(updated, { revalidate: false });
          void Promise.all([
            mutateGlobal(isWorkOrderListKey),
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

  return (
    <div>
      <WorkspaceNav mode={MechanicMode.STANDARD} />
      <ScreenHeader
        title={wo.displayId}
        subtitle={`#${wo.truckNumber} · ${messages.status[wo.status] ?? statusLabel(wo.status, messages.status)}`}
        backHref="/mechanic/standard"
      />

      <div className="card mb-4 space-y-2">
        <div className="flex items-center justify-between">
          <PriorityBadge priority={wo.priority} />
          <span className="text-sm text-shop-muted">
            Primary: {wo.primaryCategoryName} — {wo.jobsCompleted} of {wo.jobsTotal}{' '}
            jobs
          </span>
        </div>
        {wo.currentPauseReason ? (
          <p className="text-sm font-medium text-warning-foreground">
            {pauseLabel(wo.currentPauseReason)}
          </p>
        ) : null}
      </div>

      {error ? (
        <InlineAlert className="mb-3">{error}</InlineAlert>
      ) : null}

      {wo.primaryCategoryName === 'PM' ? <PmServiceCard workOrderId={wo.id} /> : null}

      <section className="mb-4 space-y-2">
        <p className="section-label">Work Options</p>
        {wo.status === 'created' ? (
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
        ) : null}
        {wo.status === 'in_progress' && todo.length ? (
          <Button
            ref={pauseTriggerRef}
            variant="secondary"
            className="w-full"
            disabled={busy}
            onClick={() => setPauseOpen(true)}
          >
            Report Blocker
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
          <span className="section-label">Truck Information</span>
          <ChevronDown
            className={`h-5 w-5 transition-transform ${truckOpen ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </Button>
        {truckOpen ? (
          <div id="truck-information-panel" className="mt-3 space-y-3">
            <div className="grid grid-cols-3 gap-2 text-sm">
              <Info label="Make" value={wo.truck.make} />
              <Info label="Model" value={wo.truck.model} />
              <Info label="Year" value={wo.truck.year?.toString()} />
              <Info label="Mileage" value={formatMileage(wo.truck.mileage)} />
              <Info label="Company" value={wo.truck.company} />
              <Info label="Owner" value={wo.truck.owner} />
              <Info label={messages.vin} value={wo.truck.vin} />
              <Info label={messages.lastReportedLocation} value={wo.truck.location} />
              <Info label={messages.locationUpdatedOn} value={formatIsoDate(wo.truck.locationUpdatedOn, messages.locale)} />
            </div>
            <Button asChild variant="secondary" className="w-full">
              <Link href={`/trucks/${wo.truckId}/history?from=${encodeURIComponent(`/work-orders/${wo.id}`)}`}>
                See Truck Repair History
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
          <EmptyState>{todo.length === 0 ? 'No pending jobs' : messages.noMyJobs}</EmptyState>
        ) : (
          <ul className="mb-3 space-y-2">
            {myTodo.map((job) => (
              <li key={job.id}>
                <JobTodoButton
                  job={job}
                  currentUserId={user?.id ?? ''}
                  disabled={busy || wo.status !== 'in_progress'}
                  onSelect={(event) => {
                    finishJobTriggerRef.current = event.currentTarget;
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
                    disabled={busy || wo.status !== 'in_progress'}
                    onSelect={(event) => {
                      finishJobTriggerRef.current = event.currentTarget;
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
        <p className="section-label mb-2">Completed</p>
        {done.length === 0 ? (
          <EmptyState>No completed jobs</EmptyState>
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
                    {jobAssignmentLabel(job.assignedMechanic, user?.id ?? '', messages)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card space-y-3">
        <div>
          <Label className="section-label" htmlFor="wo-notes">
            Notes
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
              Save Notes
            </Button>
          ) : null}
        </div>
      </section>

      <Modal
        open={!!finishJob}
        title="JOB FINISHED"
        onClose={() => setFinishJob(null)}
        returnFocusRef={finishJobTriggerRef}
      >
        <p className="mb-4 text-lg">{finishJob?.name}</p>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            onClick={() => setFinishJob(null)}
          >
            Cancel
          </Button>
          <Button
            disabled={busy}
            onClick={() => {
              if (!finishJob) return;
              const jobId = finishJob.id;
              setFinishJob(null);
              run(
                () =>
                  apiFetch<WorkOrderDetailDto>(
                    `/api/work-orders/${wo.id}/jobs/${jobId}/complete`,
                    { method: 'POST' },
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
              );
            }}
          >
            Complete Job
          </Button>
        </div>
      </Modal>

      <Modal
        open={pauseOpen}
        title="REPORT BLOCKER"
        onClose={() => setPauseOpen(false)}
        returnFocusRef={pauseTriggerRef}
      >
        <Label className="section-label mb-2 block" htmlFor="pause-reason">
          Blocker reason
        </Label>
        <div className="mb-3">
          <Select
            id="pause-reason"
            value={pauseReason}
            onChange={(e) => setPauseReason(e.target.value as PauseReason)}
          >
            <option value="">Select an option</option>
            {Object.values(PauseReason).map((r) => (
              <option key={r} value={r}>
                {PAUSE_REASON_LABELS[r]}
              </option>
            ))}
          </Select>
        </div>
        {pauseReason === PauseReason.OTHER ? (
          <div className="mb-3">
            <Label className="section-label mb-2 block" htmlFor="pause-notes">
              Additional details
            </Label>
            <Textarea
              id="pause-notes"
              placeholder="Reason required for Other"
              value={pauseNotes}
              onChange={(e) => setPauseNotes(e.target.value)}
            />
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            onClick={() => setPauseOpen(false)}
          >
            Cancel
          </Button>
          <Button
            disabled={!pauseReason || busy}
            onClick={() => {
              setPauseOpen(false);
              run(() =>
                apiFetch<WorkOrderDetailDto>(`/api/work-orders/${wo.id}/blockers`, {
                  method: 'POST',
                  body: JSON.stringify({
                    reason: pauseReason,
                    notes: pauseNotes || undefined,
                  }),
                }),
              );
            }}
          >
            Report Blocker
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
      setNotesError(err instanceof Error ? err.message : 'Unable to save notes.');
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
        title={wo.displayId}
        subtitle={`#${wo.truckNumber} · ${messages.status[wo.status] ?? statusLabel(wo.status, messages.status)}`}
        backHref="/mechanic/pm"
      />

      {error ? <InlineAlert className="mb-3">{error}</InlineAlert> : null}

      <section className="card mb-4 space-y-3" aria-labelledby="pm-truck-information">
        <h2 id="pm-truck-information" className="section-label">Truck Information</h2>
        <div className="grid grid-cols-3 gap-2 text-sm">
          <Info label="Make" value={wo.truck.make} />
          <Info label="Model" value={wo.truck.model} />
          <Info label="Year" value={wo.truck.year?.toString()} />
          <Info label="Mileage" value={formatMileage(wo.truck.mileage)} />
          <Info label="Company" value={wo.truck.company} />
          <Info label="Owner" value={wo.truck.owner} />
          <Info label={messages.vin} value={wo.truck.vin} />
          <Info label={messages.lastReportedLocation} value={wo.truck.location} />
          <Info label={messages.locationUpdatedOn} value={formatIsoDate(wo.truck.locationUpdatedOn, messages.locale)} />
        </div>
        <Button asChild variant="secondary" className="w-full">
          <Link href={`/trucks/${wo.truckId}/history?from=${encodeURIComponent(`/work-orders/${wo.id}`)}`}>
            See Truck Repair History
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
                <option key={reason} value={reason}>{PAUSE_REASON_LABELS[reason]}</option>
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
        <Label className="section-label" htmlFor="pm-notes">Notes</Label>
        <Textarea
          id="pm-notes"
          placeholder="Add notes (optional)"
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
          {notesSaving ? 'Saving…' : notesError ? <><span className="text-destructive">{notesError} </span><Button variant="ghost" className="px-1 underline" onClick={() => void saveNotes()}>Retry</Button></> : notesDirty ? 'Saving…' : 'Saved'}
        </p>
      </section>

      {wo.currentPauseReason ? (
        <p className="mb-3 text-sm font-medium text-warning-foreground">{pauseLabel(wo.currentPauseReason)}</p>
      ) : null}

      <section className="mb-4 space-y-2" aria-label="PM work actions">
        {wo.status === 'in_progress' ? (
          <div className="grid grid-cols-2 gap-2">
            <Button ref={pauseTriggerRef} variant="secondary" disabled={busy} onClick={() => setPauseOpen(true)}>{messages.pauseWorkOrder}</Button>
            <Button disabled={finishBlocked} onClick={() => setFinishOpen(true)}>Finish Work</Button>
          </div>
        ) : null}
        {wo.status === 'waiting_paused' ? (
          <Button className="w-full" disabled={busy} onClick={() => run(() => apiFetch<WorkOrderDetailDto>(`/api/work-orders/${wo.id}/resume`, { method: 'POST' }))}>Resume Work</Button>
        ) : null}
        {wo.status === 'in_progress' && finishBlocked ? (
          <p className="text-sm text-muted-foreground">Finish Work requires a saved observed mileage and at least one part.</p>
        ) : null}
      </section>

      <Modal open={finishOpen} title="Finish PM service" onClose={() => setFinishOpen(false)}>
        <p className="mb-4 text-sm text-muted-foreground">
          {mileageChangesTruck
            ? `This will update the truck mileage from ${formatMileage(wo.truck.mileage)} to ${formatMileage(mileage)} and create an audit record.`
            : 'This will complete the PM service.'}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => setFinishOpen(false)}>Cancel</Button>
          <Button disabled={busy} onClick={() => {
            setFinishOpen(false);
            void run(
              () => apiFetch<WorkOrderDetailDto>(`/api/work-orders/${wo.id}/complete`, { method: 'POST' }),
              () => router.replace('/mechanic/pm', { scroll: true }),
            );
          }}>Finish Work</Button>
        </div>
      </Modal>

      <Modal open={pauseOpen} title={messages.pauseWorkOrder} onClose={() => setPauseOpen(false)} returnFocusRef={pauseTriggerRef}>
        <Label className="section-label mb-2 block" htmlFor="pm-pause-reason">Pause reason</Label>
        <div className="mb-3">
          <Select id="pm-pause-reason" value={pauseReason} onChange={(event) => setPauseReason(event.target.value as PauseReason)}>
            <option value="">Select an option</option>
            {Object.values(PauseReason).map((reason) => <option key={reason} value={reason}>{PAUSE_REASON_LABELS[reason]}</option>)}
          </Select>
        </div>
        {pauseReason === PauseReason.OTHER ? (
          <Textarea className="mb-3" placeholder="Reason required for Other" value={pauseNotes} onChange={(event) => setPauseNotes(event.target.value)} />
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => setPauseOpen(false)}>Cancel</Button>
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

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-shop-muted">
        {label}
      </p>
      <p className="font-medium">{value || '—'}</p>
    </div>
  );
}
