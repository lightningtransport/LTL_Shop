'use client';

import { useState, type FormEvent } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { isPmCategory, isQualityCheckJob, type AdminWorkOrderDetailDto } from '@ltl-shop/shared';
import { intlLocale } from '@/lib/shop-locale';
import { formatAdminDate } from '@/lib/admin-format';
import { fillPlaceholders } from '@/lib/admin-next-step';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';
import { jobStatusLabel } from '@/lib/status-chips';
import { jobDisplayName } from '@/lib/job-display-name';
import { externalShopLabel } from '@/lib/external-shop';
import { useCatalogJobs } from '@/lib/shop-data';
import { Badge, Button, CompactEmpty, JobStatusBadge, Modal, Select, Textarea } from './ui';

type Job = AdminWorkOrderDetailDto['jobs'][number];
type Mechanic = { id: string; name: string };
type ExternalKind = 'part' | 'truck';
/** LTR-188: the dialogs this table owns besides the row menu (D23 helper, D24 external shop). */
type JobDialog =
  | { kind: 'helper'; jobId: string }
  | { kind: 'external'; jobId: string }
  | { kind: 'return'; jobId: string };

// Fixed columns on desktop so every row lines up: Job (grows) · Mechanic · Status · Action.
const ROW_GRID = 'lg:grid-cols-[minmax(0,1fr)_13rem_7rem_13rem]';

