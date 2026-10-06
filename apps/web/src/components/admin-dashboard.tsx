'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { CalendarClock, CheckCircle2, ClipboardCheck, Flag, MessageSquarePlus, OctagonPause, Truck, UserPlus, Wrench, X, type LucideIcon } from 'lucide-react';
import { AppCapability, type AdminOpenWorkRequestDto, type AdminWorkOrderSummaryDto } from '@ltl-shop/shared';
import { AdminBlockerResolve } from './admin-blocker-resolve';
import { NextStepAction } from './next-step-action';
import { useActionToast } from './action-toast';
import { PageHeader, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, LoadFailure, PageSkeleton, PriorityBadge } from './ui';
import { formatAdminDate, formatAdminDateOnly } from '@/lib/admin-format';
import { handleAdminWorkRequest, useAdminDashboard, useAdminYardDataBoundary } from '@/lib/admin-data';
import { fillPlaceholders } from '@/lib/admin-next-step';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';
import { adminTruckHref } from '@/lib/admin-truck-origin';
import { useAuth } from '@/lib/auth-context';
import { formatVehicleYmm } from '@/lib/format';
import { adminPriorityLabel } from '@/lib/status-chips';
import { truckNextStepText } from '@/lib/truck-next-step';
import {
  DASHBOARD_COUNTERS,
  dashboardCounts,
  groupDashboardQueue,
  leavingSoonNotReady,
  shopDay,
  type DashboardGroup,
} from '@/lib/dashboard-queue';

const GROUP_META: Record<DashboardGroup, { label: keyof AdminMessages; Icon: LucideIcon; tone: string }> = {
  blocked: { label: 'dashboardGroupBlocked', Icon: OctagonPause, tone: 'text-warning-foreground' },
  close: { label: 'dashboardGroupClose', Icon: Flag, tone: 'text-primary' },
  return_to_service: { label: 'dashboardGroupReadyToGo', Icon: Truck, tone: 'text-shop-success' },
  assign: { label: 'dashboardGroupUnassigned', Icon: UserPlus, tone: 'text-primary' },
  inspect: { label: 'dashboardGroupInspect', Icon: ClipboardCheck, tone: 'text-primary' },
  missing_steps: { label: 'dashboardGroupMissing', Icon: ClipboardCheck, tone: 'text-destructive-text' },
  qc: { label: 'dashboardGroupQc', Icon: CheckCircle2, tone: 'text-muted-foreground' },
  external: { label: 'dashboardGroupExternal', Icon: Wrench, tone: 'text-muted-foreground' },
};

/**
 * Stage 3 (D1, UX-5-002, UX-4-001): the Dashboard answers "what do I do now?". Four counters filter
 * one queue of everything that waits on the Manager — grouped by the action, each row acting in place
 * (D26) — plus the Trucks Dispatch expects to leave soon while still in the shop, and the mechanics'
 * work requests. History counts are one quiet line of links.
 */
