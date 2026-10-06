'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useId, useMemo, useState } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { AppCapability, Priority, type YardOperationsTruckDto } from '@ltl-shop/shared';
import { adminTruckHref } from '@/lib/admin-truck-origin';
import { adminPauseReasonLabel, type AdminLocale, type AdminMessages } from '@/lib/admin-messages';
import { useAdminYardDataBoundary, useAdminYardOperations } from '@/lib/admin-data';
import { useAuth } from '@/lib/auth-context';
import { truckNextStepText } from '@/lib/truck-next-step';
import { ReturnToServiceDialog } from './return-to-service-dialog';
import {
  buildYardOperationsQuery,
  countActiveYardOperationsFilters,
  DEFAULT_YARD_OPERATIONS_FILTERS,
  readYardOperationsFilters,
  withYardQuickFilter,
  YARD_PRIORITIES,
  YARD_QUICK_FILTERS,
  YARD_READINESS_FILTERS,
  YARD_SHEET_FILTER_KEYS,
  YARD_WORK_ORDER_STATUSES,
  WORK_PLAN_YARD_PHASES,
  type YardBoardColumnPhase,
  type YardOperationsFilters,
  type YardQuickFilter,
  yardOperationsFromPath,
  yardQuickFilterOf,
} from '@/lib/yard-operations-routing';
import { nextShopDay, shopDay } from '@/lib/dashboard-queue';
import { profileInitials } from '@/lib/profile-initials';
import { adminPriorityLabel, workOrderStatusLabel } from '@/lib/status-chips';
import { formatVehicleYmm } from '@/lib/format';
import { formatAdminDate, formatAdminDateOnly } from '@/lib/admin-format';
import { compactAge, dispatchSignalsByTruck, fillYardText, yardCardAlert, type YardCardAlert, type YardDispatchSignal } from '@/lib/yard-card';
import { AdminYardDataBoundaryCards } from './admin-yard-data-boundary-cards';
import { PageHeader, Badge, Button, Card, CardDescription, CardTitle, CompactEmpty, EmptyState, Input, LoadFailure, Modal, PageSkeleton, PriorityBadge, Select } from './ui';

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
  // LTR-120: the Shop's own board and Dispatch are separate tabs.
  const tab: 'shop' | 'movement' = searchParams.get('tab') === 'movement' ? 'movement' : 'shop';
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [movementSearch, setMovementSearch] = useState('');
  const query = searchParams.toString();
  // D4 / UX-5-006: the Truck's back link returns here with the same search, filters and tab.
  const yardFromPath = useMemo(() => yardOperationsFromPath(query), [query]);
  const { data, error, isLoading, size, setSize, mutate, isValidating } = useAdminYardOperations(query);
  const { user } = useAuth();
  const canManageWorkOrders = !!user?.capabilities.includes(AppCapability.WORK_ORDERS_MANAGE);
  const {
    data: yardBoundary,
    error: yardBoundaryError,
    isLoading: yardBoundaryLoading,
    mutate: retryBoundary,
  } = useAdminYardDataBoundary();
  // UX-6-001: the board refreshes every 30 s; the line under the filters says when it last did.
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  useEffect(() => {
    if (data) setUpdatedAt(new Date().toISOString());
  }, [data]);

  useEffect(() => {
    const fromUrl = readYardOperationsFilters(searchParams);
    setFilters((current) => ({
      ...fromUrl,
      search: current.search !== fromUrl.search ? current.search : fromUrl.search,
    }));
  }, [searchParams]);

  const dispatchSignals = useMemo(() => dispatchSignalsByTruck(yardBoundary), [yardBoundary]);
  // "Leaving soon" = today or the next shop day (same window as the Dashboard).
  const soonUntil = useMemo(() => nextShopDay(shopDay(new Date())), []);
  const items = useMemo(() => data?.flatMap((page) => page.items) ?? [], [data]);
  const lastPage = data?.[data.length - 1];
  const hasMore = Boolean(lastPage?.nextCursor);
  const counts = data?.[0]?.counts;
  const appliedFilters = useMemo(() => readYardOperationsFilters(searchParams), [searchParams]);
  const quick = yardQuickFilterOf(appliedFilters);
  const sheetFilterCount = YARD_SHEET_FILTER_KEYS.filter((key) => appliedFilters[key] && !(key === 'priority' && quick === 'high')).length;
  const anyFilter = Boolean(appliedFilters.search) || countActiveYardOperationsFilters(appliedFilters) > 0 || Boolean(appliedFilters.outOfShop);

  function commitFilters(next: YardOperationsFilters) {
    const params = buildYardOperationsQuery(next);
    if (tab === 'movement') params.set('tab', 'movement');
    router.replace(`/admin/yard-operations${params.size ? `?${params.toString()}` : ''}`);
  }

  function updateFilter(key: keyof YardOperationsFilters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
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
  }, [appliedFilters, filters.search, tab, router]);

  function clearFilters() {
    setFilters(DEFAULT_YARD_OPERATIONS_FILTERS);
    router.replace(tab === 'movement' ? '/admin/yard-operations?tab=movement' : '/admin/yard-operations');
    setFiltersOpen(false);
  }

  function updateTab(nextTab: 'shop' | 'movement') {
    const params = new URLSearchParams(searchParams.toString());
    if (nextTab === 'shop') params.delete('tab');
    else params.set('tab', nextTab);
    router.replace(`/admin/yard-operations${params.size ? `?${params.toString()}` : ''}`);
  }

  const quickLabels: Record<YardQuickFilter, string> = {
    all: messages.yardQuickAll,
    blocked: messages.yardQuickBlocked,
    high: messages.yardQuickHigh,
    out: messages.yardQuickOut,
  };
  const quickCounts: Record<YardQuickFilter, number | undefined> = {
    all: counts?.quick?.all,
    blocked: counts?.quick?.blocked,
    high: counts?.quick?.highPriority,
    out: counts?.quick?.outOfShop,
  };

  return <div className="space-y-5">
    <PageHeader title={messages.yardOperationsTitle} subtitle={messages.yardOperationsDescription} />

    <div role="tablist" aria-label={messages.yardTabsLabel} className="flex gap-1 border-b">
      {(['shop', 'movement'] as const).map((value) => (
        <button
          key={value}
          type="button"
          role="tab"
          id={`yard-tab-${value}`}
          aria-selected={tab === value}
          aria-controls={`yard-panel-${value}`}
          className={`-mb-px min-h-11 border-b-2 px-4 text-sm font-medium ${tab === value ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
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
        {yardBoundary?.asOf && !yardBoundaryError ? (
          <p className="text-xs text-muted-foreground" data-testid="yard-movement-source">
            {fillYardText(messages.yardMovementSource, { time: formatAdminDate(yardBoundary.asOf, locale) })}
          </p>
        ) : null}
        {/* UX-6-008: Dispatch did not answer — say so and offer a retry; the shop board keeps working. */}
        {yardBoundaryError && yardBoundary === undefined ? (
          <Button type="button" variant="outline" size="sm" onClick={() => void retryBoundary()}>{messages.yardDispatchRetry}</Button>
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
    </div> : isLoading ? <PageSkeleton label={messages.loadingYardOperations} /> : error || !data?.[0] ? <LoadFailure message={messages.yardLoadError} retryLabel={messages.yardRetry} onRetry={() => void mutate()} /> : <div role="tabpanel" id="yard-panel-shop" aria-labelledby="yard-tab-shop" className="flex flex-col gap-4">

      {/* Stage 6 (UX-5-009): search with a visible placeholder, more filters in a sheet, and quick filters that apply on tap. */}
      <form role="search" className="flex min-w-0 items-center gap-2" onSubmit={applyFilters}>
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">{messages.yardSearch}</span>
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            autoComplete="off"
            enterKeyHint="search"
            aria-label={messages.yardSearch}
            placeholder={messages.yardSearch}
            className="min-w-0 pl-9"
            value={filters.search}
            onChange={(event) => updateFilter('search', event.target.value)}
          />
        </label>
        <Button
          type="button"
          variant="outline"
          className="shrink-0"
          aria-label={sheetFilterCount ? `${messages.moreFilters} (${sheetFilterCount})` : messages.moreFilters}
          aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen(true)}
        >
          <SlidersHorizontal aria-hidden="true" className="size-4" />
          <span className="hidden sm:inline">{messages.moreFilters}</span>
          {sheetFilterCount ? (
            <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">{sheetFilterCount}</span>
          ) : null}
        </Button>
      </form>

      <div role="group" aria-label={messages.yardQuickFilters} className="-mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0" data-testid="yard-quick-filters">
        {YARD_QUICK_FILTERS.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={quick === value}
            data-testid={`yard-quick-${value}`}
            onClick={() => commitFilters(withYardQuickFilter({ ...appliedFilters, search: filters.search }, value))}
            className={`relative inline-flex min-h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-sm font-medium ${quick === value ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-accent'}`}
          >
            {quickLabels[value]}
            {quickCounts[value] !== undefined ? <span className={`tabular-nums ${quick === value ? '' : 'text-muted-foreground'}`}>{quickCounts[value]}</span> : null}
          </button>
        ))}
      </div>

      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground" data-testid="yard-showing">
        {counts?.matching !== undefined && counts.total !== undefined ? (
          <span>{fillYardText(messages.yardShowing, { count: String(counts.matching), total: String(counts.total) })}</span>
        ) : null}
        {updatedAt ? <span>{fillYardText(messages.yardLive, { time: formatAdminDate(updatedAt, locale) })}</span> : null}
        {anyFilter ? <button type="button" className="tap-inline font-medium text-primary hover:underline" onClick={clearFilters}>{messages.clearFilters}</button> : null}
      </p>

      <Modal
        open={filtersOpen}
        title={messages.moreFilters}
        closeLabel={messages.closeDialog}
        onClose={() => setFiltersOpen(false)}
      >
        <form className="space-y-3" onSubmit={applyFilters}>
          <YardFilterFields filters={filters} messages={messages} onChange={updateFilter} boardPhases={WORK_PLAN_YARD_PHASES} />
          <div className="flex items-end justify-end gap-2 border-t pt-3">
            <Button type="button" variant="ghost" onClick={clearFilters}>{messages.clearFilters}</Button>
            <Button type="submit">{messages.applyFilters}</Button>
          </div>
        </form>
      </Modal>

      {items.length === 0 ? (
        <EmptyState>
          <p>{messages.noYardOperations}</p>
          <p className="mt-1 text-sm text-muted-foreground">{messages.noYardOperationsBody}</p>
          {anyFilter ? <Button type="button" variant="outline" className="mt-3" onClick={clearFilters}>{messages.clearFilters}</Button> : null}
        </EmptyState>
      ) : (
        // Stage 6 (UX-4-004, D9): one lane per step, top to bottom; an empty step is one line; no sideways scroll.
        <section aria-labelledby="yard-lanes-title" className="space-y-2" data-testid="yard-lanes">
          <h2 id="yard-lanes-title" className="sr-only">{messages.yardLanes}</h2>
          {WORK_PLAN_YARD_PHASES.map((phase, index) => {
            const phaseItems = items.filter((item) => item.phase === phase);
            return (
              <section key={phase} aria-labelledby={`yard-group-${phase}`} data-phase={phase} className={phaseItems.length ? 'rounded-xl border bg-card p-3' : 'flex items-center gap-2 rounded-xl border border-dashed px-3 py-2'}>
                <div className={`flex items-center gap-2 ${phaseItems.length ? 'mb-2' : ''}`}>
                  <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">{index + 1}</span>
                  <h3 id={`yard-group-${phase}`} className="font-display text-sm font-semibold">{messages[phaseMessageKey[phase]]}</h3>
                  {phaseItems.length ? <Badge variant="secondary">{phaseItems.length}</Badge> : <span className="text-sm text-muted-foreground">· {messages.yardNoTrucksLane}</span>}
                </div>
                {phaseItems.length ? (
                  <div className="grid gap-2 sm:grid-cols-[repeat(auto-fill,minmax(15rem,1fr))]">
                    {phaseItems.map((item) => <YardTruckCard key={item.truck.id} item={item} messages={messages} locale={locale} dispatch={dispatchSignals.get(item.truck.truckNumber)} soonUntil={soonUntil} canManage={canManageWorkOrders} fromPath={yardFromPath} onChanged={() => mutate()} />)}
                  </div>
                ) : null}
              </section>
            );
          })}
        </section>
      )}
      {hasMore ? <Button variant="outline" className="w-full" disabled={isValidating} onClick={() => void setSize(size + 1)}>{isValidating ? `${messages.yardLoadMore}…` : messages.yardLoadMore}</Button> : null}
    </div>}
  </div>;
}

