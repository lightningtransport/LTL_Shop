'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useId, useMemo, useState } from 'react';
import { Building2, CalendarClock, CirclePause, OctagonPause, PlugZap, Search, Truck, UserPlus, X, type LucideIcon } from 'lucide-react';
import { AppCapability, Priority, type YardOperationsTruckDto } from '@ltl-shop/shared';
import { adminTruckHref } from '@/lib/admin-truck-origin';
import { adminPauseReasonLabel, type AdminLocale, type AdminMessages } from '@/lib/admin-messages';
import { useAdminYardDataBoundary, useAdminYardOperations } from '@/lib/admin-data';
import { useAuth } from '@/lib/auth-context';
import { truckNextStepText } from '@/lib/truck-next-step';
import { cn } from '@/lib/utils';
import { formatShortDateTime } from '@/lib/work-order-view';
import { ReturnToServiceDialog } from './return-to-service-dialog';
import { MechanicAvatarStack } from './mechanic-avatar';
import {
  buildYardOperationsQuery,
  countActiveYardOperationsFilters,
  DEFAULT_YARD_OPERATIONS_FILTERS,
  readYardOperationsFilters,
  withYardQuickFilter,
  YARD_QUICK_FILTERS,
  WORK_PLAN_YARD_PHASES,
  type YardBoardColumnPhase,
  type YardOperationsFilters,
  type YardQuickFilter,
  yardApiQuery,
  yardOperationsFromPath,
  yardQuickFilterOf,
} from '@/lib/yard-operations-routing';
import { nextShopDay, shopDay } from '@/lib/dashboard-queue';
import { adminPriorityLabel } from '@/lib/status-chips';
import { formatVehicleYmm } from '@/lib/format';
import { formatAdminDateOnly } from '@/lib/admin-format';
import { compactAge, dispatchSignalsByTruck, fillYardText, yardCardAlert, type YardCardAlert, type YardDispatchSignal } from '@/lib/yard-card';
import { AdminYardDataBoundaryCards } from './admin-yard-data-boundary-cards';
import { KanbanBoard, KanbanColumn, KanbanFullscreenButton, useKanbanFullscreen } from './kanban';
import { Button, LoadFailure, PageSkeleton, PriorityBadge } from './ui';

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

