'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Ban, ClipboardCheck, Search, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { Priority, type YardOperationsTruckDto } from '@ltl-shop/shared';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';
import { useAdminYardDataBoundary, useAdminYardOperations } from '@/lib/admin-data';
import {
  buildYardOperationsQuery,
  countActiveYardOperationsFilters,
  countOverflowYardOperationsFilters,
  DEFAULT_YARD_OPERATIONS_FILTERS,
  readYardOperationsFilters,
  YARD_OVERFLOW_FILTER_KEYS,
  YARD_PRIORITIES,
  YARD_READINESS_FILTERS,
  YARD_TOOLBAR_FILTER_KEYS,
  YARD_WORK_ORDER_STATUSES,
  yardPhasesForBoard,
  type YardBoardColumnPhase,
  type YardOperationsFilters,
} from '@/lib/yard-operations-routing';
import { adminPriorityLabel, workOrderStatusLabel } from '@/lib/status-chips';
import { workPlanPhaseLabel } from '@/lib/work-plan';
import { formatVehicleYmm } from '@/lib/format';
import { AdminYardDataBoundaryCards } from './admin-yard-data-boundary-cards';
import { AdminPageHeader, Badge, Button, Card, CardDescription, CardTitle, CompactEmpty, EmptyState, Input, LoadFailure, Modal, PageSkeleton, PhaseBadge, PriorityBadge, Select } from './ui';

const phaseMessageKey = {
  needs_evaluation: 'needsEvaluation',
  inspection: 'inspection',
  required_work: 'requiredWork',
  pm: 'pm',
  alignment: 'alignment',
  detailing: 'detailing',
  quality_check: 'qualityCheck',
  ready_for_approval: 'readyForApproval',
  ready_to_go: 'readyToGo',
  ready_to_close: 'readyToClose',
  shop_work: 'shopWork',
} as const satisfies Record<YardBoardColumnPhase, keyof AdminMessages>;

const readinessMessageKey = {
  not_started: 'notStarted',
  under_review: 'underReview',
  ready: 'readyToGo',
} as const;

const priorityMessageKey = { low: 'lowPriority', normal: 'normalPriority', high: 'highPriority', critical: 'criticalPriority' } as const;

