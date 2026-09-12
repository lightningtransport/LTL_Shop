'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Ban, ClipboardCheck, MapPin, ShieldCheck, Truck, Warehouse } from 'lucide-react';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';
import { formatAdminDate, formatDuration } from '@/lib/admin-format';
import { useAdminYardOperations } from '@/lib/admin-data';
import { buildYardOperationsQuery, DEFAULT_YARD_OPERATIONS_FILTERS, readYardOperationsFilters, YARD_PHASES, YARD_PRIORITIES, YARD_READINESS_FILTERS, YARD_WORK_ORDER_STATUSES, type YardOperationsFilters } from '@/lib/yard-operations-routing';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, CompactEmpty, EmptyState, Input, LoadFailure, PageSkeleton, Select } from './ui';
import type { YardOperationsTruckDto } from '@ltl-shop/shared';

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

const statusMessageKey = {
  created: 'created',
  in_progress: 'inProgress',
  waiting_paused: 'waitingPaused',
  completed: 'completed',
  cancelled: 'cancelled',
} as const;

const priorityMessageKey = { low: 'lowPriority', normal: 'normalPriority', high: 'highPriority', critical: 'criticalPriority' } as const;
const blockerMessageKey = { open_work_order: 'openWorkOrderBlocker', required_requirement: 'requiredRequirementBlocker', unevaluated_requirement: 'unevaluatedRequirementBlocker', approval_conflict: 'approvalConflictBlocker' } as const;

