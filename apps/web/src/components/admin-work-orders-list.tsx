'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { AppCapability } from '@ltl-shop/shared';
import { AdminWorkOrderItem } from './admin-work-order-item';
import { PageHeader, Button, Card, EmptyState, Input, LoadFailure, Modal, PageSkeleton, PriorityBadge, Select, WorkOrderStatusBadge } from './ui';
import { adminListFromPath, adminTruckHref, adminWorkOrderHref } from '@/lib/admin-truck-origin';
import { workOrderListNextText } from '@/lib/admin-work-summary';
import { formatAdminDate } from '@/lib/admin-format';
import { adminPriorityLabel, workOrderStatusLabel } from '@/lib/status-chips';
import { useAdminWorkOrders } from '@/lib/admin-data';
import { useAuth } from '@/lib/auth-context';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';
import {
  buildAdminWorkOrdersQuery,
  countActiveAdminWorkOrderFilters,
  DEFAULT_ADMIN_WORK_ORDER_FILTERS,
  DASHBOARD_RANGE_KEYS,
  hrefWithQuery,
  rankWorkOrderResults,
  readAdminWorkOrdersFilters,
  type AdminWorkOrdersFilters,
} from '@/lib/work-order-search';

export function AdminWorkOrdersList({ locale, messages }: { locale: AdminLocale; messages: AdminMessages }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlQuery = searchParams.toString();
  const [filters, setFilters] = useState(() => readAdminWorkOrdersFilters(searchParams));
  const [appliedQuery, setAppliedQuery] = useState(urlQuery);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { user } = useAuth();
  const { data, error, isLoading, size, setSize, mutate, isValidating } = useAdminWorkOrders(appliedQuery);
  const canCreateWorkOrder = !!user?.capabilities.includes(AppCapability.WORK_ORDERS_MANAGE);
  // LTR-245 (UX-5-008): the Truck and the Work Order come back here with the same filters.
  const fromPath = adminListFromPath('/admin/work-orders', urlQuery);

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
    setFiltersOpen(false);
  }

  function clearFilters() {
    setFilters(DEFAULT_ADMIN_WORK_ORDER_FILTERS);
    setAppliedQuery('');
    router.replace('/admin/work-orders');
    setFiltersOpen(false);
  }

  const appliedParams = useMemo(() => new URLSearchParams(appliedQuery), [appliedQuery]);
  const activeFilterCount = countActiveAdminWorkOrderFilters(
    readAdminWorkOrdersFilters(appliedParams),
    appliedParams,
  );
  const hasDashboardRange = DASHBOARD_RANGE_KEYS.some((key) => searchParams.has(key));
  const filtersButtonLabel = activeFilterCount > 0
    ? `${messages.filters} (${activeFilterCount})`
    : messages.filters;

  return <div className="space-y-6">
    <PageHeader
      title={messages.workOrdersTitle}
      subtitle={messages.workOrdersDescription}
      actions={canCreateWorkOrder ? <Button asChild><Link href="/admin/work-orders/new">{messages.newWorkOrderCta}</Link></Button> : null}
    />
    <Card className="min-w-0 p-3 [container-type:inline-size]">
      {/* UX-4-005: five filters fit inline only when the card has the room (container, not window). */}
      <form role="search" className="min-w-0" onSubmit={applyFilters}>
        <div className="flex min-w-0 items-end gap-2 [@container(min-width:68rem)]:flex-nowrap [@container(min-width:68rem)]:gap-1.5">
          {/* UX-4-005: the search keeps 14rem next to the inline filters; short placeholder, full aria-label. */}
          <label className="min-w-0 flex-1 space-y-1 [@container(min-width:68rem)]:min-w-[14rem] [@container(min-width:68rem)]:flex-[1.35]">
            <span className="sr-only [@container(min-width:68rem)]:not-sr-only [@container(min-width:68rem)]:block [@container(min-width:68rem)]:truncate [@container(min-width:68rem)]:text-xs [@container(min-width:68rem)]:font-medium" title={messages.search}>{messages.search}</span>
            <Input
              type="search"
              autoComplete="off"
              enterKeyHint="search"
              aria-label={messages.search}
              placeholder={messages.searchPlaceholder}
              className="[@container(min-width:68rem)]:min-h-9 [@container(min-width:68rem)]:px-3"
              value={filters.search}
              onChange={(event) => updateFilter('search', event.target.value)}
            />
          </label>
          <div className="hidden min-w-0 [@container(min-width:68rem)]:contents">
            <WorkOrderFilterFields filters={filters} messages={messages} onChange={updateFilter} compact />
            <div className="flex shrink-0 gap-1.5">
              <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={clearFilters}>{messages.clearFilters}</Button>
              <Button type="submit" size="sm" className="shrink-0">{messages.applyFilters}</Button>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            className="shrink-0 [@container(min-width:68rem)]:hidden"
            aria-label={filtersButtonLabel}
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen(true)}
          >
            <SlidersHorizontal aria-hidden="true" className="size-4" />
            {messages.filters}
            {activeFilterCount > 0 ? (
              <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
                {activeFilterCount}
              </span>
            ) : null}
          </Button>
        </div>
        {hasDashboardRange ? <p className="mt-2 hidden rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground [@container(min-width:68rem)]:block">{messages.dashboardRangeActive}</p> : null}
      </form>
    </Card>
    <Modal
      open={filtersOpen}
      title={messages.filters}
      onClose={() => setFiltersOpen(false)}
    >
      <form className="space-y-3" onSubmit={applyFilters}>
        <WorkOrderFilterFields filters={filters} messages={messages} onChange={updateFilter} />
        {hasDashboardRange ? <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">{messages.dashboardRangeActive}</p> : null}
        <div className="flex items-end justify-end gap-2 border-t pt-3">
          <Button type="button" variant="ghost" onClick={clearFilters}>{messages.clearFilters}</Button>
          <Button type="submit">{messages.applyFilters}</Button>
        </div>
      </form>
    </Modal>
    {isLoading && !data ? <PageSkeleton label={messages.workOrdersTitle} /> : error ? <LoadFailure message={messages.loadError} retryLabel={messages.retry} onRetry={() => void mutate()} /> : items.length === 0 ? <EmptyState><p>{messages.noWorkOrders}</p></EmptyState> : <>
      <div className="space-y-3 xl:hidden">{items.map((item) => <AdminWorkOrderItem key={item.id} item={item} locale={locale} messages={messages} fromPath={fromPath} canManage={canCreateWorkOrder} onChanged={() => mutate()} />)}</div>
      <div className="hidden min-h-60 max-h-[calc(100dvh-22rem)] overflow-auto rounded-xl border bg-card xl:block">
        <table className="w-full min-w-[900px] text-left text-sm"><thead className="sticky top-0 bg-muted"><tr><th className="p-3">{messages.truck}</th><th className="whitespace-nowrap p-3">{messages.displayId}</th><th className="p-3">{messages.workOrderNextColumn}</th><th className="p-3">{messages.status}</th><th className="p-3">{messages.priority}</th><th className="p-3">{messages.progress}</th><th className="p-3">{messages.mechanicsLabel}</th><th className="p-3">{messages.updated}</th></tr></thead>
          <tbody>{items.map((item) => <tr key={item.id} className="border-t"><td className="p-3 font-display text-base font-semibold"><Link className="text-primary hover:underline" href={adminTruckHref(item.truck.id, fromPath)}>{item.truck.truckNumber}</Link></td><td className="whitespace-nowrap p-3 text-muted-foreground"><Link className="hover:underline" href={adminWorkOrderHref(item.id, fromPath)}>{item.displayId}</Link></td><td className="p-3" data-testid="work-order-row-next-step" data-kind={item.nextStep?.kind}>{workOrderListNextText(item, messages)}</td><td className="p-3"><WorkOrderStatusBadge status={item.status}>{workOrderStatusLabel(item.status, messages)}</WorkOrderStatusBadge></td><td className="p-3"><PriorityBadge priority={item.priority}>{adminPriorityLabel(item.priority, messages)}</PriorityBadge></td><td className="p-3">{item.jobsCompleted}/{item.jobsTotal}</td><td className="max-w-48 truncate p-3">{item.mechanics.map((mechanic) => mechanic.mechanicName).join(', ') || '—'}</td><td className="whitespace-nowrap p-3">{formatAdminDate(item.updatedAt, locale)}</td></tr>)}</tbody>
        </table>
      </div>
      {hasMore ? <Button variant="outline" className="w-full" disabled={isValidating} onClick={() => void setSize(size + 1)}>{isValidating ? `${messages.loadMore}…` : messages.loadMore}</Button> : null}
    </>}
  </div>;
}

