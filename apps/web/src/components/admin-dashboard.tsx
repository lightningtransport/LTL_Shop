'use client';

import Link from 'next/link';
import { useMemo, useState, type ReactNode } from 'react';
import { ArrowRight, Building2, CalendarClock, Check, CircleAlert, CircleCheck, CircleX, ClipboardCheck, FilePlus, Flag, MessageSquarePlus, OctagonPause, Plus, ShieldCheck, Truck, UserPlus, X, type LucideIcon } from 'lucide-react';
import { AppCapability, BlockerReason, type AdminOpenWorkRequestDto, type AdminWorkOrderSummaryDto, type YardSamsaraTruckDto } from '@ltl-shop/shared';
import { NextStepAction } from './next-step-action';
import { NewWorkOrderDialog } from './new-work-order-dialog';
import { useActionToast } from './action-toast';
import { Button, LoadFailure, PageSkeleton, PriorityBadge, Textarea } from './ui';
import { formatAdminDateOnly } from '@/lib/admin-format';
import { handleAdminWorkRequest, resolveAdminBlocker, unhandleAdminWorkRequest, useAdminDashboard, useAdminYardDataBoundary } from '@/lib/admin-data';
import { fillPlaceholders } from '@/lib/admin-next-step';
import { adminPauseReasonLabel, type AdminLocale, type AdminMessages } from '@/lib/admin-messages';
import { cn } from '@/lib/utils';
import { formatShortDateTime } from '@/lib/work-order-view';
import { adminTruckHref, adminWorkOrderHref } from '@/lib/admin-truck-origin';
import { useAuth } from '@/lib/auth-context';
import { formatVehicleYmm } from '@/lib/format';
import { adminPriorityLabel } from '@/lib/status-chips';
import { truckNextStepText } from '@/lib/truck-next-step';
import { yardSinceWhen } from '@/lib/samsara-view';
import {
  DASHBOARD_ARRIVED_LIMIT,
  DASHBOARD_COUNTERS,
  arrivedNeedsWorkOrder,
  dashboardCounts,
  groupDashboardQueue,
  leavingSoonNotReady,
  shopDay,
  type DashboardCounter,
  type DashboardGroup,
} from '@/lib/dashboard-queue';

const GROUP_META: Record<DashboardGroup, { label: keyof AdminMessages; Icon: LucideIcon; tone: string }> = {
  blocked: { label: 'dashboardGroupBlocked', Icon: OctagonPause, tone: 'text-warning-foreground dark:text-warning' },
  close: { label: 'dashboardGroupClose', Icon: Flag, tone: 'text-primary' },
  cancel: { label: 'dashboardGroupCancel', Icon: CircleX, tone: 'text-muted-foreground' },
  return_to_service: { label: 'dashboardGroupReadyToGo', Icon: Truck, tone: 'text-success' },
  assign: { label: 'dashboardGroupUnassigned', Icon: UserPlus, tone: 'text-primary' },
  inspect: { label: 'dashboardGroupInspect', Icon: ClipboardCheck, tone: 'text-primary' },
  missing_steps: { label: 'dashboardGroupMissing', Icon: CircleAlert, tone: 'text-destructive-text' },
  qc: { label: 'dashboardGroupQc', Icon: ShieldCheck, tone: 'text-muted-foreground' },
  external: { label: 'dashboardGroupExternal', Icon: Building2, tone: 'text-muted-foreground' },
};

/**
 * Stage 3 (D1, UX-5-002, UX-4-001) / Stage 8 (mockup): the Dashboard answers "what do I do now?". Four counters
 * filter one queue of everything that waits on the Manager — grouped by the action, each row two lines and the
 * action on the right, acting in place (D26) — plus the Trucks Dispatch expects to leave soon while still in the
 * shop, and the mechanics' work requests. History counts are one quiet line of links.
 */
