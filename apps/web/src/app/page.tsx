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
  PageSkeleton,
  PriorityBadge,
  ScreenHeader,
} from '@/components/ui';

export default function HomePage() {
  const { token, sessionLoading, logout } = useAuth();
  const router = useRouter();
  const { data, error } = useWorkOrders(!!token);

  useEffect(() => {
    if (!sessionLoading && !token) router.replace('/login');
  }, [sessionLoading, token, router]);

  if (sessionLoading || !token) {
    return <PageSkeleton label="Restoring session" />;
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <ScreenHeader
          title="Home"
          subtitle="Current jobs, work orders, and recent work."
        />
        <button type="button" className="btn-secondary self-start" onClick={logout}>
          Logout
        </button>
      </div>

      <Link href="/work-orders/new" className="btn-primary mb-6 w-full">
        Create New Work Order
      </Link>

      {error ? (
        <p className="mb-4 text-sm text-red-300">
          {error instanceof Error ? error.message : 'Unable to load work orders'}
        </p>
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
  mode: 'created' | 'active' | 'paused';
}) {
  return (
    <article className="card space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-xl font-bold tracking-wide">
            {wo.displayId}
          </p>
          <p className="text-sm text-shop-muted">
            #{wo.truckNumber} · {priorityLabel(wo.priority)} ·{' '}
            {mode === 'paused'
              ? pauseLabel(wo.currentPauseReason)
              : mode === 'created'
                ? 'Created'
                : 'In Progress'}
          </p>
        </div>
        <PriorityBadge priority={wo.priority} />
      </div>
      <p className="text-sm text-shop-muted">
        {wo.primaryCategoryName} · {wo.jobsCompleted} of {wo.jobsTotal} jobs
        done
      </p>
      {(mode === 'active' || mode === 'paused') && wo.jobs.length > 0 ? (
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
        {mode === 'paused' ? (
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
          <>
            <Link href={`/work-orders/${wo.id}?action=pause`} className="btn-secondary flex-1">
              Pause Work
            </Link>
            <Link href={`/work-orders/${wo.id}`} className="btn-primary flex-1">
              View Work
            </Link>
          </>
        )}
      </div>
    </article>
  );
}
