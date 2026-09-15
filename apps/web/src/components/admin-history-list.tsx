'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { AdminFilterToolbar, AdminPageHeader, EmptyState, LoadFailure, PageSkeleton, WorkOrderStatusBadge } from './ui';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { NativeSelect } from './ui/native-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { formatAdminDate } from '@/lib/admin-format';
import { useAdminHistory } from '@/lib/admin-data';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';
import { workOrderStatusLabel } from '@/lib/status-chips';

export function AdminHistoryList({ locale, messages }: { locale: AdminLocale; messages: AdminMessages }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [status, setStatus] = useState(searchParams.get('status') ?? 'all');
  const { data, error, isLoading, size, setSize, mutate, isValidating } = useAdminHistory(query);

  useEffect(() => {
    setSearch(searchParams.get('search') ?? '');
    setStatus(searchParams.get('status') ?? 'all');
  }, [searchParams]);

  const items = useMemo(() => data?.flatMap((page) => page.items) ?? [], [data]);
  const hasMore = Boolean(data?.[data.length - 1]?.nextCursor);

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader eyebrow={messages.eyebrow} title={messages.historyTitle} subtitle={messages.historyDescription} />
      <AdminFilterToolbar
        className="md:flex-row"
        onClear={() => router.replace('/admin/history')}
        clearLabel={messages.clearFilters}
        applyLabel={messages.applyFilters}
        onSubmit={(event) => {
          event.preventDefault();
          const next = new URLSearchParams();
          if (search.trim()) next.set('search', search.trim());
          if (status !== 'all') next.set('status', status);
          router.replace(`/admin/history${next.size ? `?${next}` : ''}`);
        }}
      >
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem]">
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={messages.searchHistory} aria-label={messages.searchHistory} />
          <NativeSelect aria-label={messages.status} value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">{messages.closedStatuses}</option>
            <option value="completed">{messages.woStatusCompleted}</option>
            <option value="cancelled">{messages.woStatusCancelled}</option>
          </NativeSelect>
        </div>
      </AdminFilterToolbar>
      {error ? <LoadFailure message={messages.loadError} retryLabel={messages.retry} onRetry={() => void mutate()} /> : null}
      {isLoading && !data ? <PageSkeleton label={messages.historyTitle} /> : null}
      {!isLoading && !error && items.length === 0 ? <EmptyState><p>{messages.noHistory}</p></EmptyState> : null}
      {items.length ? (
        <div className="rounded-xl border">
          <Table className="min-w-[48rem]">
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="px-3">{messages.displayId}</TableHead>
                <TableHead className="px-3">{messages.truck}</TableHead>
                <TableHead className="px-3">{messages.category}</TableHead>
                <TableHead className="px-3">{messages.status}</TableHead>
                <TableHead className="px-3">{messages.updatedAt}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="p-3 font-semibold"><Link className="text-primary hover:underline" href={`/admin/work-orders/${item.id}`}>{item.displayId}</Link></TableCell>
                  <TableCell className="p-3">{item.truck.truckNumber}</TableCell>
                  <TableCell className="p-3">{item.category.name}</TableCell>
                  <TableCell className="p-3"><WorkOrderStatusBadge status={item.status}>{workOrderStatusLabel(item.status, messages)}</WorkOrderStatusBadge></TableCell>
                  <TableCell className="whitespace-nowrap p-3">{formatAdminDate(item.updatedAt, locale)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
      {hasMore ? <Button type="button" variant="outline" disabled={isValidating} onClick={() => setSize(size + 1)}>{messages.loadMore}</Button> : null}
    </div>
  );
}