export function AdminYardOperations({ locale, messages }: { locale: AdminLocale; messages: AdminMessages }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<YardOperationsFilters>(DEFAULT_YARD_OPERATIONS_FILTERS);
  const [now, setNow] = useState<number | null>(null);
  const [view, setView] = useState<'board' | 'list'>('board');
  const query = searchParams.toString();
  const { data, error, isLoading, size, setSize, mutate, isValidating } = useAdminYardOperations(query);

  useEffect(() => {
    setFilters(readYardOperationsFilters(searchParams));
    setView(searchParams.get('view') === 'list' ? 'list' : 'board');
    setNow(Date.now());
  }, [searchParams]);

  const items = useMemo(() => data?.flatMap((page) => page.items) ?? [], [data]);
  const lastPage = data?.[data.length - 1];
  const hasMore = Boolean(lastPage?.nextCursor);
  const counts = data?.[0]?.counts;
  const incomingUnavailable = data?.[0]?.incomingTrucks.status === 'unavailable';
  const departuresUnavailable = data?.[0]?.upcomingDepartures.status === 'unavailable';

  function updateFilter(key: keyof YardOperationsFilters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function applyFilters(event: React.FormEvent) {
    event.preventDefault();
    const params = buildYardOperationsQuery(filters);
    if (view === 'list') params.set('view', 'list');
    router.replace(`/admin/yard-operations${params.size ? `?${params.toString()}` : ''}`);
  }

  function clearFilters() {
    setFilters(DEFAULT_YARD_OPERATIONS_FILTERS);
    router.replace('/admin/yard-operations');
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
    <header>
      <p className="section-label">{messages.eyebrow}</p>
      <h1 className="mt-2 font-display text-3xl font-bold tracking-wide sm:text-4xl">{messages.yardOperationsTitle}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{messages.yardOperationsDescription}</p>
    </header>

    <Card className="border-warning/50 bg-warning-surface" role="region" aria-labelledby="yard-phase-1-title">
      <CardHeader className="mb-3 flex flex-row items-start gap-3">
        <Warehouse aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-warning-foreground" />
        <div><CardTitle id="yard-phase-1-title" className="text-base">{messages.yardOperationsPhase1}</CardTitle><CardDescription className="mt-1 text-warning-foreground">{messages.yardOperationsPhase1Body}</CardDescription></div>
      </CardHeader>
      <CardContent className="grid gap-2 p-0 sm:grid-cols-3">
        <UnavailableStatus icon={Truck} label={messages.workLocationUnavailable} unavailableLabel={messages.unavailableLabel} />
        <UnavailableStatus icon={Truck} label={messages.incomingTrucksUnavailable} unavailable={incomingUnavailable} unavailableLabel={messages.unavailableLabel} />
        <UnavailableStatus icon={ShieldCheck} label={messages.upcomingDeparturesUnavailable} unavailable={departuresUnavailable} unavailableLabel={messages.unavailableLabel} />
      </CardContent>
    </Card>

    {isLoading ? <PageSkeleton label={messages.loadingYardOperations} /> : error || !data?.[0] ? <LoadFailure message={messages.yardLoadError} retryLabel={messages.yardRetry} onRetry={() => void mutate()} /> : <>
      <section aria-labelledby="yard-summary-title">
        <div className="mb-3"><h2 id="yard-summary-title" className="font-display text-xl font-semibold">{messages.yardSummaryMetrics}</h2></div>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
          <SummaryMetric label={messages.underReview} value={counts?.underReview ?? 0} Icon={ClipboardCheck} />
          <SummaryMetric label={messages.readyToGo} value={counts?.readyToGo ?? 0} Icon={ShieldCheck} />
          <SummaryMetric label={messages.blocked} value={counts?.blocked ?? 0} Icon={Ban} />
        </div>
      </section>

      <Card>
        <CardHeader><CardTitle>{messages.yardFilters}</CardTitle></CardHeader>
        <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-6" onSubmit={applyFilters}>
          <label className="space-y-1 xl:col-span-2"><span className="text-sm font-medium">{messages.search}</span><Input aria-label={messages.search} value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} /></label>
          <label className="space-y-1"><span className="text-sm font-medium">{messages.readiness}</span><Select aria-label={messages.readiness} value={filters.readiness} onChange={(event) => updateFilter('readiness', event.target.value)}><option value="">{messages.allReadiness}</option>{YARD_READINESS_FILTERS.map((value) => <option key={value} value={value}>{messages[readinessMessageKey[value]]}</option>)}</Select></label>
          <label className="space-y-1"><span className="text-sm font-medium">{messages.phase}</span><Select aria-label={messages.phase} value={filters.phase} onChange={(event) => updateFilter('phase', event.target.value)}><option value="">{messages.allPhases}</option>{YARD_PHASES.map((value) => <option key={value} value={value}>{messages[phaseMessageKey[value]]}</option>)}</Select></label>
          <label className="space-y-1"><span className="text-sm font-medium">{messages.workOrderStatus}</span><Select aria-label={messages.workOrderStatus} value={filters.workOrderStatus} onChange={(event) => updateFilter('workOrderStatus', event.target.value)}><option value="">{messages.allWorkOrderStatuses}</option>{YARD_WORK_ORDER_STATUSES.map((value) => <option key={value} value={value}>{messages[statusMessageKey[value]]}</option>)}</Select></label>
          <label className="space-y-1"><span className="text-sm font-medium">{messages.priority}</span><Select aria-label={messages.priority} value={filters.priority} onChange={(event) => updateFilter('priority', event.target.value)}><option value="">{messages.allPriorities}</option>{YARD_PRIORITIES.map((value) => <option key={value} value={value}>{messages[priorityMessageKey[value]]}</option>)}</Select></label>
          <label className="space-y-1"><span className="text-sm font-medium">{messages.blockedFilter}</span><Select aria-label={messages.blockedFilter} value={filters.blocked} onChange={(event) => updateFilter('blocked', event.target.value)}><option value="">{messages.allBlockerStates}</option><option value="true">{messages.blockedOnly}</option><option value="false">{messages.unblockedOnly}</option></Select></label>
          <div className="flex items-end justify-end gap-2 border-t pt-3 md:col-span-2 xl:col-span-6"><Button type="button" variant="ghost" onClick={clearFilters}>{messages.yardClearFilters}</Button><Button type="submit">{messages.yardApplyFilters}</Button></div>
        </form>
      </Card>

      <div className="hidden items-center justify-end gap-2 xl:flex" aria-label={messages.view}>
        <span className="text-sm text-muted-foreground">{messages.view}</span>
        <Button type="button" variant={view === 'board' ? 'secondary' : 'ghost'} size="sm" aria-pressed={view === 'board'} onClick={() => updateView('board')}>{messages.boardView}</Button>
        <Button type="button" variant={view === 'list' ? 'secondary' : 'ghost'} size="sm" aria-pressed={view === 'list'} onClick={() => updateView('list')}>{messages.listView}</Button>
      </div>

      {items.length === 0 ? <EmptyState><p>{messages.noYardOperations}</p><p className="mt-1 text-sm text-muted-foreground">{messages.noYardOperationsBody}</p></EmptyState> : <>
        <section className={view === 'board' ? 'hidden xl:block' : 'hidden'} aria-labelledby="yard-board-title">
          <div className="mb-3"><h2 id="yard-board-title" className="font-display text-xl font-semibold">{messages.yardBoard}</h2></div>
          <div className="overflow-x-auto rounded-xl border bg-muted/40 p-3">
            <div className="grid min-w-[1530px] grid-cols-9 gap-3">
              {YARD_PHASES.map((phase) => <div key={phase} className="min-w-0" data-phase={phase}><div className="mb-2 flex items-center justify-between gap-2"><h3 className="font-display text-sm font-semibold">{messages[phaseMessageKey[phase]]}</h3><span className="text-xs text-muted-foreground">{items.filter((item) => item.phase === phase).length}</span></div><div className="space-y-3">{items.filter((item) => item.phase === phase).map((item) => <YardTruckCard key={item.truck.id} item={item} locale={locale} messages={messages} now={now} />)}{items.every((item) => item.phase !== phase) ? <CompactEmpty>{messages.noTrucksInPhase}</CompactEmpty> : null}</div></div>)}
            </div>
          </div>
        </section>
        <section className={view === 'list' ? 'space-y-4' : 'space-y-4 xl:hidden'} aria-labelledby="yard-list-title">
          <div><h2 id="yard-list-title" className="font-display text-xl font-semibold">{messages.yardGroupedList}</h2></div>
          {YARD_PHASES.map((phase) => { const phaseItems = items.filter((item) => item.phase === phase); return phaseItems.length ? <section key={phase} aria-labelledby={`yard-group-${phase}`}><div className="mb-2 flex items-center gap-2"><h3 id={`yard-group-${phase}`} className="font-display text-base font-semibold">{messages[phaseMessageKey[phase]]}</h3><Badge variant="secondary">{phaseItems.length}</Badge></div><div className="space-y-3">{phaseItems.map((item) => <YardTruckCard key={item.truck.id} item={item} locale={locale} messages={messages} now={now} />)}</div></section> : null; })}
        </section>
      </>}
      {hasMore ? <Button variant="outline" className="w-full" disabled={isValidating} onClick={() => void setSize(size + 1)}>{isValidating ? `${messages.yardLoadMore}…` : messages.yardLoadMore}</Button> : null}
    </>}
  </div>;
}

function SummaryMetric({ label, value, Icon }: { label: string; value: number; Icon: typeof ClipboardCheck }) {
  return <Card className="flex min-h-28 items-start justify-between gap-2 p-3 sm:p-4"><div><p className="text-xs text-muted-foreground sm:text-sm">{label}</p><p className="mt-2 font-display text-2xl font-bold sm:text-3xl">{value}</p></div><Icon aria-hidden="true" className="size-5 shrink-0 text-primary" /></Card>;
}

function UnavailableStatus({ icon: Icon, label, unavailable = true, unavailableLabel }: { icon: typeof MapPin; label: string; unavailable?: boolean; unavailableLabel: string }) {
  return <div className="flex items-center gap-2 rounded-lg border bg-card/70 px-3 py-2 text-xs text-muted-foreground"><Icon aria-hidden="true" className="size-4 shrink-0" /><span>{label}</span>{unavailable ? <Badge variant="secondary" className="ml-auto">{unavailableLabel}</Badge> : null}</div>;
}

function YardTruckCard({ item, locale, messages, now }: { item: YardOperationsTruckDto; locale: AdminLocale; messages: AdminMessages; now: number | null }) {
  const workOrder = item.activeWorkOrder;
  const assessmentDuration = item.assessment && now !== null ? formatDuration(Math.max(0, now - new Date(item.assessment.startedAt).getTime())) : '—';
  const firstBlocker = item.blockers[0];
  const blockerText = firstBlocker ? `${messages[blockerMessageKey[firstBlocker.kind]]}${firstBlocker.categoryName ? ` ${firstBlocker.categoryName}` : ''}${firstBlocker.status ? ` · ${messages[statusMessageKey[firstBlocker.status]]}` : ''}` : messages.noBlockerRecorded;
  return <Card className="space-y-3 p-3" data-testid="yard-truck-card">
    <div className="flex items-start justify-between gap-2"><Link className="font-display text-base font-semibold text-primary hover:underline" href={`/admin/trucks/${item.truck.id}`}>{item.truck.truckNumber}</Link><Badge variant={item.blockers.length ? 'warning' : 'success'}>{messages[phaseMessageKey[item.phase]]}</Badge></div>
    <p className="text-xs text-muted-foreground">{[item.truck.year, item.truck.make, item.truck.model].filter(Boolean).join(' ') || messages.noValue}</p>
    <dl className="space-y-2 text-xs"><div className="flex items-center justify-between gap-2"><dt className="text-muted-foreground">{messages.timeInAssessment}</dt><dd className="font-medium">{assessmentDuration}</dd></div><div className="flex items-center justify-between gap-2"><dt className="text-muted-foreground">{messages.linkedWorkOrder}</dt><dd>{workOrder ? <Link className="text-primary hover:underline" href={`/admin/work-orders/${workOrder.id}`}>{workOrder.displayId}</Link> : <span>{messages.noActiveWorkOrder}</span>}</dd></div><div className="flex items-center justify-between gap-2"><dt className="text-muted-foreground">{messages.priority}</dt><dd>{workOrder ? <LocalizedPriority priority={workOrder.priority} messages={messages} /> : '—'}</dd></div><div><dt className="text-muted-foreground">{messages.mechanicsLabel}</dt><dd className="mt-1 truncate">{workOrder?.mechanics.map((mechanic) => mechanic.mechanicName).join(', ') || messages.noMechanicsAssigned}</dd></div><div><dt className="text-muted-foreground">{messages.firstBlocker}</dt><dd className="mt-1 line-clamp-2">{blockerText}</dd></div></dl>
    <p className="flex items-start gap-1 text-[11px] text-muted-foreground"><MapPin aria-hidden="true" className="mt-0.5 size-3 shrink-0" /><span>{messages.lastReportedLocation}: {item.truck.location ?? messages.noValue}</span></p>
    <p className="sr-only">{formatAdminDate(item.assessment?.startedAt ?? null, locale)}</p>
  </Card>;
}

function LocalizedPriority({ priority, messages }: { priority: keyof typeof priorityMessageKey; messages: AdminMessages }) {
  return <span className="rounded-md border border-shop-accent/40 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide">{messages[priorityMessageKey[priority]]}</span>;
}
