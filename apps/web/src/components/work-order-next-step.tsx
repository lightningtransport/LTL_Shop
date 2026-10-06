'use client';

import { useState, type Ref } from 'react';
import {
  Building2,
  Check,
  CheckCheck,
  ChevronDown,
  CircleCheck,
  CirclePause,
  CircleX,
  ClipboardCheck,
  Flag,
  ListPlus,
  PackageCheck,
  Play,
  ShieldCheck,
  TriangleAlert,
  Truck,
  Wrench,
} from 'lucide-react';
import { isQualityCheckJob, type AdminWorkOrderDetailDto, type PauseEventDto } from '@ltl-shop/shared';
import { resolveAdminBlocker } from '@/lib/admin-data';
import { adminPauseReasonLabel, type AdminLocale, type AdminMessages } from '@/lib/admin-messages';
import { fillPlaceholders } from '@/lib/admin-next-step';
import { truckNextStepText } from '@/lib/truck-next-step';
import { cn } from '@/lib/utils';
import { formatShortDateTime, workOrderCancelReason } from '@/lib/work-order-view';
import { useActionToast } from './action-toast';
import { NextStepAction } from './next-step-action';
import { NextStepCallout, type CalloutTone } from './next-step-callout';
import { Button, Textarea } from './ui';

type Blocker = AdminWorkOrderDetailDto['reportedBlockers'][number];

/**
 * Stage 8 (F7, mockup): the Work Order's Next step as one callout. The Work Order's own state comes first
 * (cancelled, completed and returned or not, paused); then an active blocker (only the first, "+N more",
 * resolved right here with an optional note); then the API's Next step (`data.nextStep`, the same rule as the
 * Truck, Dashboard and Yard). Ready to close carries "Confirm completion" (the sticky bar watches this box).
 * Resolved blockers fold into the callout's footer.
 */
