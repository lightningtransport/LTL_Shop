'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { formatMileage } from '@/lib/format';
import { useCategories, useRepairHistory } from '@/lib/shop-data';
import { Button, Card, EmptyState, LoadFailure, PageSkeleton, ScreenHeader } from '@/components/ui';
import { useShopLocale } from '@/lib/locale-context';

export default function RepairHistoryPage() {
  const { token, sessionLoading } = useAuth();
  const { messages } = useShopLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams<{ id: string }>();
  const [categoryId, setCategoryId] = useState<string>('all');
  const { data: categoryData } = useCategories(!!token);
  const { data, error, mutate } = useRepairHistory(
    params.id,
    categoryId,
    !!token,
  );
  const categories = categoryData ?? [];
  const truck = data?.truck;
  const items = data?.items ?? [];
  const requestedReturn = searchParams.get('from');
  const backHref = requestedReturn?.startsWith('/') ? requestedReturn : '/';
  const backLabel = backHref === '/work-orders/new'
    ? (messages.locale === 'es' ? 'Volver al nuevo Work Order' : 'Back to New Work Order')
    : backHref.startsWith('/work-orders/')
      ? (messages.locale === 'es' ? 'Volver al Work Order' : 'Back to Work Order')
      : messages.backToHome;

  useEffect(() => {
    if (!sessionLoading && !token) router.replace('/login');
  }, [sessionLoading, token, router]);

  if (!truck) {
    if (error instanceof Error) {
      return (
        <LoadFailure message={error.message} onRetry={() => void mutate()} retryLabel={messages.retry} />
      );
    }
    return <PageSkeleton label={messages.locale === 'es' ? 'Cargando historial de reparaciones' : 'Loading repair history'} />;
  }

  return (
    <div>
      <ScreenHeader
        title={messages.locale === 'es' ? 'HISTORIAL DE REPARACIONES' : 'REPAIR HISTORY'}
        subtitle={`#${truck.truckNumber}`}
        backHref={backHref}
        backLabel={backLabel}
      />

      <Card className="mb-4 text-sm">
        <p>
          {truck.make} | {truck.model} | {truck.year}
        </p>
        <p className="text-shop-muted">
          {formatMileage(truck.mileage)} | {truck.company} | {truck.owner}
        </p>
      </Card>

      <div
        className="mb-4 flex gap-2 overflow-x-auto overscroll-x-contain pb-2"
        aria-label={messages.locale === 'es' ? 'Filtrar historial de reparaciones por categoría' : 'Filter repair history by category'}
      >
        <FilterChip
          active={categoryId === 'all'}
          onClick={() => setCategoryId('all')}
          label={messages.locale === 'es' ? 'TODOS' : 'ALL'}
        />
        {categories.slice(0, 6).map((c) => (
          <FilterChip
            key={c.id}
            active={categoryId === c.id}
            onClick={() => setCategoryId(c.id)}
            label={c.name}
          />
        ))}
      </div>

      {!items.length ? (
        <EmptyState>{messages.locale === 'es' ? 'No hay historial de reparaciones.' : 'No repair history.'}</EmptyState>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <article key={item.workOrderId} className="card space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold uppercase tracking-wide">
                  {new Date(item.date).toLocaleDateString(messages.locale === 'es' ? 'es-US' : 'en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
                <span className="text-shop-muted">#{item.truckNumber}</span>
              </div>
              <p>{item.primaryCategoryName}</p>
              <p className="text-sm text-shop-muted">
                {messages.locale === 'es' ? 'Mecánico' : 'Mechanic'}: {item.mechanicNames.join(' / ') || '—'}
              </p>
              <p className="text-sm text-shop-muted">
                {messages.locale === 'es' ? 'Millaje' : 'Mileage'}: {formatMileage(item.mileage)}
              </p>
              <div>
                <p className="section-label mb-2">{messages.locale === 'es' ? 'TRABAJO REALIZADO' : 'WORK PERFORMED'}</p>
                {item.jobs.length ? <div className="flex flex-wrap gap-2">
                  {item.jobs.map((j) => (
                    <span
                      key={j}
                      className="rounded-lg border border-shop-border px-2 py-1 text-xs"
                    >
                      {j}
                    </span>
                  ))}
                </div> : <p className="text-sm text-shop-muted">{messages.locale === 'es' ? 'No se registraron detalles del trabajo.' : 'No work details were recorded.'}</p>}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      onClick={onClick}
      aria-pressed={active}
      variant={active ? 'default' : 'secondary'}
      size="sm"
      className="min-h-11 whitespace-nowrap"
    >
      {label}
    </Button>
  );
}