export function AdminDashboard({ locale, messages }: { locale: AdminLocale; messages: AdminMessages }) {
  const { user } = useAuth();
  const { data, error, isLoading, mutate } = useAdminDashboard();
  const { data: dispatch, mutate: mutateDispatch } = useAdminYardDataBoundary();
  const [focus, setFocus] = useState<DashboardCounter | null>(null);
  const [opening, setOpening] = useState<{ id: string; truckNumber: string } | null>(null);
  const queue = useMemo(() => data?.queue ?? data?.attention ?? [], [data]);
  if (isLoading) return <PageSkeleton label={messages.currentOperations} />;
  if (error || !data) return <LoadFailure message={messages.loadError} retryLabel={messages.retry} onRetry={() => void mutate()} />;

  const canManage = !!user?.capabilities.includes(AppCapability.WORK_ORDERS_MANAGE);
  const counts = dashboardCounts(queue);
  const groups = groupDashboardQueue(queue, focus);
  // LTR-277 §1: a counter hides only the other counters; arrivals, requests and what leaves soon stay.
  const focusedEmpty = !!focus && !groups.some((entry) => entry.group === focus);
  const requests = data.openWorkRequests ?? [];
  // LTR-261: a truck that arrived without a Work Order waits on the Manager too, not only on the Yard.
  const arrived = arrivedNeedsWorkOrder(dispatch?.samsaraPlaces);
  const departures = dispatch?.upcomingDepartures.status === 'ok' ? dispatch.upcomingDepartures.items : [];
  const today = shopDay(new Date(data.generatedAt));
  const leaving = leavingSoonNotReady(queue, departures, today);
  // Ready to Go rows say when Dispatch has the Truck leaving.
  const leavesOn = new Map<string, string>();
  for (const departure of departures) {
    const day = departure.outDate?.slice(0, 10);
    if (day && day >= today && (!leavesOn.has(departure.truckNumber) || day < leavesOn.get(departure.truckNumber)!)) leavesOn.set(departure.truckNumber, day);
  }
  const waiting = groups.reduce((total, entry) => total + entry.items.length, 0) + requests.length + arrived.length;
  const listHref = (entries: Record<string, string>) => `/admin/work-orders?${new URLSearchParams(entries).toString()}`;
  const openStatuses = 'created,in_progress,waiting_paused';
  const refresh = () => mutate();
  // LTR-277 §1: built once so the counter's group can go above the arrivals.
  const groupSections = groups.map(({ group, items }) => {
    const { label, Icon, tone } = GROUP_META[group];
    return (
      <section key={group} aria-label={messages[label] as string} data-testid={`dashboard-group-${group}`}>
        <h3 className={cn('flex items-center gap-2 border-b bg-sunken px-4 py-2 text-xs font-medium', tone)}>
          <Icon aria-hidden="true" className="size-3.5" />{messages[label] as string}
          <span className="tnum text-muted-foreground">{items.length}</span>
        </h3>
        <ul className="divide-y border-b last:border-b-0">
          {items.map((item) => (
            <QueueRow key={item.id} item={item} group={group} leavesOn={leavesOn.get(item.truck.truckNumber) ?? null} locale={locale} messages={messages} canManage={canManage} onChanged={refresh} />
          ))}
        </ul>
      </section>
    );
  });

  return <div className="space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div className="space-y-1">
        <h1 className="page-title">{messages.title}</h1>
        <p className="text-muted-foreground">{messages.dashboardSubtitle}</p>
      </div>
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <span aria-hidden="true" className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-success/60 motion-reduce:animate-none" />
          <span className="relative inline-flex size-2 rounded-full bg-success" />
        </span>
        {fillPlaceholders(messages.dashLive, { time: formatShortDateTime(data.generatedAt, locale) })}
      </span>
    </header>

    {/* UX-4-001: four counters that filter the queue below, the same "Blocked" as the Yard (D5). */}
    <section className="space-y-3" aria-label={messages.dashboardCountersLabel}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {DASHBOARD_COUNTERS.map((counter) => {
          const { label, Icon, tone } = GROUP_META[counter];
          const value = counts[counter];
          const active = focus === counter;
          return (
            <button
              key={counter}
              type="button"
              aria-pressed={active}
              data-testid={`dashboard-counter-${counter}`}
              onClick={() => setFocus(active ? null : counter)}
              className={cn('flex items-center justify-between gap-2 rounded-xl border bg-card px-4 py-3 text-left hover:bg-accent', active && 'border-primary ring-1 ring-primary')}
            >
              <span className="min-w-0">
                <span className="block text-xs text-muted-foreground">{messages[label] as string}</span>
                <span className={cn('tnum text-xl font-semibold', value ? tone : 'text-muted-foreground')}>{value}</span>
              </span>
              <Icon aria-hidden="true" className={cn('size-5 shrink-0', value ? tone : 'text-muted-foreground')} />
            </button>
          );
        })}
      </div>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <Link className="tap-inline hover:text-foreground hover:underline" href={listHref({ status: openStatuses })}>{fillPlaceholders(messages.dashboardOpenLink, { count: String(data.counts.open) })}</Link>
        <Link className="tap-inline hover:text-foreground hover:underline" href={listHref({ status: 'completed', completedFrom: data.windows.today.from, completedBefore: data.windows.today.to })}>{fillPlaceholders(messages.dashboardCompletedTodayLink, { count: String(data.counts.completedToday) })}</Link>
        <Link className="tap-inline hover:text-foreground hover:underline" href={listHref({ status: 'completed', completedFrom: data.windows.last7Days.from, completedBefore: data.windows.last7Days.to })}>{fillPlaceholders(messages.dashboardCompletedWeekLink, { count: String(data.counts.completedLast7Days) })}</Link>
      </p>
    </section>

    {/* UX-5-004: Dispatch crossed with the shop — leaving today or the next working day with work left. */}
    {leaving.length ? (
      <section className="rounded-xl border border-warning/40 bg-warning-surface/50" aria-labelledby="dashboard-leaving-title" data-testid="dashboard-leaving-soon">
        <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
          <CalendarClock aria-hidden="true" className="size-4 text-warning-foreground dark:text-warning" />
          <h2 id="dashboard-leaving-title" className="font-semibold">{messages.dashboardLeavingSoon}</h2>
          <span className="text-xs text-muted-foreground">· {messages.dashboardLeavingSoonSource}</span>
        </div>
        <ul className="divide-y divide-warning/20 px-1 pb-1">
          {leaving.map(({ item, outDate }) => {
            const href = adminTruckHref(item.truck.id, '/admin');
            return (
              <li key={item.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5">
                <Link className="tap-inline font-semibold text-primary hover:underline" href={href}>{fillPlaceholders(messages.woTitle, { truck: item.truck.truckNumber })}</Link>
                <span>{rich(messages.dashboardLeavingSoonRow, { date: formatAdminDateOnly(outDate, locale), count: String(Math.max(0, item.jobsTotal - item.jobsCompleted)) }, ['date'])}</span>
                <span className="min-w-0 text-muted-foreground">{truckNextStepText(item.nextStep, messages)}</span>
                <Link className="ml-auto inline-flex h-9 items-center gap-1 font-medium text-primary hover:underline" href={href}>
                  {messages.openTruckAction}<ArrowRight aria-hidden="true" className="size-3.5" />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    ) : null}

    <section className="overflow-hidden rounded-xl border bg-card text-card-foreground" aria-labelledby="dashboard-queue-title" data-testid="dashboard-queue">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <h2 id="dashboard-queue-title" className="text-base font-semibold">{messages.dashboardQueueTitle} <span className="tnum font-normal text-muted-foreground">{waiting}</span></h2>
        {focus ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => setFocus(null)}>
            <X aria-hidden="true" />{messages.dashboardShowAll}
          </Button>
        ) : null}
      </div>
      {focusedEmpty ? (
        <p className="border-b px-4 py-3 text-sm text-muted-foreground" data-testid="dashboard-filter-empty">
          {fillPlaceholders(messages.dashboardFilterEmpty, { filter: messages[GROUP_META[focus].label] as string })}
        </p>
      ) : null}
      {!waiting && !focus ? (
        <div className="flex flex-col items-center gap-1 px-4 py-10 text-center text-muted-foreground" data-testid="dashboard-nothing-waiting">
          <CircleCheck aria-hidden="true" className="size-5 text-success" />
          <p className="font-medium text-foreground">{messages.dashboardNothingWaiting}</p>
          <p>{fillPlaceholders(messages.dashboardNothingWaitingBody, { time: formatShortDateTime(data.generatedAt, locale) })}</p>
        </div>
      ) : null}
      {/* LTR-277 §1: the counter's group goes first. */}
      {focus && !focusedEmpty ? groupSections[0] : null}
      {/* LTR-261: where the flow starts — Samsara saw it arrive and nobody opened a Work Order (D49, D51). */}
      {arrived.length ? (
        <section aria-label={messages.dashboardGroupArrived} data-testid="dashboard-group-arrived">
          <h3 className="flex items-center gap-2 border-b bg-sunken px-4 py-2 text-xs font-medium text-warning-foreground dark:text-warning">
            <FilePlus aria-hidden="true" className="size-3.5" />{messages.dashboardGroupArrived}
            <span className="tnum text-muted-foreground">{arrived.length}</span>
          </h3>
          <ul className="divide-y border-b last:border-b-0">
            {arrived.slice(0, DASHBOARD_ARRIVED_LIMIT).map((truck) => (
              <ArrivedRow key={truck.truckId} truck={truck} locale={locale} messages={messages} canManage={canManage} onCreateWo={setOpening} />
            ))}
            {arrived.length > DASHBOARD_ARRIVED_LIMIT ? (
              <li className="px-4 py-2.5 text-sm">
                <Link className="tap-inline inline-flex items-center gap-1 font-medium text-primary hover:underline" href="/admin/trucks?place=in_yard_no_wo" data-testid="dashboard-arrived-see-all">
                  {fillPlaceholders(messages.dashArrivedSeeAll, { count: String(arrived.length) })}<ArrowRight aria-hidden="true" className="size-3.5" />
                </Link>
              </li>
            ) : null}
          </ul>
        </section>
      ) : null}
      {groupSections.slice(focus && !focusedEmpty ? 1 : 0)}
      {/* D46 / SQ-3: Safety findings the Manager has not added or set aside yet. */}
      {data.openQcFindings?.length ? (
        <section aria-label={messages.dashQcFindings} data-testid="dashboard-group-qc-findings">
          <h3 className="flex items-center gap-2 border-b bg-sunken px-4 py-2 text-xs font-medium text-primary">
            <ShieldCheck aria-hidden="true" className="size-3.5" />{messages.dashQcFindings}
            <span className="tnum text-muted-foreground">{data.openQcFindings.length}</span>
          </h3>
          <ul className="divide-y">
            {data.openQcFindings.map((finding) => (
              <li key={finding.id} className="px-4 py-2.5 text-sm">
                <Link href={adminWorkOrderHref(finding.workOrderId, '/admin')} className="tap-inline hover:underline">
                  <span className="font-medium">{finding.truckNumber}</span> · “{finding.text}”
                </Link>
                <p className="text-xs text-muted-foreground">{finding.kind === 'blocking' ? messages.qcFindingBlocking : messages.qcFindingNote} · {finding.workOrderDisplayId}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {requests.length ? (
        <section aria-label={messages.dashboardWorkRequests} data-testid="dashboard-group-requests">
          <h3 className="flex items-center gap-2 border-b bg-sunken px-4 py-2 text-xs font-medium text-primary">
            <MessageSquarePlus aria-hidden="true" className="size-3.5" />{messages.dashboardWorkRequests}
            <span className="tnum text-muted-foreground">{requests.length}</span>
          </h3>
          <ul className="divide-y">
            {requests.map((request) => <RequestRow key={request.id} request={request} locale={locale} messages={messages} canManage={canManage} onChanged={refresh} />)}
          </ul>
        </section>
      ) : null}
    </section>
    {opening ? (
      <NewWorkOrderDialog open truck={opening} messages={messages} onClose={() => setOpening(null)} onCreated={() => { setOpening(null); return Promise.all([mutate(), mutateDispatch()]); }} />
    ) : null}
  </div>;
}

/** LTR-261: "Truck 918 · In yard · since 9:00 AM", and Create WO right here (D26), like Dispatch (D51). */
function ArrivedRow({ truck, locale, messages, canManage, onCreateWo }: {
  truck: YardSamsaraTruckDto;
  locale: AdminLocale;
  messages: AdminMessages;
  canManage: boolean;
  onCreateWo: (truck: { id: string; truckNumber: string }) => void;
}) {
  const where = truck.inYardSince ? fillPlaceholders(messages.presenceInYardSince, { since: yardSinceWhen(truck.inYardSince, locale) }) : messages.presenceInYard;
  return (
    <li className="grid gap-x-4 gap-y-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center" data-testid="dashboard-arrived-row">
      <div className="min-w-0 space-y-0.5">
        <Link className="tap-inline font-semibold text-primary hover:underline" href={adminTruckHref(truck.truckId, '/admin')}>{fillPlaceholders(messages.woTitle, { truck: truck.truckNumber })}</Link>
        <p>{where}</p>
        <p className="text-xs text-muted-foreground">{messages.dashArrivedSub}</p>
      </div>
      {canManage ? (
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Button type="button" onClick={() => onCreateWo({ id: truck.truckId, truckNumber: truck.truckNumber })} data-testid="dashboard-create-wo">
            <Plus aria-hidden="true" />{messages.yardCreateWo}
          </Button>
        </div>
      ) : null}
    </li>
  );
}

/** "{job} is blocked · {reason}" → the named keys in bold, the rest plain. */
function rich(rawTemplate: string, values: Record<string, string>, bold: string[]): ReactNode[] {
  // Plurals first ({count:Job|Jobs}); the plain {key} parts stay for the bold ones.
  const template = rawTemplate.replace(/\{(\w+):((?:[^|{}]|\{\w+\})*)\|((?:[^{}]|\{\w+\})*)\}/g, (match, key: string, one: string, many: string) => (values[key] === undefined ? match : Number(values[key]) === 1 ? one : many));
  return template.split(/(\{[a-z]+\})/g).filter(Boolean).map((part, index) => {
    const key = /^\{([a-z]+)\}$/.exec(part)?.[1];
    if (!key) return part;
    return bold.includes(key) ? <b key={index} className="font-semibold">{values[key]}</b> : values[key];
  });
}

/** One thing that waits on the Manager: "Truck 918", what happens (two lines), and the action right here (D26). */
function QueueRow({ item, group, leavesOn, locale, messages, canManage, onChanged }: {
  item: AdminWorkOrderSummaryDto;
  group: DashboardGroup;
  leavesOn: string | null;
  locale: AdminLocale;
  messages: AdminMessages;
  canManage: boolean;
  onChanged: () => Promise<unknown> | void;
}) {
  const { showToast } = useActionToast();
  const [resolving, setResolving] = useState(false);
  const [note, setNote] = useState('');
  const [pending, setPending] = useState(false);
  const vehicle = formatVehicleYmm(item.truck);
  const step = item.nextStep;
  const blocker = step?.kind === 'resolve_blocker' ? item.latestReportedBlocker : null;
  // LTR-217: a Safety return is answered with work; resolving without it has to tell Safety why.
  const safetyReturn = blocker?.blockerReason === BlockerReason.QUALITY_CHECK_FAILED;
  const noteLabel = safetyReturn ? messages.resolveSafetyReturnNoteLabel : messages.resolveBlockerNoteLabel;
  const flagged = group === 'blocked';
  const left = Math.max(0, item.jobsTotal - item.jobsCompleted);
  const date = (value: string | null | undefined) => formatShortDateTime(value, locale);

  async function resolve() {
    if (!blocker || pending) return;
    setPending(true);
    try {
      await resolveAdminBlocker(item.id, blocker.id, note.trim() || undefined);
      setNote('');
      setResolving(false);
      showToast('success', messages.blockerResolvedSuccess);
      await onChanged();
    } catch {
      showToast('error', messages.blockerResolveFailed);
    } finally {
      setPending(false);
    }
  }

  let title: ReactNode = truckNextStepText(step, messages);
  let detail: ReactNode = null;
  switch (step?.kind) {
    case 'resolve_blocker':
      if (blocker) {
        const reason = adminPauseReasonLabel(blocker.blockerReason ?? blocker.reason, messages);
        const lastNote = blocker.blockerNotes?.[blocker.blockerNotes.length - 1]?.body ?? blocker.notes;
        title = blocker.job ? rich(messages.calloutBlockerTitle, { job: blocker.job.displayName, reason }, ['job']) : reason;
        detail = `${blocker.reportedBy?.name ?? messages.noValue} · ${date(blocker.startedAt)}${lastNote ? ` · “${lastNote}”` : ''}`;
      }
      break;
    case 'resume':
      title = fillPlaceholders(messages.calloutPausedTitle, { reason: item.currentPause ? adminPauseReasonLabel(item.currentPause.reason, messages) : step.reason ? adminPauseReasonLabel(step.reason, messages) : '—' });
      detail = item.currentPause ? fillPlaceholders(messages.dashSince, { date: date(item.currentPause.startedAt) }) : null;
      break;
    case 'close':
      title = fillPlaceholders(messages.dashCloseTitle, { count: String(item.jobsTotal) });
      detail = messages.dashCloseSub;
      break;
    case 'cancel_work_order':
      title = messages.calloutCancelWorkOrderTitle;
      detail = messages.calloutCancelWorkOrderSub;
      break;
    case 'return_to_service':
      // D52 (LTR-260): Samsara saw it leave the yard after the close (or leave and come back): confirm, do not assume.
      if (step.yardMove) {
        title = <span className="text-warning-foreground dark:text-warning">{truckNextStepText(step, messages)}</span>;
        detail = messages.dashRtsMovedSub;
        break;
      }
      title = <>{messages.workPlanReady}{leavesOn ? <> · <span className="text-warning-foreground dark:text-warning">{fillPlaceholders(messages.dashDispatchLeaves, { date: formatAdminDateOnly(leavesOn, locale) })}</span></> : null}</>;
      detail = messages.dashRtsSub;
      break;
    case 'assign':
      title = rich(messages.dashAssignTitle, { job: step.jobName ?? '' }, ['job']);
      detail = fillPlaceholders(messages.dashJobsLeft, { count: String(left) });
      break;
    case 'inspect':
      title = messages.dashInspectTitle;
      detail = fillPlaceholders(messages.dashInspectSub, { date: date(item.createdAt) });
      break;
    case 'qc':
      title = messages.dashQcTitle;
      // D-SET6: the Manager reaches Quality Check as backup from here (D29).
      // UX-2-006: a link inside a sentence is always underlined (the line is muted text; color alone is 1.2:1).
      // LTR-248 (UX-5-009): only who can do the QC as backup gets the link; /qc sends anyone else back.
      detail = canManage ? <>{messages.dashQcSub} <Link className="tap-inline font-medium text-primary underline underline-offset-2" href="/qc">{messages.shopWorkflowQcBackupLink}</Link></> : messages.dashQcSub;
      break;
    case 'add_missing_steps':
      detail = messages.calloutMissingSub;
      break;
    case 'external':
      detail = messages.dashExternalSub;
      break;
    default:
      break;
  }

  const action = blocker ? (
    canManage && !resolving ? (
      safetyReturn ? (
        <>
          <Button asChild><Link href={`${adminTruckHref(item.truck.id, '/admin')}#add-work`}><Plus aria-hidden="true" />{messages.safetyReturnCompleteAddWork}</Link></Button>
          <Button type="button" variant="outline" onClick={() => setResolving(true)}>{messages.resolveSafetyReturnWithoutWork}</Button>
        </>
      ) : <Button type="button" onClick={() => setResolving(true)}><Check aria-hidden="true" />{messages.resolveBlocker}</Button>
    ) : null
  ) : (
    <NextStepAction
      step={step}
      place="dashboard"
      truck={item.truck}
      workOrderDisplayId={item.displayId}
      fromPath="/admin"
      canManage={canManage}
      messages={messages}
      onChanged={onChanged}
    />
  );

  return (
    <li className={cn('grid gap-x-4 gap-y-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center', flagged && 'shadow-[inset_3px_0_0_var(--warning)]')} data-testid="dashboard-queue-row" data-kind={step?.kind}>
      <div className="min-w-0 space-y-0.5">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <Link className="tap-inline font-semibold text-primary hover:underline" href={adminTruckHref(item.truck.id, '/admin')}>{fillPlaceholders(messages.woTitle, { truck: item.truck.truckNumber })}</Link>
          <span className="text-xs text-muted-foreground">
            {vehicle ? `${vehicle} · ` : ''}<Link className="tap-inline font-mono hover:text-foreground hover:underline" href={adminWorkOrderHref(item.id, '/admin')}>{item.displayId}</Link>
          </span>
          {item.priority === 'high' || item.priority === 'critical' ? <PriorityBadge priority={item.priority}>{adminPriorityLabel(item.priority, messages)}</PriorityBadge> : null}
        </div>
        <div data-testid={blocker ? 'admin-blocker' : undefined}>
          <p data-testid="work-order-next-step" data-kind={step?.kind}>{title}</p>
          {detail ? <p className="text-xs text-muted-foreground">{detail}</p> : null}
          {resolving ? (
            <form className="mt-2 space-y-2" onSubmit={(event) => { event.preventDefault(); void resolve(); }}>
              <Textarea
                aria-label={noteLabel}
                placeholder={noteLabel}
                rows={2}
                maxLength={1000}
                value={note}
                disabled={pending}
                required={safetyReturn}
                autoFocus
                onChange={(event) => setNote(event.target.value)}
              />
              <div className="flex gap-2">
                <Button loading={pending} type="submit" disabled={pending || (safetyReturn && !note.trim())}>{messages.blockerConfirmResolve}</Button>
                <Button type="button" variant="ghost" disabled={pending} onClick={() => { setResolving(false); setNote(''); }}>{messages.cancel}</Button>
              </div>
            </form>
          ) : null}
        </div>
        {!canManage && step?.kind !== 'work' ? <p className="text-xs text-muted-foreground">{messages.calloutStepReadOnly}</p> : null}
      </div>
      {action ? <div className="flex flex-wrap gap-2 sm:justify-end">{action}</div> : null}
    </li>
  );
}

/** LTR-126: a mechanic's request for more work; handled right here, or open the Work Order to add it. */
function RequestRow({ request, locale, messages, canManage, onChanged }: {
  request: AdminOpenWorkRequestDto;
  locale: AdminLocale;
  messages: AdminMessages;
  canManage: boolean;
  onChanged: () => Promise<unknown> | void;
}) {
  const { showToast } = useActionToast();
  const [pending, setPending] = useState(false);
  async function markHandled() {
    if (pending) return;
    setPending(true);
    try {
      await handleAdminWorkRequest(request.workOrderId, request.id);
      // LTR-218 (UX-1-006): one tap removes the request from the list, so the toast offers it back.
      const { workOrderId, id } = request;
      showToast('success', fillPlaceholders(messages.workRequestHandledOn, { truck: request.truckNumber }), {
        label: messages.undo,
        onAction: () => {
          void unhandleAdminWorkRequest(workOrderId, id)
            .then(() => onChanged())
            .catch(() => showToast('error', messages.workRequestHandleFailed));
        },
      });
      await onChanged();
    } catch {
      showToast('error', messages.workRequestHandleFailed);
    } finally {
      setPending(false);
    }
  }
  const truckLabel = fillPlaceholders(messages.woTitle, { truck: request.truckNumber });
  return (
    <li className="grid gap-x-4 gap-y-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center" data-testid="dashboard-request-row">
      <div className="min-w-0 space-y-0.5">
        <p className="flex flex-wrap items-baseline gap-x-2">
          {request.truckId ? (
            <Link className="tap-inline font-semibold text-primary hover:underline" href={adminTruckHref(request.truckId, '/admin')}>{truckLabel}</Link>
          ) : <span className="font-semibold">{truckLabel}</span>}
          <span className="font-mono text-xs text-muted-foreground">{request.workOrderDisplayId}</span>
        </p>
        <p className="whitespace-pre-wrap">“{request.body}”</p>
        <p className="text-xs text-muted-foreground">{request.author.name} · {formatShortDateTime(request.createdAt, locale)}</p>
      </div>
      <div className="flex flex-wrap gap-2 sm:justify-end">
        <Button asChild variant="ghost"><Link href={adminWorkOrderHref(request.workOrderId, '/admin')}>{messages.dashboardOpenWorkOrder}</Link></Button>
        {canManage ? (
          <Button loading={pending} type="button" variant="outline" onClick={() => void markHandled()}>
            <Check aria-hidden="true" />{messages.markWorkRequestHandled}
          </Button>
        ) : null}
      </div>
    </li>
  );
}
