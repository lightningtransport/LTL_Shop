'use client';

import Link from 'next/link';
import { useMemo, useState, type ReactNode } from 'react';
import {
  AppCapability,
  JobStatus,
  WorkPlanInspectionOutcome,
  type RecordWorkPlanInspectionInput,
  type TruckWorkPlanDto,
} from '@ltl-shop/shared';
import { DropdownMenu } from 'radix-ui';
import { ArrowUpRight, ChevronDown } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { apiErrorMessage } from '@/lib/api-error-message';
import {
  addAdminWorkPlanJobs,
  assignAdminWorkOrderJob,
  fetchAdminTruckWorkPlan,
  useAdminAssignableMechanics,
} from '@/lib/admin-data';
import { fillPlaceholders } from '@/lib/admin-next-step';
import type { AdminMessages } from '@/lib/admin-messages';
import { useCategories } from '@/lib/shop-data';
import { workPlanJobUiStatusLabel, workPlanReadyReasonMessage, type WorkPlanJobDraft } from '@/lib/work-plan';
import { jobDisplayName } from '@/lib/job-display-name';
import { externalShopLabel } from '@/lib/external-shop';
import { profileInitials } from '@/lib/profile-initials';
import type { TruckStep, TruckStepKey } from '@/lib/truck-stepper';
import { WorkPlanAddWork } from './work-plan-add-work';
import { MechanicPicker, type PickerMechanic } from './mechanic-picker';
import { SideSheet } from './side-sheet';
import { TruckStepIcon, truckStepLabel, truckStepStateLabel } from './truck-stepper';
import { useActionToast } from './action-toast';
import { Button, Card, CardContent, CardHeader, CardTitle } from './ui';

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

