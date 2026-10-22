'use client';

import Link from 'next/link';
import { useMemo, useState, type ReactNode, useRef, useCallback } from 'react';
import {
  AppCapability,
  JobStatus,
  WorkPlanInspectionOutcome,
  type TruckWorkPlanDto,
} from '@ltl-shop/shared';
import { Building2, Check, ChevronDown, ClipboardCheck, CircleSlash, CornerDownRight, Lock, OctagonPause, Package, ShieldCheck, SquareArrowOutUpRight, Truck, UserPlus } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { apiErrorMessage } from '@/lib/api-error-message';
import {
  addAdminWorkPlanJobs,
  assignAdminWorkOrderJob,
  fetchAdminTruckWorkPlan,
  useAdminAssignableMechanics,
} from '@/lib/admin-data';
import { fillPlaceholders } from '@/lib/admin-next-step';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';
import { formatShortDateTime } from '@/lib/work-order-view';
import { useCategories } from '@/lib/shop-data';
import { type WorkPlanJobDraft } from '@/lib/work-plan';
import { jobDisplayName } from '@/lib/job-display-name';
import type { TruckStep, TruckStepKey } from '@/lib/truck-stepper';
import { WorkPlanAddWork } from './work-plan-add-work';
import { MechanicPicker, type PickerMechanic } from './mechanic-picker';
import { SideSheet } from './side-sheet';
import { STEP_TONE, TruckStepIcon, truckStepLabel } from './truck-stepper';
import { MechanicAvatar } from './mechanic-avatar';
import { useActionToast } from './action-toast';
import { Button } from './ui';

type PlanJob = TruckWorkPlanDto['jobs'][number];

const STEP_LANES: Record<TruckStepKey, string[]> = {
  inspection: ['inspection'],
  shop_work: ['shop_work'],
  pm: ['pm'],
  alignment: ['alignment'],
  detailing: ['detailing'],
  quality_check: ['quality_check'],
  close: [],
};

/**
 * Stage 4 (UX-4-004, UX-5-003, T4, T5, T9, T10): the Truck's Work Plan — one section per step with
 * its state (finished steps folded), the Jobs read-only under their step and "Manage in Work Order"
 * on every row (the Work Order does the rest). Only a Job with no owner has Assign here. Add work
 * opens in a side panel. Success is a toast; errors go to the Truck's error line (`onError`).
 */
