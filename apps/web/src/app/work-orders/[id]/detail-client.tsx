'use client';

import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Check, ChevronDown, CircleAlert, MessageSquarePlus, Play } from 'lucide-react';
import { useSWRConfig } from 'swr';
import {
  AppCapability,
  BlockerReason,
  MECHANIC_BLOCKER_REASONS,
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
import { apiErrorMessage } from '@/lib/api-error-message';
import { draftKeys, useLocalDraft } from '@/lib/local-draft';
import { useShopLocale } from '@/lib/locale-context';
import { clockStoppedLine } from '@/lib/clock-stopped';
import { formatShopDateTime, pauseLabel, statusLabel } from '@/lib/format';
import { TruckInformationFields } from '@/components/truck-information-fields';
import { MechanicClockStrip } from '@/components/mechanic-clock-strip';
import { MechanicAvatar, MechanicAvatarStack } from '@/components/mechanic-avatar';
import { intlLocale } from '@/lib/shop-locale';
import { jobDisplayName } from '@/lib/job-display-name';
import { isStandardWorkWaitingOnManager, jobAssignmentLabel, jobPersonLabel, splitMyJobs } from '@/lib/job-assignment';
import { useWorkOrder } from '@/lib/shop-data';
import { isWorkOrderRelatedListKey } from '@/lib/swr-cache-keys';
import {
  Badge,
  Button,
  Card,
  CountChip,
  SectionCard,
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
  const { showToast, dismissToast } = useActionToast();
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
  // Block A (MG9): the closing note and the blocker note are drafts per Job, kept until sent.
  const [finishNotes, setFinishNotes, clearFinishNotes] = useLocalDraft(finishJob ? draftKeys.jobFinish(finishJob.id) : null);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [pauseReason, setPauseReason] = useState<PauseReason | ''>('');
  // LTR-155 / D17: the Job the mechanic is blocking, and note drafts per blocker.
  const [blockerJob, setBlockerJob] = useState<{ id: string; name: string } | null>(null);
  const [pauseNotes, setPauseNotes, clearPauseNotes] = useLocalDraft(blockerJob ? draftKeys.blockerNote(blockerJob.id) : null);
  // Block A (MG8): with "Other", the note is required; the button says so instead of staying grey.
  const [pauseNotesError, setPauseNotesError] = useState(false);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  // Stage MG-4 (UX-4-006): a blocker's note field opens when asked for.
  const [openBlockerNote, setOpenBlockerNote] = useState<string | null>(null);
  // Stage MG-4 (D-MG5): "Other work" starts folded; the phone remembers if the mechanic opens it.
  const [otherOpen, setOtherOpen] = useState(false);
  useEffect(() => {
    try { setOtherOpen(window.localStorage.getItem('ltl-other-work-open') === '1'); } catch { /* storage unavailable */ }
  }, []);
  const toggleOtherWork = () => setOtherOpen((open) => {
    try { window.localStorage.setItem('ltl-other-work-open', open ? '0' : '1'); } catch { /* storage unavailable */ }
    return !open;
  });
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
      setError(apiErrorMessage(e, messages, messages.actionFailed));
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (!sessionLoading && !token) {
    return <SessionSignInFallback />;
  }

  if (sessionLoading || !token || !wo) {
    // Block A (A12, MG6): a Work Order that does not load keeps the tabs and a way back to My work,
    // and says what happened: gone, no Jobs of mine anymore, or a failure to retry.
    const pmOnly = Boolean(user && user.capabilities.includes(AppCapability.MECHANIC_PM) && !user.capabilities.includes(AppCapability.MECHANIC_STANDARD));
    const myWorkHref = pmOnly ? '/mechanic/pm' : '/mechanic/standard';
    const backToMyWork = (
      <Button asChild variant="secondary" className="w-full">
        <Link href={myWorkHref}>{messages.backToMyWork}</Link>
      </Button>
    );
    const status = loadError instanceof ApiError ? loadError.status : null;
    let body: ReactNode = null;
    if (error) body = <p className="text-shop-muted" role="alert">{error}</p>;
    else if (status === 403 || status === 404) {
      body = (
        <div className="space-y-3" data-testid="work-order-unavailable">
          <InlineAlert>{status === 404 ? messages.workOrderGone : messages.noJobsHereAnymore}</InlineAlert>
          {backToMyWork}
        </div>
      );
    } else if (loadError instanceof Error) {
      body = (
        <div className="space-y-3">
          <LoadFailure message={apiErrorMessage(loadError, messages, messages.loadError)} onRetry={() => void mutateWorkOrder()} retryLabel={messages.retryWorkOrder} />
          {backToMyWork}
        </div>
      );
    }
    if (!body) return <PageSkeleton label={messages.loadingWorkOrder} />;
    return (
      <div>
        <WorkspaceNav mode={pmOnly ? MechanicMode.PM : MechanicMode.STANDARD} />
        <PageHeader className="mb-6" title={messages.workOrder} backHref={myWorkHref} />
        {body}
      </div>
    );
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

  // LTR-154 / D11: the mechanic completes only their own Jobs; the rest of the truck's work is read-only.
  const { mine, others, partDone } = splitMyJobs(wo, user?.id ?? '');
  const myTodo = mine.filter((job) => job.status === 'to_do');
  // LTR-155 / D17: a blocked Job waits for the Manager; only the others are workable.
  const myWorkable = myTodo.filter((job) => !job.activeBlocker);
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

  // Stage MG-4 (MG5, D-MG2): my own time on this Work Order; it runs live while my clock is here.
  const myLaborMs = liveLaborMs(wo.myActiveLaborMs ?? wo.totalActiveLaborMs, wo.laborRunning, fetchedAt, now);
  const myOpen = mine.filter((job) => job.status !== 'cancelled');
  const myDone = myOpen.filter((job) => job.status === 'completed').length;
  const nextJobId = myWorkable[0]?.id ?? null;
  const stoppedLine = !wo.resolvedBlocker && needsStart ? clockStoppedLine(wo.myClockStopped, messages) : null;
  const othersOpen = others.filter((job) => job.status !== 'cancelled');
  const blockerSince = (iso: string) => new Intl.DateTimeFormat(intlLocale(messages.locale), { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
  // LTR-197 / D28: let a Job taken from the team queue go back to it, then go home (it is no longer mine).
  const releaseToTeamQueue = async (jobId: string, jobName: string) => {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/team-queue/${jobId}/release`, { method: 'POST' });
      await mutateGlobal(isWorkOrderRelatedListKey, undefined, { revalidate: true, populateCache: false });
      void mutateGlobal('/api/team-queue');
      showToast('success', messages.teamQueueReleased(jobName));
      router.push('/');
    } catch (e) {
      setError(apiErrorMessage(e, messages, messages.actionFailed));
    } finally {
      setBusy(false);
    }
  };
  const startOrContinue = () => {
    // Block A (MG2): say when Start moved my clock from another Truck (D21).
    let movedFrom: WorkOrderDetailDto['clockMovedFrom'] = null;
    return run(
      async () => {
        const started = await apiFetch<WorkOrderDetailDto>(`/api/work-orders/${wo.id}/start`, {
          method: 'POST',
        });
        movedFrom = started.clockMovedFrom ?? null;
        return started;
      },
      undefined,
      () => showToast('success', movedFrom ? messages.clockMovedFromTo(movedFrom.truckNumber, wo.truckNumber) : messages.workStartedSuccess),
    );
  };

  return (
    <div>
      <WorkspaceNav mode={MechanicMode.STANDARD} />
      <MechanicClockStrip />
      <PageHeader
        className="mb-4"
        title={messages.truckTitle(wo.truckNumber)}
        subtitle={[vehicleLine(wo.truck), `${messages.workOrder} ${wo.displayId}`, messages.status[wo.status] ?? statusLabel(wo.status, messages.status)].filter(Boolean).join(' · ')}
        backHref="/mechanic/standard"
      />

      {/* One column: the mechanic screens keep the phone width on a computer too (UX-4-008: the mechanic works on the phone). */}
      <div>
        <div>
          {/* Stage MG-4 (UX-4-007, MG5): what matters to me here — my Jobs and my time. */}
          <section
            className={`mb-4 rounded-xl border bg-card p-4 ${wo.laborRunning ? 'border-primary ring-1 ring-primary' : ''}`}
            data-testid="my-summary"
            aria-live="off"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">{messages.myJobs}</p>
                <p className="text-lg font-semibold tnum">{messages.yourJobsDoneCount(myDone, myOpen.length)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">{messages.yourTimeLabel}</p>
                <div className="flex items-center justify-end gap-2 text-lg font-semibold tnum">
                  {formatLaborDuration(myLaborMs)}
                  <Badge variant={wo.laborRunning ? 'success' : 'secondary'}>
                    <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
                    {wo.laborRunning ? messages.laborRunningLabel : messages.laborStoppedLabel}
                  </Badge>
                </div>
              </div>
            </div>
            {wo.priority === 'high' || wo.priority === 'critical' ? (
              <div className="mt-2"><PriorityBadge priority={wo.priority}>{messages.priority[wo.priority] ?? wo.priority}</PriorityBadge></div>
            ) : null}
            {wo.currentPauseReason ? (
              <p className="mt-2 text-sm font-medium text-warning-foreground">
                {pauseLabel(wo.currentPauseReason, messages.pauseReason)}
              </p>
            ) : null}
            {stoppedLine ? (
              // LTR-186 / D20, D21: the day close or a Truck switch stopped my clock here; Continue below.
              <p className="mt-3 rounded-md bg-muted px-2.5 py-1.5 text-sm font-medium" role="status" data-testid="clock-stopped">
                {stoppedLine}
              </p>
            ) : null}
            {needsStart ? (
              <Button className="mt-3 w-full" disabled={busy} onClick={() => void startOrContinue()}>
                <Play aria-hidden="true" />
                {busy ? messages.startingWork : startedHereBefore ? messages.continueWork : messages.startWork}
              </Button>
            ) : null}
            {wo.status === 'waiting_paused' ? (
              <p className="mt-2 text-sm text-muted-foreground">{messages.pausedAskManager}</p>
            ) : null}
          </section>

          {finishedMyPart ? (
            <div className="mb-4 rounded-xl border border-success/40 bg-success/10 px-3 py-2 text-sm" role="status">
              <p className="font-medium">{messages.finishedYourPart(wo.truckNumber)}</p>
              <p>{waitingOnManager ? messages.waitingOnManagerBody : messages.finishedYourPartHint}</p>
            </div>
          ) : waitingOnManager ? (
            <p className="mb-4 rounded-xl border border-success/40 bg-success/10 px-3 py-2 text-sm" role="status">
              {messages.waitingOnManagerBody}
            </p>
          ) : null}

          {wo.resolvedBlocker ? (
            // LTR-164 (#9): who resolved my blocker and the Manager's note, until I tap Continue.
            <div className="mb-4 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-sm" role="status" data-testid="resolved-blocker">
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

          {(wo.activeBlockers ?? []).map((blocker) => (
            // Stage MG-4 (UX-4-006, UX-1-009): the blocker is a compact notice; the note field opens on request.
            <section
              key={blocker.id}
              className="mb-4 space-y-2 rounded-xl border border-warning/50 bg-warning-surface px-4 py-3 text-sm text-warning-foreground"
              aria-label={messages.activeBlockers}
              data-testid="active-blocker"
            >
              <p className="flex items-start gap-2 font-semibold">
                <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                {[blocker.job?.displayName, pauseLabel(blocker.blockerReason ?? blocker.reason, messages.pauseReason)].filter(Boolean).join(' · ')}
              </p>
              <p className="text-xs">{messages.blockerSinceBy(blockerSince(blocker.startedAt), blocker.reportedBy?.name ?? '—')}</p>
              {blocker.notes ? <p className="text-foreground">{blocker.notes}</p> : null}
              {(blocker.blockerNotes ?? []).length ? (
                <ul className="space-y-1">
                  {(blocker.blockerNotes ?? []).map((note) => (
                    <li key={note.id}>
                      <span className="text-xs">{note.author.name} · {formatShopDateTime(note.createdAt, messages.locale)}</span>
                      <p className="text-foreground">{note.body}</p>
                    </li>
                  ))}
                </ul>
              ) : null}
              {openBlockerNote === blocker.id ? (
                <form
                  className="space-y-2"
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
                        setOpenBlockerNote(null);
                        showToast('success', messages.blockerNoteAdded);
                      },
                    );
                  }}
                >
                  <Label htmlFor={`blocker-note-${blocker.id}`} className="text-foreground">{messages.noteForManager}</Label>
                  <Textarea
                    id={`blocker-note-${blocker.id}`}
                    aria-label={messages.addBlockerNote}
                    placeholder={messages.blockerNotePlaceholder}
                    value={noteDrafts[blocker.id] ?? ''}
                    onChange={(event) => setNoteDrafts((prev) => ({ ...prev, [blocker.id]: event.target.value }))}
                    disabled={busy}
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <Button type="button" variant="ghost" onClick={() => setOpenBlockerNote(null)}>{messages.cancelAction}</Button>
                    <Button type="submit" variant="outline" className="flex-1" disabled={busy || !(noteDrafts[blocker.id] ?? '').trim()}>
                      {messages.addBlockerNote}
                    </Button>
                  </div>
                </form>
              ) : (
                <Button type="button" variant="outline" className="bg-card" onClick={() => setOpenBlockerNote(blocker.id)}>
                  <MessageSquarePlus aria-hidden="true" />{messages.addNoteOpen}
                </Button>
              )}
            </section>
          ))}

          <SectionCard className="mb-4" title={messages.myJobs} count={myOpen.length} data-testid="your-jobs">
            {needsStart ? (
              <p className="border-b px-4 py-2 text-sm text-muted-foreground">{startedHereBefore ? messages.continueToCompleteJobs : messages.startWorkToCompleteJobs}</p>
            ) : myWorkable.length > 0 && wo.status === 'in_progress' ? (
              <p className="border-b px-4 py-2 text-sm text-muted-foreground">{messages.tapJobToComplete}</p>
            ) : null}
            {myOpen.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">{messages.noMyJobs}</p>
            ) : (
              <ul className="divide-y">
                {myOpen.map((job) => (
                  <li key={job.id} className="space-y-3 px-4 py-3">
                    <MyJobRow job={job} next={job.id === nextJobId} currentUserId={user?.id ?? ''} />
                    {job.status === 'to_do' && !job.activeBlocker ? (
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          className="flex-1"
                          variant={job.id === nextJobId ? 'default' : 'outline'}
                          disabled={busy || wo.status !== 'in_progress' || laborStopped}
                          aria-label={messages.completeJobFor(job.displayName)}
                          onClick={(event) => {
                            finishJobTriggerRef.current = event.currentTarget;
                            dismissToast();
                            setError(null);
                            setFinishJob({ id: job.id, name: job.displayName });
                          }}
                        >
                          <Check aria-hidden="true" />{messages.jobFinishConfirm}
                        </Button>
                        {wo.status === 'in_progress' || wo.status === 'created' ? (
                          <Button
                            type="button"
                            variant="outline"
                            className="flex-1"
                            disabled={busy}
                            aria-label={messages.reportBlockerFor(job.displayName)}
                            onClick={(event) => {
                              pauseTriggerRef.current = event.currentTarget;
                              dismissToast();
                              setError(null);
                              setPauseReason('');
                              setPauseNotesError(false);
                              setBlockerJob({ id: job.id, name: job.displayName });
                              setPauseOpen(true);
                            }}
                          >
                            <CircleAlert aria-hidden="true" />{messages.reportBlocker}
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                    {/* LTR-197 / D28: a Job taken from the team queue can go back to it (not while my time runs here). */}
                    {job.workflowStepKey && job.status === 'to_do' && !job.activeBlocker ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="-ml-2"
                        disabled={busy}
                        title={messages.teamQueueReleaseHint}
                        onClick={() => void releaseToTeamQueue(job.id, job.displayName)}
                        data-testid="release-to-team-queue"
                      >
                        {messages.teamQueueRelease}
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {othersOpen.length ? (
            // Stage MG-4 (UX-4-005, D-MG5): other mechanics' work, folded, with the count and their avatars.
            <section className="mb-4 overflow-hidden rounded-xl border bg-card" data-testid="other-work">
              <button
                type="button"
                className="flex min-h-12 w-full items-center gap-2 px-4 py-2 text-left"
                aria-expanded={otherOpen}
                aria-controls="other-work-panel"
                onClick={() => toggleOtherWork()}
              >
                <span className="text-base font-semibold">{messages.otherWorkOnThisTruck}</span>
                <CountChip>{othersOpen.length}</CountChip>
                <span className="ml-auto"><MechanicAvatarStack mechanics={uniqueMechanics(othersOpen)} max={4} /></span>
                <ChevronDown aria-hidden="true" className={`size-5 shrink-0 transition-transform ${otherOpen ? 'rotate-180' : ''}`} />
              </button>
              {otherOpen ? (
                <div id="other-work-panel" className="border-t">
                  <ul className="divide-y">
                    {othersOpen.map((job) => <OtherJobRow key={job.id} job={job} currentUserId={user?.id ?? ''} />)}
                  </ul>
                  <p className="border-t px-4 py-2 text-xs text-muted-foreground">{messages.otherWorkReadOnly}</p>
                </div>
              ) : null}
            </section>
          ) : null}
          {wo.status !== 'completed' && wo.status !== 'cancelled' ? (
            <p className="mb-4 text-sm text-muted-foreground">{messages.additionalWorkHint}</p>
          ) : null}
        </div>

        <div>
          <WorkOrderNotesThread
            wo={wo}
            onUpdated={async (updated) => {
              await mutateWorkOrder(updated, { revalidate: false });
            }}
          />

          <section className="mb-4 overflow-hidden rounded-xl border bg-card">
            <button
              type="button"
              className="flex min-h-12 w-full items-center justify-between px-4 py-2 text-left"
              onClick={() => setTruckOpen((v) => !v)}
              aria-expanded={truckOpen}
              aria-controls="truck-information-panel"
            >
              <span className="text-base font-semibold">{messages.truckInformation}</span>
              <ChevronDown className={`size-5 transition-transform ${truckOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
            {truckOpen ? (
              <div id="truck-information-panel" className="space-y-3 border-t p-4">
                <TruckInformationFields truck={wo.truck} locale={messages.locale} />
                <Button asChild variant="secondary" className="w-full">
                  <Link href={`/trucks/${wo.truckId}/history?from=${encodeURIComponent(`/work-orders/${wo.id}`)}`}>
                    {messages.repairHistory}
                  </Link>
                </Button>
              </div>
            ) : null}
          </section>
        </div>
      </div>

      <Modal
        open={!!finishJob}
        title={finishJob ? messages.completeJobTitle(finishJob.name) : messages.jobFinishTitle}
        description={finishJob ? (myWorkable.length === 1 && myWorkable[0].id === finishJob.id ? messages.completeLastHint : messages.completeKeepsRunning) : undefined}
        closeLabel={messages.closeDialog}
        onClose={() => {
          if (busy) return;
          setFinishJob(null);
          setError(null);
        }}
        returnFocusRef={finishJobTriggerRef}
      >
        {error ? <InlineAlert className="mb-3">{error}</InlineAlert> : null}
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
                  clearFinishNotes();
                  setFinishJob(null);
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
        description={messages.blockerSheetHint}
        closeLabel={messages.closeDialog}
        onClose={() => {
          if (busy) return;
          setPauseOpen(false);
          setBlockerJob(null);
          setError(null);
        }}
        returnFocusRef={pauseTriggerRef}
      >
        {error ? <InlineAlert className="mb-3">{error}</InlineAlert> : null}
        {/* Stage MG-5 (UX-7-005): the reasons are big options, all visible; "Waiting for Parts" first, "Other" last. */}
        <fieldset className="mb-3">
          <legend className="mb-2 text-sm font-medium">{messages.blockerReason}</legend>
          <div className="space-y-1.5" role="radiogroup" aria-label={messages.blockerReason}>
            {MECHANIC_BLOCKER_REASONS.map((r) => {
              const reason = r as unknown as PauseReason;
              const checked = pauseReason === reason;
              return (
                <label
                  key={r}
                  className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 text-sm ${checked ? 'border-primary bg-primary/10 font-medium' : 'hover:bg-accent'}`}
                >
                  <input
                    type="radio"
                    name="pause-reason"
                    value={r}
                    checked={checked}
                    disabled={busy}
                    onChange={() => { setPauseReason(reason); setPauseNotesError(false); }}
                    className="size-4 accent-primary"
                  />
                  {messages.pauseReason[reason]}
                </label>
              );
            })}
          </div>
        </fieldset>
        {/* Block A (MG8): the note is always there (what part, which tool); required only with "Other". */}
        <div className="mb-3">
          <Label className="mb-2 block" htmlFor="pause-notes">
            {pauseReason === PauseReason.OTHER ? messages.blockerNoteRequiredLabel : messages.blockerNoteOptionalLabel}
          </Label>
          <Textarea
            id="pause-notes"
            placeholder={pauseReason === PauseReason.OTHER ? messages.reasonRequiredForOther : messages.blockerReportPlaceholder}
            value={pauseNotes}
            onChange={(e) => { setPauseNotes(e.target.value); setPauseNotesError(false); }}
            disabled={busy}
            aria-invalid={pauseNotesError || undefined}
            aria-describedby={pauseNotesError ? 'pause-notes-error' : undefined}
          />
          {pauseNotesError ? <p id="pause-notes-error" className="mt-2 text-sm text-destructive-text" role="alert">{messages.blockerNoteRequired}</p> : null}
        </div>
        {/* LTR-169 / LTR-189 (W13): a disabled button says why — above the buttons, where the floating button cannot cover it. */}
        {!pauseReason ? <p className="mb-3 text-sm text-muted-foreground">{messages.blockerReasonRequiredHint}</p> : null}
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
            disabled={!pauseReason || !blockerJob || busy}
            onClick={() => {
              if (busy || !blockerJob) return;
              if (pauseReason === PauseReason.OTHER && !pauseNotes.trim()) {
                setPauseNotesError(true);
                return;
              }
              void run(
                () =>
                  apiFetch<WorkOrderDetailDto>(`/api/work-orders/${wo.id}/blockers`, {
                    method: 'POST',
                    body: JSON.stringify({
                      jobId: blockerJob.id,
                      reason: pauseReason,
                      notes: pauseNotes.trim() || undefined,
                    }),
                  }),
                undefined,
                () => {
                  clearPauseNotes();
                  setPauseOpen(false);
                  setBlockerJob(null);
                  setPauseReason('');
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

/** Stage MG-4: one of my Jobs — its state, "Next", the category only when it adds something, and a block. */
function MyJobRow({ job, next, currentUserId }: { job: WorkOrderJobDto; next: boolean; currentUserId: string }) {
  const { messages } = useShopLocale();
  const done = job.status === 'completed';
  const blocked = job.status === 'to_do' && job.activeBlocker;
  const name = jobDisplayName(job, messages.helperJobSuffix);
  const detail = [job.category.name !== job.displayName ? job.category.name : null, job.helperOfJobId ? jobPersonLabel(job, currentUserId, messages) : null].filter(Boolean).join(' · ');
  return (
    <div className="flex items-start gap-3" data-testid="my-job" aria-current={next ? 'step' : undefined}>
      {done ? (
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-success/15 text-success"><Check aria-hidden="true" className="size-4" /></span>
      ) : blocked ? (
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-warning/20 text-warning-foreground dark:text-warning"><CircleAlert aria-hidden="true" className="size-4" /></span>
      ) : (
        <span aria-hidden="true" className={`size-6 shrink-0 rounded-full border-2 ${next ? 'border-primary' : 'border-muted-foreground/50'}`} />
      )}
      <div className="min-w-0 flex-1">
        <p className={`break-words text-base ${done ? 'text-muted-foreground line-through' : 'font-medium'}`}>
          {name}
          {next ? <span className="ml-2 text-xs font-semibold text-primary">{messages.nextJob}</span> : null}
        </p>
        {detail ? <p className="text-xs text-muted-foreground">{detail}</p> : null}
        {job.external ? <p className="text-xs text-muted-foreground">{messages.jobAtExternalShop}</p> : null}
        {/* D42 / S-6: why this Job is here when it came from a Samsara fault. */}
        {job.samsaraFaults?.map((fault) => (
          <p key={fault.code} className="text-xs text-muted-foreground" data-testid="job-samsara-fault">
            {messages.jobSamsaraFault(fault.code, fault.description)}
          </p>
        ))}
        {blocked ? (
          <p className="text-xs font-medium text-warning-foreground dark:text-warning">
            {messages.blockedWithReason(pauseLabel(job.activeBlocker!.reason, messages.pauseReason) ?? '')} · {messages.waitingOnManagerShort}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** Stage MG-4 (UX-4-005): someone else's Job, one line — read-only (LTR-189 W12). */
function OtherJobRow({ job, currentUserId }: { job: WorkOrderJobDto; currentUserId: string }) {
  const { messages } = useShopLocale();
  const status = job.status === 'completed'
    ? { label: messages.jobStatus.completed, tone: 'success' as const }
    : job.activeBlocker
      ? { label: messages.blockedWithReason(pauseLabel(job.activeBlocker.reason, messages.pauseReason) ?? ''), tone: 'warning' as const }
      : job.workStatus === 'in_progress'
        ? { label: messages.jobStatusInProgress, tone: 'default' as const }
        : { label: messages.jobStatusPending, tone: 'secondary' as const };
  return (
    <li className="flex items-center gap-3 px-4 py-2.5 text-sm" data-testid="job-read-only" data-external={job.external ? job.external.kind : undefined}>
      {job.assignedMechanic ? <MechanicAvatar id={job.assignedMechanic.id} name={job.assignedMechanic.name} size="sm" /> : <span className="size-6 shrink-0" />}
      <span className="min-w-0 flex-1 truncate">
        {jobDisplayName(job, messages.helperJobSuffix)}
        <span className="text-xs text-muted-foreground"> · {job.external ? messages.jobAtExternalShop : jobAssignmentLabel(job.assignedMechanic, currentUserId, messages)}</span>
      </span>
      <Badge variant={status.tone}><span aria-hidden="true" className="size-1.5 rounded-full bg-current" />{status.label}</Badge>
    </li>
  );
}

function uniqueMechanics(jobs: WorkOrderJobDto[]) {
  const seen = new Map<string, { id: string; name: string }>();
  for (const job of jobs) if (job.assignedMechanic && !seen.has(job.assignedMechanic.id)) seen.set(job.assignedMechanic.id, job.assignedMechanic);
  return [...seen.values()];
}
