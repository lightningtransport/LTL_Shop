'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { AdminFilterToolbar, DataTable, PageHeader, Button, EmptyState, LoadFailure, PageSkeleton, Select, WorkOrderStatusBadge } from './ui';
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
        search={search}
        onSearchChange={setSearch}
        searchLabel={messages.searchHistory}
        filtersLabel={messages.filters}
        closeLabel={messages.closeDialog}
        activeFilterCount={searchParams.get('status') ? 1 : 0}
        filters={(
          <label className="block space-y-2 md:w-48 md:space-y-0">
            <span className="text-sm font-medium md:sr-only">{messages.status}</span>
            <Select aria-label={messages.status} value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="all">{messages.closedStatuses}</option>
              <option value="completed">{messages.woStatusCompleted}</option>
              <option value="cancelled">{messages.woStatusCancelled}</option>
            </Select>
          </label>
        )}
        onClear={() => router.replace('/admin/history')}
        clearLabel={messages.clearFilters}
        applyLabel={messages.applyFilters}
        onSubmit={() => {
          const next = new URLSearchParams();
          if (search.trim()) next.set('search', search.trim());
          if (status !== 'all') next.set('status', status);
          router.replace(`/admin/history${next.size ? `?${next}` : ''}`);
        }}
      />
      {error ? <LoadFailure message={messages.loadError} retryLabel={messages.retry} onRetry={() => void mutate()} /> : null}
      {isLoading && !data ? <PageSkeleton label={messages.historyTitle} header={false} /> : null}
      {!isLoading && !error && items.length === 0 ? <EmptyState><p>{messages.noHistory}</p></EmptyState> : null}
      {items.length ? (
        <DataTable
          items={items}
          caption={messages.historyTitle}
          getKey={(item) => item.id}
          getRowLabel={(item) => `${item.truck.truckNumber} ${item.displayId}`}
          columns={[
            {
              key: 'work-order',
              header: messages.displayId,
              primary: true,
              cell: (item) => (
                <div>
                  <Link className="tap-inline font-semibold text-primary hover:underline" href={`/admin/work-orders/${item.id}`}>{item.displayId}</Link>
                  <p className="text-sm text-muted-foreground">{messages.truck} {item.truck.truckNumber}</p>
                </div>
              ),
            },
            { key: 'status', header: messages.status, cell: (item) => <span><WorkOrderStatusBadge status={item.status}>{workOrderStatusLabel(item.status, messages)}</WorkOrderStatusBadge></span> },
            { key: 'category', header: messages.category, cell: (item) => <span>{item.category.name}</span> },
            { key: 'updated', header: messages.updatedAt, className: 'whitespace-nowrap', cell: (item) => <span>{formatAdminDate(item.updatedAt, locale)}</span> },
          ]}
        />
      ) : null}
      {hasMore ? <Button type="button" variant="outline" disabled={isValidating} onClick={() => setSize(size + 1)}>{messages.loadMore}</Button> : null}
    </div>
  );
}