export function WorkOrderNextStep({
  data,
  locale,
  messages,
  canManage,
  readyToClose,
  pending,
  calloutRef,
  onResume,
  onReturnToService,
  onConfirmCompletion,
  onReturned,
  onChanged,
}: {
  data: AdminWorkOrderDetailDto;
  locale: AdminLocale;
  messages: AdminMessages;
  canManage: boolean;
  readyToClose: boolean;
  pending: boolean;
  calloutRef: Ref<HTMLDivElement>;
  onResume: () => void;
  onReturnToService: () => void;
  onConfirmCompletion: () => void;
  onReturned: (jobId: string) => void;
  onChanged: () => Promise<unknown> | void;
}) {
  const date = (value: string | null | undefined) => formatShortDateTime(value, locale);
  const step = data.nextStep ?? null;
  const blockers = data.reportedBlockers ?? [];
  const openJobIds = new Set(data.jobs.filter((job) => job.status === 'to_do').map((job) => job.id));
  const activeBlockers = blockers.filter((blocker) => !blocker.resolvedAt && (!blocker.job || openJobIds.has(blocker.job.id)));
  const resolved = blockers.filter((blocker) => blocker.resolvedAt);
  const footer = resolved.length ? <ResolvedFooter blockers={resolved} locale={locale} messages={messages} /> : null;
  const primary = (label: string, Icon: typeof Check, onClick: () => void) => (
    <Button type="button" disabled={pending} onClick={onClick}><Icon aria-hidden="true" />{pending ? messages.saving : label}</Button>
  );
  const box = (props: {
    tone: CalloutTone;
    icon: typeof Check;
    eyebrow: string;
    title: string;
    sub?: string | null;
    actions?: React.ReactNode;
    extra?: React.ReactNode;
    kind: string;
  }) => (
    <div ref={calloutRef}>
      <NextStepCallout
        id="next-step"
        testId="admin-wo-next-step"
        tone={props.tone}
        icon={props.icon}
        eyebrow={props.eyebrow}
        title={props.title}
        sub={props.sub}
        actions={props.actions}
        extra={props.extra}
        footer={footer}
        kind={props.kind}
      />
    </div>
  );
  const readOnlyNote = (text: string) => <p className="text-muted-foreground">{text}</p>;

  if (data.status === 'cancelled') {
    const reason = workOrderCancelReason(data);
    return box({ tone: 'muted', icon: CircleX, eyebrow: messages.calloutCancelled, title: messages.calloutCancelledTitle, sub: `${reason ? `“${reason}” · ` : ''}${messages.calloutCancelledSub}`, kind: 'cancelled' });
  }
  if (data.status === 'completed') {
    if (data.returnedToServiceAt) {
      return box({ tone: 'success', icon: CircleCheck, eyebrow: messages.calloutDone, title: messages.calloutReturnedTitle, sub: fillPlaceholders(messages.calloutReturnedSub, { completed: date(data.completedAt), returned: date(data.returnedToServiceAt) }), kind: 'returned' });
    }
    return box({
      tone: 'primary',
      icon: Truck,
      eyebrow: messages.calloutNextStep,
      title: messages.calloutReturnTitle,
      sub: fillPlaceholders(messages.calloutReturnSub, { date: date(data.completedAt) }),
      actions: canManage ? <Button type="button" disabled={pending} onClick={onReturnToService}>{messages.returnToServiceTitle}</Button> : null,
      kind: 'return_to_service',
    });
  }
  if (data.status === 'waiting_paused') {
    const pause = data.currentPause;
    return box({
      tone: 'warning',
      icon: CirclePause,
      eyebrow: messages.calloutPaused,
      title: fillPlaceholders(messages.calloutPausedTitle, { reason: pause ? adminPauseReasonLabel(pause.reason, messages) : '—' }),
      sub: fillPlaceholders(messages.calloutPausedSub, { date: date(pause?.startedAt) }),
      actions: canManage ? primary(messages.resumeShort, Play, onResume) : null,
      kind: 'resume',
    });
  }
  if (activeBlockers.length) {
    const blocker = activeBlockers[0];
    const more = activeBlockers.length - 1;
    return (
      <div ref={calloutRef}>
        <BlockerCallout
          blocker={blocker}
          more={more}
          workOrderId={data.id}
          locale={locale}
          messages={messages}
          canResolve={canManage}
          footer={footer}
          onResolved={onChanged}
        />
      </div>
    );
  }

  const left = data.jobs.filter((job) => job.status === 'to_do');
  const outside = left.filter((job) => job.external);
  const inShop = left.filter((job) => !job.external);
  const action = (
    <NextStepAction
      step={step}
      place="work-order"
      truck={data.truck}
      workOrderDisplayId={data.displayId}
      expectedVersion={data.version}
      fromPath={`/admin/work-orders/${data.id}`}
      canManage={canManage}
      messages={messages}
      onChanged={onChanged}
    />
  );
  const noPermission = !canManage ? readOnlyNote(messages.nextStepNoPermission) : null;

  if (step?.kind === 'inspect') {
    return box({ tone: 'primary', icon: ClipboardCheck, eyebrow: messages.calloutNextStep, title: messages.calloutInspectTitle, sub: messages.calloutInspectSub, actions: action, extra: noPermission, kind: step.kind });
  }
  if (step?.kind === 'add_missing_steps') {
    return box({ tone: 'warning', icon: ListPlus, eyebrow: messages.calloutNextStep, title: truckNextStepText(step, messages) ?? '', sub: messages.calloutMissingSub, actions: action, extra: noPermission, kind: step.kind });
  }
  // External shop: the API's step, or (without one) every Job left is outside.
  if (step?.kind === 'external' || (!step && outside.length && !inShop.some((job) => !isQualityCheckJob(job.category.name, job.displayName)))) {
    const job = outside.find((candidate) => candidate.id === step?.jobId) ?? outside[0];
    if (job?.external) {
      const what = job.external.kind === 'truck' ? messages.calloutExternalTruck : messages.calloutExternalPart;
      return box({
        tone: 'primary',
        icon: Building2,
        eyebrow: `${messages.calloutWaiting}${outside.length > 1 ? fillPlaceholders(messages.calloutMore, { count: String(outside.length - 1) }) : ''}`,
        title: fillPlaceholders(messages.calloutExternalTitle, { job: job.displayName }),
        sub: fillPlaceholders(what, { date: date(job.external.since), note: job.external.note }),
        actions: canManage ? primary(messages.externalReturnedAction, PackageCheck, () => onReturned(job.id)) : null,
        kind: 'external',
      });
    }
  }
  if (step?.kind === 'qc') {
    return box({ tone: 'primary', icon: ShieldCheck, eyebrow: messages.calloutQc, title: messages.calloutQcTitle, sub: messages.calloutQcSub, actions: action, extra: noPermission, kind: step.kind });
  }
  if (readyToClose) {
    return box({ tone: 'primary', icon: Flag, eyebrow: messages.calloutNextStep, title: messages.calloutAllDoneTitle, sub: messages.readyToCloseHint, actions: primary(messages.completeWorkOrderConfirm, CheckCheck, onConfirmCompletion), kind: 'close' });
  }
  if (!left.length) {
    return box({ tone: 'muted', icon: Flag, eyebrow: messages.calloutNextStep, title: messages.calloutAllDoneTitle, sub: messages.calloutAllDoneReadOnly, kind: step?.kind ?? 'close' });
  }

  const unassigned = inShop.filter((job) => !job.assignedMechanic && !isQualityCheckJob(job.category.name, job.displayName)).length;
  const sub = fillPlaceholders(messages.calloutWorkSub, { count: String(inShop.length) })
    + (unassigned ? fillPlaceholders(messages.calloutWithoutMechanic, { count: String(unassigned) }) : messages.calloutEveryHasMechanic)
    + (outside.length ? fillPlaceholders(messages.calloutAtExternal, { count: String(outside.length) }) : '');
  if (step?.kind === 'assign') {
    return box({ tone: 'muted', icon: Wrench, eyebrow: messages.calloutNextStep, title: fillPlaceholders(messages.calloutAssignTitle, { job: step.jobName ?? '' }), sub, actions: action, extra: noPermission, kind: step.kind });
  }
  return box({ tone: 'muted', icon: Wrench, eyebrow: messages.calloutNextStep, title: messages.calloutWorkTitle, sub, kind: step?.kind ?? 'work' });
}

