'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { SessionSignInFallback } from '@/components/session-sign-in-fallback';
import { replaceAppLocation } from '@/lib/session-restore';
import { formatIsoDate, formatMileage } from '@/lib/format';
import { useCategories, useRepairHistory } from '@/lib/shop-data';
import { Badge, Button, Card, EmptyState, LoadFailure, PageSkeleton, PageHeader } from '@/components/ui';
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
  const backLabel = backHref === '/work-orders/new' || /^\/mechanic\/(standard|pm)\/new$/.test(backHref)
    ? (messages.locale === 'es' ? 'Volver al nuevo Work Order' : 'Back to New Work Order')
    : backHref.startsWith('/work-orders/')
      ? (messages.locale === 'es' ? 'Volver al Work Order' : 'Back to Work Order')
      : /^\/mechanic\/(standard|pm)\/trucks$/.test(backHref)
        ? messages.backToTrucks
        : messages.backToHome;

  useEffect(() => {
    if (!sessionLoading && !token) replaceAppLocation('/login', router);
  }, [sessionLoading, token, router]);

  if (!sessionLoading && !token) {
    return <SessionSignInFallback />;
  }

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
      <PageHeader
        className="mb-6"
        title={messages.locale === 'es' ? 'Historial de reparaciones' : 'Repair history'}
        subtitle={messages.truckTitle(truck.truckNumber)}
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
        <p className="text-shop-muted">
          {messages.vin}: {truck.vin || '—'}
        </p>
        <p className="text-shop-muted">
          {messages.lastReportedLocation}: {truck.location || '—'}
          {truck.locationUpdatedOn ? ` · ${messages.locationUpdatedOn} ${formatIsoDate(truck.locationUpdatedOn, messages.locale)}` : ''}
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
            <article key={item.workOrderId} className="card space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{item.primaryCategoryName}</p>
                  <p className="mt-1 text-sm text-shop-muted">
                    {new Date(item.date).toLocaleDateString(messages.locale === 'es' ? 'es-US' : 'en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })} · #{item.truckNumber}
                  </p>
                  <p className="mt-1 text-sm text-shop-muted">
                    {messages.locale === 'es' ? 'Mecánico' : 'Mechanic'}: {item.mechanicNames.join(' / ') || '—'}
                  </p>
                </div>
                <div className="shrink-0 text-right text-xs text-shop-muted">
                  <span className="block">{messages.locale === 'es' ? 'Millaje' : 'Mileage'}</span>
                  <span className="mt-1 block font-medium text-foreground">{formatMileage(item.mileage)}</span>
                </div>
              </div>
              <div>
                <p className="group-title mb-2">{messages.locale === 'es' ? 'Trabajo realizado' : 'Work performed'}</p>
                {item.jobs.length ? <div className="flex flex-wrap gap-2">
                  {item.jobs.map((j) => (
                    <Badge key={j} variant="outline">{j}</Badge>
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
