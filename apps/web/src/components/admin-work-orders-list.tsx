'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { AppCapability } from '@ltl-shop/shared';
import { AdminWorkOrderItem } from './admin-work-order-item';
import { AdminPageHeader, EmptyState, LoadFailure, PageSkeleton, PriorityBadge, WorkOrderStatusBadge } from './ui';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { NativeSelect as Select } from './ui/native-select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from './ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
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
  const filtersButtonRef = useRef<HTMLButtonElement>(null);
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

  return <div className="flex flex-col gap-5">
    <AdminPageHeader
      eyebrow={messages.eyebrow}
      title={messages.workOrdersTitle}
      subtitle={messages.workOrdersDescription}
      actions={canCreateWorkOrder ? <Button asChild><Link href="/admin/work-orders/new">{messages.newWorkOrderCta}</Link></Button> : null}
    />
    <Card className="min-w-0 p-3">
      <form role="search" className="min-w-0" onSubmit={applyFilters}>
        <div className="flex min-w-0 items-end gap-2 md:flex-nowrap md:gap-1.5">
          <label className="min-w-0 flex-1 space-y-1 md:flex-[1.35]">
            <span className="sr-only md:not-sr-only md:block md:truncate md:text-xs md:font-medium" title={messages.search}>{messages.search}</span>
            <Input
              type="search"
              autoComplete="off"
              enterKeyHint="search"
              aria-label={messages.search}
              className="md:min-h-9 md:px-3"
              value={filters.search}
              onChange={(event) => updateFilter('search', event.target.value)}
            />
          </label>
          <div className="hidden min-w-0 md:contents">
            <WorkOrderFilterFields filters={filters} messages={messages} onChange={updateFilter} compact />
            <div className="flex shrink-0 gap-1.5">
              <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={clearFilters}>{messages.clearFilters}</Button>
              <Button type="submit" size="sm" className="shrink-0">{messages.applyFilters}</Button>
            </div>
          </div>
          <Button
            ref={filtersButtonRef}
            type="button"
            variant="outline"
            className="shrink-0 md:hidden"
            aria-label={filtersButtonLabel}
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen(true)}
          >
            <SlidersHorizontal aria-hidden="true" className="size-4" />
            {messages.filters}
            {activeFilterCount > 0 ? (
              <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
                {activeFilterCount}
              </span>
            ) : null}
          </Button>
        </div>
        {hasDashboardRange ? <p className="mt-2 hidden rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground md:block">{messages.dashboardRangeActive}</p> : null}
      </form>
    </Card>
    <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
      <SheetContent
        side="bottom"
        closeLabel={messages.closeFilters}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          filtersButtonRef.current?.focus();
        }}
      >
      <SheetHeader className="mb-4">
        <SheetTitle>{messages.filters}</SheetTitle>
        <SheetDescription>{messages.workOrdersDescription}</SheetDescription>
      </SheetHeader>
      <form className="flex flex-col gap-3" onSubmit={applyFilters}>
        <WorkOrderFilterFields filters={filters} messages={messages} onChange={updateFilter} />
        {hasDashboardRange ? <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">{messages.dashboardRangeActive}</p> : null}
        <div className="flex items-end justify-end gap-2 border-t pt-3">
          <Button type="button" variant="ghost" onClick={clearFilters}>{messages.clearFilters}</Button>
          <Button type="submit">{messages.applyFilters}</Button>
        </div>
      </form>
      </SheetContent>
    </Sheet>
    {isLoading ? <PageSkeleton label={messages.workOrdersTitle} /> : error ? <LoadFailure message={messages.loadError} retryLabel={messages.retry} onRetry={() => void mutate()} /> : items.length === 0 ? <EmptyState><p>{messages.noWorkOrders}</p></EmptyState> : <>
      <div className="flex flex-col gap-3 xl:hidden">{items.map((item) => <AdminWorkOrderItem key={item.id} item={item} locale={locale} messages={messages} />)}</div>
      <div className="hidden min-h-60 max-h-[calc(100dvh-22rem)] overflow-auto rounded-xl border bg-card xl:block">
        <Table className="min-w-[900px]">
          <TableHeader className="sticky top-0 bg-muted">
            <TableRow>
              <TableHead className="px-3">{messages.displayId}</TableHead>
              <TableHead className="px-3">{messages.truck}</TableHead>
              <TableHead className="px-3">{messages.category}</TableHead>
              <TableHead className="px-3">{messages.status}</TableHead>
              <TableHead className="px-3">{messages.priority}</TableHead>
              <TableHead className="px-3">{messages.progress}</TableHead>
              <TableHead className="px-3">{messages.mechanicsLabel}</TableHead>
              <TableHead className="px-3">{messages.updated}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>{items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="p-3 font-semibold"><Link className="text-primary hover:underline" href={`/admin/work-orders/${item.id}`}>{item.displayId}</Link></TableCell>
              <TableCell className="p-3"><Link className="text-primary hover:underline" href={`/admin/trucks/${item.truck.id}`}>{item.truck.truckNumber}</Link></TableCell>
              <TableCell className="p-3">{item.category.name}</TableCell>
              <TableCell className="p-3"><WorkOrderStatusBadge status={item.status}>{workOrderStatusLabel(item.status, messages)}</WorkOrderStatusBadge></TableCell>
              <TableCell className="p-3"><PriorityBadge priority={item.priority}>{adminPriorityLabel(item.priority, messages)}</PriorityBadge></TableCell>
              <TableCell className="p-3">{item.jobsCompleted}/{item.jobsTotal}</TableCell>
              <TableCell className="max-w-48 truncate p-3">{item.mechanics.map((mechanic) => mechanic.mechanicName).join(', ') || '—'}</TableCell>
              <TableCell className="whitespace-nowrap p-3">{formatAdminDate(item.updatedAt, locale)}</TableCell>
            </TableRow>
          ))}</TableBody>
        </Table>
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
  const fieldClass = compact ? 'min-w-0 flex-1 space-y-1' : 'space-y-1';
  const labelClass = compact ? 'block truncate text-xs font-medium' : 'text-sm font-medium';
  const controlClass = compact ? 'min-h-9 px-3 pr-9' : undefined;

  return <>
    <label className={fieldClass}><span className={labelClass} title={messages.status}>{messages.status}</span><Select className={controlClass} aria-label={messages.status} value={filters.status} onChange={(event) => onChange('status', event.target.value)}>
      <option value="open">{messages.openStatuses}</option><option value="all">{messages.allStatuses}</option><option value="created">{messages.woStatusCreated}</option><option value="in_progress">{messages.woStatusInProgress}</option><option value="waiting_paused">{messages.woStatusPaused}</option><option value="completed">{messages.woStatusCompleted}</option><option value="cancelled">{messages.woStatusCancelled}</option>
    </Select></label>
    <label className={fieldClass}><span className={labelClass} title={messages.priority}>{messages.priority}</span><Select className={controlClass} aria-label={messages.priority} value={filters.priority} onChange={(event) => onChange('priority', event.target.value)}><option value="all">{messages.allPriorities}</option><option value="high,critical">{messages.highCritical}</option><option value="low">{messages.lowPriority}</option><option value="normal">{messages.normalPriority}</option><option value="high">{messages.highPriority}</option><option value="critical">{messages.criticalPriority}</option></Select></label>
    <label className={fieldClass}><span className={labelClass} title={messages.sort}>{messages.sort}</span><Select className={controlClass} aria-label={messages.sort} value={filters.sort} onChange={(event) => onChange('sort', event.target.value)}><option value="updatedAt">{messages.updatedAt}</option><option value="createdAt">{messages.createdAt}</option><option value="displayId">{messages.displayId}</option></Select></label>
    <label className={fieldClass}><span className={labelClass} title={messages.direction}>{messages.direction}</span><Select className={controlClass} aria-label={messages.direction} value={filters.direction} onChange={(event) => onChange('direction', event.target.value)}><option value="desc">{messages.newestFirst}</option><option value="asc">{messages.oldestFirst}</option></Select></label>
  </>;
}