function BlockerCallout({
  blocker,
  more,
  workOrderId,
  locale,
  messages,
  canResolve,
  footer,
  onResolved,
}: {
  blocker: Blocker;
  more: number;
  workOrderId: string;
  locale: AdminLocale;
  messages: AdminMessages;
  canResolve: boolean;
  footer: React.ReactNode;
  onResolved: () => Promise<unknown> | void;
}) {
  const { showToast } = useActionToast();
  const [resolving, setResolving] = useState(false);
  const [note, setNote] = useState('');
  const [pending, setPending] = useState(false);
  const reason = adminPauseReasonLabel(blocker.blockerReason ?? blocker.reason, messages);
  const reporter = blocker.reportedBy?.name ?? blocker.createdBy?.name ?? messages.noValue;

  async function resolve() {
    if (pending) return;
    setPending(true);
    try {
      await resolveAdminBlocker(workOrderId, blocker.id, note.trim() || undefined);
      setNote('');
      setResolving(false);
      showToast('success', messages.blockerResolvedSuccess);
      await onResolved();
    } catch {
      showToast('error', messages.blockerResolveFailed);
    } finally {
      setPending(false);
    }
  }

  return (
    <NextStepCallout
      id="next-step"
      testId="admin-wo-next-step"
      kind="resolve_blocker"
      tone="warning"
      icon={TriangleAlert}
      eyebrow={`${messages.calloutBlocker}${more > 0 ? fillPlaceholders(messages.calloutMore, { count: String(more) }) : ''}`}
      title={blocker.job ? fillPlaceholders(messages.calloutBlockerTitle, { job: blocker.job.displayName, reason }) : reason}
      sub={fillPlaceholders(messages.calloutReportedBy, { name: reporter, date: formatShortDateTime(blocker.startedAt, locale) })}
      actions={canResolve && !resolving ? (
        <Button type="button" onClick={() => setResolving(true)}><Check aria-hidden="true" />{messages.resolveBlocker}</Button>
      ) : null}
      extra={(
        <div data-testid="admin-blocker" className="space-y-1">
          {blocker.notes ? <p className="text-foreground/90">{fillPlaceholders(messages.calloutMechanicNote, { body: blocker.notes })}</p> : null}
          {(blocker.blockerNotes ?? []).map((entry) => (
            <p key={entry.id} className="text-foreground/90">{fillPlaceholders(messages.calloutMechanicNote, { body: entry.body })}</p>
          ))}
          {resolving ? (
            <form className="space-y-2 pt-2" onSubmit={(event) => { event.preventDefault(); void resolve(); }}>
              <Textarea
                aria-label={messages.resolveBlockerNoteLabel}
                placeholder={messages.resolveBlockerNoteLabel}
                value={note}
                rows={2}
                maxLength={1000}
                disabled={pending}
                autoFocus
                onChange={(event) => setNote(event.target.value)}
              />
              <div className="flex gap-2">
                <Button type="submit" className="flex-1 sm:flex-none" disabled={pending}>{pending ? messages.saving : messages.blockerConfirmResolve}</Button>
                <Button type="button" variant="ghost" disabled={pending} onClick={() => { setResolving(false); setNote(''); }}>{messages.cancel}</Button>
              </div>
            </form>
          ) : null}
          {!canResolve ? <p className="text-muted-foreground">{messages.calloutResolveReadOnly}</p> : null}
        </div>
      )}
      footer={footer}
    />
  );
}