const DOT: Record<string, string> = {
  completed: 'bg-shop-success',
  in_progress: 'bg-primary',
  blocked: 'bg-warning',
  external: 'bg-warning',
  cancelled: 'bg-muted-foreground',
  pending: 'border border-muted-foreground bg-transparent',
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
  messages,
  addWorkOpen,
  onAddWorkOpenChange,
  inspectionPending,
  inspectionInNextStep,
  onRecordInspection,
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
  messages: AdminMessages;
  addWorkOpen: boolean;
  onAddWorkOpenChange: (open: boolean) => void;
  inspectionPending: boolean;
  /** The Next step already shows the two inspection buttons (`inspect`); the section only states it. */
  inspectionInNextStep: boolean;
  onRecordInspection: (outcome: RecordWorkPlanInspectionInput['outcome']) => void;
  onPlanUpdated: (next: TruckWorkPlanDto) => Promise<void> | void;
  onError: (message: string | null) => void;
}) {
  const [pendingAction, setPendingAction] = useState<string | null>(null);
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
        if (code === 'OPEN_WORK_ORDER_EXISTS' || /pm/i.test(errorValue.message)) return messages.workPlanPmOpenConflict;
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
    const jobs = jobsFor(key);
    if (!jobs.length) return null;
    return (
      <ul className="divide-y rounded-lg border">
        {jobs.map((job) => {
          // LTR-188 / D24: a Job at an external shop comes back through "Returned" on the Work Order. QC is Safety's (D19).
          const canAssignHere = canAddWork && plan.workOrder && job.status === JobStatus.TO_DO && job.assignedMechanic === null && job.lane !== 'quality_check' && !job.external;
          const name = jobDisplayName(job, messages.helperJobSuffix);
          const href = manageHref(job);
          const owner = job.external ? (
            <span title={job.external.note} data-testid="work-plan-job-external">{externalShopLabel(job.external.kind, messages)}</span>
          ) : job.assignedMechanic ? (
            <span className="inline-flex items-center gap-1">
              <span aria-hidden="true" className="grid size-6 place-items-center rounded-full bg-muted text-xs font-semibold text-foreground">{profileInitials(job.assignedMechanic.name)}</span>
              {`${messages.jobAssignee}: ${job.assignedMechanic.name}`}
            </span>
          ) : job.lane === 'quality_check' ? (
            <span title={messages.workPlanQcHint}>{messages.qcBySafety}</span>
          ) : job.assignedMechanic === null ? (
            <span>{messages.jobUnassigned}</span>
          ) : null;
          return (
            <li key={job.id} className={`flex items-center gap-3 px-3 py-2.5 ${job.helperOfJobId ? 'pl-8' : ''}`} data-testid="truck-job-row" data-status={job.uiStatus}>
              <span aria-hidden="true" className={`size-2.5 shrink-0 rounded-full ${DOT[job.uiStatus] ?? DOT.pending}`} />
              <div className="min-w-0 flex-1">
                <p className={`font-medium ${job.status === JobStatus.CANCELLED ? 'text-muted-foreground line-through' : ''}`}>{name}</p>
                <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                  <span>{workPlanJobUiStatusLabel(job.uiStatus, messages)}</span>
                  {owner ? <><span aria-hidden="true">·</span>{owner}</> : null}
                </p>
              </div>
              {canAssignHere ? (
                <MechanicPicker
                  open={pickerJobId === job.id}
                  onOpenChange={(open) => setPickerJobId(open ? job.id : null)}
                  title={fillPlaceholders(messages.assignJobMechanicFor, { job: job.displayName })}
                  mechanics={job.lane === 'pm' ? pmMechanics : standardMechanics}
                  loading={mechanicsLoading}
                  messages={messages}
                  onPick={(mechanic) => void handleAssign(job.id, mechanic)}
                  trigger={(
                    <Button id={`assign-job-${job.id}`} type="button" size="sm" variant="outline" disabled={Boolean(pendingAction)}>
                      {messages.truckNextStepAssignAction}
                    </Button>
                  )}
                />
              ) : null}
              {href ? (
                <Link
                  href={href}
                  className="tap-inline inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
                  aria-label={fillPlaceholders(messages.manageJobInWorkOrder, { job: name })}
                  title={messages.manageInWorkOrder}
                >
                  <ArrowUpRight aria-hidden="true" className="size-4" />
                </Link>
              ) : null}
            </li>
          );
        })}
      </ul>
    );
  }

  const recorded = plan.inspection.outcome !== WorkPlanInspectionOutcome.NOT_STARTED;

  return (
    <section aria-labelledby="truck-work-plan-title">
      <Card>
        <CardHeader>
          <CardTitle id="truck-work-plan-title" tabIndex={-1}>{messages.workPlanSection}</CardTitle>
          {recorded ? <p className="text-sm text-muted-foreground">{workPlanReadyReasonMessage(plan.readyReason, messages)}</p> : null}
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="space-y-2" aria-label={messages.jobsInPlan}>
            {steps.map((step) => (
              <StepSection
                key={step.key}
                step={step}
                open={isStepOpen(step)}
                onToggle={(open) => onToggleStep(step.key, open)}
                messages={messages}
              >
                {step.key === 'inspection' ? (
                  <InspectionControl
                    plan={plan}
                    messages={messages}
                    canInspect={canInspect && !inspectionInNextStep}
                    pending={inspectionPending || Boolean(pendingAction)}
                    onRecord={onRecordInspection}
                  />
                ) : null}
                {step.key === 'quality_check' && !jobsFor('quality_check').length ? <p className="text-sm text-muted-foreground">{messages.workPlanQcHint}</p> : null}
                {renderJobs(step.key)}
              </StepSection>
            ))}
          </ul>
          {!canAddWork && !canInspect ? (
            <p className="text-sm text-muted-foreground">{messages.permissionReadOnly}</p>
          ) : null}
        </CardContent>
      </Card>

      {canAddWork ? (
        <SideSheet
          open={addWorkOpen}
          title={fillPlaceholders(messages.addWorkPanelTitle, { truck: truckNumber })}
          description={plan.workOrder ? undefined : messages.addWorkPanelNoWorkOrder}
          closeLabel={messages.closeDialog}
          onClose={() => onAddWorkOpenChange(false)}
          testId="work-plan-add-work-panel"
        >
          <div id="work-plan-add-work">
            <WorkPlanAddWork
              plan={plan}
              messages={messages}
              disabled={Boolean(pendingAction)}
              submitting={pendingAction === 'add-work'}
              standardMechanics={standardMechanics}
              onSubmit={handleAddWork}
            />
          </div>
        </SideSheet>
      ) : null}
    </section>
  );
}