export function AdminYardOperations({ locale, messages }: { locale: AdminLocale; messages: AdminMessages }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<YardOperationsFilters>(() => readYardOperationsFilters(searchParams));
  const [view, setView] = useState<'board' | 'list'>(() => searchParams.get('view') === 'list' ? 'list' : 'board');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const query = searchParams.toString();
  const { data, error, isLoading, size, setSize, mutate, isValidating } = useAdminYardOperations(query);
  const {
    data: yardBoundary,
    error: yardBoundaryError,
    isLoading: yardBoundaryLoading,
  } = useAdminYardDataBoundary();

  useEffect(() => {
    const fromUrl = readYardOperationsFilters(searchParams);
    setView(searchParams.get('view') === 'list' ? 'list' : 'board');
    setFilters((current) => ({
      ...fromUrl,
      search: current.search !== fromUrl.search ? current.search : fromUrl.search,
    }));
  }, [searchParams]);

  const items = useMemo(() => data?.flatMap((page) => page.items) ?? [], [data]);
  const lastPage = data?.[data.length - 1];
  const hasMore = Boolean(lastPage?.nextCursor);
  const counts = data?.[0]?.counts;
  const workPlanBoardCutover = data?.[0]?.workPlanBoardCutover === true;
  const boardPhases = useMemo(
    () => yardPhasesForBoard({
      workPlanBoardCutover,
      itemPhases: items.map((item) => item.phase),
    }),
    [workPlanBoardCutover, items],
  );
  const appliedFilters = useMemo(() => readYardOperationsFilters(searchParams), [searchParams]);
  const activeFilterCount = countActiveYardOperationsFilters(appliedFilters);
  const overflowFilterCount = countOverflowYardOperationsFilters(appliedFilters);
  const filtersButtonLabel = activeFilterCount > 0 ? `${messages.filters} (${activeFilterCount})` : messages.filters;
  const moreFiltersLabel = overflowFilterCount > 0 ? `${messages.moreFilters} (${overflowFilterCount})` : messages.moreFilters;

  function updateFilter(key: keyof YardOperationsFilters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function commitFilters(next: YardOperationsFilters) {
    const params = buildYardOperationsQuery(next);
    if (view === 'list') params.set('view', 'list');
    router.replace(`/admin/yard-operations${params.size ? `?${params.toString()}` : ''}`);
  }

  function applyFilters(event: React.FormEvent) {
    event.preventDefault();
    commitFilters(filters);
    setFiltersOpen(false);
  }

  useEffect(() => {
    if (filters.search === appliedFilters.search) return undefined;
    const handle = window.setTimeout(() => {
      commitFilters({ ...appliedFilters, search: filters.search });
    }, 300);
    return () => window.clearTimeout(handle);
  }, [appliedFilters, filters.search, view, router]);

  function clearFilters() {
    setFilters(DEFAULT_YARD_OPERATIONS_FILTERS);
    router.replace('/admin/yard-operations');
    setFiltersOpen(false);
  }

  function updateView(nextView: 'board' | 'list') {
    setView(nextView);
    const params = new URLSearchParams(searchParams.toString());
    if (nextView === 'board') params.delete('view');
    else params.set('view', nextView);
    params.delete('cursor');
    router.replace(`/admin/yard-operations${params.size ? `?${params.toString()}` : ''}`);
  }

  return <div className="space-y-5">
    <AdminPageHeader eyebrow={messages.eyebrow} title={messages.yardOperationsTitle} subtitle={messages.yardOperationsDescription} />

    {isLoading ? <PageSkeleton label={messages.loadingYardOperations} /> : error || !data?.[0] ? <LoadFailure message={messages.yardLoadError} retryLabel={messages.yardRetry} onRetry={() => void mutate()} /> : <div className="flex flex-col gap-5">
    <Card className="order-3 p-3 xl:order-none" role="region" aria-labelledby="yard-movement-title">
      <div className="mb-2 space-y-1">
        <CardTitle id="yard-movement-title" className="text-sm">{messages.yardOperationsPhase1}</CardTitle>
        <CardDescription className="line-clamp-2">{messages.yardOperationsPhase1Body}</CardDescription>
      </div>
      <AdminYardDataBoundaryCards
        locale={locale}
        boundary={yardBoundary}
        loading={yardBoundaryLoading}
        fetchFailed={Boolean(yardBoundaryError) && yardBoundary === undefined}
        expanded
      />
    </Card>

      <section className="order-1 xl:order-none" aria-labelledby="yard-summary-title">
        <h2 id="yard-summary-title" className="sr-only">{messages.yardSummaryMetrics}</h2>
        <div className="grid min-w-0 grid-cols-3 gap-2">
          <SummaryMetric label={messages.underReview} value={counts?.underReview ?? 0} Icon={ClipboardCheck} />
          <SummaryMetric label={messages.readyToGo} value={counts?.readyToGo ?? 0} Icon={ShieldCheck} />
          <SummaryMetric label={messages.blocked} value={counts?.blocked ?? 0} Icon={Ban} />
        </div>
      </section>

      <Card className="order-1 min-w-0 p-3 xl:order-none">
        <form role="search" className="min-w-0" onSubmit={applyFilters}>
          <div className="flex min-w-0 flex-wrap items-end gap-2 xl:flex-nowrap xl:gap-1.5">
            <label className="min-w-0 flex-1 space-y-1 xl:flex-[1.35]">
              <span className="sr-only">{messages.yardSearch}</span>
              <span className="relative block min-w-0">
                <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground xl:hidden" />
                <Input
                  type="search"
                  autoComplete="off"
                  enterKeyHint="search"
                  aria-label={messages.yardSearch}
                  title={messages.yardSearch}
                  placeholder={messages.yardSearch}
                  className="min-w-0 pl-9 max-xl:placeholder:text-transparent xl:min-h-9 xl:px-3 xl:pl-3"
                  value={filters.search}
                  onChange={(event) => updateFilter('search', event.target.value)}
                />
              </span>
            </label>
            <div className="hidden min-w-0 xl:contents">
              <YardFilterFields filters={filters} messages={messages} onChange={updateFilter} variant="toolbar" compact boardPhases={boardPhases} />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                aria-label={moreFiltersLabel}
                aria-expanded={filtersOpen}
                onClick={() => setFiltersOpen(true)}
              >
                {messages.moreFilters}
                {overflowFilterCount > 0 ? (
                  <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
                    {overflowFilterCount}
                  </span>
                ) : null}
              </Button>
              <div className="flex shrink-0 gap-1.5">
                <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={clearFilters}>{messages.clearFilters}</Button>
                <Button type="submit" size="sm" className="shrink-0">{messages.applyFilters}</Button>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="shrink-0 xl:hidden"
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
        </form>
      </Card>

      <Modal
        open={filtersOpen}
        title={messages.filters}
        closeLabel={messages.closeDialog}
        onClose={() => setFiltersOpen(false)}
      >
        <form className="space-y-3" onSubmit={applyFilters}>
          <YardFilterFields filters={filters} messages={messages} onChange={updateFilter} variant="sheet" boardPhases={boardPhases} />
          <div className="flex items-end justify-end gap-2 border-t pt-3">
            <Button type="button" variant="ghost" onClick={clearFilters}>{messages.clearFilters}</Button>
            <Button type="submit">{messages.applyFilters}</Button>
          </div>
        </form>
      </Modal>

      <div className="hidden items-center justify-end gap-2 xl:flex" aria-label={messages.view}>
        <span className="text-sm text-muted-foreground">{messages.view}</span>
        <Button type="button" variant={view === 'board' ? 'secondary' : 'ghost'} size="sm" aria-pressed={view === 'board'} onClick={() => updateView('board')}>{messages.boardView}</Button>
        <Button type="button" variant={view === 'list' ? 'secondary' : 'ghost'} size="sm" aria-pressed={view === 'list'} onClick={() => updateView('list')}>{messages.listView}</Button>
      </div>

      {items.length === 0 ? <div className="order-2 xl:order-none"><EmptyState><p>{messages.noYardOperations}</p><p className="mt-1 text-sm text-muted-foreground">{messages.noYardOperationsBody}</p></EmptyState></div> : <>
        <section className={view === 'board' ? 'hidden xl:block' : 'hidden'} aria-labelledby="yard-board-title">
          <div className="mb-2"><h2 id="yard-board-title" className="font-display text-lg font-semibold">{messages.yardBoard}</h2></div>
          <div className="overflow-x-auto rounded-xl border bg-muted/40 p-2">
            <div
              className="grid gap-2"
              style={{
                gridTemplateColumns: `repeat(${boardPhases.length}, minmax(160px, 1fr))`,
                minWidth: `${boardPhases.length * 170}px`,
              }}
              data-work-plan-board={workPlanBoardCutover ? 'true' : 'false'}
            >
              {boardPhases.map((phase) => {
                const phaseItems = items.filter((item) => item.phase === phase);
                return (
                  <div key={phase} className="min-w-0" data-phase={phase}>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <h3 className="font-display text-sm font-semibold">{workPlanPhaseLabel(phase, messages)}</h3>
                      <Badge variant="secondary">{phaseItems.length}</Badge>
                    </div>
                    <div className="space-y-2">
                      {phaseItems.map((item) => <YardTruckCard key={item.truck.id} item={item} messages={messages} />)}
                      {phaseItems.length === 0 ? (
                        <CompactEmpty className="text-xs">{messages.noTrucksInPhase}</CompactEmpty>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
        <section className={view === 'list' ? 'order-2 space-y-3 xl:order-none' : 'order-2 space-y-3 xl:order-none xl:hidden'} aria-labelledby="yard-list-title">
          <div><h2 id="yard-list-title" className="font-display text-lg font-semibold">{messages.yardGroupedList}</h2></div>
          {boardPhases.map((phase) => {
            const phaseItems = items.filter((item) => item.phase === phase);
            return phaseItems.length ? (
              <section key={phase} aria-labelledby={`yard-group-${phase}`}>
                <div className="mb-2 flex items-center gap-2">
                  <h3 id={`yard-group-${phase}`} className="font-display text-sm font-semibold">{messages[phaseMessageKey[phase]]}</h3>
                  <Badge variant="secondary">{phaseItems.length}</Badge>
                </div>
                <div className="space-y-2">{phaseItems.map((item) => <YardTruckCard key={item.truck.id} item={item} messages={messages} />)}</div>
              </section>
            ) : null;
          })}
        </section>
      </>}
      {hasMore ? <Button variant="outline" className="order-2 w-full xl:order-none" disabled={isValidating} onClick={() => void setSize(size + 1)}>{isValidating ? `${messages.yardLoadMore}…` : messages.yardLoadMore}</Button> : null}
    </div>}
  </div>;
}

function YardFilterFields({
  filters,
  messages,
  onChange,
  variant,
  compact = false,
  boardPhases,
}: {
  filters: YardOperationsFilters;
  messages: AdminMessages;
  onChange: (key: keyof YardOperationsFilters, value: string) => void;
  variant: 'toolbar' | 'sheet';
  compact?: boolean;
  boardPhases: ReadonlyArray<YardBoardColumnPhase>;
}) {
  const fieldClass = compact ? 'min-w-0 flex-1 space-y-1' : 'space-y-1';
  const labelClass = compact ? 'block text-xs font-medium' : 'text-sm font-medium';
  const controlClass = compact ? 'min-h-9 px-3 pr-9' : undefined;
  const render = (key: keyof YardOperationsFilters) => (
    <YardFilterField key={key} fieldKey={key} filters={filters} messages={messages} onChange={onChange} fieldClass={fieldClass} labelClass={labelClass} controlClass={controlClass} boardPhases={boardPhases} />
  );

  if (variant === 'toolbar') {
    return <>{YARD_TOOLBAR_FILTER_KEYS.map(render)}</>;
  }

  return <>
    <div className="space-y-3 xl:hidden">{YARD_TOOLBAR_FILTER_KEYS.map(render)}</div>
    {YARD_OVERFLOW_FILTER_KEYS.map(render)}
  </>;
}

function YardFilterField({
  fieldKey,
  filters,
  messages,
  onChange,
  fieldClass,
  labelClass,
  controlClass,
  boardPhases,
}: {
  fieldKey: keyof YardOperationsFilters;
  filters: YardOperationsFilters;
  messages: AdminMessages;
  onChange: (key: keyof YardOperationsFilters, value: string) => void;
  fieldClass: string;
  labelClass: string;
  controlClass?: string;
  boardPhases: ReadonlyArray<YardBoardColumnPhase>;
}) {
  if (fieldKey === 'search') return null;
  if (fieldKey === 'readiness') {
    return <label className={fieldClass}><span className={labelClass} title={messages.readiness}>{messages.readiness}</span><Select className={controlClass} aria-label={messages.readiness} value={filters.readiness} onChange={(event) => onChange('readiness', event.target.value)}><option value="">{messages.allReadiness}</option>{YARD_READINESS_FILTERS.map((value) => <option key={value} value={value}>{messages[readinessMessageKey[value]]}</option>)}</Select></label>;
  }
  if (fieldKey === 'phase') {
    return <label className={fieldClass}><span className={labelClass} title={messages.phase}>{messages.phase}</span><Select className={controlClass} aria-label={messages.phase} value={filters.phase} onChange={(event) => onChange('phase', event.target.value)}><option value="">{messages.allPhases}</option>{boardPhases.map((value) => <option key={value} value={value}>{messages[phaseMessageKey[value]]}</option>)}</Select></label>;
  }
  if (fieldKey === 'workOrderStatus') {
    return <label className={fieldClass}><span className={labelClass} title={messages.workOrderStatus}>{messages.workOrderStatus}</span><Select className={controlClass} aria-label={messages.workOrderStatus} value={filters.workOrderStatus} onChange={(event) => onChange('workOrderStatus', event.target.value)}><option value="">{messages.allWorkOrderStatuses}</option>{YARD_WORK_ORDER_STATUSES.map((value) => <option key={value} value={value}>{workOrderStatusLabel(value, messages)}</option>)}</Select></label>;
  }
  if (fieldKey === 'priority') {
    return <label className={fieldClass}><span className={labelClass} title={messages.priority}>{messages.priority}</span><Select className={controlClass} aria-label={messages.priority} value={filters.priority} onChange={(event) => onChange('priority', event.target.value)}><option value="">{messages.allPriorities}</option>{YARD_PRIORITIES.map((value) => <option key={value} value={value}>{messages[priorityMessageKey[value]]}</option>)}</Select></label>;
  }
  return <label className={fieldClass}><span className={labelClass} title={messages.blockedFilter}>{messages.blockedFilter}</span><Select className={controlClass} aria-label={messages.blockedFilter} value={filters.blocked} onChange={(event) => onChange('blocked', event.target.value)}><option value="">{messages.allBlockerStates}</option><option value="true">{messages.blockedOnly}</option><option value="false">{messages.unblockedOnly}</option></Select></label>;
}

function SummaryMetric({ label, value, Icon }: { label: string; value: number; Icon: typeof ClipboardCheck }) {
  return (
    <Card className="flex min-w-0 items-center justify-between gap-1.5 overflow-hidden px-2.5 py-1.5">
      <div className="min-w-0">
        <p className="truncate text-[11px] text-muted-foreground" title={label}>{label}</p>
        <p className="font-display text-lg font-bold leading-tight">{value}</p>
      </div>
      <Icon aria-hidden="true" className="size-4 shrink-0 text-primary" />
    </Card>
  );
}

function YardTruckCard({ item, messages }: { item: YardOperationsTruckDto; messages: AdminMessages }) {
  const workOrder = item.activeWorkOrder;
  const vehicle = formatVehicleYmm(item.truck);
  const showPriority = Boolean(workOrder && workOrder.priority !== Priority.NORMAL);
  const showBlocker = item.blockers.length > 0;

  return (
    <Link
      href={`/admin/trucks/${item.truck.id}`}
      aria-label={item.truck.truckNumber}
      className="card block space-y-1.5 p-2 hover:bg-accent/40"
      data-testid="yard-truck-card"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="truncate font-display text-sm font-semibold text-primary">{item.truck.truckNumber}</span>
        <PhaseBadge phase={item.phase}>{workPlanPhaseLabel(item.phase, messages)}</PhaseBadge>
      </div>
      {vehicle ? <p className="truncate text-xs text-muted-foreground" title={vehicle}>{vehicle}</p> : null}
      {workOrder ? (
        <p className="truncate text-xs text-muted-foreground">{messages.workOrder} {workOrder.displayId}</p>
      ) : (
        <CompactEmpty className="px-2 py-1 text-xs">{messages.noOpenWorkOrder}</CompactEmpty>
      )}
      {showPriority || showBlocker ? (
        <div className="flex flex-wrap items-center gap-1">
          {showPriority && workOrder ? <PriorityBadge priority={workOrder.priority}>{adminPriorityLabel(workOrder.priority, messages)}</PriorityBadge> : null}
          {showBlocker ? <Badge variant="warning" className="normal-case tracking-normal">{messages.blocked}</Badge> : null}
        </div>
      ) : null}
    </Link>
  );
}
