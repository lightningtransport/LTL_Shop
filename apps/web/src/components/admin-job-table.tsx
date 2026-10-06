'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { DropdownMenu } from 'radix-ui';
import { ChevronDown, MoreHorizontal } from 'lucide-react';
import { isPmCategory, isQualityCheckJob, type AdminWorkOrderDetailDto } from '@ltl-shop/shared';
import { intlLocale } from '@/lib/shop-locale';
import { formatAdminDate } from '@/lib/admin-format';
import { fillPlaceholders } from '@/lib/admin-next-step';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';
import { jobStatusLabel } from '@/lib/status-chips';
import { jobDisplayName } from '@/lib/job-display-name';
import { externalShopLabel } from '@/lib/external-shop';
import { useCatalogJobs } from '@/lib/shop-data';
import { profileInitials } from '@/lib/profile-initials';
import { MechanicPicker } from './mechanic-picker';
import { orderJobs } from '@/lib/work-order-jobs';
import { Button, CompactEmpty, Modal, Select, Textarea } from './ui';

type Job = AdminWorkOrderDetailDto['jobs'][number];
type Mechanic = { id: string; name: string };
type ExternalKind = 'part' | 'truck';
/** LTR-188: the dialogs this table owns besides the row menu (D23 helper, D24 external shop). */
type JobDialog =
  | { kind: 'helper'; jobId: string }
  | { kind: 'external'; jobId: string }
  | { kind: 'return'; jobId: string };

// Fixed columns on desktop so every row lines up: Job (grows) · Mechanic · Status · Action.
const ROW_GRID = 'lg:grid-cols-[minmax(0,1fr)_13rem_8rem_13rem]';

const MENU_ITEM = 'flex min-h-11 cursor-pointer select-none items-center rounded-lg px-3 text-sm outline-none data-[highlighted]:bg-accent';

const DOT: Record<string, string> = {
  blocked: 'bg-warning',
  external: 'bg-warning',
  completed: 'bg-shop-success',
  cancelled: 'bg-muted-foreground',
  to_do: 'border border-muted-foreground bg-transparent',
};

