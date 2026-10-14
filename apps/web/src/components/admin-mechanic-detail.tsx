'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AppCapability, UserRole, type AdminMechanicDetailDto } from '@ltl-shop/shared';
import { useActionToast } from './action-toast';
import { MechanicAccessCard, MechanicCapabilityEditor } from './admin-mechanic-roster';
import { personTypeLabel } from './admin-mechanics-list';
import { stepLabel } from './admin-shop-workflow';
import { AdminWriteTip } from './admin-write-tip';
import { MechanicAvatar } from './mechanic-avatar';
import { AdminBackLink, PageHeader, Badge, Button, CompactEmpty, EmptyState, InlineAlert, LoadFailure, PageSkeleton, SectionCard } from './ui';
import { ApiError } from '@/lib/api';
import { apiErrorMessage } from '@/lib/api-error-message';
import { useCanShowManagerWrites } from '@/lib/admin-actor';
import { sendAdminMechanicJobsToQueue, updateAdminMechanic, useAdminMechanic } from '@/lib/admin-data';
import { fillPlaceholders } from '@/lib/admin-next-step';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';
import { formatShortDateTime } from '@/lib/work-order-view';

/**
 * LTR-199 / D31: one person of the Shop — a status header, their pending Jobs (send a queue Job back to its team
 * queue; reassign the rest from the Work Order), the step teams they are on, the Jobs they completed lately, name
 * and type, and access (reset password, deactivate, Remove from Shop).
 */
