'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { AdminFilterToolbar, PageHeader, Button, EmptyState, Input, LoadFailure, PageSkeleton, Select, WorkOrderStatusBadge } from './ui';
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
    <div className="space-y-6">
      <PageHeader title={messages.historyTitle} subtitle={messages.historyDescription} />
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
          <Select aria-label={messages.status} value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">{messages.closedStatuses}</option>
            <option value="completed">{messages.woStatusCompleted}</option>
            <option value="cancelled">{messages.woStatusCancelled}</option>
          </Select>
        </div>
      </AdminFilterToolbar>
      {error ? <LoadFailure message={messages.loadError} retryLabel={messages.retry} onRetry={() => void mutate()} /> : null}
      {isLoading && !data ? <PageSkeleton label={messages.historyTitle} header={false} /> : null}
      {!isLoading && !error && items.length === 0 ? <EmptyState><p>{messages.noHistory}</p></EmptyState> : null}
      {items.length ? (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="p-3 font-medium">{messages.truck}</th>
                <th className="p-3 font-medium">{messages.displayId}</th>
                <th className="p-3 font-medium">{messages.category}</th>
                <th className="p-3 font-medium">{messages.status}</th>
                <th className="p-3 font-medium">{messages.updatedAt}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="p-3 font-display font-semibold">{item.truck.truckNumber}</td>
                  <td className="p-3 text-muted-foreground"><Link className="tap-inline hover:underline" href={`/admin/work-orders/${item.id}`}>{item.displayId}</Link></td>
                  <td className="p-3">{item.category.name}</td>
                  <td className="p-3"><WorkOrderStatusBadge status={item.status}>{workOrderStatusLabel(item.status, messages)}</WorkOrderStatusBadge></td>
                  <td className="whitespace-nowrap p-3">{formatAdminDate(item.updatedAt, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {hasMore ? <Button type="button" variant="outline" disabled={isValidating} onClick={() => setSize(size + 1)}>{messages.loadMore}</Button> : null}
    </div>
  );
}
