'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Ban, ChevronDown, ClipboardCheck, ShieldCheck, SlidersHorizontal, Truck, Warehouse } from 'lucide-react';
import { Priority, type YardOperationsTruckDto } from '@ltl-shop/shared';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';
import { useAdminYardOperations } from '@/lib/admin-data';
import {
  buildYardOperationsQuery,
  countActiveYardOperationsFilters,
  countOverflowYardOperationsFilters,
  DEFAULT_YARD_OPERATIONS_FILTERS,
  readYardOperationsFilters,
  YARD_OVERFLOW_FILTER_KEYS,
  YARD_PHASES,
  YARD_PRIORITIES,
  YARD_READINESS_FILTERS,
  YARD_TOOLBAR_FILTER_KEYS,
  YARD_WORK_ORDER_STATUSES,
  type YardOperationsFilters,
} from '@/lib/yard-operations-routing';
import { adminPriorityLabel, phaseLabel, workOrderStatusLabel } from '@/lib/status-chips';
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
} as const satisfies Record<(typeof YARD_PHASES)[number], keyof AdminMessages>;

const readinessMessageKey = {
  not_started: 'notStarted',
  under_review: 'underReview',
  ready: 'readyToGo',
} as const;

const priorityMessageKey = { low: 'lowPriority', normal: 'normalPriority', high: 'highPriority', critical: 'criticalPriority' } as const;