export function AdminMechanicDetail({ id, locale, messages }: { id: string; locale: AdminLocale; messages: AdminMessages }) {
  const canWrite = useCanShowManagerWrites();
  const { data, error, isLoading, mutate } = useAdminMechanic(id);
  const canEditRoster = canWrite && data?.role === UserRole.MECHANIC && !data.removedAt;
  if (isLoading) return <PageSkeleton label={messages.mechanicsTitle} />;
  if (error instanceof ApiError && error.status === 404) {
    return <EmptyState><p>{messages.mechanicNotFound}</p><Button asChild variant="outline" className="mt-4"><Link href="/admin/mechanics">{messages.backToMechanics}</Link></Button></EmptyState>;
  }
  if (error || !data) return <LoadFailure message={messages.loadError} retryLabel={messages.retry} onRetry={() => void mutate()} />;
  const pending = data.pendingJobs.length;

  return (
    <div className="space-y-6">
      <AdminBackLink href="/admin/mechanics">{messages.backToMechanics}</AdminBackLink>
      <div className="flex items-start gap-4">
        <MechanicAvatar id={data.id} name={data.name} size="lg" />
        <PageHeader
          className="min-w-0 flex-1"
          title={data.name}
          subtitle={<>{data.email}<span className="block">{fillPlaceholders(messages.peopleSummaryLine, { pending: String(pending), completed: String(data.completedJobCount) })}</span></>}
          badges={(
            <>
              {data.removedAt ? <Badge variant="secondary">{messages.peopleRemovedBadge}</Badge>
                : data.active ? <Badge variant="success" dot>{messages.peopleActiveBadge}</Badge> : <Badge variant="secondary">{messages.mechanicInactive}</Badge>}
              <Badge variant="outline">{personTypeLabel(data, messages)}</Badge>
              {!canEditRoster && !data.removedAt ? <Badge variant="outline">{messages.readOnly}</Badge> : null}
            </>
          )}
        />
      </div>

      {data.removedAt ? (
        <p className="rounded-xl border bg-muted px-4 py-3 text-sm" data-testid="person-removed">
          {fillPlaceholders(messages.peopleRemovedBanner, {
            date: formatShortDateTime(data.removedAt, locale),
            by: data.removedBy ? fillPlaceholders(messages.peopleRemovedBy, { name: data.removedBy.name }) : '',
          })}
        </p>
      ) : !data.active ? (
        <p className="rounded-xl border border-warning/40 bg-warning-surface px-4 py-3 text-sm text-warning-foreground">
          {fillPlaceholders(messages.peopleInactiveBanner, { name: data.name })}
        </p>
      ) : null}

      {!data.removedAt ? <PendingJobs person={data} canWrite={canEditRoster} messages={messages} onChanged={() => void mutate()} /> : null}

      <SectionCard title={messages.peopleTeamsTitle} count={data.defaultOwnerOfSteps.length}>
        <div className="px-4 py-3 text-sm">
          {data.defaultOwnerOfSteps.length ? (
            <ul className="space-y-1">
              {data.defaultOwnerOfSteps.map((step) => (
                <li key={step.stepKey}>
                  <Link className="tap-inline text-primary hover:underline" href="/admin/setup/workflow">
                    {(step.memberCount ?? 1) > 1
                      ? fillPlaceholders(messages.peopleTeamLine, { step: stepLabel(step.stepKey, messages), count: String(step.memberCount) })
                      : fillPlaceholders(messages.peopleTeamAlone, { step: stepLabel(step.stepKey, messages) })}
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className="text-muted-foreground">{messages.peopleNoTeams}</p>}
        </div>
      </SectionCard>

      {canEditRoster ? <AdminWriteTip testId>{messages.mechanicRosterTip}</AdminWriteTip> : null}
      {canEditRoster ? <MechanicCapabilityEditor mechanic={data} messages={messages} onSaved={() => void mutate()} /> : null}
      {canEditRoster ? <InspectPermissionCard person={data} messages={messages} onSaved={() => void mutate()} /> : null}
      {canEditRoster ? <MechanicAccessCard mechanic={data} messages={messages} onChanged={() => void mutate()} /> : null}

      <SectionCard title={messages.peopleCompletedTitle}>
        <div className="px-4 py-3">
          {data.recentCompletedJobs?.length ? (
            <ul className="divide-y">
              {data.recentCompletedJobs.map((job) => (
                <li key={job.jobId} className="flex flex-wrap items-baseline gap-x-2 py-2 text-sm first:pt-0">
                  <span className="font-medium">{job.displayName}</span>
                  <span className="text-muted-foreground">· {fillPlaceholders(messages.woTitle, { truck: job.truckNumber })}</span>
                  <Link className="tap-inline font-mono text-xs text-muted-foreground hover:text-foreground hover:underline" href={`/admin/work-orders/${job.workOrderId}`}>{job.displayId}</Link>
                  {job.completedAt ? <span className="text-xs text-muted-foreground">· {formatShortDateTime(job.completedAt, locale)}</span> : null}
                </li>
              ))}
            </ul>
          ) : <CompactEmpty>{messages.peopleNoCompleted}</CompactEmpty>}
        </div>
      </SectionCard>
    </div>
  );
}

/** D28 / D31: each pending Job; one from a team queue can go back to it from here. The rest are reassigned on the WO. */
function PendingJobs({ person, canWrite, messages, onChanged }: {
  person: AdminMechanicDetailDto;
  canWrite: boolean;
  messages: AdminMessages;
  onChanged: () => void;
}) {
  const { showToast } = useActionToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasOthers = person.pendingJobs.some((job) => !job.workflowStepKey);

  async function sendBack(jobId: string) {
    setBusy(true);
    setError(null);
    try {
      const result = await sendAdminMechanicJobsToQueue(person.id, [jobId]);
      showToast('success', result.sent
        ? fillPlaceholders(messages.peopleSentToQueue, { count: String(result.sent) })
        : fillPlaceholders(messages.peopleSendSkipped, { count: String(result.skipped) }));
      onChanged();
    } catch (failure) {
      setError(apiErrorMessage(failure, messages, messages.mechanicWriteFailed));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SectionCard title={messages.peoplePendingTitle} count={person.pendingJobs.length} data-testid="person-pending-jobs">
      {person.pendingJobs.length ? (
        <ul className="divide-y">
          {person.pendingJobs.map((job, index) => (
            <li key={job.jobId ?? `${job.workOrderId}-${index}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
              <span className="min-w-0 flex-1">
                <span className="font-medium">{fillPlaceholders(messages.woTitle, { truck: job.truckNumber })} · {job.jobDisplayName}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  <Link className="tap-inline font-mono hover:text-foreground hover:underline" href={`/admin/work-orders/${job.workOrderId}`}>{job.workOrderDisplayId}</Link>
                  {job.workflowStepKey ? ` · ${fillPlaceholders(messages.peopleStepJob, { step: stepLabel(job.workflowStepKey, messages) })}` : null}
                </span>
              </span>
              {canWrite && job.workflowStepKey && job.jobId ? (
                <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void sendBack(job.jobId!)}>
                  {fillPlaceholders(messages.peopleSendToQueue, { step: stepLabel(job.workflowStepKey, messages) })}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : <div className="px-4 py-3"><CompactEmpty>{messages.peopleNoPending}</CompactEmpty></div>}
      {person.runningSession ? <p className="border-t px-4 py-2 text-xs text-warning-foreground">{messages.mechanicOpenWorkRunning}</p> : null}
      {canWrite && hasOthers ? <p className="border-t px-4 py-2 text-xs text-muted-foreground">{messages.peopleReassignHint}</p> : null}
      {error ? <InlineAlert className="m-3">{error}</InlineAlert> : null}
    </SectionCard>
  );
}

/**
 * D41 / HU-M17: "Can inspect trucks", apart from the type (D22). Standard and PM mechanics only: Safety keeps doing
 * only the Quality Check, so the box is not shown for Safety.
 */
function InspectPermissionCard({ person, messages, onSaved }: { person: AdminMechanicDetailDto; messages: AdminMessages; onSaved: () => void }) {
  const { showToast } = useActionToast();
  const [pending, setPending] = useState(false);
  const isMechanic = person.capabilities.includes(AppCapability.MECHANIC_STANDARD) || person.capabilities.includes(AppCapability.MECHANIC_PM);
  if (!isMechanic) return null;
  const checked = person.capabilities.includes(AppCapability.INSPECTION_PERFORM);
  async function toggle(next: boolean) {
    setPending(true);
    try {
      await updateAdminMechanic(person.id, { canInspect: next });
      showToast('success', fillPlaceholders(next ? messages.peopleCanInspectOn : messages.peopleCanInspectOff, { name: person.name }));
      onSaved();
    } catch (failure) {
      showToast('error', apiErrorMessage(failure, messages, messages.peopleCanInspectFailed));
    } finally {
      setPending(false);
    }
  }
  return (
    <SectionCard title={messages.peopleExtraPermissions} data-testid="person-inspect-permission">
      <label className="flex min-h-12 items-start gap-3 p-4">
        <input type="checkbox" className="mt-0.5 size-4 accent-[var(--primary)]" checked={checked} disabled={pending} onChange={(event) => void toggle(event.target.checked)} />
        <span>
          <span className="font-medium">{messages.peopleCanInspect}</span>
          <span className="block text-xs text-muted-foreground">{messages.peopleCanInspectHint}</span>
        </span>
      </label>
    </SectionCard>
  );
}
