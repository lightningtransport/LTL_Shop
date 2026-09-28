'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AppCapability, MechanicMode, type WorkOrderSummaryDto } from '@ltl-shop/shared';
import { useAuth } from '@/lib/auth-context';
import { SessionSignInFallback } from '@/components/session-sign-in-fallback';
import { replaceAppLocation } from '@/lib/session-restore';
import { apiFetch } from '@/lib/api';
import { useWorkOrders } from '@/lib/shop-data';
import { isWorkOrderRelatedListKey } from '@/lib/swr-cache-keys';
import { pauseLabel, statusLabel } from '@/lib/format';
import { useSWRConfig } from 'swr';
import { isMyJob, isMyPartDone, isStandardWorkWaitingOnManager, jobPersonLabel } from '@/lib/job-assignment';
import { canOfficiallyPauseWorkOrder } from '@/lib/work-order-pause';
import { useShopLocale } from '@/lib/locale-context';
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
  ScreenHeader,
  buttonVariants,
} from '@/components/ui';
import { cn } from '@/lib/utils';
import { jobCategoriesLine, vehicleLine } from '@/lib/work-order-identity';

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

  if (!token) {
    if (sessionError) {
      return (
        <div>
          <HomeTopBar mode={mode ?? undefined} />
          <ScreenHeader title={messages.home} subtitle={messages.homeSubtitle} />
          <LoadFailure message={sessionError} onRetry={retrySession} retryLabel={messages.retry} />
        </div>
      );
    }
    if (sessionLoading) {
      return (
        <div>
          <HomeTopBar mode={mode ?? undefined} />
          <ScreenHeader title={messages.home} subtitle={messages.homeSubtitle} />
          <PageSkeleton label={messages.restoringSession} />
        </div>
      );
    }
    return <SessionSignInFallback />;
  }

  if (!user) {
    return (
      <div>
        <HomeTopBar />
        <ScreenHeader title={messages.home} subtitle={messages.homeSubtitle} />
        {sessionError ? (
          <LoadFailure
            message={sessionError}
            onRetry={retrySession}
            retryLabel={messages.retry}
          />
        ) : (
          <PageSkeleton label={messages.restoringSession} />
        )}
      </div>
    );
  }

  if (!mode) {
    const allowedHome = defaultWorkspacePath(user);
    return (
      <div>
        <HomeTopBar />
        <ScreenHeader title={messages.home} subtitle={messages.homeSubtitle} />
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
        <ScreenHeader
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
      <ScreenHeader
        title={isPm ? messages.pmHomeTitle : messages.standardHomeTitle}
        subtitle={isPm ? messages.pmHomeSubtitle : messages.standardHomeSubtitle}
      />

      {isPm ? (
        <>
          {/* LTR-95: one running PM at a time; the API enforces it too. */}
          {activeWork.length ? (
            <>
              <Button className="mb-2 w-full" disabled>{messages.createPmService}</Button>
              <p className="mb-6 text-center text-sm text-shop-muted">{messages.pmAlreadyRunning(activeWork[0].displayId)}</p>
            </>
          ) : (
            <>
              <Button asChild className="mb-6 w-full">
                <Link href={`/mechanic/${mode}/new`}>{messages.createPmService}</Link>
              </Button>
              <p className="-mt-4 mb-6 text-center text-sm text-shop-muted">
                {messages.pmServicesStartImmediately}
              </p>
            </>
          )}
        </>
      ) : null}

      {error ? (
        <div className="mb-4">
          <LoadFailure
            message={error instanceof Error ? error.message : messages.unableToLoadWorkOrders}
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

      {data ? (
        <>
          {/* LTR-134: one unit (the Work Order) per section; what I am working on comes first. */}
          <section className="mb-6">
              <h2 className="section-label mb-2">{isPm ? messages.pmActiveTitle : messages.activeJobsTitle}</h2>
            <p className="mb-3 text-sm text-shop-muted">
              {isPm ? messages.activePmServices(activeWork.length) : messages.activeJobs(activeWork.length)}
            </p>
            {!activeWork.length ? (
              <EmptyState>
                {isPm ? (
                  messages.noActivePmServices
                ) : (
                  <>
                    <p>{messages.noActiveJobs}</p>
                    {!data.created.length && !waitingOnManager.length ? (
                      <p className="mt-2 text-sm">{messages.askManagerToCreate}</p>
                    ) : null}
                  </>
                )}
              </EmptyState>
            ) : (
              <div className="space-y-3">
                {activeWork.map((wo) => (
                  <WorkOrderCard key={wo.id} wo={wo} mode="active" currentUserId={user.id} pmWorkspace={isPm} />
                ))}
              </div>
            )}
          </section>

          {data.created.length ? (
            <section className="mb-6">
              <h2 className="section-label mb-2">{messages.readyToStart}</h2>
              <p className="mb-3 text-sm text-shop-muted">
                {messages.ordersReadyToStart(data.created.length)}
              </p>
              <div className="space-y-3">
                {data.created.map((wo) => (
                  <WorkOrderCard key={wo.id} wo={wo} mode="created" currentUserId={user.id} pmWorkspace={isPm} />
                ))}
              </div>
            </section>
          ) : null}

          {waitingOnManager.length ? (
            <section className="mb-6">
              <h2 className="section-label mb-2">{messages.waitingOnManager}</h2>
              <p className="mb-3 text-sm text-shop-muted">
                {messages.waitingOnManagerHint(waitingOnManager.length)}
              </p>
              <div className="space-y-3">
                {waitingOnManager.map((wo) => (
                  <WorkOrderCard key={wo.id} wo={wo} mode="waiting_on_manager" currentUserId={user.id} pmWorkspace={isPm} />
                ))}
              </div>
            </section>
          ) : null}

          <section>
            <h2 className="section-label mb-2">{isPm ? messages.pmPausedTitle : messages.pausedJobsTitle}</h2>
            <p className="mb-3 text-sm text-shop-muted">
              {isPm ? messages.pausedPmServices(data.paused.length) : messages.pausedJobs(data.paused.length)}
            </p>
            {!data.paused.length ? (
              <EmptyState>
                {isPm ? messages.noPausedPmServices : messages.noPausedJobs}
              </EmptyState>
            ) : (
              <div className="space-y-3">
                {data.paused.map((wo) => (
                  <WorkOrderCard key={wo.id} wo={wo} mode="paused" currentUserId={user.id} pmWorkspace={isPm} />
                ))}
              </div>
            )}
          </section>

          {/* LTR-133: completed work has its own screen (also in the tab bar). */}
          {data.completed.length ? (
            <Link href={`/mechanic/${isPm ? 'pm' : 'standard'}/completed`} className={cn(buttonVariants({ variant: 'secondary' }), 'mt-6 w-full')}>
              {messages.viewCompletedWork(data.completed.length)}
            </Link>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function WorkOrderCard({
  wo,
  mode,
  currentUserId,
  pmWorkspace = false,
}: {
  wo: WorkOrderSummaryDto;
  mode: 'created' | 'active' | 'waiting_on_manager' | 'paused' | 'completed';
  currentUserId: string;
  pmWorkspace?: boolean;
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
          <p className="font-display text-xl font-bold tracking-wide">
            {messages.truckTitle(wo.truckNumber)}
          </p>
          {vehicleLine(wo.truckVehicle) ? (
            <p className="text-sm text-shop-muted">{vehicleLine(wo.truckVehicle)}</p>
          ) : null}
          <p className="text-sm text-shop-muted">
            {messages.workOrder} {wo.displayId}
            {' · '}
            {!isPm ? `${messages.priority[wo.priority] ?? wo.priority} · ` : ''}
            {mode === 'paused'
              ? pauseLabel(wo.currentPauseReason, messages.pauseReason)
              : messages.status[wo.status] ?? statusLabel(wo.status, messages.status)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {!isPm ? <PriorityBadge priority={wo.priority}>{messages.priority[wo.priority] ?? wo.priority}</PriorityBadge> : null}
          {/* LTR-158 / D18: the Manager resolved my blocker; my time waits for Continue. */}
          {wo.resolvedBlockerAwaitingContinue ? (
            <span className="rounded-full bg-shop-accent/15 px-2 py-0.5 text-xs font-semibold text-shop-accent" data-testid="resolved-tap-continue">
              {messages.resolvedTapContinue}
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
          {messages.pmStartedAt(new Intl.DateTimeFormat(messages.locale === 'es' ? 'es-US' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date((pmJob ? pmJob.startedAt : wo.startedAt)!)))}
        </p>
      ) : null}
      {!isPm && mode !== 'completed' && myJobs.length > 0 ? (
        <ul className="space-y-2 text-sm">
          {/* LTR-154 / D11: only my Jobs, with the next one marked. */}
          {myJobs.map((job) => (
            <li key={job.id} className="flex items-start gap-2" aria-current={job.id === nextJobId ? 'step' : undefined}>
              <span
                className={
                  job.status === 'completed'
                    ? 'mt-0.5 text-shop-success'
                    : 'mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-shop-border text-[10px] text-shop-muted'
                }
              >
                {job.status === 'completed' ? '✓' : '○'}
              </span>
              <span className="min-w-0">
                <span
                  className={`block ${
                    job.status === 'completed' ? 'text-shop-muted line-through' : ''
                  }`}
                >
                  {job.displayName}
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
            action={mode === 'completed' ? messages.viewCompletedWorkAction : pmJob.startedAt ? messages.continuePmService : messages.startPmService}
            wo={wo}
            variant={mode === 'completed' ? 'secondary' : undefined}
            className="w-full"
          />
        ) : mode === 'completed' ? (
          <WorkOrderActionLink href={`/work-orders/${wo.id}`} action={messages.viewCompletedWorkAction} wo={wo} variant="secondary" className="flex-1" />
        ) : mode === 'paused' ? (
          isPm ? (
            <>
              <WorkOrderActionLink href={`/work-orders/${wo.id}`} action={messages.viewDetails} wo={wo} variant="secondary" className="flex-1" />
              <WorkOrderActionLink href={`/work-orders/${wo.id}?action=resume`} action={messages.resumeWork} wo={wo} className="flex-1" />
            </>
          ) : (
            <WorkOrderActionLink href={`/work-orders/${wo.id}`} action={messages.viewDetails} wo={wo} className="w-full" />
          )
        ) : mode === 'waiting_on_manager' ? (
          <WorkOrderActionLink href={`/work-orders/${wo.id}`} action={messages.viewDetails} wo={wo} className="w-full" />
        ) : mode === 'created' ? (
          isPm ? (
            <div className="flex w-full flex-col gap-2">
              <StartWorkAction wo={wo} className="w-full" />
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                disabled
                aria-describedby={`pause-unavailable-${wo.id}`}
              >
                {messages.pauseWorkOrder}
              </Button>
              <p id={`pause-unavailable-${wo.id}`} className="text-sm text-shop-muted">{messages.pauseUnavailableUntilInProgress}</p>
            </div>
          ) : (
            <StartWorkAction wo={wo} className="flex-1" />
          )
        ) : (
          isPm && canOfficiallyPauseWorkOrder(wo.status) && wo.jobs.some((job) => job.status === 'to_do') ? <>
              <WorkOrderActionLink href={`/work-orders/${wo.id}?action=pause`} action={messages.pauseWorkOrder} wo={wo} variant="secondary" className="flex-1" />
              <WorkOrderActionLink href={`/work-orders/${wo.id}`} action={messages.viewWork} wo={wo} className="flex-1" />
            </> : !isPm && wo.jobs.some((job) => job.status === 'to_do') ? (
              <WorkOrderActionLink href={`/work-orders/${wo.id}`} action={messages.viewWork} wo={wo} className="w-full" />
            ) : isPm ? (
              // LTR-138: this link opens the PM detail; Finish Work lives there.
              <WorkOrderActionLink href={`/work-orders/${wo.id}`} action={messages.continuePmService} wo={wo} className="w-full" />
            ) : (
              <WorkOrderActionLink href={`/work-orders/${wo.id}`} action={messages.viewWork} wo={wo} className="w-full" />
            )
        )}
      </div>
    </Card>
  );
}

function StartWorkAction({
  wo,
  className,
}: {
  wo: WorkOrderSummaryDto;
  className?: string;
}) {
  const { messages } = useShopLocale();
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startLabor() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/work-orders/${wo.id}/start`, { method: 'POST' });
      await mutate(isWorkOrderRelatedListKey, undefined, { revalidate: true, populateCache: false });
      router.push(`/work-orders/${wo.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : messages.loadError);
      setBusy(false);
    }
  }

  return (
    <div className={className}>
      {error ? <InlineAlert className="mb-2">{error}</InlineAlert> : null}
      <Button
        className="w-full"
        disabled={busy}
        aria-label={messages.workOrderAction(messages.startWork, wo.displayId, wo.truckNumber)}
        onClick={() => void startLabor()}
      >
        {busy ? messages.startingWork : messages.startWork}
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
