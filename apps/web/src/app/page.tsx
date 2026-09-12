'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AppCapability, MechanicMode, type WorkOrderSummaryDto } from '@ltl-shop/shared';
import { useAuth } from '@/lib/auth-context';
import { useWorkOrders } from '@/lib/shop-data';
import { pauseLabel, priorityLabel } from '@/lib/format';
import { jobAssignmentLabel, workOrderTeamLabel } from '@/lib/job-assignment';
import { useShopLocale } from '@/lib/locale-context';
import { defaultWorkspacePath } from '@/lib/admin-routing';
import {
  Button,
  CardListSkeleton,
  EmptyState,
  HomeTopBar,
  LoadFailure,
  PageSkeleton,
  PriorityBadge,
  ScreenHeader,
} from '@/components/ui';

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
    if (!sessionLoading && !token && !sessionError) router.replace('/login');
    if (!sessionLoading && token && user && !mode) {
      router.replace(defaultWorkspacePath(user));
    }
  }, [sessionLoading, token, sessionError, user, mode, requiredCapability, router]);

  if (sessionLoading && !token) {
    return (
      <div>
        <HomeTopBar mode={mode ?? undefined} />
        <ScreenHeader title={messages.home} subtitle={messages.locale === 'es' ? 'Jobs actuales, Work Orders y trabajo reciente.' : 'Current jobs, work orders, and recent work.'} />
        <PageSkeleton label={messages.locale === 'es' ? 'Restaurando sesión' : 'Restoring session'} />
      </div>
    );
  }

  if (!token && sessionError) {
    return (
      <div>
        <HomeTopBar mode={mode ?? undefined} />
        <ScreenHeader title={messages.home} subtitle={messages.locale === 'es' ? 'Jobs actuales, Work Orders y trabajo reciente.' : 'Current jobs, work orders, and recent work.'} />
        <LoadFailure message={sessionError} onRetry={retrySession} retryLabel={messages.retry} />
      </div>
    );
  }

  if (!sessionLoading && token && !user) {
    return (
      <div>
        <HomeTopBar />
        <ScreenHeader title={messages.home} subtitle={messages.locale === 'es' ? 'Jobs actuales, Work Orders y trabajo reciente.' : 'Current jobs, work orders, and recent work.'} />
        <LoadFailure
          message={sessionError ?? (messages.locale === 'es' ? 'No se pudo cargar tu perfil.' : 'Unable to load your profile.')}
          onRetry={retrySession}
          retryLabel={messages.retry}
        />
      </div>
    );
  }

  if (!sessionLoading && user && (!mode || !hasWorkspaceAccess)) {
    const allowedHome = defaultWorkspacePath(user);
    return (
      <div>
        <HomeTopBar />
        <ScreenHeader
          title={mode === MechanicMode.PM
            ? (messages.locale === 'es' ? 'Mecánico de PM' : 'PM Mechanic')
            : (messages.locale === 'es' ? 'Mi trabajo asignado' : 'My Assigned Work')}
          subtitle={messages.workspaceUnavailable}
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

  if (!token || !user || !mode || !hasWorkspaceAccess) {
    return <PageSkeleton label={messages.locale === 'es' ? 'Restaurando sesión' : 'Restoring session'} />;
  }

  const isPm = mode === MechanicMode.PM;

  return (
    <div>
      <HomeTopBar mode={mode} />
      <ScreenHeader
        title={isPm ? (messages.locale === 'es' ? 'Mecánico de PM' : 'PM Mechanic') : (messages.locale === 'es' ? 'Mi trabajo asignado' : 'My Assigned Work')}
        subtitle={isPm ? (messages.locale === 'es' ? 'Servicios de PM asignados a ti.' : 'PM services assigned to you.') : (messages.locale === 'es' ? 'Work Orders y Jobs que te asignó el Manager.' : 'Work Orders and Jobs the Manager assigned to you.')}
      />

      {isPm ? (
        <>
          <Link href={`/mechanic/${mode}/new`} className="btn-primary mb-6 w-full">
            {messages.createPmService}
          </Link>
          <p className="-mt-4 mb-6 text-center text-sm text-shop-muted">
            {messages.locale === 'es' ? 'Los servicios de PM comienzan inmediatamente después de crearse.' : 'PM services start immediately after creation.'}
          </p>
        </>
      ) : (
        <p className="mb-6 text-sm text-shop-muted">{messages.askManagerToCreateHint}</p>
      )}

      {error ? (
        <div className="mb-4">
          <LoadFailure
            message={error instanceof Error ? error.message : 'Unable to load work orders'}
            onRetry={() => void mutate()}
            retryLabel={messages.retry}
          />
        </div>
      ) : null}

      {!data && !error ? (
        <div role="status" aria-label={messages.locale === 'es' ? 'Cargando Work Orders' : 'Loading work orders'} aria-live="polite">
          <CardListSkeleton />
          <span className="sr-only">{messages.locale === 'es' ? 'Cargando Work Orders' : 'Loading work orders'}</span>
        </div>
      ) : null}

      {data ? (
        <>
          {data.created.length ? (
            <section className="mb-6">
              <h2 className="section-label mb-2">{messages.locale === 'es' ? 'Listos para iniciar' : 'Ready to Start'}</h2>
              <p className="mb-3 text-sm text-shop-muted">
                {data.created.length} order(s) ready to Start Work
              </p>
              <div className="space-y-3">
                {data.created.map((wo) => (
                  <WorkOrderCard key={wo.id} wo={wo} mode="created" currentUserId={user.id} />
                ))}
              </div>
            </section>
          ) : null}

          <section className="mb-6">
              <h2 className="section-label mb-2">{messages.locale === 'es' ? 'Jobs activos' : 'Active Jobs'}</h2>
            <p className="mb-3 text-sm text-shop-muted">
              {messages.activeJobs(data.active.length)}
            </p>
            {!data.active.length ? (
              <EmptyState>
                {isPm && messages.locale === 'es' ? 'No hay servicios de PM activos asignados a ti.' : isPm ? 'No active PM services assigned to you.' : messages.noActiveJobs}
              </EmptyState>
            ) : (
              <div className="space-y-3">
                {data.active.map((wo) => (
                  <WorkOrderCard key={wo.id} wo={wo} mode="active" currentUserId={user.id} />
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="section-label mb-2">{messages.locale === 'es' ? 'Jobs pausados' : 'Paused Jobs'}</h2>
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
              <summary className="btn-secondary w-full cursor-pointer list-none">
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
  mode: 'created' | 'active' | 'paused' | 'completed';
  currentUserId: string;
}) {
  const { messages } = useShopLocale();
  const isPm = wo.primaryCategoryName === 'PM';
  return (
    <article className="card space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-xl font-bold tracking-wide">
            {wo.displayId}
          </p>
          <p className="text-sm text-shop-muted">
            #{wo.truckNumber} · {!isPm ? `${priorityLabel(wo.priority)} · ` : ''}
            {mode === 'paused'
              ? pauseLabel(wo.currentPauseReason)
              : mode === 'created'
                ? 'Created'
                : mode === 'completed'
                  ? 'Completed'
                  : 'In Progress'}
          </p>
        </div>
        {!isPm ? <PriorityBadge priority={wo.priority} /> : null}
      </div>
      <p className="text-sm text-shop-muted">
        {isPm ? 'PM Service' : `${wo.primaryCategoryName} · ${wo.jobsCompleted} of ${wo.jobsTotal} jobs done`}
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
      <div className="flex gap-2">
        {mode === 'completed' ? (
          <WorkOrderActionLink href={`/work-orders/${wo.id}`} action="View completed work" wo={wo} className="btn-secondary flex-1" />
        ) : mode === 'paused' ? (
          isPm ? (
            <>
              <WorkOrderActionLink href={`/work-orders/${wo.id}`} action="View Details" wo={wo} className="btn-secondary flex-1" />
              <WorkOrderActionLink href={`/work-orders/${wo.id}?action=resume`} action="Resume Work" wo={wo} className="btn-primary flex-1" />
            </>
          ) : (
            <WorkOrderActionLink href={`/work-orders/${wo.id}`} action="View Details" wo={wo} className="btn-primary w-full" />
          )
        ) : mode === 'created' ? (
          <WorkOrderActionLink href={`/work-orders/${wo.id}`} action="Start Work" wo={wo} className="btn-primary flex-1" />
        ) : (
          isPm && wo.jobs.some((job) => job.status === 'to_do') ? <>
              {/* Global pause stays a PM control only; standard mechanics report
                  blockers from the detail view instead of pausing the WO. */}
              <WorkOrderActionLink href={`/work-orders/${wo.id}?action=pause`} action="Pause Work" wo={wo} className="btn-secondary flex-1" />
              <WorkOrderActionLink href={`/work-orders/${wo.id}`} action="View Work" wo={wo} className="btn-primary flex-1" />
            </> : !isPm && wo.jobs.some((job) => job.status === 'to_do') ? (
              <WorkOrderActionLink href={`/work-orders/${wo.id}`} action="View Work" wo={wo} className="btn-primary w-full" />
            ) : isPm ? (
              <WorkOrderActionLink href={`/work-orders/${wo.id}`} action="Finish Work" wo={wo} className="btn-primary w-full" />
            ) : (
              <WorkOrderActionLink href={`/work-orders/${wo.id}`} action="View Work" wo={wo} className="btn-primary w-full" />
            )
        )}
      </div>
    </article>
  );
}

function WorkOrderActionLink({
  href,
  action,
  wo,
  className,
}: {
  href: string;
  action: string;
  wo: WorkOrderSummaryDto;
  className: string;
}) {
  const { messages } = useShopLocale();
  return (
    <Link href={href} className={className} aria-label={messages.workOrderAction(action, wo.displayId, wo.truckNumber)}>
      {action}
    </Link>
  );
}