export function AdminDashboard({ locale, messages }: { locale: AdminLocale; messages: AdminMessages }) {
  const { user } = useAuth();
  const { data, error, isLoading, mutate } = useAdminDashboard();
  const { data: dispatch } = useAdminYardDataBoundary();
  const [focus, setFocus] = useState<DashboardGroup | null>(null);
  const queue = useMemo(() => data?.queue ?? data?.attention ?? [], [data]);
  if (isLoading) return <PageSkeleton label={messages.currentOperations} />;
  if (error || !data) return <LoadFailure message={messages.loadError} retryLabel={messages.retry} onRetry={() => void mutate()} />;

  const canStandard = !!user?.capabilities.includes(AppCapability.MECHANIC_STANDARD);
  const canPm = !!user?.capabilities.includes(AppCapability.MECHANIC_PM);
  const canManage = !!user?.capabilities.includes(AppCapability.WORK_ORDERS_MANAGE);
  const counts = dashboardCounts(queue);
  const groups = groupDashboardQueue(queue, focus);
  const requests = focus ? [] : data.openWorkRequests ?? [];
  const departures = dispatch?.upcomingDepartures.status === 'ok' ? dispatch.upcomingDepartures.items : [];
  const leaving = focus ? [] : leavingSoonNotReady(queue, departures, shopDay(new Date(data.generatedAt)));
  const waiting = groups.reduce((total, entry) => total + entry.items.length, 0) + requests.length;
  const listHref = (entries: Record<string, string>) => `/admin/work-orders?${new URLSearchParams(entries).toString()}`;
  const openStatuses = 'created,in_progress,waiting_paused';
  const refresh = () => mutate();

  return <div className="space-y-6">
    <PageHeader
      title={messages.title}
      subtitle={messages.dashboardSubtitle}
      meta={<>{messages.generatedAtLabel} {formatAdminDate(data.generatedAt, locale)}</>}
    />
    {canStandard || canPm ? <Workspaces messages={messages} canStandard={canStandard} canPm={canPm} /> : null}

    {/* UX-4-001: four counters that filter the queue below, the same "Blocked" as the Yard (D5). */}
    <section className="space-y-2" aria-label={messages.dashboardCountersLabel}>
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
              className={`flex min-h-16 items-center justify-between gap-2 rounded-xl border bg-card px-4 py-3 text-left transition hover:border-primary/50 ${active ? 'border-primary ring-1 ring-primary' : ''}`}
            >
              <span className="min-w-0">
                <span className="block text-xs text-muted-foreground">{messages[label] as string}</span>
                <span className={`font-display text-xl font-semibold ${value ? tone : 'text-muted-foreground'}`}>{value}</span>
              </span>
              <Icon aria-hidden="true" className={`size-5 shrink-0 ${value ? tone : 'text-muted-foreground'}`} />
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
      <section className="rounded-xl border border-warning/50 bg-warning-surface" aria-labelledby="dashboard-leaving-title" data-testid="dashboard-leaving-soon">
        <div className="flex flex-wrap items-baseline gap-x-2 px-4 pt-3">
          <CalendarClock aria-hidden="true" className="size-4 self-center text-warning-foreground" />
          <h2 id="dashboard-leaving-title" className="group-title text-warning-foreground">{messages.dashboardLeavingSoon}</h2>
          <span className="text-xs text-muted-foreground">· {messages.dashboardLeavingSoonSource}</span>
        </div>
        <ul className="divide-y divide-warning/30 px-1 pb-1">
          {leaving.map(({ item, outDate }) => (
            <li key={item.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-sm">
              <Link className="tap-inline font-semibold text-primary hover:underline" href={adminTruckHref(item.truck.id, '/admin')}>{item.truck.truckNumber}</Link>
              <span>{fillPlaceholders(messages.dashboardLeavingSoonRow, { date: formatAdminDateOnly(outDate, locale), count: String(Math.max(0, item.jobsTotal - item.jobsCompleted)) })}</span>
              <span className="min-w-0 text-muted-foreground">{truckNextStepText(item.nextStep, messages)}</span>
            </li>
          ))}
        </ul>
      </section>
    ) : null}

    <Card className="overflow-hidden p-0" data-testid="dashboard-queue">
      <CardHeader className="mb-0 flex flex-row items-center justify-between gap-3 border-b p-4">
        <CardTitle>{messages.dashboardQueueTitle} <span className="font-normal text-muted-foreground">{waiting}</span></CardTitle>
        {focus ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => setFocus(null)}>
            <X aria-hidden="true" className="size-4" />{messages.dashboardShowAll}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="p-0">
        {!waiting ? (
          <div className="flex flex-col items-center gap-1 px-4 py-10 text-center" data-testid="dashboard-nothing-waiting">
            <CheckCircle2 aria-hidden="true" className="size-6 text-shop-success" />
            <p className="font-medium">{messages.dashboardNothingWaiting}</p>
            <p className="text-sm text-muted-foreground">{fillPlaceholders(messages.dashboardNothingWaitingBody, { time: formatAdminDate(data.generatedAt, locale) })}</p>
          </div>
        ) : null}
        {groups.map(({ group, items }) => {
          const { label, Icon, tone } = GROUP_META[group];
          return (
            <section key={group} aria-label={messages[label] as string} data-testid={`dashboard-group-${group}`}>
              <h3 className={`flex items-center gap-2 border-b bg-muted/60 px-4 py-2 text-xs font-medium ${tone}`}>
                <Icon aria-hidden="true" className="size-4" />{messages[label] as string}
                <span className="text-muted-foreground">{items.length}</span>
              </h3>
              <ul className="divide-y">
                {items.map((item) => (
                  <QueueRow key={item.id} item={item} group={group} locale={locale} messages={messages} canManage={canManage} onChanged={refresh} />
                ))}
              </ul>
            </section>
          );
        })}
        {requests.length ? (
          <section aria-label={messages.dashboardWorkRequests} data-testid="dashboard-group-requests">
            <h3 className="flex items-center gap-2 border-y bg-muted/60 px-4 py-2 text-xs font-medium text-primary">
              <MessageSquarePlus aria-hidden="true" className="size-4" />{messages.dashboardWorkRequests}
              <span className="text-muted-foreground">{requests.length}</span>
            </h3>
            <ul className="divide-y">
              {requests.map((request) => <RequestRow key={request.id} request={request} locale={locale} messages={messages} canManage={canManage} onChanged={refresh} />)}
            </ul>
          </section>
        ) : null}
      </CardContent>
    </Card>
  </div>;
}