export function AdminTruckWorkPlan({
  truckId,
  truckNumber,
  fromPath,
  plan,
  steps,
  isStepOpen,
  onToggleStep,
  locale,
  messages,
  addWorkOpen,
  onAddWorkOpenChange,
  inspectionInNextStep,
  onPlanUpdated,
  onError,
}: {
  truckId: string;
  truckNumber: string;
  /** This Truck's path, for the Work Order's back link. */
  fromPath: string;
  plan: TruckWorkPlanDto;
  steps: TruckStep[];
  isStepOpen: (step: TruckStep) => boolean;
  onToggleStep: (key: TruckStepKey, open: boolean) => void;
  locale: AdminLocale;
  messages: AdminMessages;
  addWorkOpen: boolean;
  onAddWorkOpenChange: (open: boolean) => void;
  /** The Next step already shows the two inspection buttons (`inspect`); the section only states it. */
  inspectionInNextStep: boolean;
  onPlanUpdated: (next: TruckWorkPlanDto) => Promise<void> | void;
  onError: (message: string | null) => void;
}) {
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  // LTR-293 §14: while Add work holds something typed or picked, Escape or a tap outside does not close it.
  const addWorkDirty = useRef(false);
  const setAddWorkDirtyFlag = useCallback((dirty: boolean) => { addWorkDirty.current = dirty; }, []);
  const [pickerJobId, setPickerJobId] = useState<string | null>(null);
  const { showToast } = useActionToast();
  const canInspect = plan.capabilities.canRecordInspection;
  const canAddWork = plan.capabilities.canAddWork;
  useCategories(true);
  // LTR-154 / D11: a Job's one owner (PM job → PM mechanic).
  const { data: mechanicPages, isLoading: mechanicsLoading } = useAdminAssignableMechanics();
  const { standardMechanics, pmMechanics } = useMemo(() => {
    const active = (mechanicPages?.flatMap((page) => page.items) ?? []).filter((mechanic) => mechanic.active);
    return {
      standardMechanics: active.filter((mechanic) => mechanic.capabilities.includes(AppCapability.MECHANIC_STANDARD)),
      pmMechanics: active.filter((mechanic) => mechanic.capabilities.includes(AppCapability.MECHANIC_PM)),
    };
  }, [mechanicPages]);

  function mutationError(errorValue: unknown, fallback: string, forbidden: string) {
    if (errorValue instanceof ApiError) {
      if (errorValue.status === 403) return forbidden;
      if (errorValue.status === 409) return messages.mutationConflict;
      if (errorValue.status === 400) {
        const code = errorCode(errorValue);
        // LTR-219: by code only — any message with "PM" in it (e.g. PM_JOB_EXISTS) used to read as this conflict.
        if (code === 'OPEN_WORK_ORDER_EXISTS' || code === 'PM_WORK_ORDER_OPEN') return messages.workPlanPmOpenConflict;
        return apiErrorMessage(errorValue, messages, messages.mutationBadRequest);
      }
    }
    return fallback;
  }

  async function run<T>(action: string, operation: () => Promise<T>) {
    if (pendingAction) return null;
    setPendingAction(action);
    onError(null);
    try {
      return await operation();
    } finally {
      setPendingAction(null);
    }
  }

  function fail(message: string) {
    onError(message);
    showToast('error', message);
  }

  async function handleAddWork(jobs: WorkPlanJobDraft[]) {
    try {
      const next = await run('add-work', () => addAdminWorkPlanJobs(truckId, {
        jobs: jobs.map((job) => ({
          catalogJobId: job.catalogJobId,
          categoryId: job.categoryId,
          displayName: job.displayName,
          customDescription: job.customDescription,
          ...(job.assignedMechanicId ? { assignedMechanicId: job.assignedMechanicId } : {}),
          // D42 / S-6: the faults this Job takes care of.
          ...(job.samsaraFaultIds?.length ? { samsaraFaultIds: job.samsaraFaultIds } : {}),
          ...(job.qcFindingIds?.length ? { qcFindingIds: job.qcFindingIds } : {}),
        })),
        expectedVersion: plan.workOrder?.version,
      }));
      if (!next) return false;
      await onPlanUpdated(next);
      onAddWorkOpenChange(false);
      showToast('success', messages.workPlanJobsAdded);
      return true;
    } catch (errorValue) {
      fail(mutationError(errorValue, messages.workPlanAddWorkFailed, messages.workPlanAddWorkForbidden));
      return false;
    }
  }

  async function handleAssign(jobId: string, mechanic: PickerMechanic) {
    if (!plan.workOrder) return;
    const workOrder = plan.workOrder;
    setPickerJobId(null);
    try {
      await run(`assign-${jobId}`, () => assignAdminWorkOrderJob(workOrder.id, jobId, { mechanicId: mechanic.id, expectedVersion: workOrder.version }));
      await onPlanUpdated(await fetchAdminTruckWorkPlan(truckId));
      showToast('success', messages.assignJobSuccess);
    } catch (errorValue) {
      // T6: the assign error is its own, not the add-work one.
      fail(mutationError(errorValue, messages.assignmentGenericError, messages.assignJobForbidden));
    }
  }

  function jobsFor(key: TruckStepKey) {
    const lanes = STEP_LANES[key];
    const own = plan.jobs.filter((job) => lanes.includes(job.lane));
    // D23: a helper Job sits right under the Job it helps.
    const parents = own.filter((job) => !job.helperOfJobId || !own.some((other) => other.id === job.helperOfJobId));
    return parents.flatMap((job) => [job, ...own.filter((other) => other.helperOfJobId === job.id)]);
  }

  function manageHref(job: PlanJob) {
    if (!plan.workOrder) return null;
    return `/admin/work-orders/${plan.workOrder.id}?from=${encodeURIComponent(fromPath)}#job-${job.id}`;
  }

  function renderJobs(key: TruckStepKey) {
    // Pending first, then done and cancelled; a helper right under its Job.
    const jobs = [...jobsFor(key)].sort((left, right) => (left.status === JobStatus.TO_DO ? 0 : 1) - (right.status === JobStatus.TO_DO ? 0 : 1));
    if (!jobs.length) return null;
    return (
      <ul className="space-y-1 pb-3 sm:space-y-0 sm:pb-2">
        {jobs.map((job) => {
          // LTR-188 / D24: a Job at an external shop comes back through "Returned" on the Work Order. QC is Safety's (D19).
          const canAssignHere = canAddWork && plan.workOrder && job.status === JobStatus.TO_DO && !job.assignedMechanic && job.lane !== 'quality_check' && !job.external;
          const name = jobDisplayName(job, messages.helperJobSuffix);
          const href = manageHref(job);
          const open = job.status === JobStatus.TO_DO;
          const parent = job.helperOfJobId ? plan.jobs.find((other) => other.id === job.helperOfJobId) : undefined;
          let who: ReactNode;
          if (open && job.external) {
            const Icon = job.external.kind === 'truck' ? Truck : Package;
            who = <span className="flex min-w-0 items-center gap-2 text-muted-foreground" title={job.external.note} data-testid="work-plan-job-external"><Icon aria-hidden="true" className="size-3.5 shrink-0" /><span className="truncate">{job.external.kind === 'truck' ? messages.jobTruckOut : messages.jobPartOut}</span></span>;
          } else if (job.lane === 'quality_check') {
            who = (
              <span className="flex items-center gap-2 text-muted-foreground" title={messages.workPlanQcHint}>
                <span className="grid size-6 place-items-center rounded-full border border-dashed border-muted-foreground/60"><ShieldCheck aria-hidden="true" className="size-3.5" /></span>
                Safety
              </span>
            );
          } else if (canAssignHere) {
            who = (
              <MechanicPicker
                open={pickerJobId === job.id}
                onOpenChange={(next) => setPickerJobId(next ? job.id : null)}
                title={fillPlaceholders(messages.assignJobMechanicFor, { job: job.displayName })}
                mechanics={job.lane === 'pm' ? pmMechanics : standardMechanics}
                loading={mechanicsLoading}
                messages={messages}
                onPick={(mechanic) => void handleAssign(job.id, mechanic)}
                trigger={(
                  <button
                    id={`assign-job-${job.id}`}
                    type="button"
                    aria-label={fillPlaceholders(messages.assignJobMechanicFor, { job: name })}
                    disabled={Boolean(pendingAction)}
                    className="-ml-2 flex h-10 items-center gap-2 rounded-md border border-dashed border-primary/50 px-2 text-primary hover:bg-primary/10 disabled:opacity-60 lg:h-9"
                  >
                    <UserPlus aria-hidden="true" className="size-3.5" />{messages.truckNextStepAssignAction}
                  </button>
                )}
              />
            );
          } else if (job.assignedMechanic) {
            who = (
              <span className="flex min-w-0 items-center gap-2">
                <MechanicAvatar id={job.assignedMechanic.id} name={job.assignedMechanic.name} size="sm" />
                <span className="truncate"><span className="sr-only">{messages.jobAssignee}: </span>{job.assignedMechanic.name}</span>
              </span>
            );
          } else {
            who = <span className="text-muted-foreground">{job.teamQueueStepKey ? messages.jobInTeamQueue : messages.jobUnassigned}</span>;
          }
          const status = job.status === JobStatus.COMPLETED ? (
            <span className="inline-flex items-center gap-1.5 text-success"><Check aria-hidden="true" className="size-3.5" />{messages.jobDoneShort}</span>
          ) : job.status === JobStatus.CANCELLED ? (
            <span className="inline-flex items-center gap-1.5 text-muted-foreground"><CircleSlash aria-hidden="true" className="size-3.5" />{messages.jobStatusCancelled}</span>
          ) : job.uiStatus === 'external' ? (
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-primary"><Building2 aria-hidden="true" className="size-3.5" />{messages.jobExternalShort}</span>
          ) : job.uiStatus === 'blocked' ? (
            <span className="inline-flex items-center gap-1.5 text-warning-foreground dark:text-warning"><OctagonPause aria-hidden="true" className="size-3.5" />{messages.blockedShort}</span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-muted-foreground"><span aria-hidden="true" className="size-2 rounded-full border-[1.5px] border-muted-foreground" />{messages.jobToDo}</span>
          );
          const sub = parent
            ? parent.assignedMechanic ? fillPlaceholders(messages.jobHelps, { name: parent.assignedMechanic.name }) : messages.jobHelpsMain
            : job.category.name;
          return (
            <li
              key={job.id}
              className="mx-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-md border-l-2 border-border py-2 pl-3 pr-1 sm:mx-0 sm:grid-cols-[minmax(0,1fr)_180px_100px_auto] sm:rounded-none sm:border-l-0 sm:pl-[52px] sm:pr-2"
              data-testid="truck-job-row"
              data-status={job.uiStatus}
            >
              <div className="flex min-w-0 gap-1.5">
                {job.helperOfJobId ? <CornerDownRight aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" /> : null}
                <div className="min-w-0">
                  <p className={`break-words sm:truncate ${job.status === JobStatus.CANCELLED ? 'text-muted-foreground line-through' : open ? 'font-medium' : 'text-foreground/80'}`}>
                    {job.displayName}
                    {job.helperOfJobId ? <span className="font-normal text-muted-foreground">{messages.helperJobSuffix}</span> : null}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{sub}{job.completedAt ? ` · ${formatShortDateTime(job.completedAt, locale)}` : ''}</p>
                </div>
              </div>
              <div className="min-w-0 max-sm:order-2 max-sm:col-start-1 max-sm:-ml-0.5">{who}</div>
              <div className="self-start justify-self-end whitespace-nowrap max-sm:order-1 max-sm:pt-0.5 max-sm:text-xs sm:self-center sm:justify-self-start">{status}</div>
              {href ? (
                <Link
                  href={href}
                  className="grid size-10 place-items-center justify-self-end rounded-md text-muted-foreground hover:bg-accent hover:text-foreground max-sm:order-3 sm:size-8"
                  aria-label={fillPlaceholders(messages.manageJobInWorkOrder, { job: name })}
                  title={messages.manageInWorkOrder}
                >
                  <SquareArrowOutUpRight aria-hidden="true" className="size-3.5" />
                </Link>
              ) : null}
            </li>
          );
        })}
      </ul>
    );
  }

  function stepMeta(step: TruckStep) {
    const lane = jobsFor(step.key);
    const live = lane.filter((job) => job.status !== JobStatus.CANCELLED);
    switch (step.state) {
      case 'done':
        return step.key === 'close'
          ? fillPlaceholders(messages.stepMetaCloseDone, { workOrder: plan.workOrder?.displayId ?? '', date: formatShortDateTime(plan.workOrder?.completedAt, locale) })
          : fillPlaceholders(messages.stepMetaDone, { count: String(live.filter((job) => job.status === JobStatus.COMPLETED).length) });
      case 'not_applicable': return messages.stepMetaNa;
      case 'missing': return messages.stepMetaMissing;
      case 'pending': return step.remaining ? fillPlaceholders(messages.stepMetaPendingCount, { count: String(step.remaining) }) : messages.stepMetaPending;
      case 'blocked': return messages.blockedShort;
      case 'external': return messages.externalStatus;
      case 'ready': return messages.readinessReadyToClose;
      case 'waiting': return messages.stepMetaCloseWaiting;
    }
  }

  const recorded = plan.inspection.outcome !== WorkPlanInspectionOutcome.NOT_STARTED;
  const inspectionMeta = !recorded
    ? messages.stepMetaPending
    : fillPlaceholders(plan.inspection.outcome === WorkPlanInspectionOutcome.ISSUES_FOUND ? messages.stepMetaIssues : messages.stepMetaNoIssues, { date: formatShortDateTime(plan.inspection.recordedAt, locale) });

  return (
    <section aria-labelledby="truck-work-plan-title" className="overflow-hidden rounded-xl border bg-card text-card-foreground">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <h2 id="truck-work-plan-title" tabIndex={-1} className="scroll-mt-24 text-base font-semibold">{messages.workPlanSection}</h2>
        <span className="text-xs text-muted-foreground">{plan.workOrder ? fillPlaceholders(messages.workPlanJobsOn, { workOrder: plan.workOrder.displayId }) : messages.workPlanNoWorkOrderYet}</span>
      </div>
      <ul className="divide-y" aria-label={messages.jobsInPlan}>
        {steps.map((step) => {
          const jobs = jobsFor(step.key);
          // Inspection and Close never fold; a step folds only when it has Jobs.
          const collapsible = step.key !== 'inspection' && step.key !== 'close' && jobs.length > 0;
          const open = collapsible && isStepOpen(step);
          const state = step.key === 'inspection' ? (recorded ? 'done' : 'pending') : step.state;
          const meta = step.key === 'inspection' ? inspectionMeta : stepMeta(step);
          return (
            <li key={step.key} id={`truck-step-${step.key}`} className="scroll-mt-24" data-state={step.state}>
              <StepHead
                step={step}
                state={state}
                meta={meta}
                collapsible={collapsible}
                open={open}
                messages={messages}
                onToggle={() => onToggleStep(step.key, !open)}
              />
              {step.key === 'inspection' ? (
                <InspectionControl
                  plan={plan}
                  truckId={truckId}
                  messages={messages}
                  canInspect={canInspect && canAddWork && !inspectionInNextStep}
                />
              ) : null}
              {open ? renderJobs(step.key) : null}
            </li>
          );
        })}
      </ul>
      {!canAddWork && !canInspect ? (
        <p className="flex items-center gap-2 border-t bg-sunken px-4 py-3 text-muted-foreground"><Lock aria-hidden="true" className="size-3.5 shrink-0" />{messages.permissionReadOnly}</p>
      ) : null}

      {canAddWork ? (
        <SideSheet
          open={addWorkOpen}
          title={fillPlaceholders(messages.addWorkPanelTitle, { truck: truckNumber })}
          description={plan.workOrder ? undefined : messages.addWorkPanelNoWorkOrder}
          closeLabel={messages.closeDialog}
          onClose={() => onAddWorkOpenChange(false)}
          testId="work-plan-add-work-panel"
          dismissible={() => !addWorkDirty.current}
        >
          <div id="work-plan-add-work">
            <WorkPlanAddWork
              truckId={truckId}
              plan={plan}
              messages={messages}
              disabled={Boolean(pendingAction)}
              submitting={pendingAction === 'add-work'}
              standardMechanics={standardMechanics}
              onSubmit={handleAddWork}
              onCancel={() => onAddWorkOpenChange(false)}
              onDirtyChange={setAddWorkDirtyFlag}
            />
          </div>
        </SideSheet>
      ) : null}
    </section>
  );
}

function StepHead({ step, state, meta, collapsible, open, messages, onToggle }: {
  step: TruckStep;
  state: TruckStep['state'];
  meta: string;
  collapsible: boolean;
  open: boolean;
  messages: AdminMessages;
  onToggle: () => void;
}) {
  const content = (
    <>
      <span className={`grid size-6 shrink-0 place-items-center rounded-full ${STEP_TONE[state].tile}`}><TruckStepIcon state={state} /></span>
      <span className="flex min-w-0 flex-col sm:flex-row sm:items-baseline sm:gap-1.5">
        <span className="font-semibold">{truckStepLabel(step.key, messages)}</span>
        <span className="text-xs text-muted-foreground sm:text-sm"><span className="hidden sm:inline">· </span>{meta}</span>
      </span>
      {collapsible ? <ChevronDown aria-hidden="true" className={`ml-auto size-3.5 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} /> : null}
    </>
  );
  if (!collapsible) return <div className="flex min-h-11 w-full items-center gap-3 px-4 py-2.5">{content}</div>;
  return (
    <button
      type="button"
      className="flex min-h-11 w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-accent/50"
      aria-expanded={open}
      aria-controls={`truck-step-${step.key}-content`}
      onClick={onToggle}
    >
      {content}
    </button>
  );
}

/**
 * D41 / HU-M16: pending → the prompt and "Start inspection" (the sheet); recorded → the outcome is in the step's
 * line, with "View report" as a link (the report has "Add defects"). The two D14 buttons are gone: the sheet decides.
 */
function InspectionControl({
  plan,
  truckId,
  messages,
  canInspect,
}: {
  plan: TruckWorkPlanDto;
  truckId: string;
  messages: AdminMessages;
  canInspect: boolean;
}) {
  const outcome = plan.inspection.outcome;
  const href = `/admin/trucks/${truckId}/inspection`;
  if (outcome === WorkPlanInspectionOutcome.NOT_STARTED) {
    return (
      <div className="space-y-3 px-4 pb-4 sm:pl-[52px]" data-testid="truck-inspection">
        <p className="text-muted-foreground">{messages.inspectionSheetPrompt}</p>
        {canInspect && plan.workOrder ? (
          <Button asChild size="sm"><Link href={href} data-testid="truck-inspection-start"><ClipboardCheck aria-hidden="true" />{messages.inspectionStart}</Link></Button>
        ) : null}
      </div>
    );
  }
  const label = outcome === WorkPlanInspectionOutcome.ISSUES_FOUND ? messages.workPlanIssuesFound : messages.workPlanNoIssuesFound;
  return (
    <div className="-mt-1 px-4 pb-3 pl-[52px]" data-testid="truck-inspection">
      <span className="sr-only">{fillPlaceholders(messages.inspectionRecordedOutcome, { outcome: label })}</span>
      <Link href={href} className="text-sm font-medium text-primary hover:underline" data-testid="truck-inspection-report">{messages.inspectionViewReport}</Link>
    </div>
  );
}


function errorCode(errorValue: ApiError) {
  if (typeof errorValue.body === 'object' && errorValue.body !== null && 'code' in errorValue.body) {
    const code = (errorValue.body as { code?: unknown }).code;
    return typeof code === 'string' ? code : null;
  }
  return null;
}
