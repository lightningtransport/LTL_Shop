'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { AppCapability, MechanicMode, type WorkOrderDetailDto, type WorkOrderSummaryDto } from '@ltl-shop/shared';
import { useAuth } from '@/lib/auth-context';
import { SessionSignInFallback } from '@/components/session-sign-in-fallback';
import { PmInProgressNotice } from '@/components/pm-in-progress-notice';
import { useActionToast } from '@/components/action-toast';
import { StandardHome } from '@/components/mechanic-home';
import { PmHome } from '@/components/pm-home';
import { TeamQueueCard } from '@/components/team-queue-card';
import { replaceAppLocation } from '@/lib/session-restore';
import { apiFetch } from '@/lib/api';
import { apiErrorMessage } from '@/lib/api-error-message';
import { intlLocale } from '@/lib/shop-locale';
import { useWorkOrders } from '@/lib/shop-data';
import { isWorkOrderRelatedListKey } from '@/lib/swr-cache-keys';
import { pauseLabel, statusLabel } from '@/lib/format';
import { useSWRConfig } from 'swr';
import { isMyJob, isMyPartDone, isStandardWorkWaitingOnManager, jobPersonLabel } from '@/lib/job-assignment';
import { useShopLocale } from '@/lib/locale-context';
import { clockStoppedLine } from '@/lib/clock-stopped';
import { defaultWorkspacePath } from '@/lib/admin-routing';
import {
  Button,
  Card,
  CardListSkeleton,
  EmptyState,
  HomeTopBar,
  InlineAlert,
  LoadFailure,
  PageSkeleton,
  PriorityBadge,
  PageHeader,
  buttonVariants,
} from '@/components/ui';
import { cn } from '@/lib/utils';
import { jobCategoriesLine, vehicleLine } from '@/lib/work-order-identity';
import { jobDisplayName } from '@/lib/job-display-name';