function StepSection({ step, open, onToggle, messages, children }: { step: TruckStep; open: boolean; onToggle: (open: boolean) => void; messages: AdminMessages; children?: ReactNode }) {
  const contentId = `truck-step-${step.key}-content`;
  const hasContent = Array.isArray(children) ? children.some(Boolean) : Boolean(children);
  return (
    <li id={`truck-step-${step.key}`} className="scroll-mt-24 rounded-xl border" data-state={step.state}>
      <button
        type="button"
        className="flex min-h-12 w-full items-center gap-2 rounded-xl px-3 text-left text-sm hover:bg-accent"
        aria-expanded={hasContent ? open : undefined}
        aria-controls={hasContent ? contentId : undefined}
        onClick={() => hasContent && onToggle(!open)}
      >
        <TruckStepIcon state={step.state} />
        <span className="font-medium">{truckStepLabel(step.key, messages)}</span>
        <span className="ml-auto text-xs text-muted-foreground">{truckStepStateLabel(step, messages)}</span>
        {hasContent ? <ChevronDown aria-hidden="true" className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} /> : null}
      </button>
      {hasContent && open ? <div id={contentId} className="space-y-3 px-3 pb-3">{children}</div> : null}
    </li>
  );
}

/**
 * D14 / UX-4-003: pending → the two buttons; recorded → the outcome as text with "Change" (a menu
 * with the other outcome), so a recorded result never looks like a primary button.
 */
function InspectionControl({
  plan,
  messages,
  canInspect,
  pending,
  onRecord,
}: {
  plan: TruckWorkPlanDto;
  messages: AdminMessages;
  canInspect: boolean;
  pending: boolean;
  onRecord: (outcome: RecordWorkPlanInspectionInput['outcome']) => void;
}) {
  const outcome = plan.inspection.outcome;
  if (outcome === WorkPlanInspectionOutcome.NOT_STARTED) {
    return (
      <div className="space-y-2" data-testid="truck-inspection">
        <p className="text-sm text-muted-foreground">{messages.workPlanInspectionNotStarted}</p>
        {canInspect ? <InspectionButtons messages={messages} pending={pending} onRecord={onRecord} /> : null}
      </div>
    );
  }
  const label = outcome === WorkPlanInspectionOutcome.ISSUES_FOUND ? messages.workPlanIssuesFound : messages.workPlanNoIssuesFound;
  const other = outcome === WorkPlanInspectionOutcome.ISSUES_FOUND ? WorkPlanInspectionOutcome.NO_ISSUES_FOUND : WorkPlanInspectionOutcome.ISSUES_FOUND;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2" data-testid="truck-inspection">
      <p className="text-sm">{fillPlaceholders(messages.inspectionRecordedOutcome, { outcome: label })}</p>
      {canInspect ? (
        <DropdownMenu.Root modal={false}>
          <DropdownMenu.Trigger asChild>
            <Button type="button" size="sm" variant="ghost" disabled={pending}>
              {messages.inspectionChange}
              <ChevronDown aria-hidden="true" className="ml-1 size-4" />
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="end" sideOffset={6} className="z-50 min-w-48 rounded-xl border bg-popover p-1 text-popover-foreground shadow-soft">
              <DropdownMenu.Item
                className="flex min-h-11 cursor-pointer select-none items-center rounded-lg px-3 text-sm outline-none data-[highlighted]:bg-accent"
                onSelect={() => onRecord(other)}
              >
                {other === WorkPlanInspectionOutcome.ISSUES_FOUND ? messages.workPlanIssuesFound : messages.workPlanNoIssuesFound}
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      ) : null}
    </div>
  );
}

/** The two D14 buttons, also used by the Next step `inspect`. */
export function InspectionButtons({ messages, pending, onRecord }: { messages: AdminMessages; pending: boolean; onRecord: (outcome: RecordWorkPlanInspectionInput['outcome']) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => onRecord(WorkPlanInspectionOutcome.NO_ISSUES_FOUND)}>
        {messages.workPlanNoIssuesFound}
      </Button>
      <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => onRecord(WorkPlanInspectionOutcome.ISSUES_FOUND)}>
        {messages.workPlanIssuesFound}
      </Button>
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
