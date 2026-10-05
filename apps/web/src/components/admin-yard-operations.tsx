'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Ban, ClipboardCheck, Search, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { AppCapability, Priority, type YardOperationsTruckDto } from '@ltl-shop/shared';
import { adminTruckHref } from '@/lib/admin-truck-origin';
import { adminPauseReasonLabel, type AdminLocale, type AdminMessages } from '@/lib/admin-messages';
import { returnAdminWorkOrderToService, useAdminYardDataBoundary, useAdminYardOperations } from '@/lib/admin-data';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { truckNextStepText } from '@/lib/truck-next-step';
import { useActionToast } from './action-toast';
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
  WORK_PLAN_YARD_PHASES,
  type YardBoardColumnPhase,
  type YardOperationsFilters,
} from '@/lib/yard-operations-routing';
import { adminPriorityLabel, workOrderStatusLabel } from '@/lib/status-chips';
import { workPlanPhaseLabel } from '@/lib/work-plan';
import { formatVehicleYmm } from '@/lib/format';
import { formatAdminDate, formatAdminDateOnly } from '@/lib/admin-format';
import { compactAge, dispatchSignalsByTruck, fillYardText, type YardDispatchSignal } from '@/lib/yard-card';
import { AdminYardDataBoundaryCards } from './admin-yard-data-boundary-cards';
import { PageHeader, Badge, Button, Card, CardDescription, CardTitle, CompactEmpty, EmptyState, Input, LoadFailure, Modal, PageSkeleton, PhaseBadge, PriorityBadge, Select } from './ui';

const phaseMessageKey = {
  inspection: 'inspection',
  pm: 'pm',
  alignment: 'alignment',
  detailing: 'detailing',
  quality_check: 'qualityCheck',
  ready_to_go: 'readyToGo',
  ready_to_close: 'readyToClose',
  shop_work: 'shopWork',
} as const satisfies Record<YardBoardColumnPhase, keyof AdminMessages>;

const readinessMessageKey = {
  not_started: 'notStarted',
  under_review: 'inTheShop',
  ready: 'readyToGo',
} as const;

const priorityMessageKey = { low: 'lowPriority', normal: 'normalPriority', high: 'highPriority', critical: 'criticalPriority' } as const;