/**
 * LTR-174: the Jobs of a Work Order as one compact operational table — Job · Mechanic · Status · Action.
 * On phones each row stacks (name and status first, then the controls), the LTR-189 W1 card-row pattern.
 * Every control keeps its existing call: the mechanic Select assigns / unassigns (D11), "Mark complete"
 * is primary only on Quality Check (D15 / D19), the PM job is finished from the PM service (LTR-145),
 * and Cancel / Reopen live behind the row's "…" and keep the reason dialog owned by the detail.
 * LTR-188: the "…" also has "Add helper" (D23) and "Send to external shop" (D24); a Job at an
 * external shop shows where it is and "Returned" (complete it or give it to a mechanic).
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
  onAddHelper,
  onSendExternal,
  onReturnExternal,
  highlightedJobId = null,
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
  onAddHelper?: (jobId: string, mechanicId: string) => void;
  onSendExternal?: (jobId: string, input: { kind: ExternalKind; note: string }) => void;
  onReturnExternal?: (jobId: string, input: { outcome: 'complete' | 'assign'; mechanicId?: string }) => void;
  /** Stage 4 (T4): the Job opened with "Manage in Work Order" (`#job-<id>`), highlighted. */
  highlightedJobId?: string | null;
}) {
  const [menuJobId, setMenuJobId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<JobDialog | null>(null);
  const dialogJob = dialog ? data.jobs.find((job) => job.id === dialog.jobId) : undefined;
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
          const isExternal = Boolean(job.external) && isToDo;
          const canEdit = canManageJobs && isToDo;
          const menuItems = [
            ...(canEdit ? ['cancel' as const] : []),
            ...(canReopenJob && job.status === 'cancelled' ? ['reopen' as const] : []),
            ...(canEdit && onAddHelper && canAddHelper(job) ? ['helper' as const] : []),
            ...(canEdit && onSendExternal && !isQualityCheck && !isExternal ? ['external' as const] : []),
          ];
          const name = jobDisplayName(job, messages.helperJobSuffix);
          const statusBadge = isExternal
            ? <Badge variant="warning" data-testid="admin-wo-job-external">{messages.externalStatus}</Badge>
            : <JobStatusBadge status={job.status}>{jobStatusLabel(job.status, messages)}</JobStatusBadge>;
          const pmSummary = data.pmService?.workOrderJobId === job.id
            ? messages.pmJobServiceSummary
              .replace('{mileage}', data.pmService.observedMileage === null ? messages.noValue : number.format(data.pmService.observedMileage))
              .replace('{parts}', String(data.pmService.partsCount))
            : null;
          return (
            <li key={job.id} id={`job-${job.id}`} className={`grid scroll-mt-24 gap-2 rounded-lg py-3 first:pt-0 lg:items-center lg:gap-3 ${ROW_GRID} ${highlightedJobId === job.id ? 'bg-accent px-2 ring-1 ring-primary' : ''}`} data-testid="admin-wo-job-row" data-highlighted={highlightedJobId === job.id ? 'true' : undefined}>
              {/* Job */}
              <div className="flex min-w-0 items-start justify-between gap-3 lg:block">
                <div className="min-w-0">
                  <p className={job.status === 'cancelled' ? 'font-medium text-muted-foreground line-through' : 'font-medium'}>
                    {job.displayName}
                    {/* LTR-188 / D23: "· helper" comes from the catalogs, never from the stored name. */}
                    {job.helperOfJobId ? <span className="font-normal text-muted-foreground">{messages.helperJobSuffix}</span> : null}
                  </p>
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
                  {statusBadge}
                </div>
              </div>
              {/* Mechanic */}
              <div className="min-w-0 text-sm">
                <MechanicCell
                  job={job}
                  messages={messages}
                  editable={canEdit && !isQualityCheck && !isExternal}
                  disabled={pending}
                  mechanics={withCurrentAssignee(isPmJob ? pmMechanics : assignableMechanics, job.assignedMechanic)}
                  onAssign={onAssign}
                />
              </div>
              {/* Status (desktop column) */}
              <div className="hidden lg:block">
                {statusBadge}
              </div>
              {/* Action: always the same width; the menu keeps its place even when there is no primary action. */}
              <div className="flex items-center gap-2 lg:justify-end">
                {canEdit && isExternal ? (
                  onReturnExternal ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="w-full sm:w-auto lg:w-[9.5rem]"
                      disabled={pending}
                      data-testid="admin-wo-job-returned"
                      onClick={() => setDialog({ kind: 'return', jobId: job.id })}
                    >
                      {pendingAction === `return-external-${job.id}` ? messages.saving : messages.externalReturnedAction}
                    </Button>
                  ) : null
                ) : canEdit ? (
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
                    aria-label={fillPlaceholders(messages.jobRowActions, { job: name })}
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
        <Modal open title={jobDisplayName(menuJob, messages.helperJobSuffix)} closeLabel={messages.closeDialog} onClose={() => setMenuJobId(null)}>
          <div className="space-y-2">
            {canManageJobs && menuJob.status === 'to_do' && onAddHelper && canAddHelper(menuJob) ? (
              <Button type="button" variant="outline" className="w-full" data-testid="admin-wo-job-add-helper" onClick={() => { setMenuJobId(null); setDialog({ kind: 'helper', jobId: menuJob.id }); }}>
                {messages.addHelperAction}
              </Button>
            ) : null}
            {canManageJobs && menuJob.status === 'to_do' && onSendExternal && !menuJob.external && !isQualityCheckJob(menuJob.category.name, menuJob.displayName) ? (
              <Button type="button" variant="outline" className="w-full" data-testid="admin-wo-job-send-external" onClick={() => { setMenuJobId(null); setDialog({ kind: 'external', jobId: menuJob.id }); }}>
                {messages.sendExternalAction}
              </Button>
            ) : null}
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
      {dialog?.kind === 'helper' && dialogJob && onAddHelper ? (
        <AddHelperDialog
          job={dialogJob}
          messages={messages}
          mechanics={assignableMechanics.filter((mechanic) => mechanic.id !== dialogJob.assignedMechanic?.id)}
          disabled={pending}
          onClose={() => setDialog(null)}
          onConfirm={(mechanicId) => { setDialog(null); onAddHelper(dialogJob.id, mechanicId); }}
        />
      ) : null}
      {dialog?.kind === 'external' && dialogJob && onSendExternal ? (
        <SendExternalDialog
          job={dialogJob}
          messages={messages}
          disabled={pending}
          onClose={() => setDialog(null)}
          onConfirm={(input) => { setDialog(null); onSendExternal(dialogJob.id, input); }}
        />
      ) : null}
      {dialog?.kind === 'return' && dialogJob && onReturnExternal ? (
        <ReturnExternalDialog
          job={dialogJob}
          messages={messages}
          mechanics={isPmCategory(dialogJob.category.name) ? pmMechanics : assignableMechanics}
          disabled={pending}
          onClose={() => setDialog(null)}
          onConfirm={(input) => { setDialog(null); onReturnExternal(dialogJob.id, input); }}
        />
      ) : null}
    </div>
  );
}

/** LTR-188 / D23: a helper goes on a pending Job that is not the PM job, the Quality Check or a helper Job. */
function canAddHelper(job: Job): boolean {
  return job.status === 'to_do'
    && !job.external
    && !job.helperOfJobId
    && !isPmCategory(job.category.name)
    && !isQualityCheckJob(job.category.name, job.displayName);
}

function AddHelperDialog({ job, messages, mechanics, disabled, onClose, onConfirm }: {
  job: Job;
  messages: AdminMessages;
  mechanics: Mechanic[];
  disabled: boolean;
  onClose: () => void;
  onConfirm: (mechanicId: string) => void;
}) {
  const [mechanicId, setMechanicId] = useState('');
  const submit = (event: FormEvent) => { event.preventDefault(); if (mechanicId) onConfirm(mechanicId); };
  return (
    <Modal open title={fillPlaceholders(messages.addHelperTitle, { job: job.displayName })} closeLabel={messages.closeDialog} onClose={onClose}>
      <form className="space-y-3" onSubmit={submit} data-testid="admin-wo-add-helper-dialog">
        <p className="text-sm text-muted-foreground">{fillPlaceholders(messages.addHelperHelp, { job: job.displayName })}</p>
        {mechanics.length ? (
          <label className="block space-y-1">
            <span className="text-sm font-medium">{messages.addHelperMechanic}</span>
            <Select aria-label={messages.addHelperMechanic} value={mechanicId} disabled={disabled} onChange={(event) => setMechanicId(event.target.value)}>
              <option value="">{messages.addHelperChoose}</option>
              {mechanics.map((mechanic) => <option key={mechanic.id} value={mechanic.id}>{mechanic.name}</option>)}
            </Select>
          </label>
        ) : <CompactEmpty>{messages.addHelperNoMechanics}</CompactEmpty>}
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>{messages.cancel}</Button>
          <Button type="submit" className="flex-1" disabled={disabled || !mechanicId}>{messages.addHelperConfirm}</Button>
        </div>
      </form>
    </Modal>
  );
}

function SendExternalDialog({ job, messages, disabled, onClose, onConfirm }: {
  job: Job;
  messages: AdminMessages;
  disabled: boolean;
  onClose: () => void;
  onConfirm: (input: { kind: ExternalKind; note: string }) => void;
}) {
  const [kind, setKind] = useState<ExternalKind>('part');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!note.trim()) { setError(messages.sendExternalNoteRequired); return; }
    onConfirm({ kind, note: note.trim() });
  };
  return (
    <Modal open title={fillPlaceholders(messages.sendExternalTitle, { job: job.displayName })} closeLabel={messages.closeDialog} onClose={onClose}>
      <form className="space-y-3" onSubmit={submit} data-testid="admin-wo-send-external-dialog">
        <p className="text-sm text-muted-foreground">{messages.sendExternalHelp}</p>
        <fieldset className="space-y-1" disabled={disabled}>
          <legend className="text-sm font-medium">{messages.sendExternalWhat}</legend>
          {([['part', messages.sendExternalPart], ['truck', messages.sendExternalTruck]] as const).map(([value, label]) => (
            <label key={value} className="flex min-h-11 items-center gap-3 text-sm">
              <input type="radio" name={`external-kind-${job.id}`} value={value} checked={kind === value} onChange={() => setKind(value)} />
              {label}
            </label>
          ))}
        </fieldset>
        <label className="block space-y-1">
          <span className="text-sm font-medium">{messages.sendExternalNote}</span>
          <Textarea
            aria-label={messages.sendExternalNote}
            rows={3}
            maxLength={1000}
            value={note}
            disabled={disabled}
            onChange={(event) => { setNote(event.target.value); setError(null); }}
          />
        </label>
        {error ? <p className="text-sm font-medium text-destructive-text" role="alert">{error}</p> : null}
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>{messages.cancel}</Button>
          <Button type="submit" className="flex-1" disabled={disabled}>{messages.sendExternalConfirm}</Button>
        </div>
      </form>
    </Modal>
  );
}

