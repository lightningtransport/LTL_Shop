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
          subtitle="Trabajos actuales, Ordenes de trabajo y trabajos recientes."
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
          <h2 className="section-label mb-2">Por iniciar</h2>
          <p className="mb-3 text-sm text-shop-muted">
            {data.created.length} orden(es) listas para Start Work
          </p>
          <div className="space-y-3">
            {data.created.map((wo) => (
              <WorkOrderCard key={wo.id} wo={wo} mode="created" />
            ))}
          </div>
        </section>
      ) : null}

      <section className="mb-6">
        <h2 className="section-label mb-2">Trabajos Activos</h2>
        <p className="mb-3 text-sm text-shop-muted">
          {data?.active.length ?? 0} trabajos activos
        </p>
        {!data?.active.length ? (
          <EmptyState>No hay trabajos activos.</EmptyState>
        ) : (
          <div className="space-y-3">
            {data.active.map((wo) => (
              <WorkOrderCard key={wo.id} wo={wo} mode="active" />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="section-label mb-2">Trabajos Pausados</h2>
        <p className="mb-3 text-sm text-shop-muted">
          {data?.paused.length ?? 0} trabajos pausados
        </p>
        {!data?.paused.length ? (
          <EmptyState>No hay trabajos pausados.</EmptyState>
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
      <p className="text-sm">
        {wo.primaryCategoryName} — {wo.jobsCompleted} de {wo.jobsTotal} trabajos
      </p>
      <div className="flex gap-2">
        {mode === 'paused' ? (
          <>
            <Link href={`/work-orders/${wo.id}`} className="btn-secondary flex-1">
              Ver Información
            </Link>
            <Link href={`/work-orders/${wo.id}?action=resume`} className="btn-primary flex-1">
              Continuar Trabajo
            </Link>
          </>
        ) : mode === 'created' ? (
          <Link href={`/work-orders/${wo.id}`} className="btn-primary flex-1">
            Start Work
          </Link>
        ) : (
          <>
            <Link href={`/work-orders/${wo.id}?action=pause`} className="btn-secondary flex-1">
              Pausar Trabajo
            </Link>
            <Link href={`/work-orders/${wo.id}`} className="btn-primary flex-1">
              Ver Trabajo
            </Link>
          </>
        )}
      </div>
    </article>
  );
}