function WorkOrderFilterFields({
  filters,
  messages,
  onChange,
  compact = false,
}: {
  filters: AdminWorkOrdersFilters;
  messages: AdminMessages;
  onChange: <K extends keyof AdminWorkOrdersFilters>(key: K, value: AdminWorkOrdersFilters[K]) => void;
  compact?: boolean;
}) {
  // LTR-169: block, or the sheet's space-y never reaches the inline <label> (4px between fields).
  const fieldClass = compact ? 'min-w-0 flex-1 space-y-1' : 'block space-y-2';
  const labelClass = compact ? 'block truncate text-xs font-medium' : 'text-sm font-medium';
  const controlClass = compact ? 'min-h-9 px-3 pr-9' : undefined;

  return <>
    <label className={fieldClass}><span className={labelClass} title={messages.status}>{messages.status}</span><Select className={controlClass} aria-label={messages.status} value={filters.status} onChange={(event) => onChange('status', event.target.value)}>
      <option value="open">{messages.openStatuses}</option><option value="closed">{messages.woClosedFilter}</option><option value="all">{messages.allStatuses}</option><option value="created">{messages.woStatusCreated}</option><option value="in_progress">{messages.woStatusInProgress}</option><option value="waiting_paused">{messages.woStatusPaused}</option><option value="completed">{messages.woStatusCompleted}</option><option value="cancelled">{messages.woStatusCancelled}</option>
    </Select></label>
    <label className={fieldClass}><span className={labelClass} title={messages.priority}>{messages.priority}</span><Select className={controlClass} aria-label={messages.priority} value={filters.priority} onChange={(event) => onChange('priority', event.target.value)}><option value="all">{messages.allPriorities}</option><option value="high,critical">{messages.highCritical}</option><option value="low">{messages.lowPriority}</option><option value="normal">{messages.normalPriority}</option><option value="high">{messages.highPriority}</option><option value="critical">{messages.criticalPriority}</option></Select></label>
    <label className={fieldClass}><span className={labelClass} title={messages.sort}>{messages.sort}</span><Select className={controlClass} aria-label={messages.sort} value={filters.sort} onChange={(event) => onChange('sort', event.target.value)}><option value="updatedAt">{messages.updatedAt}</option><option value="createdAt">{messages.createdAt}</option><option value="displayId">{messages.displayId}</option></Select></label>
    <label className={fieldClass}><span className={labelClass} title={messages.direction}>{messages.direction}</span><Select className={controlClass} aria-label={messages.direction} value={filters.direction} onChange={(event) => onChange('direction', event.target.value)}><option value="desc">{messages.newestFirst}</option><option value="asc">{messages.oldestFirst}</option></Select></label>
  </>;
}