export default function HomePage() {
  const { user, token, sessionLoading, sessionError, retrySession } = useAuth();
  const { messages } = useShopLocale();
  const router = useRouter();
  const pathname = usePathname();
  const mode = pathname === '/mechanic/pm'
    ? MechanicMode.PM
    : pathname === '/mechanic/standard'
      ? MechanicMode.STANDARD
      : null;
  const requiredCapability = mode === MechanicMode.PM
    ? AppCapability.MECHANIC_PM
    : AppCapability.MECHANIC_STANDARD;
  const hasWorkspaceAccess = !!mode && !!user?.capabilities.includes(requiredCapability);
  const { data, error, mutate } = useWorkOrders(!!token && hasWorkspaceAccess, mode ?? undefined);

  useEffect(() => {
    if (!sessionLoading && !token && !sessionError) replaceAppLocation('/login', router);
    if (!sessionLoading && token && user && !mode) {
      replaceAppLocation(defaultWorkspacePath(user), router);
    }
  }, [sessionLoading, token, sessionError, user, mode, requiredCapability, router]);

  // LTR-167: while the session restores, show the workspace title the page will land on, so it does not jump.
  const workspaceTitle = mode === MechanicMode.PM ? messages.pmHomeTitle : mode ? messages.standardHomeTitle : messages.home;
  const workspaceSubtitle = mode === MechanicMode.PM ? messages.pmHomeSubtitle : mode ? messages.standardHomeSubtitle : messages.homeSubtitle;

  if (!token) {
    if (sessionError) {
      return (
        <div>
          <HomeTopBar mode={mode ?? undefined} />
          <PageHeader className="mb-6" title={workspaceTitle} subtitle={workspaceSubtitle} />
          <LoadFailure message={sessionError} onRetry={retrySession} retryLabel={messages.retry} />
        </div>
      );
    }
    if (sessionLoading) {
      return (
        <div>
          <HomeTopBar mode={mode ?? undefined} />
          <PageHeader className="mb-6" title={workspaceTitle} subtitle={workspaceSubtitle} />
          <PageSkeleton label={messages.restoringSession} header={false} />
        </div>
      );
    }
    return <SessionSignInFallback />;
  }

  if (!user) {
    return (
      <div>
        <HomeTopBar mode={mode ?? undefined} />
        <PageHeader className="mb-6" title={workspaceTitle} subtitle={workspaceSubtitle} />
        {sessionError ? (
          <LoadFailure
            message={sessionError}
            onRetry={retrySession}
            retryLabel={messages.retry}
          />
        ) : (
          <PageSkeleton label={messages.restoringSession} header={false} />
        )}
      </div>
    );
  }

  if (!mode) {
    const allowedHome = defaultWorkspacePath(user);
    return (
      <div>
        <HomeTopBar />
        <PageHeader className="mb-6" title={messages.home} subtitle={messages.homeSubtitle} />
        <Button asChild className="w-full">
          <Link href={allowedHome}>{messages.openAllowedHome}</Link>
        </Button>
      </div>
    );
  }

  if (!hasWorkspaceAccess) {
    const allowedHome = defaultWorkspacePath(user);
    return (
      <div>
        <HomeTopBar />
        <PageHeader
          className="mb-6"
          title={mode === MechanicMode.PM ? messages.pmHomeTitle : messages.standardHomeTitle}
        />
        <EmptyState>
          <p>{messages.workspaceUnavailable}</p>
          <Button asChild variant="outline" className="mt-4">
            <Link href={allowedHome}>{messages.openAllowedHome}</Link>
          </Button>
        </EmptyState>
      </div>
    );
  }

  const isPm = mode === MechanicMode.PM;
  // LTR-154 / D18: my part done (or every Job done) waits on the Manager.
  const partDone = (wo: WorkOrderSummaryDto) => isStandardWorkWaitingOnManager(wo) || isMyPartDone(wo, user.id);
  const waitingOnManager = data && !isPm ? data.active.filter(partDone) : [];
  const activeWork = data ? (isPm ? data.active : data.active.filter((wo) => !partDone(wo))) : [];

  return (
    <div>
      <HomeTopBar mode={mode} />
      <PageHeader
        className="mb-6"
        title={isPm ? messages.pmHomeTitle : messages.standardHomeTitle}
        subtitle={isPm ? messages.pmHomeSubtitle : messages.standardHomeSubtitle}
      />


      {error ? (
        <div className="mb-4">
          <LoadFailure
            message={apiErrorMessage(error, messages, messages.unableToLoadWorkOrders)}
            onRetry={() => void mutate()}
            retryLabel={messages.retry}
          />
        </div>
      ) : null}

      {!data && !error ? (
        <div role="status" aria-label={messages.loadingWorkOrders} aria-live="polite">
          <CardListSkeleton />
          <span className="sr-only">{messages.loadingWorkOrders}</span>
        </div>
      ) : null}

      {/* Stage MG-3: the General mechanic's home (docs/proposals/mechanic-standard-redesign). */}
      {/* LTR-197 / D28: Jobs of my Shop workflow steps waiting for someone on the team to take them. */}
      <TeamQueueCard enabled={!!token && hasWorkspaceAccess} />
      {data && !isPm ? <StandardHome data={data} userId={user.id} StartAction={StartWorkAction} /> : null}

      {/* Stage PM-3: the PM mechanic's home (docs/proposals/mechanic-pm-redesign). */}
      {isPm && !error ? <PmHome data={data} loading={false} /> : null}
    </div>
  );
}

