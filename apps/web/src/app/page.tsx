'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { WorkOrderSummaryDto } from '@ltl-shop/shared';
import { useAuth } from '@/lib/auth-context';
import { useWorkOrders } from '@/lib/shop-data';
import { pauseLabel, priorityLabel } from '@/lib/format';
import {
  CardListSkeleton,
  EmptyState,
  HomeTopBar,
  LoadFailure,
  PageSkeleton,
  PriorityBadge,
  ScreenHeader,
} from '@/components/ui';

export default function HomePage() {
  const { token, sessionLoading, sessionError, retrySession } = useAuth();
  const router = useRouter();
  const { data, error, mutate } = useWorkOrders(!!token);

  useEffect(() => {
    if (!sessionLoading && !token && !sessionError) router.replace('/login');
  }, [sessionLoading, token, sessionError, router]);

  if (sessionLoading && !token) {
    return (
      <div>
        <HomeTopBar />
        <ScreenHeader title="Home" subtitle="Current jobs, work orders, and recent work." />
        <PageSkeleton label="Restoring session" />
      </div>
    );
  }

  if (!token && sessionError) {
    return (
      <div>
        <HomeTopBar />
        <ScreenHeader title="Home" subtitle="Current jobs, work orders, and recent work." />
        <LoadFailure message={sessionError} onRetry={retrySession} retryLabel="Retry session" />
      </div>
    );
  }

  if (!token) {
    return <PageSkeleton label="Restoring session" />;
  }

  return (
    <div>
      <HomeTopBar />
      <ScreenHeader
        title="Home"
        subtitle="Current jobs, work orders, and recent work."
      />

      <Link href="/work-orders/new" className="btn-primary mb-6 w-full">
        Create New Work Order
      </Link>

      {error ? (
        <div className="mb-4">
          <LoadFailure
            message={error instanceof Error ? error.message : 'Unable to load work orders'}
            onRetry={() => void mutate()}
            retryLabel="Retry work orders"
          />
        </div>
      ) : null}

      {!data && !error ? (
        <div role="status" aria-label="Loading work orders" aria-live="polite">
          <CardListSkeleton />
          <span className="sr-only">Loading work orders</span>
        </div>
      ) : null}

      {data ? (
        <>
          {data.created.length ? (
            <section className="mb-6">
              <h2 className="section-label mb-2">Ready to Start</h2>
              <p className="mb-3 text-sm text-shop-muted">
                {data.created.length} order(s) ready to Start Work
              </p>
              <div className="space-y-3">
                {data.created.map((wo) => (
                  <WorkOrderCard key={wo.id} wo={wo} mode="created" />
                ))}
              </div>
            </section>
          ) : null}

          <section className="mb-6">
            <h2 className="section-label mb-2">Active Jobs</h2>
            <p className="mb-3 text-sm text-shop-muted">
              {data.active.length} active jobs
            </p>
            {!data.active.length ? (
              <EmptyState>No active jobs.</EmptyState>
            ) : (
              <div className="space-y-3">
                {data.active.map((wo) => (
                  <WorkOrderCard key={wo.id} wo={wo} mode="active" />
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="section-label mb-2">Paused Jobs</h2>
            <p className="mb-3 text-sm text-shop-muted">
              {data.paused.length} paused jobs
            </p>
            {!data.paused.length ? (
              <EmptyState>No paused jobs.</EmptyState>
            ) : (
              <div className="space-y-3">
                {data.paused.map((wo) => (
                  <WorkOrderCard key={wo.id} wo={wo} mode="paused" />
                ))}
              </div>
            )}
          </section>

          {data.completed.length ? (
            <details className="mt-6">
              <summary className="btn-secondary w-full cursor-pointer list-none">
                View completed work ({data.completed.length})
              </summary>
              <div className="mt-3 space-y-3">
                {data.completed.map((wo) => (
                  <WorkOrderCard key={wo.id} wo={wo} mode="completed" />
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
}: {
  wo: WorkOrderSummaryDto;
  mode: 'created' | 'active' | 'paused' | 'completed';
}) {
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
      {!isPm && (mode === 'active' || mode === 'paused') && wo.jobs.length > 0 ? (
        <ul className="space-y-1 text-sm">
          {wo.jobs.map((job) => (
            <li key={job.id} className="flex items-center gap-2">
              <span
                className={
                  job.status === 'completed'
                    ? 'text-shop-success'
                    : 'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-shop-border text-[10px] text-shop-muted'
                }
              >
                {job.status === 'completed' ? '✓' : '○'}
              </span>
              <span
                className={
                  job.status === 'completed' ? 'text-shop-muted line-through' : ''
                }
              >
                {job.displayName}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex gap-2">
        {mode === 'completed' ? (
          <Link href={`/work-orders/${wo.id}`} className="btn-secondary flex-1">
            View completed work
          </Link>
        ) : mode === 'paused' ? (
          <>
            <Link href={`/work-orders/${wo.id}`} className="btn-secondary flex-1">
              View Details
            </Link>
            <Link href={`/work-orders/${wo.id}?action=resume`} className="btn-primary flex-1">
              Resume Work
            </Link>
          </>
        ) : mode === 'created' ? (
          <Link href={`/work-orders/${wo.id}`} className="btn-primary flex-1">
            Start Work
          </Link>
        ) : (
          isPm || wo.jobs.some((job) => job.status === 'to_do') ? <>
              <Link href={`/work-orders/${wo.id}?action=pause`} className="btn-secondary flex-1">
                Pause Work
              </Link>
              <Link href={`/work-orders/${wo.id}`} className="btn-primary flex-1">
                View Work
              </Link>
            </> : <Link href={`/work-orders/${wo.id}`} className="btn-primary w-full">
              Finish Work
            </Link>
        )}
      </div>
    </article>
  );
}
