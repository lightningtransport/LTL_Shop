'use client';

import Link from 'next/link';
import { Check, Hourglass, Play } from 'lucide-react';
import type { WorkOrderSummaryDto } from '@ltl-shop/shared';
import { clockStoppedLine } from '@/lib/clock-stopped';
import { pauseLabel } from '@/lib/format';
import { isMyJob, isMyPartDone, isStandardWorkWaitingOnManager, jobPersonLabel } from '@/lib/job-assignment';
import { jobDisplayName } from '@/lib/job-display-name';
import { useShopLocale } from '@/lib/locale-context';
import type { HomeLists } from '@/lib/shop-data';
import { intlLocale } from '@/lib/shop-locale';
import { cn } from '@/lib/utils';
import { vehicleLine } from '@/lib/work-order-identity';
import { Badge, Button, CountChip, EmptyState, PriorityBadge } from './ui';

type Wo = WorkOrderSummaryDto;

const PRIORITY_RANK: Record<string, number> = { critical: 0, high: 1, normal: 2, low: 3 };

function myJobsOf(wo: Wo, userId: string) {
  return wo.jobs.filter((job) => job.status !== 'cancelled' && isMyJob(job.assignedMechanic, userId));
}

function workableOf(wo: Wo, userId: string) {
  return myJobsOf(wo, userId).filter((job) => job.status === 'to_do' && !job.activeBlocker);
}

/** Every Job I still have here is blocked: it waits on the Manager (UX-1-005). */
function onlyBlocked(wo: Wo, userId: string) {
  const todo = myJobsOf(wo, userId).filter((job) => job.status === 'to_do');
  return todo.length > 0 && todo.every((job) => job.activeBlocker);
}

/**
 * Stage MG-3 (docs/proposals/mechanic-standard-redesign §4.2): the General mechanic's home. One primary
 * action — the Truck where my clock runs, or the next work when it runs nowhere; blocked work apart, in
 * amber; paused only when there is some; priority shown only when High or Critical.
 */
