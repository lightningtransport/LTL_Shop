'use client';

import { useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { isPmCategory, isQualityCheckJob, type AdminWorkOrderDetailDto } from '@ltl-shop/shared';
import { intlLocale } from '@/lib/shop-locale';
import { formatAdminDate } from '@/lib/admin-format';
import { fillPlaceholders } from '@/lib/admin-next-step';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';
import { jobStatusLabel } from '@/lib/status-chips';
import { useCatalogJobs } from '@/lib/shop-data';
import { Button, CompactEmpty, JobStatusBadge, Modal, Select } from './ui';

type Job = AdminWorkOrderDetailDto['jobs'][number];
type Mechanic = { id: string; name: string };

// Fixed columns on desktop so every row lines up: Job (grows) · Mechanic · Status · Action.
const ROW_GRID = 'lg:grid-cols-[minmax(0,1fr)_13rem_7rem_13rem]';

/**
 * LTR-174: the Jobs of a Work Order as one compact operational table — Job · Mechanic · Status · Action.
 * On phones each row stacks (name and status first, then the controls), the LTR-189 W1 card-row pattern.
 * Every control keeps its existing call: the mechanic Select assigns / unassigns (D11), "Mark complete"
 * is primary only on Quality Check (D15 / D19), the PM job is finished from the PM service (LTR-145),
 * and Cancel / Reopen live behind the row's "…" and keep the reason dialog owned by the detail.
 */
export function AdminJobTable({
  data,
  locale,
  messages,
  canManageJobs,
  canReopenJob,
  pendingAction,
  pmMechanics,
  assignableMechanics,
  onAssign,
  onComplete,
  onPmServiceChange,
  onJobDialog,
}: {
  data: AdminWorkOrderDetailDto;
  locale: AdminLocale;
  messages: AdminMessages;
  canManageJobs: boolean;
  canReopenJob: boolean;
  pendingAction: string | null;
  pmMechanics: Mechanic[];
  assignableMechanics: Mechanic[];
  /** Empty `mechanicId` unassigns. */
  onAssign: (jobId: string, mechanicId: string) => void;
  onComplete: (jobId: string) => void;
  onPmServiceChange: (jobId: string, catalogJobId: string) => void;
  onJobDialog: (kind: 'cancel' | 'reopen', jobId: string) => void;
}) {
  const [menuJobId, setMenuJobId] = useState<string | null>(null);
  const pending = Boolean(pendingAction);
  const menuJob = menuJobId ? data.jobs.find((job) => job.id === menuJobId) : undefined;
  const number = new Intl.NumberFormat(intlLocale(locale));

  if (!data.jobs.length) return <CompactEmpty>{messages.noJobs}</CompactEmpty>;

  return (
    <div>
      <div className={`hidden border-b pb-2 text-xs text-muted-foreground lg:grid lg:gap-3 ${ROW_GRID}`} aria-hidden="true">
        <span>{messages.jobTableJob}</span>
        <span>{messages.jobTableMechanic}</span>
        <span>{messages.jobTableStatus}</span>
        <span className="text-right">{messages.jobTableAction}</span>
      </div>
      <ul className="divide-y" aria-label={messages.jobs}>
        {data.jobs.map((job) => {
          const isToDo = job.status === 'to_do';
          const isPmJob = isPmCategory(job.category.name);
          const isQualityCheck = isQualityCheckJob(job.category.name, job.displayName);
          const isTerminal = job.status === 'completed' || job.status === 'cancelled';
          const canEdit = canManageJobs && isToDo;
          const menuItems = [
            ...(canEdit ? ['cancel' as const] : []),
            ...(canReopenJob && job.status === 'cancelled' ? ['reopen' as const] : []),
          ];
          const pmSummary = data.pmService?.workOrderJobId === job.id
            ? messages.pmJobServiceSummary
              .replace('{mileage}', data.pmService.observedMileage === null ? messages.noValue : number.format(data.pmService.observedMileage))
              .replace('{parts}', String(data.pmService.partsCount))
            : null;
          return (
            <li key={job.id} className={`grid gap-2 py-3 first:pt-0 lg:items-center lg:gap-3 ${ROW_GRID}`} data-testid="admin-wo-job-row">
              {/* Job */}
              <div className="flex min-w-0 items-start justify-between gap-3 lg:block">
                <div className="min-w-0">
                  <p className={job.status === 'cancelled' ? 'font-medium text-muted-foreground line-through' : 'font-medium'}>{job.displayName}</p>
                  <p className="text-xs text-muted-foreground">{job.category.name}</p>
                  {job.customDescription ? <p className="mt-1 text-sm text-muted-foreground">{job.customDescription}</p> : null}
                  {/* LTR-145: the PM job is finished from the PM service, so the hint sits with the Job. */}
                  {canEdit && isPmJob && !isTerminal ? <p className="mt-1 text-xs text-muted-foreground">{messages.pmJobCompletedFromPmService}</p> : null}
                  {isPmJob && job.startedAt && !isTerminal ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {messages.pmJobStartedAt.replace('{date}', formatAdminDate(job.startedAt, locale))}
                      {pmSummary ? ` · ${pmSummary}` : ''}
                    </p>
                  ) : null}
                  {/* LTR-148: a finished PM job keeps its recorded mileage and parts visible. */}
                  {isPmJob && job.status === 'completed' && pmSummary ? <p className="mt-1 text-xs text-muted-foreground">{pmSummary}</p> : null}
                  {job.completionNotes ? <p className="mt-1 whitespace-pre-wrap text-sm">{messages.jobCompletionNotes}: {job.completionNotes}</p> : null}
                </div>
                {/* Phones: the status sits next to the name; desktop has its own column below. */}
                <div className="shrink-0 lg:hidden">
                  <JobStatusBadge status={job.status}>{jobStatusLabel(job.status, messages)}</JobStatusBadge>
                </div>
              </div>
              {/* Mechanic */}
              <div className="min-w-0 text-sm">
                <MechanicCell
                  job={job}
                  messages={messages}
                  editable={canEdit && !isQualityCheck}
                  disabled={pending}
                  mechanics={withCurrentAssignee(isPmJob ? pmMechanics : assignableMechanics, job.assignedMechanic)}
                  onAssign={onAssign}
                />
              </div>
              {/* Status (desktop column) */}
              <div className="hidden lg:block">
                <JobStatusBadge status={job.status}>{jobStatusLabel(job.status, messages)}</JobStatusBadge>
              </div>
              {/* Action: always the same width; the menu keeps its place even when there is no primary action. */}
              <div className="flex items-center gap-2 lg:justify-end">
                {canEdit ? (
                  isPmJob ? (
                    <PmServiceSelect
                      job={job}
                      messages={messages}
                      disabled={pending}
                      onChange={(catalogJobId) => onPmServiceChange(job.id, catalogJobId)}
                    />
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      className="w-full sm:w-auto lg:w-[9.5rem]"
                      // LTR-164 (#2) / D15 / D19: primary only on Quality Check (the Manager's fallback for Safety).
                      variant={isQualityCheck ? 'default' : 'outline'}
                      disabled={pending}
                      onClick={() => onComplete(job.id)}
                    >
                      {pendingAction === `complete-job-${job.id}` ? messages.saving : messages.completeJobAction}
                    </Button>
                  )
                ) : null}
                {menuItems.length ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-9 shrink-0"
                    aria-label={fillPlaceholders(messages.jobRowActions, { job: job.displayName })}
                    disabled={pending}
                    onClick={() => setMenuJobId(job.id)}
                  >
                    <MoreHorizontal aria-hidden="true" className="size-5" />
                  </Button>
                ) : <span aria-hidden="true" className="hidden size-9 shrink-0 lg:block" />}
              </div>
            </li>
          );
        })}
      </ul>
      {menuJob ? (
        <Modal open title={menuJob.displayName} closeLabel={messages.closeDialog} onClose={() => setMenuJobId(null)}>
          <div className="space-y-2">
            {canManageJobs && menuJob.status === 'to_do' ? (
              <Button type="button" variant="outline" className="w-full" onClick={() => { setMenuJobId(null); onJobDialog('cancel', menuJob.id); }}>
                {messages.cancelJobAction}
              </Button>
            ) : null}
            {canReopenJob && menuJob.status === 'cancelled' ? (
              <Button type="button" variant="outline" className="w-full" onClick={() => { setMenuJobId(null); onJobDialog('reopen', menuJob.id); }}>
                {messages.reopenJobAction}
              </Button>
            ) : null}
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function MechanicCell({
  job,
  messages,
  editable,
  disabled,
  mechanics,
  onAssign,
}: {
  job: Job;
  messages: AdminMessages;
  editable: boolean;
  disabled: boolean;
  mechanics: Mechanic[];
  onAssign: (jobId: string, mechanicId: string) => void;
}) {
  const isQualityCheck = isQualityCheckJob(job.category.name, job.displayName);
  if (editable) {
    return (
      <Select
        aria-label={fillPlaceholders(messages.assignJobMechanicFor, { job: job.displayName })}
        className="h-9 w-full text-sm"
        value={job.assignedMechanic?.id ?? ''}
        disabled={disabled}
        onChange={(event) => { if (event.target.value !== (job.assignedMechanic?.id ?? '')) onAssign(job.id, event.target.value); }}
      >
        <option value="">{messages.jobUnassigned}</option>
        {mechanics.map((mechanic) => <option key={mechanic.id} value={mechanic.id}>{mechanic.name}</option>)}
      </Select>
    );
  }
  if (job.status === 'completed') {
    return job.completedBy ? <span className="text-muted-foreground">{messages.completedByLabel}: {job.completedBy.name}</span> : null;
  }
  const text = job.assignedMechanic
    ? `${messages.jobAssignee}: ${job.assignedMechanic.name}`
    : isPmCategory(job.category.name) ? messages.pmJobUnassigned : messages.jobUnassigned;
  // LTR-164 (#2) / D19: Quality Check has no picker — Safety takes it from their own screen.
  return <span className="text-muted-foreground" title={isQualityCheck ? messages.workPlanQcHint : undefined}>{text}</span>;
}

/** Keep the current owner selectable even when they are no longer in the assignable list. */
function withCurrentAssignee(mechanics: Mechanic[], current: Mechanic | null | undefined): Mechanic[] {
  if (!current || mechanics.some((mechanic) => mechanic.id === current.id)) return mechanics;
  return [current, ...mechanics];
}

/** LTR-145: PM A ↔ PM B for the PM job (PM Category catalog jobs). */
function PmServiceSelect({ job, messages, disabled, onChange }: {
  job: Job;
  messages: AdminMessages;
  disabled: boolean;
  onChange: (catalogJobId: string) => void;
}) {
  const { data: pmJobs } = useCatalogJobs(job.category.id, true);
  const options = (pmJobs ?? []).filter((item) => /^PM [A-Z] Service$/i.test(item.displayName) || item.id === job.catalogJobId);
  if (options.length < 2) return null;
  return (
    <Select
      aria-label={messages.pmServiceVariant}
      title={messages.pmJobCompletedFromPmService}
      className="h-9 w-full sm:w-auto lg:w-[9.5rem]"
      value={job.catalogJobId ?? ''}
      disabled={disabled}
      onChange={(event) => { if (event.target.value && event.target.value !== job.catalogJobId) onChange(event.target.value); }}
    >
      {options.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}
    </Select>
  );
}