function WorkOrderCard({
  wo,
  mode,
  currentUserId,
  pmWorkspace = false,
  startBlocked = false,
}: {
  wo: WorkOrderSummaryDto;
  mode: 'created' | 'active' | 'waiting_on_manager' | 'paused' | 'completed';
  currentUserId: string;
  pmWorkspace?: boolean;
  /** LTR-189 (W14) / D2: another PM service is running, so this one can only be viewed for now. */
  startBlocked?: boolean;
}) {
  const { messages } = useShopLocale();
  // LTR-146: in the PM workspace a truck Work Order shows only its PM job.
  const pmJob = pmWorkspace && wo.primaryCategoryName !== 'PM' ? wo.pmJob ?? null : null;
  const isPm = wo.primaryCategoryName === 'PM' || Boolean(pmJob);
  const detailHref = pmJob ? `/work-orders/${wo.id}?view=pm` : `/work-orders/${wo.id}`;
  const myJobs = isPm ? [] : wo.jobs.filter((job) => isMyJob(job.assignedMechanic, currentUserId));
  const nextJobId = myJobs.find((job) => job.status === 'to_do' && !job.activeBlocker)?.id ?? null;
  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-xl font-bold">
            {messages.truckTitle(wo.truckNumber)}
          </p>
          {vehicleLine(wo.truckVehicle) ? (
            <p className="text-sm text-shop-muted">{vehicleLine(wo.truckVehicle)}</p>
          ) : null}
          <p className="text-sm text-shop-muted">
            {messages.workOrder} {wo.displayId}
            {' · '}
            {/* LTR-170: priority is the badge on the right; the line does not repeat it. */}
            {mode === 'paused'
              ? pauseLabel(wo.currentPauseReason, messages.pauseReason)
              : messages.status[wo.workOrderStatus ?? wo.status] ?? statusLabel(wo.workOrderStatus ?? wo.status, messages.status)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {!isPm ? <PriorityBadge priority={wo.priority}>{messages.priority[wo.priority] ?? wo.priority}</PriorityBadge> : null}
          {/* LTR-158 / D18: the Manager resolved my blocker; my time waits for Continue. */}
          {wo.resolvedBlockerAwaitingContinue ? (
            <span className="rounded-full bg-shop-accent/15 px-2 py-0.5 text-xs font-semibold text-shop-accent" data-testid="resolved-tap-continue">
              {messages.resolvedTapContinue}
            </span>
          ) : clockStoppedLine(wo.myClockStopped, messages) ? (
            // LTR-186 / D20, D21: the day close or a Truck switch stopped my clock here.
            <span className="rounded-full bg-shop-accent/15 px-2 py-0.5 text-right text-xs font-semibold text-shop-accent" data-testid="clock-stopped-tap-continue">
              {clockStoppedLine(wo.myClockStopped, messages)}
            </span>
          ) : null}
        </div>
      </div>
      <p className="text-sm text-shop-muted">
        {pmJob
          ? messages.pmJobOnWorkOrder(pmJob.displayName, wo.displayId)
          : isPm
          ? messages.pmServiceLabel
          : [myJobs.length ? messages.yourJobsCount(myJobs.length) : null, jobCategoriesLine(myJobs.length ? myJobs : wo.jobs)].filter(Boolean).join(' · ')}
      </p>
      {isPm && (pmJob ? pmJob.startedAt : wo.startedAt) && mode !== 'completed' ? (
        <p className="text-xs text-shop-muted">
          {messages.pmStartedAt(new Intl.DateTimeFormat(intlLocale(messages.locale), { dateStyle: 'medium', timeStyle: 'short' }).format(new Date((pmJob ? pmJob.startedAt : wo.startedAt)!)))}
        </p>
      ) : null}
      {!isPm && mode !== 'completed' && myJobs.length > 0 ? (
        <ul className="space-y-2 text-sm">
          {/* LTR-154 / D11: only my Jobs, with the next one marked. */}
          {myJobs.map((job) => (
            <li key={job.id} className="flex items-start gap-2" aria-current={job.id === nextJobId ? 'step' : undefined}>
              {/* LTR-167: a status mark, not a checkbox; the card's "View Work" is the action. */}
              {job.status === 'completed' ? (
                <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-shop-success" />
              ) : (
                <span aria-hidden="true" className="mt-2 size-2 shrink-0 rounded-full bg-shop-muted/60" />
              )}
              <span className="min-w-0">
                <span
                  className={`block ${
                    job.status === 'completed' ? 'text-shop-muted line-through' : ''
                  }`}
                >
                  {jobDisplayName(job, messages.helperJobSuffix)}
                  {job.id === nextJobId ? <span className="ml-2 text-xs font-semibold text-shop-accent">{messages.nextJob}</span> : null}
                </span>
                <span className="block text-xs text-shop-muted">
                  {jobPersonLabel(job, currentUserId, messages)}
                  {/* LTR-155 / D17: a blocked Job waits for the Manager. */}
                  {job.status === 'to_do' && job.activeBlocker
                    ? ` · ${messages.blockedWithReason(pauseLabel(job.activeBlocker.reason, messages.pauseReason) ?? '')}`
                    : ''}
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        {pmJob ? (
          <WorkOrderActionLink
            href={detailHref}
            action={mode === 'completed' ? messages.viewCompletedWorkAction : pmJob.startedAt ? messages.continuePmService : startBlocked ? messages.viewWork : messages.startPmService}
            wo={wo}
            variant={mode === 'completed' || startBlocked ? 'secondary' : undefined}
            className="w-full"
          />
        ) : mode === 'completed' ? (
          <WorkOrderActionLink href={`/work-orders/${wo.id}`} action={messages.viewCompletedWorkAction} wo={wo} variant="secondary" className="flex-1" />
        ) : mode === 'paused' || mode === 'waiting_on_manager' ? (
          <WorkOrderActionLink href={`/work-orders/${wo.id}`} action={messages.viewDetails} wo={wo} className="w-full" />
        ) : mode === 'created' ? (
          <StartWorkAction wo={wo} className="flex-1" />
        ) : nextJobId && clockStoppedLine(wo.myClockStopped, messages) ? (
          // Block A (MG4): the line says "tap Continue", so the button is Continue, not "View Work".
          <StartWorkAction wo={wo} className="flex-1" label={messages.continueWork} />
        ) : (
          <WorkOrderActionLink href={`/work-orders/${wo.id}`} action={messages.viewWork} wo={wo} className="w-full" />
        )}
      </div>
    </Card>
  );
}

function StartWorkAction({
  wo,
  className,
  label,
  variant = 'default',
}: {
  wo: WorkOrderSummaryDto;
  className?: string;
  /** Block A (MG4): "Continue" where my clock stopped; "Start Work" otherwise. */
  label?: string;
  /** Stage MG-3 (UX-4-001): only the next work is the primary button. */
  variant?: 'default' | 'outline';
}) {
  const { messages } = useShopLocale();
  const { showToast } = useActionToast();
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startLabor() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const started = await apiFetch<WorkOrderDetailDto>(`/api/work-orders/${wo.id}/start`, { method: 'POST' });
      await mutate(isWorkOrderRelatedListKey, undefined, { revalidate: true, populateCache: false });
      // Block A (MG2): Start closed my clock on another Truck (D21); say so instead of doing it silently.
      if (started?.clockMovedFrom) showToast('success', messages.clockMovedFromTo(started.clockMovedFrom.truckNumber, wo.truckNumber));
      router.push(`/work-orders/${wo.id}`);
    } catch (err) {
      // Block A (MG7): the API's English text never reaches a Spanish screen.
      setError(apiErrorMessage(err, messages, messages.actionFailed));
      setBusy(false);
    }
  }

  return (
    <div className={className}>
      {error ? <InlineAlert className="mb-2">{error}</InlineAlert> : null}
      <Button
        className="w-full"
        variant={variant}
        disabled={busy}
        aria-label={messages.workOrderAction(label ?? messages.startWork, wo.displayId, wo.truckNumber)}
        onClick={() => void startLabor()}
      >
        {busy ? messages.startingWork : label ?? messages.startWork}
      </Button>
    </div>
  );
}

function WorkOrderActionLink({
  href,
  action,
  wo,
  variant = 'default',
  className,
}: {
  href: string;
  action: string;
  wo: WorkOrderSummaryDto;
  variant?: 'default' | 'secondary';
  className?: string;
}) {
  const { messages } = useShopLocale();
  return (
    <Button asChild variant={variant} className={className}>
      <Link href={href} aria-label={messages.workOrderAction(action, wo.displayId, wo.truckNumber)}>
        {action}
      </Link>
    </Button>
  );
}
