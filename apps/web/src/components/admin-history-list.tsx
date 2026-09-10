'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, EmptyState, Input, LoadFailure, PageSkeleton, Select } from './ui';
import { formatAdminDate } from '@/lib/admin-format';
import { useAdminHistory } from '@/lib/admin-data';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';

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
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-muted-foreground">{messages.eyebrow}</p>
        <h1 className="font-display text-2xl font-semibold">{messages.historyTitle}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{messages.historyDescription}</p>
      </div>
      <form
        className="grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          const next = new URLSearchParams();
          if (search.trim()) next.set('search', search.trim());
          if (status !== 'all') next.set('status', status);
          router.replace(`/admin/history${next.size ? `?${next}` : ''}`);
        }}
      >
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={messages.searchHistory} aria-label={messages.searchHistory} />
        <Select aria-label={messages.status} value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">{messages.closedStatuses}</option>
          <option value="completed">{messages.completed}</option>
          <option value="cancelled">{messages.cancelled}</option>
        </Select>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={() => router.replace('/admin/history')}>{messages.clearFilters}</Button>
          <Button type="submit">{messages.applyFilters}</Button>
        </div>
      </form>
      {error ? <LoadFailure message={messages.loadError} retryLabel={messages.retry} onRetry={() => void mutate()} /> : null}
      {isLoading && !data ? <PageSkeleton label={messages.historyTitle} /> : null}
      {!isLoading && !error && items.length === 0 ? <EmptyState><p>{messages.noHistory}</p></EmptyState> : null}
      {items.length ? (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="p-3 font-medium">{messages.displayId}</th>
                <th className="p-3 font-medium">{messages.truck}</th>
                <th className="p-3 font-medium">{messages.category}</th>
                <th className="p-3 font-medium">{messages.status}</th>
                <th className="p-3 font-medium">{messages.updatedAt}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="p-3 font-semibold"><Link className="text-primary hover:underline" href={`/admin/work-orders/${item.id}`}>{item.displayId}</Link></td>
                  <td className="p-3">{item.truck.truckNumber}</td>
                  <td className="p-3">{item.category.name}</td>
                  <td className="p-3"><Badge variant="outline">{item.status === 'cancelled' ? messages.cancelled : messages.completed}</Badge></td>
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