export function AdminYardOperations({ messages }: { locale: AdminLocale; messages: AdminMessages }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<YardOperationsFilters>(DEFAULT_YARD_OPERATIONS_FILTERS);
  const [view, setView] = useState<'board' | 'list'>('board');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [phase1Open, setPhase1Open] = useState(false);
  const query = searchParams.toString();
  const { data, error, isLoading, size, setSize, mutate, isValidating } = useAdminYardOperations(query);

  useEffect(() => {
    setFilters(readYardOperationsFilters(searchParams));
    setView(searchParams.get('view') === 'list' ? 'list' : 'board');
  }, [searchParams]);

  const items = useMemo(() => data?.flatMap((page) => page.items) ?? [], [data]);
  const lastPage = data?.[data.length - 1];
  const hasMore = Boolean(lastPage?.nextCursor);
  const counts = data?.[0]?.counts;
  const incomingUnavailable = data?.[0]?.incomingTrucks.status === 'unavailable';
  const departuresUnavailable = data?.[0]?.upcomingDepartures.status === 'unavailable';
  const appliedFilters = useMemo(() => readYardOperationsFilters(searchParams), [searchParams]);
  const activeFilterCount = countActiveYardOperationsFilters(appliedFilters);
  const overflowFilterCount = countOverflowYardOperationsFilters(appliedFilters);
  const filtersButtonLabel = activeFilterCount > 0 ? `${messages.filters} (${activeFilterCount})` : messages.filters;
  const moreFiltersLabel = overflowFilterCount > 0 ? `${messages.moreFilters} (${overflowFilterCount})` : messages.moreFilters;

  function updateFilter(key: keyof YardOperationsFilters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function applyFilters(event: React.FormEvent) {
    event.preventDefault();
    const params = buildYardOperationsQuery(filters);
    if (view === 'list') params.set('view', 'list');
    router.replace(`/admin/yard-operations${params.size ? `?${params.toString()}` : ''}`);
    setFiltersOpen(false);
  }

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

    <Card className="border-warning/50 bg-warning-surface p-3" role="region" aria-labelledby="yard-phase-1-title">
      <button
        type="button"
        className="flex w-full items-start gap-2 text-left"
        aria-label={messages.yardOperationsPhase1}
        aria-expanded={phase1Open}
        aria-controls="yard-phase-1-details"
        onClick={() => setPhase1Open((open) => !open)}
      >
        <Warehouse aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning-foreground" />
        <CardTitle id="yard-phase-1-title" className="min-w-0 flex-1 text-sm">{messages.yardOperationsPhase1}</CardTitle>
        <ChevronDown aria-hidden="true" className={`mt-0.5 size-4 shrink-0 text-warning-foreground transition-transform ${phase1Open ? 'rotate-180' : ''}`} />
      </button>
      <div id="yard-phase-1-details" className="mt-2 space-y-2">
        {phase1Open ? <CardDescription className="text-warning-foreground">{messages.yardOperationsPhase1Body}</CardDescription> : null}
        <div className="grid min-w-0 gap-1.5 sm:grid-cols-3">
          <UnavailableStatus icon={Truck} label={messages.workLocationUnavailable} unavailableLabel={messages.unavailableLabel} />
          <UnavailableStatus icon={Truck} label={messages.incomingTrucksUnavailable} unavailable={incomingUnavailable} unavailableLabel={messages.unavailableLabel} />
          <UnavailableStatus icon={ShieldCheck} label={messages.upcomingDeparturesUnavailable} unavailable={departuresUnavailable} unavailableLabel={messages.unavailableLabel} />
        </div>
      </div>
    </Card>

    {isLoading ? <PageSkeleton label={messages.loadingYardOperations} /> : error || !data?.[0] ? <LoadFailure message={messages.yardLoadError} retryLabel={messages.yardRetry} onRetry={() => void mutate()} /> : <>
      <section aria-labelledby="yard-summary-title">
        <h2 id="yard-summary-title" className="sr-only">{messages.yardSummaryMetrics}</h2>
        <div className="grid min-w-0 grid-cols-3 gap-2">
          <SummaryMetric label={messages.underReview} value={counts?.underReview ?? 0} Icon={ClipboardCheck} />
          <SummaryMetric label={messages.readyToGo} value={counts?.readyToGo ?? 0} Icon={ShieldCheck} />
          <SummaryMetric label={messages.blocked} value={counts?.blocked ?? 0} Icon={Ban} />
        </div>
      </section>

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
                className="min-w-0 md:min-h-9 md:px-3"
                value={filters.search}
                onChange={(event) => updateFilter('search', event.target.value)}
              />
            </label>
            <div className="hidden min-w-0 md:contents">
              <YardFilterFields filters={filters} messages={messages} onChange={updateFilter} variant="toolbar" compact />
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
        </form>
      </Card>

      <Modal
        open={filtersOpen}
        title={messages.filters}
        onClose={() => setFiltersOpen(false)}
      >
        <form className="space-y-3" onSubmit={applyFilters}>
          <YardFilterFields filters={filters} messages={messages} onChange={updateFilter} variant="sheet" />
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

      {items.length === 0 ? <EmptyState><p>{messages.noYardOperations}</p><p className="mt-1 text-sm text-muted-foreground">{messages.noYardOperationsBody}</p></EmptyState> : <>
        <section className={view === 'board' ? 'hidden xl:block' : 'hidden'} aria-labelledby="yard-board-title">
          <div className="mb-2"><h2 id="yard-board-title" className="font-display text-lg font-semibold">{messages.yardBoard}</h2></div>
          <div className="overflow-x-auto rounded-xl border bg-muted/40 p-2">
            <div className="grid min-w-[1530px] grid-cols-9 gap-2">
              {YARD_PHASES.map((phase) => {
                const phaseItems = items.filter((item) => item.phase === phase);
                return (
                  <div key={phase} className="min-w-0" data-phase={phase}>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <h3 className="font-display text-sm font-semibold">{phaseLabel(phase, messages)}</h3>
                      <Badge variant="secondary">{phaseItems.length}</Badge>
                    </div>
                    <div className="space-y-2">
                      {phaseItems.map((item) => <YardTruckCard key={item.truck.id} item={item} messages={messages} />)}
                      {phaseItems.length === 0 ? <CompactEmpty>{messages.noTrucksInPhase}</CompactEmpty> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
        <section className={view === 'list' ? 'space-y-3' : 'space-y-3 xl:hidden'} aria-labelledby="yard-list-title">
          <div><h2 id="yard-list-title" className="font-display text-lg font-semibold">{messages.yardGroupedList}</h2></div>
          {YARD_PHASES.map((phase) => {
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
      {hasMore ? <Button variant="outline" className="w-full" disabled={isValidating} onClick={() => void setSize(size + 1)}>{isValidating ? `${messages.yardLoadMore}…` : messages.yardLoadMore}</Button> : null}
    </>}
  </div>;
}

function YardFilterFields({
  filters,
  messages,
  onChange,
  variant,
  compact = false,
}: {
  filters: YardOperationsFilters;
  messages: AdminMessages;
  onChange: (key: keyof YardOperationsFilters, value: string) => void;
  variant: 'toolbar' | 'sheet';
  compact?: boolean;
}) {
  const fieldClass = compact ? 'min-w-0 flex-1 space-y-1' : 'space-y-1';
  const labelClass = compact ? 'block truncate text-xs font-medium' : 'text-sm font-medium';
  const controlClass = compact ? 'min-h-9 px-3 pr-9' : undefined;
  const render = (key: keyof YardOperationsFilters) => (
    <YardFilterField key={key} fieldKey={key} filters={filters} messages={messages} onChange={onChange} fieldClass={fieldClass} labelClass={labelClass} controlClass={controlClass} />
  );

  if (variant === 'toolbar') {
    return <>{YARD_TOOLBAR_FILTER_KEYS.map(render)}</>;
  }

  return <>
    <div className="space-y-3 md:hidden">{YARD_TOOLBAR_FILTER_KEYS.map(render)}</div>
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
}: {
  fieldKey: keyof YardOperationsFilters;
  filters: YardOperationsFilters;
  messages: AdminMessages;
  onChange: (key: keyof YardOperationsFilters, value: string) => void;
  fieldClass: string;
  labelClass: string;
  controlClass?: string;
}) {
  if (fieldKey === 'search') return null;
  if (fieldKey === 'readiness') {
    return <label className={fieldClass}><span className={labelClass} title={messages.readiness}>{messages.readiness}</span><Select className={controlClass} aria-label={messages.readiness} value={filters.readiness} onChange={(event) => onChange('readiness', event.target.value)}><option value="">{messages.allReadiness}</option>{YARD_READINESS_FILTERS.map((value) => <option key={value} value={value}>{messages[readinessMessageKey[value]]}</option>)}</Select></label>;
  }
  if (fieldKey === 'phase') {
    return <label className={fieldClass}><span className={labelClass} title={messages.phase}>{messages.phase}</span><Select className={controlClass} aria-label={messages.phase} value={filters.phase} onChange={(event) => onChange('phase', event.target.value)}><option value="">{messages.allPhases}</option>{YARD_PHASES.map((value) => <option key={value} value={value}>{messages[phaseMessageKey[value]]}</option>)}</Select></label>;
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
        <p className="truncate text-[11px] text-muted-foreground">{label}</p>
        <p className="font-display text-lg font-bold leading-tight">{value}</p>
      </div>
      <Icon aria-hidden="true" className="size-4 shrink-0 text-primary" />
    </Card>
  );
}

function UnavailableStatus({ icon: Icon, label, unavailable = true, unavailableLabel }: { icon: typeof Truck; label: string; unavailable?: boolean; unavailableLabel: string }) {
  return <div className="flex min-w-0 items-center gap-2 overflow-hidden rounded-lg border bg-card/70 px-2 py-1.5 text-[11px] text-muted-foreground"><Icon aria-hidden="true" className="size-3.5 shrink-0" /><span className="min-w-0 truncate">{label}</span>{unavailable ? <Badge variant="secondary" className="ml-auto shrink-0">{unavailableLabel}</Badge> : null}</div>;
}

function YardTruckCard({ item, messages }: { item: YardOperationsTruckDto; messages: AdminMessages }) {
  const workOrder = item.activeWorkOrder;
  const vehicle = [item.truck.year, item.truck.make, item.truck.model].filter(Boolean).join(' ');
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
        <PhaseBadge phase={item.phase}>{phaseLabel(item.phase, messages)}</PhaseBadge>
      </div>
      {vehicle ? <p className="truncate text-xs text-muted-foreground">{vehicle}</p> : null}
      {workOrder ? (
        <p className="truncate text-xs font-medium">{workOrder.displayId}</p>
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