/**
 * LTR-174 / Stage 5 (R3, R5): the Jobs of a Work Order — Job · Mechanic · Status · Action. Open Jobs
 * first, the blocked ones on top with an amber edge; a helper right under its Job; Jobs at an external
 * shop after the shop's work and Quality Check last. Done and cancelled Jobs are grouped and folded.
 * Status is a dot and a word. The mechanic is a picker with search ("Unassign" included, D11); "Mark
 * complete" stays one tap and is primary only on Quality Check (D15 / D19); the PM job is finished
 * from the PM service (LTR-145). The row's "…" is a menu: Add helper (D23), Send to external shop
 * (D24), Cancel / Reopen (the reason dialog is the detail's). A Job at an external shop shows where it
 * is and "Returned" (complete it or give it to a mechanic).
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
  blockedJobIds = [],
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
  /** Stage 5: Jobs with an active mechanic blocker (they go on top). */
  blockedJobIds?: string[];
}) {
  const [dialog, setDialog] = useState<JobDialog | null>(null);
  const [pickerJobId, setPickerJobId] = useState<string | null>(null);
  const [closedOpen, setClosedOpen] = useState(false);
  // Stage 4/5 (T4): the Job asked for with `#job-<id>` comes into view — its group opens if it is done or cancelled.
  useEffect(() => {
    if (!highlightedJobId) return;
    if (data.jobs.some((job) => job.id === highlightedJobId && job.status !== 'to_do')) setClosedOpen(true);
    const timer = window.setTimeout(() => document.getElementById(`job-${highlightedJobId}`)?.scrollIntoView({ block: 'center' }), 50);
    return () => window.clearTimeout(timer);
    // Only when a Job is asked for, not on every refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightedJobId]);
  const dialogJob = dialog ? data.jobs.find((job) => job.id === dialog.jobId) : undefined;
  const pending = Boolean(pendingAction);
  const number = new Intl.NumberFormat(intlLocale(locale));
  const { open, closed } = useMemo(() => orderJobs(data.jobs, blockedJobIds), [data.jobs, blockedJobIds]);

  if (!data.jobs.length) return <CompactEmpty>{messages.noJobs}</CompactEmpty>;

  function renderRow(job: Job) {
    const isToDo = job.status === 'to_do';
    const isPmJob = isPmCategory(job.category.name);
    const isQualityCheck = isQualityCheckJob(job.category.name, job.displayName);
    const isTerminal = job.status === 'completed' || job.status === 'cancelled';
    const isExternal = Boolean(job.external) && isToDo;
    const isBlocked = isToDo && blockedJobIds.includes(job.id);
    const canEdit = canManageJobs && isToDo;
    const canHelp = canEdit && Boolean(onAddHelper) && canAddHelper(job);
    const canSendOut = canEdit && Boolean(onSendExternal) && !isQualityCheck && !isExternal;
    const canReopen = canReopenJob && job.status === 'cancelled';
    const hasMenu = canEdit || canReopen || canHelp || canSendOut;
    const name = jobDisplayName(job, messages.helperJobSuffix);
    const state = isExternal ? 'external' : isBlocked ? 'blocked' : job.status;
    const statusText = isExternal ? messages.externalStatus : isBlocked ? messages.blocked : jobStatusLabel(job.status, messages);
    const status = (
      <span className="inline-flex items-center gap-1.5 text-sm" data-testid={isExternal ? 'admin-wo-job-external' : undefined} data-status={state}>
        <span aria-hidden="true" className={`size-2.5 shrink-0 rounded-full ${DOT[state] ?? DOT.to_do}`} />
        {statusText}
      </span>
    );
    const pmSummary = data.pmService?.workOrderJobId === job.id
      ? messages.pmJobServiceSummary
        .replace('{mileage}', data.pmService.observedMileage === null ? messages.noValue : number.format(data.pmService.observedMileage))
        .replace('{parts}', String(data.pmService.partsCount))
      : null;
    const highlighted = highlightedJobId === job.id;
    return (
      <li
        key={job.id}
        id={`job-${job.id}`}
        className={[
          'grid scroll-mt-24 gap-2 rounded-lg py-3 lg:items-center lg:gap-3',
          ROW_GRID,
          job.helperOfJobId ? 'pl-5' : '',
          isBlocked ? 'border-l-2 border-warning pl-3' : '',
          highlighted ? 'bg-accent px-2 ring-1 ring-primary' : '',
        ].join(' ')}
        data-testid="admin-wo-job-row"
        data-highlighted={highlighted ? 'true' : undefined}
      >
        {/* Job */}
        <div className="flex min-w-0 items-start justify-between gap-3 lg:block">
          <div className="min-w-0">
            <p className={job.status === 'cancelled' ? 'font-medium text-muted-foreground line-through' : 'font-medium'}>
              {job.helperOfJobId ? <span aria-hidden="true" className="mr-1 text-muted-foreground">↳</span> : null}
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
          <div className="shrink-0 lg:hidden">{status}</div>
        </div>
        {/* Mechanic */}
        <div className="min-w-0 text-sm">
          <MechanicCell
            job={job}
            messages={messages}
            editable={canEdit && !isQualityCheck && !isExternal}
            disabled={pending}
            mechanics={withCurrentAssignee(isPmJob ? pmMechanics : assignableMechanics, job.assignedMechanic)}
            open={pickerJobId === job.id}
            onOpenChange={(next) => setPickerJobId(next ? job.id : null)}
            onAssign={(mechanicId) => { setPickerJobId(null); onAssign(job.id, mechanicId); }}
          />
        </div>
        {/* Status (desktop column) */}
        <div className="hidden lg:block">{status}</div>
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
              <PmServiceSelect job={job} messages={messages} disabled={pending} onChange={(catalogJobId) => onPmServiceChange(job.id, catalogJobId)} />
            ) : (
              <Button
                type="button"
                size="sm"
                className="w-full sm:w-auto lg:w-[9.5rem]"
                // LTR-164 (#2) / D15 / D19: primary only on Quality Check (the Manager's fallback for Safety); R3: quiet elsewhere.
                variant={isQualityCheck ? 'default' : 'secondary'}
                disabled={pending}
                onClick={() => onComplete(job.id)}
              >
                {pendingAction === `complete-job-${job.id}` ? messages.saving : messages.completeJobAction}
              </Button>
            )
          ) : null}
          {hasMenu ? (
            <DropdownMenu.Root modal={false}>
              <DropdownMenu.Trigger asChild>
                <Button type="button" variant="ghost" size="icon" className="size-9 shrink-0" aria-label={fillPlaceholders(messages.jobRowActions, { job: name })} disabled={pending}>
                  <MoreHorizontal aria-hidden="true" className="size-5" />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content align="end" sideOffset={6} collisionPadding={8} className="z-50 min-w-52 rounded-xl border bg-popover p-1 text-popover-foreground shadow-soft">
                  {canHelp ? (
                    <DropdownMenu.Item className={MENU_ITEM} data-testid="admin-wo-job-add-helper" onSelect={() => setDialog({ kind: 'helper', jobId: job.id })}>{messages.addHelperAction}</DropdownMenu.Item>
                  ) : null}
                  {canSendOut ? (
                    <DropdownMenu.Item className={MENU_ITEM} data-testid="admin-wo-job-send-external" onSelect={() => setDialog({ kind: 'external', jobId: job.id })}>{messages.sendExternalAction}</DropdownMenu.Item>
                  ) : null}
                  {canEdit ? (
                    <DropdownMenu.Item className={`${MENU_ITEM} text-destructive-text`} onSelect={() => onJobDialog('cancel', job.id)}>{messages.cancelJobAction}</DropdownMenu.Item>
                  ) : null}
                  {canReopen ? (
                    <DropdownMenu.Item className={MENU_ITEM} onSelect={() => onJobDialog('reopen', job.id)}>{messages.reopenJobAction}</DropdownMenu.Item>
                  ) : null}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          ) : <span aria-hidden="true" className="hidden size-9 shrink-0 lg:block" />}
        </div>
      </li>
    );
  }

  return (
    <div>
      <div className={`hidden border-b pb-2 text-xs text-muted-foreground lg:grid lg:gap-3 ${ROW_GRID}`} aria-hidden="true">
        <span>{messages.jobTableJob}</span>
        <span>{messages.jobTableMechanic}</span>
        <span>{messages.jobTableStatus}</span>
        <span className="text-right">{messages.jobTableAction}</span>
      </div>
      {open.length ? <ul className="divide-y" aria-label={messages.jobs}>{open.map(renderRow)}</ul> : null}
      {closed.length ? (
        <div className={open.length ? 'mt-2 border-t pt-2' : ''}>
          <button
            type="button"
            className="flex min-h-11 w-full items-center gap-2 rounded-lg px-1 text-left text-sm text-muted-foreground hover:bg-accent"
            aria-expanded={closedOpen}
            aria-controls="admin-wo-closed-jobs"
            data-testid="admin-wo-closed-jobs-toggle"
            onClick={() => setClosedOpen(!closedOpen)}
          >
            <ChevronDown aria-hidden="true" className={`size-4 transition-transform ${closedOpen ? 'rotate-180' : ''}`} />
            {fillPlaceholders(messages.jobsClosedGroup, { count: String(closed.length) })}
          </button>
          {closedOpen ? <ul id="admin-wo-closed-jobs" className="divide-y" aria-label={fillPlaceholders(messages.jobsClosedGroup, { count: String(closed.length) })}>{closed.map(renderRow)}</ul> : null}
        </div>
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
  open,
  onOpenChange,
  onAssign,
}: {
  job: Job;
  messages: AdminMessages;
  editable: boolean;
  disabled: boolean;
  mechanics: Mechanic[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Empty `mechanicId` unassigns. */
  onAssign: (mechanicId: string) => void;
}) {
  const isQualityCheck = isQualityCheckJob(job.category.name, job.displayName);
  // LTR-188 / D24: where it is instead of an owner; the note is the tooltip.
  if (job.external && job.status === 'to_do') {
    return <span className="text-muted-foreground" title={job.external.note} data-testid="admin-wo-job-external-where">{externalShopLabel(job.external.kind, messages)}</span>;
  }
  if (editable) {
    // Stage 5 (R3): a picker with search instead of a long select; the current owner first, Unassign on top.
    return (
      <MechanicPicker
        open={open}
        onOpenChange={onOpenChange}
        title={fillPlaceholders(messages.assignJobMechanicFor, { job: job.displayName })}
        mechanics={mechanics}
        currentId={job.assignedMechanic?.id ?? null}
        messages={messages}
        onPick={(mechanic) => { if (mechanic.id !== job.assignedMechanic?.id) onAssign(mechanic.id); else onOpenChange(false); }}
        onUnassign={() => onAssign('')}
        trigger={(
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full justify-between gap-2 font-normal"
            aria-label={fillPlaceholders(messages.assignJobMechanicFor, { job: job.displayName })}
            disabled={disabled}
          >
            <span className="inline-flex min-w-0 items-center gap-2">
              {job.assignedMechanic ? (
                <span aria-hidden="true" className="grid size-5 shrink-0 place-items-center rounded-full bg-accent text-[0.65rem] font-semibold text-primary">{profileInitials(job.assignedMechanic.name)}</span>
              ) : null}
              <span className={`truncate ${job.assignedMechanic ? '' : 'text-muted-foreground'}`}>{job.assignedMechanic?.name ?? messages.jobUnassigned}</span>
            </span>
            <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          </Button>
        )}
      />
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