export function AdminYardOperations({ locale, messages }: { locale: AdminLocale; messages: AdminMessages }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<YardOperationsFilters>(() => readYardOperationsFilters(searchParams));
  // LTR-120: the Shop's own board and Dispatch are separate tabs.
  const tab: 'shop' | 'movement' = searchParams.get('tab') === 'movement' ? 'movement' : 'shop';
  const [movementSearch, setMovementSearch] = useState('');
  const [closedLanes, setClosedLanes] = useState<Record<string, boolean>>({});
  // D33: the board opens full screen (Esc leaves).
  const fullscreen = useKanbanFullscreen();
  const query = searchParams.toString();
  // D4 / UX-5-006: the Truck's back link returns here with the same search, filters and tab.
  const yardFromPath = useMemo(() => yardOperationsFromPath(query), [query]);
  const {
    data: yardBoundary,
    error: yardBoundaryError,
    isLoading: yardBoundaryLoading,
    mutate: retryBoundary,
  } = useAdminYardDataBoundary();
  // "Leaving soon" = today or the next shop day (same window as the Dashboard).
  const today = useMemo(() => shopDay(new Date()), []);
  const soonUntil = useMemo(() => nextShopDay(today), [today]);
  const departures = yardBoundary?.upcomingDepartures.status === 'ok' ? yardBoundary.upcomingDepartures.items : [];
  // Stage 8: the API counts and filters "Leaving soon" over every page from the Trucks Dispatch has leaving.
  const apiQuery = useMemo(() => yardApiQuery(query, departures, today, soonUntil), [query, departures, today, soonUntil]);
  const { data, error, isLoading, size, setSize, mutate, isValidating } = useAdminYardOperations(apiQuery);
  const { user } = useAuth();
  const canManageWorkOrders = !!user?.capabilities.includes(AppCapability.WORK_ORDERS_MANAGE);
  // UX-6-001: the board refreshes every 30 s; the header says when it last did.
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
  const items = useMemo(() => data?.flatMap((page) => page.items) ?? [], [data]);
  const lastPage = data?.[data.length - 1];
  const hasMore = Boolean(lastPage?.nextCursor);
  const counts = data?.[0]?.counts;
  const appliedFilters = useMemo(() => readYardOperationsFilters(searchParams), [searchParams]);
  const quick = yardQuickFilterOf(appliedFilters);
  const anyFilter = Boolean(appliedFilters.search) || countActiveYardOperationsFilters(appliedFilters) > 0 || Boolean(appliedFilters.outOfShop) || Boolean(appliedFilters.soon);

  function commitFilters(next: YardOperationsFilters) {
    const params = buildYardOperationsQuery(next);
    if (tab === 'movement') params.set('tab', 'movement');
    router.replace(`/admin/yard-operations${params.size ? `?${params.toString()}` : ''}`);
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
    soon: messages.yardQuickSoon,
    high: messages.yardQuickHigh,
    out: messages.yardQuickOut,
  };
  const quickCounts: Record<YardQuickFilter, number | undefined> = {
    all: counts?.quick?.all,
    blocked: counts?.quick?.blocked,
    soon: counts?.quick?.leavingSoon,
    high: counts?.quick?.highPriority,
    out: counts?.quick?.outOfShop,
  };
  const matching = counts?.matching;
  const total = counts?.total;

  return <div className="space-y-5">
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div className="space-y-1">
        <h1 className="page-title">{messages.yardOperationsTitle}</h1>
        <p className="text-muted-foreground">{messages.yardSubtitle}</p>
      </div>
      {updatedAt && tab === 'shop' ? (
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="yard-live">
          <span aria-hidden="true" className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-success/60 motion-reduce:animate-none" />
            <span className="relative inline-flex size-2 rounded-full bg-success" />
          </span>
          {fillYardText(messages.yardLive, { time: formatShortDateTime(updatedAt, locale) })}
        </span>
      ) : null}
    </header>

    <div role="tablist" aria-label={messages.yardTabsLabel} className="flex gap-5 border-b">
      {(['shop', 'movement'] as const).map((value) => (
        <button
          key={value}
          type="button"
          role="tab"
          id={`yard-tab-${value}`}
          aria-selected={tab === value}
          aria-controls={`yard-panel-${value}`}
          className={cn('-mb-px h-11 border-b-2 font-medium', tab === value ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}
          onClick={() => updateTab(value)}
        >
          {value === 'shop' ? messages.yardTabShop : messages.yardTabMovement}
        </button>
      ))}
    </div>

    {tab === 'movement' ? (
      <div role="tabpanel" id="yard-panel-movement" aria-labelledby="yard-tab-movement">
      <section role="region" aria-labelledby="yard-movement-title" className="space-y-4">
        <h2 id="yard-movement-title" className="sr-only">{messages.yardOperationsPhase1}</h2>
        <p className="text-muted-foreground">
          {messages.yardOperationsPhase1Body}
          {yardBoundary?.asOf && !yardBoundaryError ? (
            <> <span data-testid="yard-movement-source">{fillYardText(messages.yardMovementSource, { time: formatShortDateTime(yardBoundary.asOf, locale) })}</span></>
          ) : null}
        </p>
        {yardBoundary && [yardBoundary.workLocation, yardBoundary.incomingTrucks, yardBoundary.upcomingDepartures].some((section) => section.status === 'ok' && section.items.length > 0) ? (
          <label className="flex h-11 items-center gap-2 rounded-md border bg-background px-3 focus-within:border-ring [@media(pointer:fine)]:h-10 lg:w-72">
            <Search aria-hidden="true" className="size-3.5 text-muted-foreground" />
            <span className="sr-only">{messages.yardMovementSearch}</span>
            <input
              type="search"
              className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
              aria-label={messages.yardMovementSearch}
              placeholder={messages.yardMovementSearch}
              value={movementSearch}
              onChange={(event) => setMovementSearch(event.target.value)}
            />
          </label>
        ) : null}
        {/* UX-6-008: Dispatch did not answer — say so and offer a retry; the shop board keeps working. */}
        {yardBoundaryError && yardBoundary === undefined ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-10 text-center text-muted-foreground">
            <PlugZap aria-hidden="true" className="size-5" />
            <p className="font-medium text-foreground">{messages.yardDispatchNoAnswer}</p>
            <p>{messages.yardDispatchNoAnswerBody}</p>
            <Button type="button" variant="outline" onClick={() => void retryBoundary()}>{messages.yardDispatchRetry}</Button>
          </div>
        ) : (
          <AdminYardDataBoundaryCards
            locale={locale}
            boundary={yardBoundary}
            loading={yardBoundaryLoading}
            fetchFailed={Boolean(yardBoundaryError) && yardBoundary === undefined}
            expanded
            search={movementSearch}
            today={today}
            soonUntil={soonUntil}
          />
        )}
      </section>
      </div>
    ) : isLoading ? <PageSkeleton label={messages.loadingYardOperations} /> : error || !data?.[0] ? <LoadFailure message={messages.yardLoadError} retryLabel={messages.yardRetry} onRetry={() => void mutate()} /> : (
      <div
        role="tabpanel"
        id="yard-panel-shop"
        aria-labelledby="yard-tab-shop"
        className={cn('flex flex-col gap-4', fullscreen.active && 'fixed inset-0 z-[45] !mt-0 overflow-y-auto bg-background p-4 lg:overflow-hidden lg:p-6')}
        data-fullscreen={fullscreen.active || undefined}
      >
        {fullscreen.active ? <p className="text-lg font-semibold" aria-hidden="true">{messages.yardOperationsTitle}</p> : null}
        {/* Stage 8 (mockup): search and the quick filters on one row; no "More filters" (owner decision). The URL
            still accepts readiness, phase, Work Order status and priority from links on other screens. */}
        <section className="flex flex-col gap-3 lg:flex-row lg:items-center" aria-label={messages.yardQuickFilters}>
          <form role="search" className="lg:w-72" onSubmit={(event) => { event.preventDefault(); commitFilters({ ...appliedFilters, search: filters.search }); }}>
            <label className="flex h-11 items-center gap-2 rounded-md border bg-background px-3 focus-within:border-ring [@media(pointer:fine)]:h-10">
              <Search aria-hidden="true" className="size-3.5 text-muted-foreground" />
              <span className="sr-only">{messages.yardSearch}</span>
              <input
                type="search"
                autoComplete="off"
                enterKeyHint="search"
                aria-label={messages.yardSearch}
                placeholder={messages.yardSearch}
                className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
                value={filters.search}
                onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
              />
            </label>
          </form>
          <div role="group" aria-label={messages.yardQuickFilters} className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0" data-testid="yard-quick-filters">
            {YARD_QUICK_FILTERS.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={quick === value}
                data-testid={`yard-quick-${value}`}
                onClick={() => commitFilters(withYardQuickFilter({ ...appliedFilters, search: filters.search }, value))}
                className={cn(
                  'inline-flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-sm [@media(pointer:fine)]:h-9',
                  quick === value ? 'border-primary bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                {quickLabels[value]}
                {quickCounts[value] !== undefined ? <span className="tnum text-xs">{quickCounts[value]}</span> : null}
              </button>
            ))}
          </div>
          {anyFilter ? <Button type="button" variant="ghost" size="sm" className="self-start lg:ml-auto lg:self-auto" onClick={clearFilters}><X aria-hidden="true" />{messages.clearFilters}</Button> : null}
          <KanbanFullscreenButton
            active={fullscreen.active}
            onClick={fullscreen.toggle}
            enterLabel={messages.yardFullscreen}
            exitLabel={messages.yardExitFullscreen}
            className={cn('hidden shrink-0 lg:inline-flex', !anyFilter && 'lg:ml-auto')}
          />
        </section>

        <p className="-mt-1 text-xs text-muted-foreground" data-testid="yard-showing">
          {matching !== undefined && total !== undefined
            ? matching === total ? fillYardText(messages.yardInShopCount, { count: String(total) }) : fillYardText(messages.yardShowing, { count: String(matching), total: String(total) })
            : null}
          {' · '}{messages.yardFiltersStay}
        </p>

        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-10 text-center text-muted-foreground">
            <p>{anyFilter
              ? fillYardText(messages.yardNoMatch, {
                query: appliedFilters.search ? fillYardText(messages.yardNoMatchQuery, { query: appliedFilters.search }) : '',
                chip: quick !== 'all' ? fillYardText(messages.yardNoMatchChip, { chip: quickLabels[quick] }) : '',
              })
              : messages.noYardOperations}</p>
            {!anyFilter ? <p>{messages.noYardOperationsBody}</p> : null}
            {anyFilter ? <Button type="button" variant="outline" onClick={clearFilters}>{messages.clearFilters}</Button> : null}
          </div>
        ) : (
          // D33: desktop — a Kanban board like Trello, one list per step side by side (an empty one too); a list scrolls
          // its own cards and the board scrolls sideways inside itself. Phones — a foldable list per step, empty steps
          // hidden. No sideways scroll of the page.
          <KanbanBoard
            label={messages.yardLanes}
            labelId="yard-lanes-title"
            className={fullscreen.active ? 'lg:min-h-0 lg:flex-1' : 'lg:h-[max(24rem,calc(100dvh-19rem))]'}
            data-testid="yard-lanes"
          >
            {WORK_PLAN_YARD_PHASES.map((phase, index) => {
              const phaseItems = items.filter((item) => item.phase === phase);
              const laneCount = phaseItems.length ? counts?.byPhase?.[phase] ?? phaseItems.length : 0;
              const open = !closedLanes[phase];
              return (
                <KanbanColumn
                  key={phase}
                  id={phase}
                  data-phase={phase}
                  index={index + 1}
                  title={messages[phaseMessageKey[phase]]}
                  count={laneCount}
                  emptyLabel={messages.yardNoTrucksLane}
                  open={open}
                  onToggle={() => setClosedLanes((current) => ({ ...current, [phase]: open }))}
                >
                  {phaseItems.map((item) => <YardTruckCard key={item.truck.id} item={item} messages={messages} locale={locale} dispatch={dispatchSignals.get(item.truck.truckNumber)} soonUntil={soonUntil} canManage={canManageWorkOrders} fromPath={yardFromPath} onChanged={() => mutate()} />)}
                </KanbanColumn>
              );
            })}
            <p className="text-center text-xs text-muted-foreground lg:hidden">{messages.yardEmptyHidden}</p>
          </KanbanBoard>
        )}
        {hasMore ? <Button variant="outline" className="w-full" disabled={isValidating} onClick={() => void setSize(size + 1)}>{isValidating ? `${messages.yardLoadMore}…` : messages.yardLoadMore}</Button> : null}
      </div>
    )}
  </div>;
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
  const readyToGo = item.nextStep?.kind === 'return_to_service';
  // LTR-159: the same Next step as the Truck, Dashboard and Work Order.
  const nextStepText = readyToGo
    ? dispatch?.departs ? fillYardText(messages.dashDispatchLeaves, { date: formatAdminDateOnly(dispatch.departs, locale) }) : messages.yardWaitingToLeave
    : item.nextStep && item.nextStep.kind !== 'create_work_order' ? truckNextStepText(item.nextStep, messages) : null;
  const mechanics = (workOrder?.mechanics ?? []).filter((mechanic) => !mechanic.removedAt).map((mechanic) => ({ id: mechanic.mechanicId, name: mechanic.mechanicName }));
  const showPriority = Boolean(workOrder && (workOrder.priority === Priority.HIGH || workOrder.priority === Priority.CRITICAL));
  // Stage 6 (UX-4-005) / Stage 8: the alert line or the Next step (not both), the most urgent first.
  const alert = yardCardAlert(item, dispatch, soonUntil);
  const alertText = alert ? yardAlertText(alert, messages, locale, item.outOfShopJobName ?? null) : null;
  const warning = alert && (alert.kind === 'blocked' || alert.kind === 'paused' || alert.kind === 'leaves');
  const AlertIcon = alert ? ALERT_ICON[alert.kind] : null;
  const describedBy = useId();
  const rts = readyToGo && canManage && item.nextStep?.workOrderId ? item.nextStep.workOrderId : null;

  return (
    <article className={cn('shrink-0 rounded-lg border bg-card shadow-sm', warning && 'shadow-[inset_3px_0_0_var(--warning)]')}>
      <Link
        href={adminTruckHref(item.truck.id, fromPath)}
        aria-label={item.truck.truckNumber}
        aria-describedby={`${describedBy}-line`}
        className="block space-y-1.5 rounded-lg p-3 hover:bg-accent/40"
        data-testid="yard-truck-card"
      >
        <div className="flex items-start justify-between gap-2">
          <span className="truncate text-base font-semibold">{item.truck.truckNumber}</span>
          {showPriority && workOrder ? <PriorityBadge priority={workOrder.priority}>{adminPriorityLabel(workOrder.priority, messages)}</PriorityBadge> : null}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {[vehicle, workOrder ? null : messages.noOpenWorkOrder].filter(Boolean).join(' · ')}
          {workOrder ? <>{vehicle ? ' · ' : ''}<span className="font-mono">{workOrder.displayId}</span> · {compactAge(workOrder.createdAt)}</> : null}
        </p>
        {alert && alertText && AlertIcon ? (
          <p
            id={`${describedBy}-line`}
            className={cn('flex items-start gap-1.5 text-xs font-medium', warning ? 'text-warning-foreground dark:text-warning' : 'text-primary')}
            data-testid={alert.kind === 'out_of_shop' ? 'yard-card-out-of-shop' : alert.kind === 'leaves' ? 'yard-card-dispatch' : 'yard-card-alert'}
            data-kind={alert.kind}
          >
            <AlertIcon aria-hidden="true" className="mt-px size-3.5 shrink-0" /><span>{alertText}</span>
          </p>
        ) : nextStepText ? (
          // LTR-101: what is missing (the same Next step everywhere).
          <p id={`${describedBy}-line`} className="line-clamp-2 text-xs text-foreground/90" title={nextStepText} data-testid="yard-card-next-step">{nextStepText}</p>
        ) : null}
        {dispatch?.expectedIn ? <p className="truncate text-xs text-muted-foreground" data-testid="yard-card-dispatch">{fillYardText(messages.yardDispatchExpectedIn, { date: formatAdminDateOnly(dispatch.expectedIn, locale) })}</p> : null}
        {workOrder && !readyToGo ? (
          <div className="flex items-center gap-2 pt-0.5" title={fillYardText(messages.yardJobsProgress, { done: String(workOrder.jobsCompleted), total: String(workOrder.jobsTotal) })}>
            <span aria-hidden="true" className="h-1 flex-1 overflow-hidden rounded-full bg-muted-foreground/20">
              <span className="block h-1 rounded-full bg-success" style={{ width: `${workOrder.jobsTotal ? (workOrder.jobsCompleted / workOrder.jobsTotal) * 100 : 0}%` }} />
            </span>
            <span className="tnum text-xs text-muted-foreground">{workOrder.jobsCompleted}/{workOrder.jobsTotal}</span>
            <MechanicAvatarStack mechanics={mechanics} max={3} />
          </div>
        ) : null}
      </Link>
      {rts ? (
        <div className="border-t p-2">
          <YardReturnToService workOrderId={rts} truckNumber={item.truck.truckNumber} messages={messages} onChanged={onChanged} />
        </div>
      ) : null}
    </article>
  );
}

const ALERT_ICON: Record<YardCardAlert['kind'], LucideIcon> = {
  blocked: OctagonPause,
  paused: CirclePause,
  out_of_shop: Building2,
  leaves: CalendarClock,
  nobody: UserPlus,
};

function yardAlertText(alert: YardCardAlert, messages: AdminMessages, locale: AdminLocale, outJob: string | null) {
  switch (alert.kind) {
    case 'blocked': return `${messages.blocked} · ${adminPauseReasonLabel(alert.reason, messages)}`;
    case 'paused': return alert.reason ? fillYardText(messages.yardAlertPaused, { reason: adminPauseReasonLabel(alert.reason, messages) }) : messages.yardAlertPausedNoReason;
    case 'out_of_shop': return outJob ? fillYardText(messages.yardOutOfShopJob, { job: outJob }) : messages.yardOutOfShop;
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
      <Button type="button" variant="outline" className="h-10 w-full sm:h-8" onClick={() => setOpen(true)}>
        <Truck aria-hidden="true" />{messages.returnToServiceTitle}
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