function ResolvedFooter({ blockers, locale, messages }: { blockers: PauseEventDto[]; locale: AdminLocale; messages: AdminMessages }) {
  const [open, setOpen] = useState(false);
  const names = blockers.map((blocker) => blocker.job?.displayName ?? adminPauseReasonLabel(blocker.blockerReason ?? blocker.reason, messages)).join(', ');
  const label = blockers.length === 1
    ? fillPlaceholders(messages.resolvedBlockerOne, { names })
    : fillPlaceholders(messages.resolvedBlockerMany, { count: String(blockers.length), names });
  return (
    <div data-testid="admin-wo-resolved-blockers">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="admin-wo-resolved-list"
        className="flex min-h-11 w-full items-center gap-2 border-t border-inherit px-4 py-2.5 text-left text-muted-foreground hover:text-foreground"
        onClick={() => setOpen(!open)}
      >
        <CircleCheck aria-hidden="true" className="size-3.5 shrink-0 text-success" />
        <span className="min-w-0 truncate">{label}</span>
        <ChevronDown aria-hidden="true" className={cn('ml-auto size-3.5 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>
      {open ? (
        <ul id="admin-wo-resolved-list" className="divide-y border-t border-inherit">
          {blockers.map((blocker) => {
            const reason = adminPauseReasonLabel(blocker.blockerReason ?? blocker.reason, messages);
            return (
              <li key={blocker.id} className="space-y-0.5 px-4 py-3 text-muted-foreground" data-testid="admin-blocker">
                <p>
                  <span className="font-medium text-foreground">{blocker.job ? `${blocker.job.displayName}: ${reason}` : reason}</span>
                  {fillPlaceholders(messages.resolvedReportedBy, { name: blocker.reportedBy?.name ?? messages.noValue, date: formatShortDateTime(blocker.startedAt, locale) })}
                </p>
                {(blocker.blockerNotes ?? []).map((entry) => <p key={entry.id}>{fillPlaceholders(messages.calloutMechanicNote, { body: entry.body })}</p>)}
                <p>
                  {fillPlaceholders(messages.resolvedByLine, { name: blocker.resolvedBy?.name ?? messages.noValue, date: formatShortDateTime(blocker.resolvedAt, locale) })}
                  {blocker.resolutionNote ? ` · “${blocker.resolutionNote}”` : ''}
                </p>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
