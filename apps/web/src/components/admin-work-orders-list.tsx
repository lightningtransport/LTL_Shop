'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { AppCapability } from '@ltl-shop/shared';
import { AdminWorkOrderItem } from './admin-work-order-item';
import { Badge, Button, Card, EmptyState, Input, LoadFailure, PageSkeleton, PriorityBadge, Select } from './ui';
import { formatAdminDate, humanize } from '@/lib/admin-format';
import { useAdminWorkOrders } from '@/lib/admin-data';
import { useAuth } from '@/lib/auth-context';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';
import {
  buildAdminWorkOrdersQuery,
  DEFAULT_ADMIN_WORK_ORDER_FILTERS,
  DASHBOARD_RANGE_KEYS,
  hrefWithQuery,
  rankWorkOrderResults,
  readAdminWorkOrdersFilters,
} from '@/lib/work-order-search';

export function AdminWorkOrdersList({ locale, messages }: { locale: AdminLocale; messages: AdminMessages }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlQuery = searchParams.toString();
  const [filters, setFilters] = useState(() => readAdminWorkOrdersFilters(searchParams));
  const [appliedQuery, setAppliedQuery] = useState(urlQuery);
  const { user } = useAuth();
  const { data, error, isLoading, size, setSize, mutate, isValidating } = useAdminWorkOrders(appliedQuery);
  const canCreateWorkOrder = !!user?.capabilities.includes(AppCapability.WORK_ORDERS_MANAGE);

  useEffect(() => {
    const params = new URLSearchParams(urlQuery);
    setFilters(readAdminWorkOrdersFilters(params));
    setAppliedQuery(urlQuery);
  }, [urlQuery]);

  const appliedSearch = new URLSearchParams(appliedQuery).get('search') ?? '';
  const items = useMemo(() => {
    const rows = data?.flatMap((page) => page.items) ?? [];
    return rankWorkOrderResults(rows, appliedSearch).results;
  }, [appliedSearch, data]);
  const hasMore = Boolean(data?.[data.length - 1]?.nextCursor);

  function updateFilter<K extends keyof typeof filters>(key: K, value: (typeof filters)[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function applyFilters(event: React.FormEvent) {
    event.preventDefault();
    const next = buildAdminWorkOrdersQuery(filters, searchParams);
    const href = hrefWithQuery('/admin/work-orders', next);
    setAppliedQuery(next.toString());
    router.replace(href);
  }

  function clearFilters() {
    setFilters(DEFAULT_ADMIN_WORK_ORDER_FILTERS);
    setAppliedQuery('');
    router.replace('/admin/work-orders');
  }

  const hasDashboardRange = DASHBOARD_RANGE_KEYS.some((key) => searchParams.has(key));

  return <div className="space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="section-label">{messages.eyebrow}</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-wide">{messages.workOrdersTitle}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{messages.workOrdersDescription}</p>
      </div>
      {canCreateWorkOrder ? <Button asChild><Link href="/admin/work-orders/new">{messages.newWorkOrderCta}</Link></Button> : null}
    </header>
    <Card>
      <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-12" onSubmit={applyFilters}>
        <label className="space-y-1 xl:col-span-4"><span className="text-sm font-medium">{messages.search}</span><Input type="search" autoComplete="off" enterKeyHint="search" aria-label={messages.search} value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} /></label>
        <label className="space-y-1 xl:col-span-2"><span className="text-sm font-medium">{messages.status}</span><Select aria-label={messages.status} value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
          <option value="open">{messages.openStatuses}</option><option value="all">{messages.allStatuses}</option><option value="created">{messages.created}</option><option value="in_progress">{messages.inProgress}</option><option value="waiting_paused">{messages.waitingPaused}</option><option value="completed">{messages.completed}</option><option value="cancelled">{messages.cancelled}</option>
        </Select></label>
        <label className="space-y-1 xl:col-span-2"><span className="text-sm font-medium">{messages.priority}</span><Select aria-label={messages.priority} value={filters.priority} onChange={(event) => updateFilter('priority', event.target.value)}><option value="all">{messages.allPriorities}</option><option value="high,critical">{messages.highCritical}</option><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="critical">Critical</option></Select></label>
        <label className="space-y-1 xl:col-span-2"><span className="text-sm font-medium">{messages.sort}</span><Select aria-label={messages.sort} value={filters.sort} onChange={(event) => updateFilter('sort', event.target.value)}><option value="updatedAt">{messages.updatedAt}</option><option value="createdAt">{messages.createdAt}</option><option value="displayId">{messages.displayId}</option></Select></label>
        <label className="space-y-1 xl:col-span-2"><span className="text-sm font-medium">{messages.direction}</span><Select aria-label={messages.direction} value={filters.direction} onChange={(event) => updateFilter('direction', event.target.value)}><option value="desc">{messages.newestFirst}</option><option value="asc">{messages.oldestFirst}</option></Select></label>
        {hasDashboardRange ? <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground md:col-span-2 xl:col-span-12">{messages.dashboardRangeActive}</p> : null}
        <div className="flex items-end justify-end gap-2 border-t pt-3 md:col-span-2 xl:col-span-12"><Button type="button" variant="ghost" onClick={clearFilters}>{messages.clearFilters}</Button><Button type="submit">{messages.applyFilters}</Button></div>
      </form>
    </Card>
    {isLoading ? <PageSkeleton label={messages.workOrdersTitle} /> : error ? <LoadFailure message={messages.loadError} retryLabel={messages.retry} onRetry={() => void mutate()} /> : items.length === 0 ? <EmptyState><p>{messages.noWorkOrders}</p></EmptyState> : <>
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
