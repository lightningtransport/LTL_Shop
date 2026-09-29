'use client';

import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { useSWRConfig } from 'swr';
import {
  AppCapability,
  BlockerReason,
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
import { formatMileage, formatShopDateTime, pauseLabel, statusLabel } from '@/lib/format';
import { TruckInformationFields } from '@/components/truck-information-fields';
import { isStandardWorkWaitingOnManager, jobAssignmentLabel, jobPersonLabel, splitMyJobs } from '@/lib/job-assignment';
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
  PageHeader,
  Select,
  Textarea,
  WorkspaceNav,
} from '@/components/ui';
import { PmServiceCard, type PmDraftState } from '@/components/pm-service-card';
import { PmJobDetail } from '@/components/pm-job-detail';
import { WorkOrderNotesThread } from '@/components/work-order-notes-thread';
import { jobCategoriesLine, liveLaborMs, vehicleLine } from '@/lib/work-order-identity';
import { optimisticCompleteJob } from '@/lib/optimistic-complete-job';

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
  // LTR-155 / D17: the Job the mechanic is blocking, and note drafts per blocker.
  const [blockerJob, setBlockerJob] = useState<{ id: string; name: string } | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
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

  const done = wo.jobs.filter((j) => j.status === 'completed');
  // LTR-154 / D11: the mechanic completes only their own Jobs; the rest of the truck's work is read-only.
  const { mine, others, partDone } = splitMyJobs(wo, user?.id ?? '');
  const myTodo = mine.filter((job) => job.status === 'to_do');
  // LTR-155 / D17: a blocked Job waits for the Manager; only the others are workable.
  const myWorkable = myTodo.filter((job) => !job.activeBlocker);
  const otherTodo = others.filter((job) => job.status === 'to_do');
  const waitingOnManager = isStandardWorkWaitingOnManager(wo);
  // LTR-154 / D18: labor is per mechanic. `laborRunning` is the viewer's own session;
  // it stops when they finish their part and "Continue" reopens it for a new Job.
  // `laborRunning === false` keeps older API responses (field absent) unchanged.
  const laborStopped = wo.status === 'in_progress' && wo.laborRunning === false;
  const needsStart = (wo.status === 'created' || laborStopped) && myWorkable.length > 0;
  // LTR-164 (#6): a mechanic who has not worked here yet starts; one who stopped continues.
  const startedHereBefore = wo.myLaborStarted ?? wo.status !== 'created';
  const finishedMyPart = partDone && (wo.status === 'in_progress' || wo.status === 'created');
  const laborMs = liveLaborMs(wo.totalActiveLaborMs, wo.laborRunning, fetchedAt, now);

  return (
    <div>
      <WorkspaceNav mode={MechanicMode.STANDARD} />
      <PageHeader
        className="mb-6"
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

      {finishedMyPart ? (
        <div className="mb-4 rounded-xl border border-shop-accent/40 bg-shop-accent/10 px-3 py-2 text-sm" role="status">
          <p className="font-medium">{messages.finishedYourPart(wo.truckNumber)}</p>
          <p>{waitingOnManager ? messages.waitingOnManagerBody : messages.finishedYourPartHint}</p>
        </div>
      ) : waitingOnManager ? (
        <p className="mb-4 rounded-xl border border-shop-accent/40 bg-shop-accent/10 px-3 py-2 text-sm" role="status">
          {messages.waitingOnManagerBody}
        </p>
      ) : null}

      {wo.resolvedBlocker ? (
        // LTR-164 (#9): who resolved my blocker and the Manager's note, until I tap Continue.
        <div className="mb-4 rounded-xl border border-shop-accent/40 bg-shop-accent/10 px-3 py-2 text-sm" role="status" data-testid="resolved-blocker">
          <p className="font-medium">
            {messages.resolvedBlockerTitle(wo.resolvedBlocker.job?.displayName ?? '', wo.resolvedBlocker.resolvedBy?.name ?? '')}
          </p>
          {wo.resolvedBlocker.resolutionNote ? <p>{messages.managerNote(wo.resolvedBlocker.resolutionNote)}</p> : null}
          <p>{messages.resolvedBlockerHint}</p>
        </div>
      ) : null}

      {error && !finishJob && !pauseOpen ? (
        <InlineAlert className="mb-3">{error}</InlineAlert>
      ) : null}

      {wo.primaryCategoryName === 'PM' ? <PmServiceCard workOrderId={wo.id} /> : null}

      {(wo.activeBlockers ?? []).length ? (
        // LTR-155 / D17: the mechanic sees each blocked Job and adds notes; only the Manager resolves.
        <section className="mb-4 space-y-2" aria-labelledby="active-blockers-title">
          <p id="active-blockers-title" className="group-title">{messages.activeBlockers}</p>
          <p className="text-sm text-muted-foreground">{messages.blockerWaitsForManager}</p>
          <ul className="space-y-2">
            {(wo.activeBlockers ?? []).map((blocker) => (
              <li key={blocker.id} className="space-y-2 rounded-xl bg-warning-surface px-3 py-2 text-sm text-warning-foreground">
                <p className="font-medium">
                  {[blocker.job?.displayName, messages.blockedWithReason(pauseLabel(blocker.blockerReason ?? blocker.reason, messages.pauseReason) ?? '')].filter(Boolean).join(' · ')}
                </p>
                {blocker.notes ? <p>{blocker.notes}</p> : null}
                {(blocker.blockerNotes ?? []).length ? (
                  <ul className="space-y-1">
                    {(blocker.blockerNotes ?? []).map((note) => (
                      <li key={note.id}>
                        <span className="text-xs">{note.author.name} · {formatShopDateTime(note.createdAt, messages.locale)}</span>
                        <p>{note.body}</p>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <form
                  className="flex flex-col gap-2 sm:flex-row"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const body = (noteDrafts[blocker.id] ?? '').trim();
                    if (!body) return;
                    void run(
                      () => apiFetch<WorkOrderDetailDto>(`/api/work-orders/${wo.id}/blockers/${blocker.id}/notes`, {
                        method: 'POST',
                        body: JSON.stringify({ body }),
                      }),
                      undefined,
                      () => {
                        setNoteDrafts((prev) => ({ ...prev, [blocker.id]: '' }));
                        showToast('success', messages.blockerNoteAdded);
                      },
                    );
                  }}
                >
                  <Textarea
                    aria-label={messages.addBlockerNote}
                    placeholder={messages.blockerNotePlaceholder}
                    value={noteDrafts[blocker.id] ?? ''}
                    onChange={(event) => setNoteDrafts((prev) => ({ ...prev, [blocker.id]: event.target.value }))}
                    disabled={busy}
                    rows={2}
                  />
                  <Button type="submit" variant="secondary" disabled={busy || !(noteDrafts[blocker.id] ?? '').trim()}>
                    {messages.addBlockerNote}
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* LTR-164 (#5): the section only shows when it has something (Start / Continue or the pause note). */}
      {needsStart || wo.status === 'waiting_paused' ? (
        <section className="mb-4 space-y-2">
          <p className="group-title">{messages.workOptions}</p>
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
              {busy ? messages.startingWork : startedHereBefore ? messages.continueWork : messages.startWork}
            </Button>
          ) : null}
          {wo.status === 'waiting_paused' ? (
            <p className="text-sm text-muted-foreground">{messages.pausedAskManager}</p>
          ) : null}
        </section>
      ) : null}

      <section className="card mb-4">
        <Button
          variant="ghost"
          className="w-full justify-between px-0"
          onClick={() => setTruckOpen((v) => !v)}
          aria-expanded={truckOpen}
          aria-controls="truck-information-panel"
        >
          <span className="group-title">{messages.truckInformation}</span>
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
        <p className="group-title mb-2">{messages.myJobs}</p>
        {/* LTR-131: say why Jobs are disabled before Start Work. */}
        {needsStart ? (
          <p className="mb-2 text-sm text-muted-foreground">{startedHereBefore ? messages.continueToCompleteJobs : messages.startWorkToCompleteJobs}</p>
        ) : myWorkable.length > 0 && wo.status === 'in_progress' ? (
          <p className="mb-2 text-sm text-muted-foreground">{messages.tapJobToComplete}</p>
        ) : null}
        {myTodo.length === 0 ? (
          <EmptyState>{mine.length > 0 ? messages.noPendingJobs : messages.noMyJobs}</EmptyState>
        ) : (
          <ul className="mb-3 space-y-2">
            {myTodo.map((job) => (
              <li key={job.id} className="space-y-1">
                {job.activeBlocker ? (
                  <JobTodoButton job={job} currentUserId={user?.id ?? ''} readOnly disabled onSelect={() => undefined} />
                ) : (
                  <>
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
                    {wo.status === 'in_progress' || wo.status === 'created' ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="w-full"
                        disabled={busy}
                        aria-label={messages.reportBlockerFor(job.displayName)}
                        onClick={(event) => {
                          pauseTriggerRef.current = event.currentTarget;
                          setPauseReason('');
                          setPauseNotes('');
                          setBlockerJob({ id: job.id, name: job.displayName });
                          setPauseOpen(true);
                        }}
                      >
                        {messages.reportBlocker}
                      </Button>
                    ) : null}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        {otherTodo.length ? (
          <>
            <p className="group-title mb-1">{messages.otherWorkOnThisTruck}</p>
            <p className="mb-2 text-xs text-muted-foreground">{messages.otherWorkReadOnly}</p>
            <ul className="mb-3 space-y-2">
              {otherTodo.map((job) => (
                <li key={job.id}>
                  <JobTodoButton job={job} currentUserId={user?.id ?? ''} readOnly disabled onSelect={() => undefined} />
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
        <p className="group-title mb-2">{messages.jobStatus.completed}</p>
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
        <Label className="mb-2 block" htmlFor="finish-job-notes">
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
                (current) =>
                  optimisticCompleteJob(
                    current,
                    jobId,
                    user?.id ?? null,
                    notesToSave ?? null,
                    new Date().toISOString(),
                  ),
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
        open={pauseOpen && Boolean(blockerJob)}
        title={blockerJob ? messages.reportBlockerFor(blockerJob.name) : messages.reportBlocker}
        closeLabel={messages.closeDialog}
        onClose={() => {
          if (busy) return;
          setPauseOpen(false);
          setBlockerJob(null);
        }}
        returnFocusRef={pauseTriggerRef}
      >
        {error ? <InlineAlert className="mb-3">{error}</InlineAlert> : null}
        <Label className="mb-2 block" htmlFor="pause-reason">
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
            {/* LTR-155 / D12: mechanic reasons only (no Break, End of Shift, other Work Order, Truck Unavailable). */}
            {Object.values(BlockerReason).map((r) => (
              <option key={r} value={r}>
                {messages.pauseReason[r as unknown as PauseReason]}
              </option>
            ))}
          </Select>
        </div>
        {pauseReason === PauseReason.OTHER ? (
          <div className="mb-3">
            <Label className="mb-2 block" htmlFor="pause-notes">
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
            disabled={!pauseReason || !blockerJob || busy || (pauseReason === PauseReason.OTHER && !pauseNotes.trim())}
            onClick={() => {
              if (busy || !blockerJob) return;
              void run(
                () =>
                  apiFetch<WorkOrderDetailDto>(`/api/work-orders/${wo.id}/blockers`, {
                    method: 'POST',
                    body: JSON.stringify({
                      jobId: blockerJob.id,
                      reason: pauseReason,
                      notes: pauseNotes || undefined,
                    }),
                  }),
                undefined,
                () => {
                  setPauseOpen(false);
                  setBlockerJob(null);
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
      <PageHeader
        className="mb-6"
        title={messages.truckTitle(wo.truckNumber)}
        subtitle={[vehicleLine(wo.truck), `${messages.workOrder} ${wo.displayId}`, messages.status[wo.status] ?? statusLabel(wo.status, messages.status)].filter(Boolean).join(' · ')}
        backHref="/mechanic/pm"
      />

      {error ? <InlineAlert className="mb-3">{error}</InlineAlert> : null}

      <section className="card mb-4 space-y-3" aria-labelledby="pm-truck-information">
        <h2 id="pm-truck-information" className="group-title">{messages.truckInformation}</h2>
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
          <Label htmlFor="pm-change-pause-reason">Change Pause Reason</Label>
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
        <Label className="mb-2 block" htmlFor="pm-pause-reason">{messages.pauseReasonLabel}</Label>
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
  /** LTR-154 / D11: another mechanic's or an unassigned Job is listed without "Complete job". */
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
          {[
            jobAssignmentLabel(job.assignedMechanic, currentUserId, messages),
            job.activeBlocker
              ? messages.blockedWithReason(pauseLabel(job.activeBlocker.reason, messages.pauseReason) ?? '')
              : job.workStatus === 'in_progress' ? messages.jobStatusInProgress : job.workStatus === 'pending' ? messages.jobStatusPending : null,
          ].filter(Boolean).join(' · ')}
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
