'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AppCapability, MechanicMode, type WorkOrderSummaryDto } from '@ltl-shop/shared';
import { useAuth } from '@/lib/auth-context';
import { SessionSignInFallback } from '@/components/session-sign-in-fallback';
import { replaceAppLocation } from '@/lib/session-restore';
import { useWorkOrders } from '@/lib/shop-data';
import { pauseLabel, statusLabel } from '@/lib/format';
import { isStandardWorkWaitingOnManager, jobAssignmentLabel, workOrderTeamLabel } from '@/lib/job-assignment';
import { useShopLocale } from '@/lib/locale-context';
import { defaultWorkspacePath } from '@/lib/admin-routing';
import {
  Button,
  Card,
  CardListSkeleton,
  EmptyState,
  HomeTopBar,
  LoadFailure,
  PageSkeleton,
  PriorityBadge,
  ScreenHeader,
  buttonVariants,
} from '@/components/ui';
import { cn } from '@/lib/utils';

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
  const waitingOnManager = data && !isPm ? data.active.filter(isStandardWorkWaitingOnManager) : [];
  const activeWork = data ? (isPm ? data.active : data.active.filter((wo) => !isStandardWorkWaitingOnManager(wo))) : [];

  return (
    <div>
      <HomeTopBar mode={mode} />
      <ScreenHeader
        title={isPm ? messages.pmHomeTitle : messages.standardHomeTitle}
        subtitle={isPm ? messages.pmHomeSubtitle : messages.standardHomeSubtitle}
      />

      {isPm ? (
        <>
          <Button asChild className="mb-6 w-full">
            <Link href={`/mechanic/${mode}/new`}>{messages.createPmService}</Link>
          </Button>
          <p className="-mt-4 mb-6 text-center text-sm text-shop-muted">
            {messages.pmServicesStartImmediately}
          </p>
        </>
      ) : (
        <p className="mb-6 text-sm text-shop-muted">{messages.askManagerToCreateHint}</p>
      )}

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
          {data.created.length ? (
            <section className="mb-6">
              <h2 className="section-label mb-2">{messages.readyToStart}</h2>
              <p className="mb-3 text-sm text-shop-muted">
                {messages.ordersReadyToStart(data.created.length)}
              </p>
              <div className="space-y-3">
                {data.created.map((wo) => (
                  <WorkOrderCard key={wo.id} wo={wo} mode="created" currentUserId={user.id} />
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
                  <WorkOrderCard key={wo.id} wo={wo} mode="waiting_on_manager" currentUserId={user.id} />
                ))}
              </div>
            </section>
          ) : null}

          <section className="mb-6">
              <h2 className="section-label mb-2">{messages.activeJobsTitle}</h2>
            <p className="mb-3 text-sm text-shop-muted">
              {messages.activeJobs(activeWork.length)}
            </p>
            {!activeWork.length ? (
              <EmptyState>
                {isPm ? (
                  messages.noActivePmServices
                ) : (
                  <>
                    <p>{messages.noActiveJobs}</p>
                    <p className="mt-2 text-sm">{messages.askManagerToCreate}</p>
                  </>
                )}
              </EmptyState>
            ) : (
              <div className="space-y-3">
                {activeWork.map((wo) => (
                  <WorkOrderCard key={wo.id} wo={wo} mode="active" currentUserId={user.id} />
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="section-label mb-2">{messages.pausedJobsTitle}</h2>
            <p className="mb-3 text-sm text-shop-muted">
              {messages.pausedJobs(data.paused.length)}
            </p>
            {!data.paused.length ? (
              <EmptyState>
                {messages.noPausedJobs}
              </EmptyState>
            ) : (
              <div className="space-y-3">
                {data.paused.map((wo) => (
                  <WorkOrderCard key={wo.id} wo={wo} mode="paused" currentUserId={user.id} />
                ))}
              </div>
            )}
          </section>

          {data.completed.length ? (
            <details className="mt-6">
              <summary className={cn(buttonVariants({ variant: 'secondary' }), 'w-full cursor-pointer list-none')}>
                {messages.viewCompletedWork(data.completed.length)}
              </summary>
              <div className="mt-3 space-y-3">
                {data.completed.map((wo) => (
                  <WorkOrderCard key={wo.id} wo={wo} mode="completed" currentUserId={user.id} />
                ))}
              </div>
            </details>
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
}: {
  wo: WorkOrderSummaryDto;
  mode: 'created' | 'active' | 'waiting_on_manager' | 'paused' | 'completed';
  currentUserId: string;
}) {
  const { messages } = useShopLocale();
  const isPm = wo.primaryCategoryName === 'PM';
  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-xl font-bold tracking-wide">
            {wo.displayId}
          </p>
          <p className="text-sm text-shop-muted">
            #{wo.truckNumber} · {!isPm ? `${messages.priority[wo.priority] ?? wo.priority} · ` : ''}
            {mode === 'paused'
              ? pauseLabel(wo.currentPauseReason, messages.pauseReason)
              : messages.status[wo.status] ?? statusLabel(wo.status, messages.status)}
          </p>
        </div>
        {!isPm ? <PriorityBadge priority={wo.priority}>{messages.priority[wo.priority] ?? wo.priority}</PriorityBadge> : null}
      </div>
      <p className="text-sm text-shop-muted">
        {isPm ? messages.pmServiceLabel : `${wo.primaryCategoryName} · ${messages.jobsDone(wo.jobsCompleted, wo.jobsTotal)}`}
      </p>
      {!isPm ? (
        <p className="text-xs text-shop-muted">{workOrderTeamLabel(wo.mechanics, messages)}</p>
      ) : null}
      {!isPm && mode !== 'completed' && wo.jobs.length > 0 ? (
        <ul className="space-y-2 text-sm">
          {wo.jobs.map((job) => (
            <li key={job.id} className="flex items-start gap-2">
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
                </span>
                <span className="block text-xs text-shop-muted">
                  {jobAssignmentLabel(job.assignedMechanic, currentUserId, messages)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        {mode === 'completed' ? (
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
          <WorkOrderActionLink href={`/work-orders/${wo.id}`} action={messages.startWork} wo={wo} className="flex-1" />
        ) : (
          isPm && wo.jobs.some((job) => job.status === 'to_do') ? <>
              <WorkOrderActionLink href={`/work-orders/${wo.id}?action=pause`} action={messages.pauseWorkOrder} wo={wo} variant="secondary" className="flex-1" />
              <WorkOrderActionLink href={`/work-orders/${wo.id}`} action={messages.viewWork} wo={wo} className="flex-1" />
            </> : !isPm && wo.jobs.some((job) => job.status === 'to_do') ? (
              <WorkOrderActionLink href={`/work-orders/${wo.id}`} action={messages.viewWork} wo={wo} className="w-full" />
            ) : isPm ? (
              <WorkOrderActionLink href={`/work-orders/${wo.id}`} action={messages.finishWork} wo={wo} className="w-full" />
            ) : (
              <WorkOrderActionLink href={`/work-orders/${wo.id}`} action={messages.viewWork} wo={wo} className="w-full" />
            )
        )}
      </div>
    </Card>
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