function YardFilterFields({
  filters,
  messages,
  onChange,
  boardPhases,
}: {
  filters: YardOperationsFilters;
  messages: AdminMessages;
  onChange: (key: keyof YardOperationsFilters, value: string) => void;
  boardPhases: ReadonlyArray<YardBoardColumnPhase>;
}) {
  return <>
    {YARD_SHEET_FILTER_KEYS.map((key) => (
      <YardFilterField key={key} fieldKey={key} filters={filters} messages={messages} onChange={onChange} fieldClass="block space-y-2" labelClass="text-sm font-medium" boardPhases={boardPhases} />
    ))}
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

function YardTruckCard({ item, messages, locale, dispatch, soonUntil = null, canManage = false, fromPath = '/admin/yard-operations', onChanged }: {
  item: YardOperationsTruckDto;
  /** Where the Truck's back link returns (the Yard with its current query). */
  fromPath?: string;
  /** LTR-159: Return to Service from a Ready to Go card. */
  canManage?: boolean;
  onChanged?: () => Promise<unknown> | void;
  messages: AdminMessages;
  locale: AdminLocale;
  /** LTR-120: Dispatch movement shown only as a signal, never as a phase. */
  dispatch?: YardDispatchSignal;
  /** Last day of "leaving soon" (YYYY-MM-DD). */
  soonUntil?: string | null;
}) {
  const workOrder = item.activeWorkOrder;
  const vehicle = formatVehicleYmm(item.truck);
  // LTR-159: the same Next step as the Truck, Dashboard and Work Order.
  const nextStepText = item.nextStep && item.nextStep.kind !== 'create_work_order' ? truckNextStepText(item.nextStep, messages) : null;
  const mechanics = (workOrder?.mechanics ?? []).filter((mechanic) => !mechanic.removedAt);
  const showPriority = Boolean(workOrder && (workOrder.priority === Priority.HIGH || workOrder.priority === Priority.CRITICAL));
  // Stage 6 (UX-4-005): one alert line, the most urgent first.
  const alert = yardCardAlert(item, dispatch, soonUntil);
  const alertText = alert ? yardAlertText(alert, messages, locale) : null;
  const progress = workOrder && workOrder.jobsTotal ? Math.round((workOrder.jobsCompleted / workOrder.jobsTotal) * 100) : null;
  // The link's name is the Truck number; the alert and the Next step describe it.
  const describedBy = useId();

  const card = (
    <Link
      href={adminTruckHref(item.truck.id, fromPath)}
      aria-label={item.truck.truckNumber}
      aria-describedby={alert || nextStepText ? `${describedBy}-alert ${describedBy}-step` : undefined}
      className="block space-y-1.5 rounded-lg border bg-background p-2.5 hover:bg-accent"
      data-testid="yard-truck-card"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="truncate font-display text-base font-semibold text-primary">{item.truck.truckNumber}</span>
        {showPriority && workOrder ? <PriorityBadge priority={workOrder.priority}>{adminPriorityLabel(workOrder.priority, messages)}</PriorityBadge> : null}
      </div>
      {vehicle ? <p className="truncate text-xs text-muted-foreground" title={vehicle}>{vehicle}</p> : null}
      {alert && alertText ? (
        <p
          id={`${describedBy}-alert`}
          className="border-l-2 border-warning pl-2 text-sm font-medium text-warning-foreground"
          data-testid={alert.kind === 'out_of_shop' ? 'yard-card-out-of-shop' : alert.kind === 'leaves' ? 'yard-card-dispatch' : 'yard-card-alert'}
          data-kind={alert.kind}
        >
          {alertText}
        </p>
      ) : null}
      {/* LTR-101: what is missing (the same Next step everywhere). */}
      {nextStepText ? <p id={`${describedBy}-step`} className="line-clamp-2 text-sm" title={nextStepText} data-testid="yard-card-next-step">{nextStepText}</p> : null}
      {dispatch?.expectedIn ? <p className="truncate text-xs text-muted-foreground" data-testid="yard-card-dispatch">{fillYardText(messages.yardDispatchExpectedIn, { date: formatAdminDateOnly(dispatch.expectedIn, locale) })}</p> : null}
      {dispatch?.departs && alert?.kind !== 'leaves' ? <p className="truncate text-xs text-muted-foreground" data-testid="yard-card-dispatch">{fillYardText(messages.yardDispatchDeparts, { date: formatAdminDateOnly(dispatch.departs, locale) })}</p> : null}
      {workOrder ? (
        <div className="flex items-center gap-2 pt-0.5 text-xs text-muted-foreground">
          <span className="shrink-0">{workOrder.displayId} · {compactAge(workOrder.createdAt)}</span>
          {progress !== null ? (
            <span className="flex min-w-0 flex-1 items-center gap-1.5" title={fillYardText(messages.yardJobsProgress, { done: String(workOrder.jobsCompleted), total: String(workOrder.jobsTotal) })}>
              <span aria-hidden="true" className="h-1.5 min-w-8 flex-1 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-primary" style={{ width: `${progress}%` }} /></span>
              <span className="tabular-nums">{workOrder.jobsCompleted}/{workOrder.jobsTotal}</span>
            </span>
          ) : <span className="flex-1" />}
          {mechanics.length ? (
            <span className="flex shrink-0 -space-x-1" title={mechanics.map((mechanic) => mechanic.mechanicName).join(', ')}>
              {mechanics.slice(0, 3).map((mechanic) => (
                <span key={mechanic.mechanicId} aria-hidden="true" className="grid size-5 place-items-center rounded-full border border-background bg-accent text-[0.6rem] font-semibold text-primary">{profileInitials(mechanic.mechanicName)}</span>
              ))}
              <span className="sr-only">{mechanics.map((mechanic) => mechanic.mechanicName).join(', ')}</span>
            </span>
          ) : null}
        </div>
      ) : (
        <CompactEmpty className="px-2 py-1 text-xs">{messages.noOpenWorkOrder}</CompactEmpty>
      )}
    </Link>
  );
  if (item.nextStep?.kind !== 'return_to_service' || !canManage || !item.nextStep.workOrderId) return card;
  return (
    <div className="space-y-1">
      {card}
      <YardReturnToService workOrderId={item.nextStep.workOrderId} truckNumber={item.truck.truckNumber} messages={messages} onChanged={onChanged} />
    </div>
  );
}

function yardAlertText(alert: YardCardAlert, messages: AdminMessages, locale: AdminLocale) {
  switch (alert.kind) {
    case 'blocked': return `${messages.blocked} · ${adminPauseReasonLabel(alert.reason, messages)}`;
    case 'paused': return alert.reason ? fillYardText(messages.yardAlertPaused, { reason: adminPauseReasonLabel(alert.reason, messages) }) : messages.yardAlertPausedNoReason;
    case 'out_of_shop': return messages.yardOutOfShop;
    case 'leaves': return fillYardText(messages.yardAlertLeaves, { date: formatAdminDateOnly(alert.date, locale), count: String(alert.jobsLeft) });
    case 'nobody': return fillYardText(messages.yardAlertNobody, { job: alert.job });
  }
}

function YardReturnToService({ workOrderId, truckNumber, messages, onChanged }: {
  workOrderId: string;
  truckNumber: string;
  messages: AdminMessages;
  onChanged?: () => Promise<unknown> | void;
}) {
  // D7 / UX-5-008: the same confirmation dialog as the Truck (optional reason), never a single tap.
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" size="sm" variant="outline" className="w-full" onClick={() => setOpen(true)}>
        {messages.returnToServiceTitle}
      </Button>
      <ReturnToServiceDialog
        open={open}
        truckNumber={truckNumber}
        workOrderId={workOrderId}
        messages={messages}
        onClose={() => setOpen(false)}
        onDone={onChanged}
      />
    </>
  );
}