export function AdminYardOperations({ locale, messages }: { locale: AdminLocale; messages: AdminMessages }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<YardOperationsFilters>(() => readYardOperationsFilters(searchParams));
  const [view, setView] = useState<'board' | 'list'>(() => searchParams.get('view') === 'list' ? 'list' : 'board');
  // LTR-120: the Shop's own readiness and Dispatch movement are separate tabs.
  const tab: 'shop' | 'movement' = searchParams.get('tab') === 'movement' ? 'movement' : 'shop';
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [movementSearch, setMovementSearch] = useState('');
  const query = searchParams.toString();
  const { data, error, isLoading, size, setSize, mutate, isValidating } = useAdminYardOperations(query);
  const { user } = useAuth();
  const canManageWorkOrders = !!user?.capabilities.includes(AppCapability.WORK_ORDERS_MANAGE);
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

  const dispatchSignals = useMemo(() => dispatchSignalsByTruck(yardBoundary), [yardBoundary]);
  const items = useMemo(() => data?.flatMap((page) => page.items) ?? [], [data]);
  const lastPage = data?.[data.length - 1];
  const hasMore = Boolean(lastPage?.nextCursor);
  const counts = data?.[0]?.counts;
  const boardPhases = WORK_PLAN_YARD_PHASES;
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
    if (tab === 'movement') params.set('tab', 'movement');
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
  }, [appliedFilters, filters.search, view, tab, router]);

  function clearFilters() {
    setFilters(DEFAULT_YARD_OPERATIONS_FILTERS);
    router.replace(tab === 'movement' ? '/admin/yard-operations?tab=movement' : '/admin/yard-operations');
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

  function updateTab(nextTab: 'shop' | 'movement') {
    const params = new URLSearchParams(searchParams.toString());
    if (nextTab === 'shop') params.delete('tab');
    else params.set('tab', nextTab);
    router.replace(`/admin/yard-operations${params.size ? `?${params.toString()}` : ''}`);
  }

  return <div className="space-y-6">
    <PageHeader title={messages.yardOperationsTitle} subtitle={messages.yardOperationsDescription} />

    <div role="tablist" aria-label={messages.yardTabsLabel} className="flex gap-1 rounded-xl border bg-muted/40 p-1">
      {(['shop', 'movement'] as const).map((value) => (
        <button
          key={value}
          type="button"
          role="tab"
          id={`yard-tab-${value}`}
          aria-selected={tab === value}
          aria-controls={`yard-panel-${value}`}
          className={`min-h-11 flex-1 rounded-lg px-3 text-sm font-medium ${tab === value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          onClick={() => updateTab(value)}
        >
          {value === 'shop' ? messages.yardTabShop : messages.yardTabMovement}
        </button>
      ))}
    </div>

    {tab === 'movement' ? <div role="tabpanel" id="yard-panel-movement" aria-labelledby="yard-tab-movement">
    <Card className="p-3" role="region" aria-labelledby="yard-movement-title">
      <div className="mb-2 space-y-1">
        <CardTitle id="yard-movement-title" className="text-sm">{messages.yardOperationsPhase1}</CardTitle>
        <CardDescription>{messages.yardOperationsPhase1Body}</CardDescription>
        {yardBoundary?.asOf ? (
          <p className="text-xs text-muted-foreground" data-testid="yard-movement-source">
            {fillYardText(messages.yardMovementSource, { time: formatAdminDate(yardBoundary.asOf, locale) })}
          </p>
        ) : null}
      </div>
      {yardBoundary && [yardBoundary.workLocation, yardBoundary.incomingTrucks, yardBoundary.upcomingDepartures].some((section) => section.status === 'ok' && section.items.length > 0) ? <Input
        type="search"
        className="mb-2 h-9"
        aria-label={messages.yardMovementSearch}
        placeholder={messages.yardMovementSearch}
        value={movementSearch}
        onChange={(event) => setMovementSearch(event.target.value)}
      /> : null}
      <AdminYardDataBoundaryCards
        locale={locale}
        boundary={yardBoundary}
        loading={yardBoundaryLoading}
        fetchFailed={Boolean(yardBoundaryError) && yardBoundary === undefined}
        expanded
        search={movementSearch}
      />
    </Card>
    </div> : isLoading ? <PageSkeleton label={messages.loadingYardOperations} /> : error || !data?.[0] ? <LoadFailure message={messages.yardLoadError} retryLabel={messages.yardRetry} onRetry={() => void mutate()} /> : <div role="tabpanel" id="yard-panel-shop" aria-labelledby="yard-tab-shop" className="flex flex-col gap-5">

      <section className="order-1 xl:order-none" aria-labelledby="yard-summary-title">
        <h2 id="yard-summary-title" className="sr-only">{messages.yardSummaryMetrics}</h2>
        {counts ? (
          // LTR-100 / D5: exclusive buckets that add up to the board; Blocked (official pause) is a subset.
          <>
            <div className="grid min-w-0 grid-cols-3 gap-2">
              <SummaryMetric label={messages.inspection} value={counts.notStarted ?? 0} Icon={ClipboardCheck} />
              <SummaryMetric label={messages.inTheShop} value={counts.underReview} Icon={ClipboardCheck} />
              <SummaryMetric label={messages.readyToGo} value={counts.readyToGo} Icon={ShieldCheck} />
            </div>
            {counts.blocked ? (
              <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                <Ban aria-hidden="true" className="size-3.5" />
                {messages.blockedOfTotal.replace('{count}', String(counts.blocked))}
              </p>
            ) : null}
          </>
        ) : null}
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
                  <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
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
                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
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
              // LTR-169: an empty phase only needs its title and "no trucks"; the space goes to phases with cards,
              // so a 1366px screen fits the board without cutting off Truck numbers or the last column.
              style={{
                gridTemplateColumns: boardPhases
                  .map((phase) => (items.some((item) => item.phase === phase) ? 'minmax(172px, 1.6fr)' : 'minmax(92px, 1fr)'))
                  .join(' '),
                minWidth: `${boardPhases.reduce((sum, phase) => sum + (items.some((item) => item.phase === phase) ? 180 : 100), 0)}px`,
              }}
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
                      {phaseItems.map((item) => <YardTruckCard key={item.truck.id} item={item} messages={messages} locale={locale} dispatch={dispatchSignals.get(item.truck.truckNumber)} canManage={canManageWorkOrders} onChanged={() => mutate()} />)}
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
                <div className="space-y-2">{phaseItems.map((item) => <YardTruckCard key={item.truck.id} item={item} messages={messages} locale={locale} dispatch={dispatchSignals.get(item.truck.truckNumber)} canManage={canManageWorkOrders} onChanged={() => mutate()} />)}</div>
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
  // LTR-169: block, or the sheet's space-y never reaches the inline <label> (4px between fields).
  const fieldClass = compact ? 'min-w-0 flex-1 space-y-1' : 'block space-y-2';
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
        {/* LTR-114: wrap long labels instead of cutting them on 375px phones. */}
        <p className="line-clamp-2 text-xs leading-tight text-muted-foreground" title={label}>{label}</p>
        <p className="font-display text-lg font-bold leading-tight">{value}</p>
      </div>
      <Icon aria-hidden="true" className="size-4 shrink-0 text-primary" />
    </Card>
  );
}

function YardTruckCard({ item, messages, locale, dispatch, canManage = false, onChanged }: {
  item: YardOperationsTruckDto;
  /** LTR-159: Return to Service from a Ready to Go card. */
  canManage?: boolean;
  onChanged?: () => Promise<unknown> | void;
  messages: AdminMessages;
  locale: AdminLocale;
  /** LTR-120: Dispatch movement shown only as a signal, never as a phase. */
  dispatch?: YardDispatchSignal;
}) {
  const workOrder = item.activeWorkOrder;
  const vehicle = formatVehicleYmm(item.truck);
  // LTR-159: the same Next step as the Truck, Dashboard and Work Order.
  const nextStepText = item.nextStep && item.nextStep.kind !== 'create_work_order' ? truckNextStepText(item.nextStep, messages) : null;
  const mechanicNames = (workOrder?.mechanics ?? []).filter((mechanic) => !mechanic.removedAt).map((mechanic) => mechanic.mechanicName).join(', ');
  const showPriority = Boolean(workOrder && workOrder.priority !== Priority.NORMAL);
  // LTR-92 / D5: Blocked means an official pause (or LTR-98 active blocker), not "has open work".
  const showBlocker = workOrder?.status === 'waiting_paused' || Boolean(workOrder?.latestReportedBlocker);

  const card = (
    <Link
      href={adminTruckHref(item.truck.id, '/admin/yard-operations')}
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
        <p className="truncate text-xs text-muted-foreground">{messages.workOrder} {workOrder.displayId} · {compactAge(workOrder.createdAt)}</p>
      ) : null}
      {/* LTR-101: what is missing and who is on it. */}
      {nextStepText ? <p className="truncate text-xs font-medium text-foreground" title={nextStepText} data-testid="yard-card-next-step">{nextStepText}</p> : null}
      {mechanicNames ? <p className="truncate text-xs text-muted-foreground" title={mechanicNames}>{mechanicNames}</p> : null}
      {dispatch?.expectedIn ? <p className="truncate text-xs text-muted-foreground" data-testid="yard-card-dispatch">{fillYardText(messages.yardDispatchExpectedIn, { date: formatAdminDateOnly(dispatch.expectedIn, locale) })}</p> : null}
      {dispatch?.departs ? <p className="truncate text-xs text-muted-foreground" data-testid="yard-card-dispatch">{fillYardText(messages.yardDispatchDeparts, { date: formatAdminDateOnly(dispatch.departs, locale) })}</p> : null}
      {workOrder ? null : (
        <CompactEmpty className="px-2 py-1 text-xs">{messages.noOpenWorkOrder}</CompactEmpty>
      )}
      {showPriority || showBlocker || item.outOfShop ? (
        <div className="flex flex-wrap items-center gap-1">
          {/* LTR-188 / D24: a Job sent the whole truck to an external shop. Phase and counters stay. */}
          {item.outOfShop ? <Badge variant="warning" data-testid="yard-card-out-of-shop">{messages.yardOutOfShop}</Badge> : null}
          {showPriority && workOrder ? <PriorityBadge priority={workOrder.priority}>{adminPriorityLabel(workOrder.priority, messages)}</PriorityBadge> : null}
          {showBlocker ? (
            <Badge variant="warning">
              {/* LTR-155 / D17: "Blocked · reason" for a mechanic blocker. */}
              {workOrder?.latestReportedBlocker
                ? `${messages.blocked} · ${adminPauseReasonLabel(workOrder.latestReportedBlocker.blockerReason ?? workOrder.latestReportedBlocker.reason, messages)}`
                : messages.blocked}
            </Badge>
          ) : null}
        </div>
      ) : null}
    </Link>
  );
  if (item.nextStep?.kind !== 'return_to_service' || !canManage || !item.nextStep.workOrderId) return card;
  return (
    <div className="space-y-1">
      {card}
      <YardReturnToService workOrderId={item.nextStep.workOrderId} messages={messages} onChanged={onChanged} />
    </div>
  );
}

function YardReturnToService({ workOrderId, messages, onChanged }: {
  workOrderId: string;
  messages: AdminMessages;
  onChanged?: () => Promise<unknown> | void;
}) {
  const { showToast } = useActionToast();
  const [pending, setPending] = useState(false);
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="w-full"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          // The reason is optional (LTR-158); the version comes from the Work Order itself.
          const wo = await apiFetch<{ version: number }>(`/api/admin/work-orders/${workOrderId}`);
          await returnAdminWorkOrderToService(workOrderId, { expectedVersion: wo.version });
          showToast('success', messages.returnToServiceSuccess);
          await onChanged?.();
        } catch {
          showToast('error', messages.truckNextStepFailed);
        } finally {
          setPending(false);
        }
      }}
    >
      {messages.returnToServiceTitle}
    </Button>
  );
}