export function StandardHome({
  data,
  userId,
  StartAction,
}: {
  data: HomeLists;
  userId: string;
  /** The page's Start / Continue button (it calls the API and opens the Truck). */
  StartAction: (props: { wo: Wo; className?: string; label?: string; variant?: 'default' | 'outline' }) => React.ReactNode;
}) {
  const { messages } = useShopLocale();
  const clockId = data.myClock?.workOrderId ?? null;
  const partDone = (wo: Wo) => isStandardWorkWaitingOnManager(wo) || isMyPartDone(wo, userId);
  const blocked = [...data.active, ...data.created].filter((wo) => !partDone(wo) && onlyBlocked(wo, userId));
  const blockedIds = new Set(blocked.map((wo) => wo.id));
  const waiting = data.active.filter(partDone);
  const inProgress = data.active
    .filter((wo) => !partDone(wo) && !blockedIds.has(wo.id))
    .sort((left, right) => (left.id === clockId ? -1 : right.id === clockId ? 1 : (PRIORITY_RANK[left.priority] ?? 2) - (PRIORITY_RANK[right.priority] ?? 2)));
  const ready = data.created.filter((wo) => !blockedIds.has(wo.id));

  // UX-4-001: one primary action. With the clock running it is that Truck; otherwise the next work, in this
  // order: a resolved blocker, yesterday's open work, the most urgent in progress, then Ready to start.
  const nextId = clockId && inProgress.some((wo) => wo.id === clockId)
    ? clockId
    : (inProgress.find((wo) => wo.resolvedBlockerAwaitingContinue && workableOf(wo, userId).length)
      ?? inProgress.find((wo) => wo.myClockStopped?.reason === 'day_close' && workableOf(wo, userId).length)
      ?? inProgress.find((wo) => workableOf(wo, userId).length)
      ?? ready[0])?.id ?? null;

  const nothing = !inProgress.length && !ready.length && !blocked.length && !waiting.length && !data.paused.length;
  if (nothing) {
    return (
      <EmptyState>
        <p className="font-medium text-foreground">{messages.noJobsAssignedYet}</p>
        <p className="mt-1">{messages.noJobsAssignedHint}</p>
      </EmptyState>
    );
  }

  return (
    <div className="space-y-6" data-testid="standard-home">
      <Section title={messages.activeJobsTitle} count={inProgress.length} testId="home-in-progress" cards>
        {inProgress.length ? inProgress.map((wo) => (
          <WorkCard key={wo.id} wo={wo} userId={userId} clockHere={wo.id === clockId} primary={wo.id === nextId} StartAction={StartAction} />
        )) : <EmptyState>{messages.noActiveJobs}</EmptyState>}
      </Section>

      {ready.length ? (
        <Section title={messages.readyToStart} count={ready.length} hint={messages.mostUrgentFirst} testId="home-ready" cards>
          {ready.map((wo) => <WorkCard key={wo.id} wo={wo} userId={userId} ready primary={wo.id === nextId} StartAction={StartAction} />)}
        </Section>
      ) : null}

      {blocked.length ? (
        <Section title={messages.blockedSectionTitle} count={blocked.length} hint={messages.blockedSectionHint} testId="home-blocked" cards>
          {blocked.map((wo) => <BlockedCard key={wo.id} wo={wo} userId={userId} />)}
        </Section>
      ) : null}

      {waiting.length ? (
        <Section title={messages.waitingOnManager} count={waiting.length} hint={messages.waitingOnManagerHint(waiting.length)} testId="home-waiting">
          <ul className="divide-y rounded-xl border bg-card">
            {waiting.map((wo) => (
              <li key={wo.id}>
                <Link href={`/work-orders/${wo.id}`} className="flex min-h-11 items-center gap-3 px-3 py-2 text-sm hover:bg-accent/40">
                  <Check aria-hidden="true" className="size-4 shrink-0 text-success" />
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{messages.truckTitle(wo.truckNumber)}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {messages.yourPartDone(myJobsOf(wo, userId).map((job) => jobDisplayName(job, messages.helperJobSuffix)).join(', '))}
                    </span>
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">{wo.displayId}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {data.paused.length ? (
        <Section title={messages.pausedJobsTitle} count={data.paused.length} testId="home-paused" cards>
          {data.paused.map((wo) => <WorkCard key={wo.id} wo={wo} userId={userId} paused StartAction={StartAction} />)}
        </Section>
      ) : null}

      {data.completed.length ? (
        <Button asChild variant="secondary" className="w-full">
          <Link href="/mechanic/standard/completed">{messages.viewCompletedWork(data.completed.length)}</Link>
        </Button>
      ) : null}
    </div>
  );
}

function Section({ title, count, hint, testId, cards = false, children }: { title: string; count: number; hint?: string; testId: string; cards?: boolean; children: React.ReactNode }) {
  return (
    <section data-testid={testId}>
      <h2 className="section-title mb-1 flex items-center gap-2">{title}<CountChip>{count}</CountChip></h2>
      {hint ? <p className="mb-2 text-sm text-muted-foreground">{hint}</p> : <div className="mb-2" />}
      {/* D54: on an iPad the cards sit two per row; LTR-271: one alone on its row takes the whole row. */}
      <div className={cards ? 'card-grid' : 'space-y-3'}>{children}</div>
    </section>
  );
}

function HighPriority({ priority }: { priority: string }) {
  const { messages } = useShopLocale();
  if (priority !== 'high' && priority !== 'critical') return null;
  return <PriorityBadge priority={priority}>{messages.priority[priority as keyof typeof messages.priority] ?? priority}</PriorityBadge>;
}

function MyJobList({ wo, userId, nextJobId }: { wo: Wo; userId: string; nextJobId: string | null }) {
  const { messages } = useShopLocale();
  const jobs = myJobsOf(wo, userId);
  if (!jobs.length) return null;
  return (
    <ul className="space-y-2 text-sm">
      {jobs.map((job) => (
        <li key={job.id} className="flex items-start gap-2" aria-current={job.id === nextJobId ? 'step' : undefined}>
          {job.status === 'completed' ? (
            <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
          ) : (
            <span aria-hidden="true" className={cn('mt-1.5 size-2 shrink-0 rounded-full', job.activeBlocker ? 'bg-warning' : 'bg-muted-foreground/60')} />
          )}
          <span className="min-w-0">
            <span className={cn('block', job.status === 'completed' && 'text-muted-foreground line-through')}>
              {jobDisplayName(job, messages.helperJobSuffix)}
              {job.id === nextJobId ? <span className="ml-2 text-xs font-semibold text-primary">{messages.nextJob}</span> : null}
            </span>
            <span className={cn('block text-xs', job.status === 'to_do' && job.activeBlocker ? 'text-warning-foreground dark:text-warning' : 'text-muted-foreground')}>
              {jobPersonLabel(job, userId, messages)}
              {job.status === 'to_do' && job.activeBlocker
                ? ` · ${messages.blockedWithReason(pauseLabel(job.activeBlocker.reason, messages.pauseReason) ?? '')}`
                : ''}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function WorkCard({
  wo,
  userId,
  clockHere = false,
  primary = false,
  ready = false,
  paused = false,
  StartAction,
}: {
  wo: Wo;
  userId: string;
  clockHere?: boolean;
  primary?: boolean;
  ready?: boolean;
  paused?: boolean;
  StartAction: (props: { wo: Wo; className?: string; label?: string; variant?: 'default' | 'outline' }) => React.ReactNode;
}) {
  const { messages } = useShopLocale();
  const workable = workableOf(wo, userId);
  const nextJobId = workable[0]?.id ?? null;
  // UX-4-003: the clock notice is a full-width line inside the card, not a chip by the title.
  const notice = paused
    ? pauseLabel(wo.currentPauseReason, messages.pauseReason)
    : wo.resolvedBlockerAwaitingContinue
      ? messages.resolvedTapContinue
      : !clockHere ? clockStoppedLine(wo.myClockStopped, messages) : null;
  const vehicle = vehicleLine(wo.truckVehicle);
  const viewLabel = messages.workOrderAction(messages.viewShort, wo.displayId, wo.truckNumber);
  return (
    <div
      className={cn('rounded-xl border bg-card', clockHere && 'border-primary ring-1 ring-primary')}
      data-testid={`home-card-${wo.truckNumber}`}
    >
      <div className="space-y-2 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-display text-lg font-semibold">{messages.truckTitle(wo.truckNumber)}</p>
          <HighPriority priority={wo.priority} />
          {clockHere ? (
            <Badge variant="success" className="ml-auto" data-testid="clock-running">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />{messages.clockRunning}
            </Badge>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">{[vehicle, wo.displayId].filter(Boolean).join(' · ')}</p>
        {notice ? (
          <p
            className="flex items-start gap-2 rounded-md bg-muted px-2.5 py-1.5 text-xs font-medium"
            data-testid={wo.resolvedBlockerAwaitingContinue ? 'resolved-tap-continue' : 'clock-stopped-tap-continue'}
          >
            <Play aria-hidden="true" className="mt-px size-3.5 shrink-0" />{notice}
          </p>
        ) : null}
        <MyJobList wo={wo} userId={userId} nextJobId={nextJobId} />
      </div>
      {/* LTR-274: the card's action fills the card's width on every screen (one pattern for mechanic, PM and Safety cards). */}
      <div className="flex gap-2 border-t p-2" data-card-action>
        {clockHere || paused ? (
          <Button asChild variant={clockHere ? 'default' : 'outline'} className="w-full">
            <Link href={`/work-orders/${wo.id}`} aria-label={messages.workOrderAction(messages.viewWork, wo.displayId, wo.truckNumber)}>{messages.viewWork}</Link>
          </Button>
        ) : ready ? (
          <StartAction wo={wo} className="flex-1" variant={primary ? 'default' : 'outline'} />
        ) : nextJobId ? (
          <>
            {/* Block A (MG4): the line says "tap Continue", so the button is Continue. */}
            <StartAction wo={wo} className="flex-1" label={messages.continueWork} variant={primary ? 'default' : 'outline'} />
            <Button asChild variant="outline" className="shrink-0">
              <Link href={`/work-orders/${wo.id}`} aria-label={viewLabel}>{messages.viewShort}</Link>
            </Button>
          </>
        ) : (
          <Button asChild variant="outline" className="w-full">
            <Link href={`/work-orders/${wo.id}`} aria-label={messages.workOrderAction(messages.viewWork, wo.displayId, wo.truckNumber)}>{messages.viewWork}</Link>
          </Button>
        )}
      </div>
    </div>
  );
}

/** UX-1-005 / UX-4-002: a Truck where all I have left is blocked. The whole card opens it; no button. */
function BlockedCard({ wo, userId }: { wo: Wo; userId: string }) {
  const { messages } = useShopLocale();
  const blockedJobs = myJobsOf(wo, userId).filter((job) => job.status === 'to_do' && job.activeBlocker);
  const since = (iso: string) => new Intl.DateTimeFormat(intlLocale(messages.locale), { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
  return (
    <Link
      href={`/work-orders/${wo.id}`}
      className="block space-y-1.5 rounded-xl border border-warning/50 bg-warning-surface p-3 text-sm hover:bg-warning-surface/80"
      data-testid={`home-blocked-${wo.truckNumber}`}
      aria-label={messages.workOrderAction(messages.viewWork, wo.displayId, wo.truckNumber)}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-display text-lg font-semibold">{messages.truckTitle(wo.truckNumber)}</span>
        <HighPriority priority={wo.priority} />
        <span className="ml-auto font-mono text-xs text-muted-foreground">{wo.displayId}</span>
      </div>
      {blockedJobs.map((job) => (
        <p key={job.id} className="flex items-start gap-2 text-warning-foreground dark:text-warning">
          <Hourglass aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            <b className="font-medium">{jobDisplayName(job, messages.helperJobSuffix)}</b>
            {' · '}{pauseLabel(job.activeBlocker!.reason, messages.pauseReason)}
            <span className="block text-xs">{messages.blockedSince(since(job.activeBlocker!.reportedAt))}</span>
          </span>
        </p>
      ))}
    </Link>
  );
}

