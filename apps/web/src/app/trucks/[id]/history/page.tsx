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
import { intlLocale } from '@/lib/shop-locale';
import { apiErrorMessage } from '@/lib/api-error-message';
import { useDebouncedFilterText, useUrlFilters } from '@/lib/use-url-filters';

const HISTORY_FILTERS = { category: '' };

export default function RepairHistoryPage() {
  const { token, sessionLoading } = useAuth();
  const { messages } = useShopLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams<{ id: string }>();
  // LTR-293 §9: the category is in the URL (?category=), so Back from a Work Order keeps it.
  const { filters, set } = useUrlFilters(HISTORY_FILTERS);
  const categoryId = filters.category || 'all';
  const setCategoryId = (next: string) => set('category', next === 'all' ? '' : next);
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
    ? messages.backToNewWorkOrder
    : backHref.startsWith('/work-orders/')
      ? messages.backToWorkOrder
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
        <LoadFailure message={apiErrorMessage(error, messages, messages.loadError)} onRetry={() => void mutate()} retryLabel={messages.retry} />
      );
    }
    return <PageSkeleton label={messages.loadingRepairHistory} />;
  }

  return (
    <div>
      <PageHeader
        className="mb-6"
        title={messages.repairHistoryTitle}
        subtitle={messages.truckTitle(truck.truckNumber)}
        backHref={backHref}
        backLabel={backLabel}
      />

      <Card className="mb-4 text-sm">
        {/* UX-F-005: the vehicle reads like everywhere else ("2022 Volvo VNL 760"), with "·" between facts. */}
        <p>{[truck.year, truck.make, truck.model].filter(Boolean).join(' ')}</p>
        <p className="text-shop-muted">
          {[formatMileage(truck.mileage), truck.company, truck.owner].filter(Boolean).join(' · ')}
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
        aria-label={messages.filterRepairHistory}
      >
        <FilterChip
          active={categoryId === 'all'}
          onClick={() => setCategoryId('all')}
          label={messages.allCategoriesChip}
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
        <EmptyState>{messages.noRepairHistory}</EmptyState>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <article key={item.workOrderId} className="card space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{item.primaryCategoryName}</p>
                  <p className="mt-1 text-sm text-shop-muted">
                    {new Date(item.date).toLocaleDateString(intlLocale(messages.locale), {
                      // LTR-293 §13: the shop's day, not the phone's.
                      timeZone: 'America/New_York',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })} · #{item.truckNumber}
                  </p>
                  <p className="mt-1 text-sm text-shop-muted">
                    {messages.mechanicLabel}: {item.mechanicNames.join(' / ') || '—'}
                  </p>
                </div>
                <div className="shrink-0 text-right text-xs text-shop-muted">
                  <span className="block">{messages.mileageLabel}</span>
                  <span className="mt-1 block font-medium text-foreground">{formatMileage(item.mileage)}</span>
                </div>
              </div>
              <div>
                <p className="group-title mb-2">{messages.workPerformed}</p>
                {item.jobs.length ? <div className="flex flex-wrap gap-2">
                  {item.jobs.map((j) => (
                    <Badge key={j} variant="outline">{j}</Badge>
                  ))}
                </div> : <p className="text-sm text-shop-muted">{messages.noWorkDetails}</p>}
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