function ReturnExternalDialog({ job, messages, mechanics, disabled, onClose, onConfirm }: {
  job: Job;
  messages: AdminMessages;
  mechanics: Mechanic[];
  disabled: boolean;
  onClose: () => void;
  onConfirm: (input: { outcome: 'complete' | 'assign'; mechanicId?: string }) => void;
}) {
  const [outcome, setOutcome] = useState<'complete' | 'assign'>('complete');
  const [mechanicId, setMechanicId] = useState('');
  const ready = outcome === 'complete' || Boolean(mechanicId);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!ready) return;
    onConfirm(outcome === 'assign' ? { outcome, mechanicId } : { outcome });
  };
  return (
    <Modal open title={fillPlaceholders(messages.externalReturnTitle, { job: job.displayName })} closeLabel={messages.closeDialog} onClose={onClose}>
      <form className="space-y-3" onSubmit={submit} data-testid="admin-wo-return-external-dialog">
        {job.external?.note ? <p className="text-sm text-muted-foreground">{job.external.note}</p> : null}
        <fieldset className="space-y-1" disabled={disabled}>
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input type="radio" name={`external-return-${job.id}`} value="complete" checked={outcome === 'complete'} onChange={() => setOutcome('complete')} />
            {messages.externalReturnComplete}
          </label>
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input type="radio" name={`external-return-${job.id}`} value="assign" checked={outcome === 'assign'} onChange={() => setOutcome('assign')} />
            {messages.externalReturnAssign}
          </label>
        </fieldset>
        {outcome === 'assign' ? (
          <Select aria-label={messages.externalReturnAssign} value={mechanicId} disabled={disabled} onChange={(event) => setMechanicId(event.target.value)}>
            <option value="">{messages.addHelperChoose}</option>
            {mechanics.map((mechanic) => <option key={mechanic.id} value={mechanic.id}>{mechanic.name}</option>)}
          </Select>
        ) : null}
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>{messages.cancel}</Button>
          <Button type="submit" className="flex-1" disabled={disabled || !ready}>{messages.externalReturnConfirm}</Button>
        </div>
      </form>
    </Modal>
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
  // LTR-188 / D24: where it is instead of an owner; the note is the tooltip.
  if (job.external && job.status === 'to_do') {
    return <span className="text-muted-foreground" title={job.external.note} data-testid="admin-wo-job-external-where">{externalShopLabel(job.external.kind, messages)}</span>;
  }
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