/** One thing that waits on the Manager: which Truck, what happens, and the action right here (D26). */
function QueueRow({ item, group, locale, messages, canManage, onChanged }: {
  item: AdminWorkOrderSummaryDto;
  group: DashboardGroup;
  locale: AdminLocale;
  messages: AdminMessages;
  canManage: boolean;
  onChanged: () => Promise<unknown> | void;
}) {
  const vehicle = formatVehicleYmm(item.truck);
  const blocker = item.nextStep?.kind === 'resolve_blocker' ? item.latestReportedBlocker : null;
  const flagged = group === 'blocked';
  return (
    <li className={`grid gap-x-4 gap-y-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center ${flagged ? 'shadow-[inset_3px_0_0_var(--warning)]' : ''}`} data-testid="dashboard-queue-row" data-kind={item.nextStep?.kind}>
      <div className="min-w-0 space-y-0.5">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <Link className="tap-inline font-semibold text-primary hover:underline" href={adminTruckHref(item.truck.id, '/admin')}>{item.truck.truckNumber}</Link>
          <span className="text-xs text-muted-foreground">
            {vehicle ? `${vehicle} · ` : ''}<Link className="tap-inline font-mono hover:text-foreground hover:underline" href={`/admin/work-orders/${item.id}`}>{item.displayId}</Link>
          </span>
          {item.priority === 'high' || item.priority === 'critical' ? <PriorityBadge priority={item.priority}>{adminPriorityLabel(item.priority, messages)}</PriorityBadge> : null}
        </div>
        {blocker ? (
          // The blocker block says what, who, when and the mechanic's note; the note to the mechanic opens on demand.
          <AdminBlockerResolve workOrderId={item.id} blocker={blocker} locale={locale} messages={messages} canResolve={canManage} onResolved={onChanged} noteOnDemand />
        ) : (
          <p className="text-sm" data-testid="work-order-next-step" data-kind={item.nextStep?.kind}>{truckNextStepText(item.nextStep, messages)}</p>
        )}
        {!canManage && item.nextStep?.kind !== 'work' ? <p className="text-xs text-muted-foreground">{messages.nextStepNoPermission}</p> : null}
      </div>
      {blocker ? null : (
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <NextStepAction
            step={item.nextStep}
            place="dashboard"
            truck={item.truck}
            workOrderDisplayId={item.displayId}
            fromPath="/admin"
            canManage={canManage}
            messages={messages}
            onChanged={onChanged}
          />
        </div>
      )}
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
      showToast('success', messages.workRequestHandledSuccess);
      await onChanged();
    } catch {
      showToast('error', messages.workRequestHandleFailed);
    } finally {
      setPending(false);
    }
  }
  return (
    <li className="grid gap-x-4 gap-y-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center" data-testid="dashboard-request-row">
      <div className="min-w-0 space-y-0.5">
        <p className="whitespace-pre-wrap text-sm">{request.body}</p>
        <p className="text-xs text-muted-foreground">{messages.workRequestFrom
          .replace('{name}', request.author.name)
          .replace('{truck}', request.truckNumber)
          .replace('{workOrder}', request.workOrderDisplayId)
          .replace('{date}', formatAdminDate(request.createdAt, locale))}</p>
      </div>
      <div className="flex flex-wrap gap-2 sm:justify-end">
        <Button asChild size="sm" variant="ghost"><Link href={`/admin/work-orders/${request.workOrderId}`}>{messages.dashboardOpenWorkOrder}</Link></Button>
        {canManage ? (
          <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => void markHandled()}>
            {pending ? messages.saving : messages.markWorkRequestHandled}
          </Button>
        ) : null}
      </div>
    </li>
  );
}

/** Shortcuts to the mechanic workspaces for people who also wrench (unchanged; its place is still an open decision). */
function Workspaces({ messages, canStandard, canPm }: { messages: AdminMessages; canStandard: boolean; canPm: boolean }) {
  return (
    <section aria-labelledby="admin-workspaces-title">
      <div className="mb-3">
        <h2 id="admin-workspaces-title" className="font-display text-xl font-semibold">{messages.workspaces}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{messages.workspacesBody}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {canStandard ? (
          <Card>
            <CardHeader><Wrench aria-hidden="true" className="size-5 text-primary" /><CardTitle>{messages.standardWorkspace}</CardTitle><CardDescription>{messages.standardWorkspaceBody}</CardDescription></CardHeader>
            <CardContent><Button asChild className="w-full"><Link href="/mechanic/standard">{messages.openStandardWorkspace}</Link></Button></CardContent>
          </Card>
        ) : null}
        {canPm ? (
          <Card>
            <CardHeader><ClipboardCheck aria-hidden="true" className="size-5 text-primary" /><CardTitle>{messages.pmWorkspace}</CardTitle><CardDescription>{messages.pmWorkspaceBody}</CardDescription></CardHeader>
            <CardContent><Button asChild className="w-full"><Link href="/mechanic/pm">{messages.openPmWorkspace}</Link></Button></CardContent>
          </Card>
        ) : null}
      </div>
    </section>
  );
}
