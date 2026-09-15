'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { TruckOperationalStatus } from '@ltl-shop/shared';
import { AdminFilterToolbar, AdminPageHeader, EmptyState, LoadFailure, PageSkeleton, WorkOrderStatusBadge } from './ui';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
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
  const hasMore = Boolean(data?.[data.length - 1]?.nextCursor);

  return (
    <div className="flex flex-col gap-5">
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
        <div className="rounded-xl border">
          <Table className="min-w-[40rem]">
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="px-3">{messages.trucks}</TableHead>
                <TableHead className="px-3">{messages.operationalStatus}</TableHead>
                <TableHead className="px-3">{messages.make}</TableHead>
                <TableHead className="px-3">{messages.company}</TableHead>
                <TableHead className="px-3">{messages.currentWorkOrder}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.truck.id}>
                  <TableCell className="p-3">
                    <Link className="font-semibold text-primary hover:underline" href={`/admin/trucks/${item.truck.id}`}>{item.truck.truckNumber}</Link>
                    <p className="text-muted-foreground">
                      {[item.truck.year, item.truck.model].filter(Boolean).join(' ') || '—'}
                    </p>
                  </TableCell>
                  <TableCell className="p-3 text-muted-foreground">
                    {item.operationalStatus === TruckOperationalStatus.IN_SERVICE
                      ? messages.operationalStatusInService
                      : item.operationalStatus === TruckOperationalStatus.OFF_DUTY
                        ? messages.operationalStatusOffDuty
                        : messages.operationalStatusUnknown}
                  </TableCell>
                  <TableCell className="p-3 text-muted-foreground">{item.truck.make ?? '—'}</TableCell>
                  <TableCell className="p-3 text-muted-foreground">{item.truck.company ?? '—'}</TableCell>
                  <TableCell className="p-3">
                    {item.openWorkOrder ? (
                      <>
                        <Link className="font-medium text-primary hover:underline" href={`/admin/work-orders/${item.openWorkOrder.id}`}>{item.openWorkOrder.displayId}</Link>
                        <p className="text-muted-foreground">{item.openWorkOrder.primaryCategoryName} · <WorkOrderStatusBadge status={item.openWorkOrder.status}>{workOrderStatusLabel(item.openWorkOrder.status, messages)}</WorkOrderStatusBadge></p>
                      </>
                    ) : (
                      <span className="text-muted-foreground">{messages.noOpenWorkOrder}</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
      {hasMore ? <Button type="button" variant="outline" disabled={isValidating} onClick={() => setSize(size + 1)}>{messages.loadMore}</Button> : null}
      <p className="sr-only">{locale}</p>
    </div>
  );
}
