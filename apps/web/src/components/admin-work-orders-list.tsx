'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { AdminWorkOrderItem } from './admin-work-order-item';
import { Badge, Button, Card, EmptyState, Input, LoadFailure, PageSkeleton, PriorityBadge, Select } from './ui';
import { formatAdminDate, humanize } from '@/lib/admin-format';
import { useAdminWorkOrders } from '@/lib/admin-data';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';

const OPEN_STATUSES = 'created,in_progress,waiting_paused';
const DASHBOARD_RANGE_KEYS = ['createdBefore', 'completedFrom', 'completedBefore'] as const;

function statusFilterValue(searchParams: { get(name: string): string | null }) {
  const value = searchParams.get('status');
  return value === OPEN_STATUSES ? 'open' : value ?? 'all';
}

export function AdminWorkOrdersList({ locale, messages }: { locale: AdminLocale; messages: AdminMessages }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [status, setStatus] = useState(statusFilterValue(searchParams));
  const [priority, setPriority] = useState(searchParams.get('priority') ?? 'all');
  const [sort, setSort] = useState(searchParams.get('sort') ?? 'updatedAt');
  const [direction, setDirection] = useState(searchParams.get('direction') ?? 'desc');
  const { data, error, isLoading, size, setSize, mutate, isValidating } = useAdminWorkOrders(query);

  useEffect(() => {
    setSearch(searchParams.get('search') ?? '');
    setStatus(statusFilterValue(searchParams));
    setPriority(searchParams.get('priority') ?? 'all');
    setSort(searchParams.get('sort') ?? 'updatedAt');
    setDirection(searchParams.get('direction') ?? 'desc');
  }, [searchParams]);

  const items = useMemo(() => data?.flatMap((page) => page.items) ?? [], [data]);
  const hasMore = Boolean(data?.[data.length - 1]?.nextCursor);

  function applyFilters(event: React.FormEvent) {
    event.preventDefault();
    const next = new URLSearchParams();
    if (search.trim()) next.set('search', search.trim());
    if (status === 'open') next.set('status', OPEN_STATUSES);
    else if (status !== 'all') next.set('status', status);
    if (priority !== 'all') next.set('priority', priority);
    if (sort !== 'updatedAt') next.set('sort', sort);
    if (direction !== 'desc') next.set('direction', direction);
    for (const key of DASHBOARD_RANGE_KEYS) {
      const value = searchParams.get(key);
      if (value) next.set(key, value);
    }
    router.replace(`/admin/work-orders${next.size ? `?${next}` : ''}`);
  }

  const hasDashboardRange = DASHBOARD_RANGE_KEYS.some((key) => searchParams.has(key));

  return <div className="space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="section-label">{messages.eyebrow}</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-wide">{messages.workOrdersTitle}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{messages.workOrdersDescription}</p>
      </div>
      <Button asChild><Link href="/admin/work-orders/new">{messages.newWorkOrderCta}</Link></Button>
    </header>
    <Card>
      <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-12" onSubmit={applyFilters}>
        <label className="space-y-1 xl:col-span-4"><span className="text-sm font-medium">{messages.search}</span><Input value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <label className="space-y-1 xl:col-span-2"><span className="text-sm font-medium">{messages.status}</span><Select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="open">{messages.openStatuses}</option><option value="all">{messages.allStatuses}</option><option value="created">{messages.created}</option><option value="in_progress">{messages.inProgress}</option><option value="waiting_paused">{messages.waitingPaused}</option><option value="completed">{messages.completed}</option><option value="cancelled">{messages.cancelled}</option>
        </Select></label>
        <label className="space-y-1 xl:col-span-2"><span className="text-sm font-medium">{messages.priority}</span><Select value={priority} onChange={(event) => setPriority(event.target.value)}><option value="all">{messages.allPriorities}</option><option value="high,critical">{messages.highCritical}</option><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="critical">Critical</option></Select></label>
        <label className="space-y-1 xl:col-span-2"><span className="text-sm font-medium">{messages.sort}</span><Select value={sort} onChange={(event) => setSort(event.target.value)}><option value="updatedAt">{messages.updatedAt}</option><option value="createdAt">{messages.createdAt}</option><option value="displayId">{messages.displayId}</option></Select></label>
        <label className="space-y-1 xl:col-span-2"><span className="text-sm font-medium">{messages.direction}</span><Select value={direction} onChange={(event) => setDirection(event.target.value)}><option value="desc">{messages.newestFirst}</option><option value="asc">{messages.oldestFirst}</option></Select></label>
        {hasDashboardRange ? <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground md:col-span-2 xl:col-span-12">{messages.dashboardRangeActive}</p> : null}
        <div className="flex items-end justify-end gap-2 border-t pt-3 md:col-span-2 xl:col-span-12"><Button type="button" variant="ghost" onClick={() => router.replace('/admin/work-orders')}>{messages.clearFilters}</Button><Button type="submit">{messages.applyFilters}</Button></div>
      </form>
    </Card>
    {isLoading ? <PageSkeleton label={messages.workOrdersTitle} /> : error ? <LoadFailure message={messages.loadError} retryLabel={messages.retry} onRetry={() => void mutate()} /> : items.length === 0 ? <EmptyState>{messages.noWorkOrders}</EmptyState> : <>
      <div className="space-y-3 xl:hidden">{items.map((item) => <AdminWorkOrderItem key={item.id} item={item} locale={locale} messages={messages} />)}</div>
      <div className="hidden min-h-60 max-h-[calc(100dvh-22rem)] overflow-auto rounded-xl border bg-card xl:block">
        <table className="w-full min-w-[900px] text-left text-sm"><thead className="sticky top-0 bg-muted"><tr><th className="p-3">{messages.displayId}</th><th className="p-3">{messages.truck}</th><th className="p-3">{messages.category}</th><th className="p-3">{messages.status}</th><th className="p-3">{messages.priority}</th><th className="p-3">{messages.progress}</th><th className="p-3">{messages.mechanicsLabel}</th><th className="p-3">{messages.updated}</th></tr></thead>
          <tbody>{items.map((item) => <tr key={item.id} className="border-t"><td className="p-3 font-semibold"><Link className="text-primary hover:underline" href={`/admin/work-orders/${item.id}`}>{item.displayId}</Link></td><td className="p-3"><Link className="text-primary hover:underline" href={`/admin/trucks/${item.truck.id}`}>{item.truck.truckNumber}</Link></td><td className="p-3">{item.category.name}</td><td className="p-3"><Badge variant="outline">{humanize(item.status)}</Badge></td><td className="p-3"><PriorityBadge priority={item.priority} /></td><td className="p-3">{item.jobsCompleted}/{item.jobsTotal}</td><td className="max-w-48 truncate p-3">{item.mechanics.map((mechanic) => mechanic.mechanicName).join(', ') || '—'}</td><td className="whitespace-nowrap p-3">{formatAdminDate(item.updatedAt, locale)}</td></tr>)}</tbody>
        </table>
      </div>
      {hasMore ? <Button variant="outline" className="w-full" disabled={isValidating} onClick={() => void setSize(size + 1)}>{isValidating ? `${messages.loadMore}…` : messages.loadMore}</Button> : null}
    </>}
  </div>;
}
