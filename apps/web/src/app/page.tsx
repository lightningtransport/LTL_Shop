'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { WorkOrderSummaryDto } from '@ltl-shop/shared';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';
import { pauseLabel, priorityLabel } from '@/lib/format';
import { EmptyState, PriorityBadge, ScreenHeader } from '@/components/ui';

type HomeLists = {
  created: WorkOrderSummaryDto[];
  active: WorkOrderSummaryDto[];
  paused: WorkOrderSummaryDto[];
};

export default function HomePage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<HomeLists | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    apiFetch<HomeLists>('/api/work-orders')
      .then(setData)
      .catch((e) => setError(e.message));
  }, [user]);

  if (loading || !user) {
    return <p className="text-shop-muted">Loading…</p>;
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
        <p className="mb-4 text-sm text-red-300">{error}</p>
      ) : null}

      {data?.created?.length ? (
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
          {data?.active.length ?? 0} active jobs
        </p>
        {!data?.active.length ? (
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
          {data?.paused.length ?? 0} paused jobs
        </p>
        {!data?.paused.length ? (
          <EmptyState>No paused jobs.</EmptyState>
        ) : (
          <div className="space-y-3">
            {data.paused.map((wo) => (
              <WorkOrderCard key={wo.id} wo={wo} mode="paused" />
            ))}
          </div>
        )}
      </section>
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
