'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { TruckOperationalStatus } from '@ltl-shop/shared';
import { AdminFilterToolbar, AdminPageHeader, Button, EmptyState, Input, LoadFailure, PageSkeleton, WorkOrderStatusBadge } from './ui';
import { adminTruckHref } from '@/lib/admin-truck-origin';
import { useAdminTrucks } from '@/lib/admin-data';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';
import { workOrderStatusLabel } from '@/lib/status-chips';

export function AdminTrucksList({ locale, messages }: { locale: AdminLocale; messages: AdminMessages }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const { data, error, isLoading, size, setSize, mutate, isValidating } = useAdminTrucks(query);

  useEffect(() => {
    setSearch(searchParams.get('search') ?? '');
  }, [searchParams]);

  const items = useMemo(() => data?.flatMap((page) => page.items) ?? [], [data]);
  const showOperationalStatus = items.some((item) => item.operationalStatus !== TruckOperationalStatus.UNKNOWN);
  const hasMore = Boolean(data?.[data.length - 1]?.nextCursor);

  return (
    <div className="space-y-5">
      <AdminPageHeader eyebrow={messages.eyebrow} title={messages.trucksTitle} subtitle={messages.trucksDescription} />
      <AdminFilterToolbar
        onClear={() => router.replace('/admin/trucks')}
        clearLabel={messages.clearFilters}
        applyLabel={messages.applyFilters}
        onSubmit={(event) => {
          event.preventDefault();
          const next = new URLSearchParams();
          if (search.trim()) next.set('search', search.trim());
          router.replace(`/admin/trucks${next.size ? `?${next}` : ''}`);
        }}
      >
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={messages.searchTrucks} aria-label={messages.searchTrucks} />
      </AdminFilterToolbar>
      {error ? <LoadFailure message={messages.loadError} retryLabel={messages.retry} onRetry={() => void mutate()} /> : null}
      {isLoading && !data ? <PageSkeleton label={messages.trucksTitle} /> : null}
      {!isLoading && !error && items.length === 0 ? <EmptyState><p>{messages.noTrucksMatch}</p></EmptyState> : null}
      {items.length ? (
        <div className="overflow-x-auto rounded-xl border">
          {/* LTR-111: hide the column while every truck is Unknown (no service-status events yet). */}
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="p-3 font-medium">{messages.trucks}</th>
                {showOperationalStatus ? <th className="p-3 font-medium">{messages.operationalStatus}</th> : null}
                <th className="p-3 font-medium">{messages.make}</th>
                <th className="p-3 font-medium">{messages.company}</th>
                <th className="p-3 font-medium">{messages.currentWorkOrder}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.truck.id} className="border-t">
                  <td className="p-3">
                    <Link className="font-semibold text-primary hover:underline" href={adminTruckHref(item.truck.id, '/admin/trucks')}>{item.truck.truckNumber}</Link>
                    <p className="text-muted-foreground">
                      {[item.truck.year, item.truck.model].filter(Boolean).join(' ') || '—'}
                    </p>
                  </td>
                  {showOperationalStatus ? (
                    <td className="p-3 text-muted-foreground">
                      {item.operationalStatus === TruckOperationalStatus.IN_SERVICE
                        ? messages.operationalStatusInService
                        : item.operationalStatus === TruckOperationalStatus.OFF_DUTY
                          ? messages.operationalStatusOffDuty
                          : messages.operationalStatusUnknown}
                    </td>
                  ) : null}
                  <td className="p-3 text-muted-foreground">{item.truck.make ?? '—'}</td>
                  <td className="p-3 text-muted-foreground">{item.truck.company ?? '—'}</td>
                  <td className="p-3">
                    {item.openWorkOrder ? (
                      <>
                        <Link className="font-medium text-primary hover:underline" href={`/admin/work-orders/${item.openWorkOrder.id}`}>{item.openWorkOrder.displayId}</Link>
                        <p className="text-muted-foreground">{item.openWorkOrder.primaryCategoryName} · <WorkOrderStatusBadge status={item.openWorkOrder.status}>{workOrderStatusLabel(item.openWorkOrder.status, messages)}</WorkOrderStatusBadge></p>
                      </>
                    ) : (
                      <span className="text-muted-foreground">{messages.noOpenWorkOrder}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {hasMore ? <Button type="button" variant="outline" disabled={isValidating} onClick={() => setSize(size + 1)}>{messages.loadMore}</Button> : null}
      <p className="sr-only">{locale}</p>
    </div>
  );
}
