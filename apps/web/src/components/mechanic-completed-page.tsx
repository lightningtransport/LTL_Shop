'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MechanicMode, type WorkOrderSummaryDto } from '@ltl-shop/shared';
import { useAuth } from '@/lib/auth-context';
import { useShopLocale } from '@/lib/locale-context';
import { replaceAppLocation } from '@/lib/session-restore';
import { useWorkOrders } from '@/lib/shop-data';
import { myCompletedJobs } from '@/lib/my-completed-jobs';
import { jobCategoriesLine, vehicleLine } from '@/lib/work-order-identity';
import { SessionSignInFallback } from './session-sign-in-fallback';
import { Check, ChevronRight } from 'lucide-react';
import { formatMileage } from '@/lib/format';
import { Card, CardListSkeleton, CountChip, EmptyState, HomeTopBar, LoadFailure, PageHeader } from './ui';
import { intlLocale } from '@/lib/shop-locale';

/** LTR-133: completed work has its own screen in both mechanic workspaces. */
export function MechanicCompletedPage({ mode }: { mode: MechanicMode }) {
  const { token, sessionLoading, user } = useAuth();
  const { messages } = useShopLocale();
  const router = useRouter();
  const isPm = mode === MechanicMode.PM;
  const { data, error, mutate } = useWorkOrders(!!token, isPm ? 'pm' : 'standard');

  useEffect(() => {
    if (!sessionLoading && !token) replaceAppLocation('/login', router);
  }, [sessionLoading, token, router]);
  if (!sessionLoading && !token) return <SessionSignInFallback />;

  const completed = data?.completed ?? [];
  // LTR-189 (W11): a Standard mechanic sees the Jobs they completed (the Work Order may still be open);
  // the PM workspace keeps listing finished PM services.
  const myGroups = isPm ? [] : myCompletedJobs(data, user?.id ?? '');
  const isEmpty = isPm ? !completed.length : !myGroups.length;
  return (
    <div>
      <HomeTopBar mode={mode} />
      <PageHeader className="mb-6" title={messages.mechanicCompletedTitle} subtitle={isPm ? messages.pmCompletedSubtitle : messages.mechanicCompletedSubtitle} />
      {error ? <LoadFailure message={messages.unableToLoadWorkOrders} onRetry={() => void mutate()} retryLabel={messages.retry} /> : null}
      {!data && !error ? <CardListSkeleton /> : null}
      {data && isEmpty ? <EmptyState>{messages.noCompletedWork}</EmptyState> : null}
      {isPm ? null : <CompletedByDay groups={myGroups} />}
      {isPm ? <PmCompletedByDay items={completed} /> : null}
    </div>
  );
}

type CompletedGroups = ReturnType<typeof myCompletedJobs>;

/**
 * Stage MG-6 (UX-1-011): my completed Jobs by day (Today, Yesterday, Earlier), each with the time it was
 * closed and its closing note, so "when did I finish this and what did I write" has an answer.
 */
function CompletedByDay({ groups }: { groups: CompletedGroups }) {
  const { messages } = useShopLocale();
  const dayOf = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(iso));
  const today = dayOf(new Date().toISOString());
  const yesterday = dayOf(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  const time = (iso: string) => new Intl.DateTimeFormat(intlLocale(messages.locale), { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
  const rows = groups
    .flatMap(({ wo, jobs }) => jobs.map((job) => ({ wo, job, at: (job as { completedAt?: string | null }).completedAt ?? null, note: (job as { completionNotes?: string | null }).completionNotes ?? null })))
    .sort((left, right) => (right.at ?? '').localeCompare(left.at ?? ''));
  const sections = [
    { label: messages.completedToday, rows: rows.filter((row) => row.at && dayOf(row.at) === today) },
    { label: messages.completedYesterday, rows: rows.filter((row) => row.at && dayOf(row.at) === yesterday) },
    { label: messages.completedEarlier, rows: rows.filter((row) => !row.at || (dayOf(row.at) !== today && dayOf(row.at) !== yesterday)) },
  ].filter((section) => section.rows.length);
  return (
    <div className="space-y-4" data-testid="completed-by-day">
      {sections.map((section) => (
        <section key={section.label}>
          <h2 className="mb-1 flex items-center gap-2 text-sm font-medium text-muted-foreground">{section.label}<CountChip>{section.rows.length}</CountChip></h2>
          <ul className="divide-y rounded-xl border bg-card">
            {section.rows.map(({ wo, job, at, note }) => (
              <li key={job.id}>
                <Link href={`/work-orders/${wo.id}`} className="flex items-start gap-3 px-3 py-3 text-sm hover:bg-accent/40" data-testid="completed-job">
                  <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="font-medium">{job.displayName}</span>
                      {at ? <span className="tnum shrink-0 text-xs text-muted-foreground">{time(at)}</span> : null}
                    </span>
                    <span className="block text-xs text-muted-foreground">{messages.truckTitle(wo.truckNumber)} · <span className="font-mono">{wo.displayId}</span></span>
                    <span className={note ? 'block truncate italic' : 'block text-xs text-muted-foreground'}>{note ? `“${note}”` : messages.noClosingNote}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** Stage PM-4 (UX-1-007): finished PM services by day, each with its date, mileage and parts. */
function PmCompletedByDay({ items }: { items: WorkOrderSummaryDto[] }) {
  const { messages } = useShopLocale();
  const dayOf = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(iso));
  const today = dayOf(new Date().toISOString());
  const yesterday = dayOf(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  const dateLabel = (iso: string) => new Intl.DateTimeFormat(intlLocale(messages.locale), { timeZone: 'America/New_York', month: 'short', day: 'numeric' }).format(new Date(iso));
  const rows = items
    .map((wo) => ({ wo, at: wo.pmJob?.completedAt ?? wo.startedAt ?? wo.createdAt }))
    .sort((left, right) => right.at.localeCompare(left.at));
  const groups = [
    { label: messages.completedToday, rows: rows.filter((row) => dayOf(row.at) === today) },
    { label: messages.completedYesterday, rows: rows.filter((row) => dayOf(row.at) === yesterday) },
    { label: messages.completedEarlier, rows: rows.filter((row) => dayOf(row.at) !== today && dayOf(row.at) !== yesterday) },
  ].filter((group) => group.rows.length);
  return (
    <div className="space-y-4" data-testid="pm-completed-by-day">
      {groups.map((group) => (
        <section key={group.label}>
          <h2 className="mb-1 flex items-center gap-2 text-sm font-medium text-muted-foreground">{group.label}<CountChip>{group.rows.length}</CountChip></h2>
          <ul className="divide-y rounded-xl border bg-card">
            {group.rows.map(({ wo, at }) => (
              <li key={wo.id}>
                <Link href={`/work-orders/${wo.id}${wo.pmJob ? '?view=pm' : ''}`} className="flex items-center gap-3 px-3 py-3 text-sm hover:bg-accent/40">
                  <Check aria-hidden="true" className="size-4 shrink-0 text-success" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{[messages.truckTitle(wo.truckNumber), wo.pmJob?.displayName?.replace(/ Service$/i, ''), wo.displayId].filter(Boolean).join(' · ')}</span>
                    <span className="block text-xs text-muted-foreground">
                      {messages.pmCompletedLine(dateLabel(at), wo.pmJob?.observedMileage == null ? messages.mileageNotRecorded : formatMileage(wo.pmJob.observedMileage), wo.pmJob?.partsCount ?? 0)}
                    </span>
                  </span>
                  <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
