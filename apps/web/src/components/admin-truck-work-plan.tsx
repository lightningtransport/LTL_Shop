'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  AppCapability,
  JobStatus,
  WorkPlanInspectionOutcome,
  type RecordWorkPlanInspectionInput,
  type TruckWorkPlanDto,
  type WorkPlanMandatoryPhaseDto,
} from '@ltl-shop/shared';
import { ApiError } from '@/lib/api';
import {
  addAdminWorkPlanJobs,
  assignAdminWorkOrderJob,
  completeAdminJob,
  fetchAdminTruckWorkPlan,
  recordAdminWorkPlanInspection,
  unassignAdminWorkOrderJob,
  useAdminAssignableMechanics,
} from '@/lib/admin-data';
import { fillPlaceholders } from '@/lib/admin-next-step';
import type { AdminMessages } from '@/lib/admin-messages';
import { useCategories } from '@/lib/shop-data';
import {
  workPlanJobUiStatusLabel,
  workPlanJobUiStatusVariant,
  workPlanMandatoryStatusLabel,
  workPlanMandatoryStatusVariant,
  workPlanNextStepCategoryName,
  workPlanNextStepCtaLabel,
  workPlanPhaseLabel,
  workPlanReadyReasonMessage,
  workPlanRemainingSummary,
  type WorkPlanJobDraft,
} from '@/lib/work-plan';
import { WorkPlanAddWork } from './work-plan-add-work';
import { useActionToast } from './action-toast';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, CompactEmpty, Select } from './ui';

type Feedback = { kind: 'success' | 'error'; message: string };

export function AdminTruckWorkPlan({
  truckId,
  plan,
  messages,
  onPlanUpdated,
}: {
  truckId: string;
  plan: TruckWorkPlanDto;
  messages: AdminMessages;
  onPlanUpdated: (next: TruckWorkPlanDto) => Promise<void> | void;
}) {
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const { showToast } = useActionToast();
  const [addWorkOpen, setAddWorkOpen] = useState(plan.inspection.outcome === WorkPlanInspectionOutcome.ISSUES_FOUND && plan.jobs.length === 0);
  const [preferredCategoryName, setPreferredCategoryName] = useState<string | null>(null);
  const canInspect = plan.capabilities.canRecordInspection;
  const canAddWork = plan.capabilities.canAddWork;
  const ready = plan.readiness === 'ready';
  useCategories(true);
  // LTR-154 / D11: the Manager sets each Job's one owner here (PM job → PM mechanic).
  const { data: mechanicPages } = useAdminAssignableMechanics();
  const { standardMechanics, pmMechanics } = useMemo(() => {
    const active = (mechanicPages?.flatMap((page) => page.items) ?? []).filter((mechanic) => mechanic.active);
    return {
      standardMechanics: active.filter((mechanic) => mechanic.capabilities.includes(AppCapability.MECHANIC_STANDARD)),
      pmMechanics: active.filter((mechanic) => mechanic.capabilities.includes(AppCapability.MECHANIC_PM)),
    };
  }, [mechanicPages]);

  function openAddWork(categoryName?: string | null) {
    setPreferredCategoryName(categoryName ?? null);
    setAddWorkOpen(true);
  }

  function mutationError(errorValue: unknown, fallback: string, forbidden: string) {
    if (errorValue instanceof ApiError) {
      if (errorValue.status === 403) return forbidden;
      if (errorValue.status === 409) return messages.mutationConflict;
      if (errorValue.status === 400) {
        const code = errorCode(errorValue);
        if (code === 'OPEN_WORK_ORDER_EXISTS' || /pm/i.test(errorValue.message)) return messages.workPlanPmOpenConflict;
        return errorValue.message || messages.mutationBadRequest;
      }
    }
    return fallback;
  }

  async function run<T>(action: string, operation: () => Promise<T>) {
    if (pendingAction) return null;
    setPendingAction(action);
    setFeedback(null);
    try {
      return await operation();
    } finally {
      setPendingAction(null);
    }
  }

  async function handleInspection(outcome: RecordWorkPlanInspectionInput['outcome']) {
    try {
      const next = await run('inspection', () => recordAdminWorkPlanInspection(truckId, outcome));
      if (!next) return;
      await onPlanUpdated(next);
      if (outcome === WorkPlanInspectionOutcome.ISSUES_FOUND) openAddWork(null);
      setFeedback({ kind: 'success', message: messages.workPlanInspectionRecorded });
      showToast('success', messages.workPlanInspectionRecorded);
    } catch (errorValue) {
      setFeedback({
        kind: 'error',
        message: mutationError(errorValue, messages.workPlanInspectionFailed, messages.workPlanInspectionForbidden),
      });
    }
  }

  async function handleAddWork(jobs: WorkPlanJobDraft[]) {
    try {
      const next = await run('add-work', () => addAdminWorkPlanJobs(truckId, {
        jobs: jobs.map((job) => ({
          catalogJobId: job.catalogJobId,
          categoryId: job.categoryId,
          displayName: job.displayName,
          customDescription: job.customDescription,
        })),
        expectedVersion: plan.workOrder?.version,
      }));
      if (!next) return false;
      await onPlanUpdated(next);
      setAddWorkOpen(false);
      setFeedback({ kind: 'success', message: messages.workPlanJobsAdded });
      showToast('success', messages.workPlanJobsAdded);
      return true;
    } catch (errorValue) {
      setFeedback({
        kind: 'error',
        message: mutationError(errorValue, messages.workPlanAddWorkFailed, messages.workPlanAddWorkForbidden),
      });
      return false;
    }
  }

  async function handleAssign(jobId: string, mechanicId: string) {
    if (!plan.workOrder) return;
    const workOrder = plan.workOrder;
    try {
      await run(`assign-${jobId}`, () => (mechanicId
        ? assignAdminWorkOrderJob(workOrder.id, jobId, { mechanicId, expectedVersion: workOrder.version })
        : unassignAdminWorkOrderJob(workOrder.id, jobId, workOrder.version)));
      const next = await fetchAdminTruckWorkPlan(truckId);
      await onPlanUpdated(next);
      const message = mechanicId ? messages.assignJobSuccess : messages.unassignJobSuccess;
      setFeedback({ kind: 'success', message });
      showToast('success', message);
    } catch (errorValue) {
      setFeedback({
        kind: 'error',
        message: mutationError(errorValue, messages.assignmentGenericError, messages.workPlanAddWorkForbidden),
      });
    }
  }

  async function handleCompleteJob(jobId: string) {
    if (!plan.workOrder) return;
    try {
      await run(`complete-${jobId}`, () => completeAdminJob(jobId, { expectedVersion: plan.workOrder!.version }));
      const next = await fetchAdminTruckWorkPlan(truckId);
      await onPlanUpdated(next);
      setFeedback({ kind: 'success', message: messages.workPlanJobCompleted });
      showToast('success', messages.workPlanJobCompleted);
    } catch (errorValue) {
      setFeedback({
        kind: 'error',
        message: mutationError(errorValue, messages.workPlanCompleteJobFailed, messages.workPlanCompleteJobForbidden),
      });
    }
  }

  return (
    <section aria-labelledby="truck-work-plan-title">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle id="truck-work-plan-title">{messages.workPlanSection}</CardTitle>
              <CardDescription>{messages.workPlanDescription}</CardDescription>
            </div>
            {canAddWork ? (
              <Button
                type="button"
                variant={addWorkOpen ? 'secondary' : 'default'}
                onClick={() => {
                  if (addWorkOpen) {
                    setAddWorkOpen(false);
                    setPreferredCategoryName(null);
                  } else {
                    openAddWork(workPlanNextStepCategoryName(plan.readyReason));
                  }
                }}
                disabled={Boolean(pendingAction)}
                aria-expanded={addWorkOpen}
                aria-controls="work-plan-add-work"
              >
                {addWorkOpen ? messages.workPlanHideAddWork : messages.workPlanAddWork}
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {feedback ? (
            <div
              className={feedback.kind === 'error'
                ? 'rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive'
                : 'rounded-xl border border-shop-success/30 bg-shop-success/10 px-3 py-2 text-sm text-shop-success'}
              role={feedback.kind === 'error' ? 'alert' : 'status'}
              aria-live="polite"
            >
              {feedback.message}
              {feedback.kind === 'error' && feedback.message === messages.mutationConflict ? (
                <Button type="button" variant="outline" size="sm" className="ml-3" onClick={() => void onPlanUpdated(plan)}>
                  {messages.reloadTruck}
                </Button>
              ) : null}
            </div>
          ) : null}

          <InspectionPanel
            plan={plan}
            messages={messages}
            canInspect={canInspect}
            pending={Boolean(pendingAction)}
            onRecord={(outcome) => void handleInspection(outcome)}
          />

          {addWorkOpen && canAddWork ? (
            <div id="work-plan-add-work" className="rounded-xl border p-3">
              <WorkPlanAddWork
                plan={plan}
                messages={messages}
                disabled={Boolean(pendingAction)}
                submitting={pendingAction === 'add-work'}
                preferredCategoryName={preferredCategoryName}
                onSubmit={handleAddWork}
              />
            </div>
          ) : null}

          <WorkPlanSummary
            plan={plan}
            messages={messages}
            ready={ready}
            canAddWork={canAddWork}
            onAddWorkStep={(categoryName) => openAddWork(categoryName)}
          />

          <div>
            <h3 className="mb-2 font-medium">{messages.jobsInPlan}</h3>
            {plan.jobs.length ? (
              <ul className="divide-y rounded-xl border" aria-label={messages.jobsInPlan}>
                {plan.jobs.map((job) => (
                  <li key={job.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium">{job.displayName}</p>
                      <p className="text-xs text-muted-foreground">{job.category.name}</p>
                      {job.assignedMechanic !== undefined ? (
                        <p className="text-xs text-muted-foreground">
                          {job.assignedMechanic ? `${messages.jobAssignee}: ${job.assignedMechanic.name}` : messages.jobUnassigned}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {canAddWork && plan.workOrder && job.status === JobStatus.TO_DO && job.assignedMechanic !== undefined ? (
                        <Select
                          id={`assign-job-${job.id}`}
                          aria-label={fillPlaceholders(messages.assignJobMechanicFor, { job: job.displayName })}
                          className="w-full sm:w-44"
                          value={job.assignedMechanic?.id ?? ''}
                          disabled={Boolean(pendingAction)}
                          onChange={(event) => void handleAssign(job.id, event.target.value)}
                        >
                          <option value="">{messages.jobUnassigned}</option>
                          {withCurrentAssignee(job.lane === 'pm' ? pmMechanics : standardMechanics, job.assignedMechanic).map((mechanic) => (
                            <option key={mechanic.id} value={mechanic.id}>{mechanic.name}</option>
                          ))}
                        </Select>
                      ) : null}
                      <Badge variant={workPlanJobUiStatusVariant(job.uiStatus)} className="normal-case tracking-normal">
                        {workPlanJobUiStatusLabel(job.uiStatus, messages)}
                      </Badge>
                      {/* LTR-148: the PM job is finished from the PM service (mileage + parts), not "Mark complete". */}
                      {job.lane === 'pm' && job.status === JobStatus.TO_DO ? (
                        <span className="text-xs text-muted-foreground">{messages.pmJobCompletedFromPmService}</span>
                      ) : null}
                      {canAddWork && plan.workOrder && job.status === JobStatus.TO_DO && job.lane !== 'pm' ? (
                        <Button
                          type="button"
                          size="sm"
                          // LTR-158 / D15: primary only on Quality Check (the Manager's step); secondary on mechanics' Jobs.
                          variant={job.lane === 'quality_check' ? 'default' : 'ghost'}
                          disabled={Boolean(pendingAction)}
                          onClick={() => void handleCompleteJob(job.id)}
                        >
                          {messages.completeJobAction}
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <CompactEmpty>{messages.workPlanNoJobs}</CompactEmpty>
            )}
          </div>

          {plan.workOrder ? (
            <Button asChild variant="outline">
              <Link href={`/admin/work-orders/${plan.workOrder.id}`}>
                {messages.workPlanOpenWorkOrder}: {plan.workOrder.displayId}
              </Link>
            </Button>
          ) : null}

          {!canAddWork && !canInspect ? (
            <p className="text-sm text-muted-foreground">{messages.permissionReadOnly}</p>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}

function InspectionPanel({
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
  return (
    <div className="space-y-3 rounded-xl border p-3" aria-labelledby="work-plan-inspection-title">
      <div>
        <h3 id="work-plan-inspection-title" className="font-medium">{messages.workPlanInspectionTitle}</h3>
        <p className="text-sm text-muted-foreground">{messages.workPlanInspectionDescription}</p>
      </div>
      {/* LTR-112: always state the inspection result, never a Ready label here. */}
      {outcome === 'not_started' ? (
        <p className="text-sm">{messages.workPlanInspectionNotStarted}</p>
      ) : outcome === 'no_issues_found' ? (
        <p className="text-sm"><span className="font-medium">{messages.workPlanNoIssuesFound}.</span> {messages.workPlanNoIssuesFoundHelp}</p>
      ) : (
        <p className="text-sm"><span className="font-medium">{messages.workPlanIssuesFound}.</span> {messages.workPlanIssuesFoundHelp}</p>
      )}
      {canInspect ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={outcome === 'no_issues_found' ? 'secondary' : 'outline'}
            disabled={pending}
            aria-pressed={outcome === 'no_issues_found'}
            onClick={() => onRecord(WorkPlanInspectionOutcome.NO_ISSUES_FOUND)}
          >
            {messages.workPlanNoIssuesFound}
          </Button>
          <Button
            type="button"
            variant={outcome === 'issues_found' ? 'default' : 'outline'}
            disabled={pending}
            aria-pressed={outcome === 'issues_found'}
            onClick={() => onRecord(WorkPlanInspectionOutcome.ISSUES_FOUND)}
          >
            {messages.workPlanIssuesFound}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function WorkPlanSummary({
  plan,
  messages,
  ready,
  canAddWork,
  onAddWorkStep,
}: {
  plan: TruckWorkPlanDto;
  messages: AdminMessages;
  ready: boolean;
  canAddWork: boolean;
  onAddWorkStep: (categoryName: string | null) => void;
}) {
  const nextStepLabel = workPlanNextStepCtaLabel(plan.readyReason, messages);
  const nextStepCategory = workPlanNextStepCategoryName(plan.readyReason);

  return (
    <div className="space-y-3 rounded-xl border p-3" aria-live="polite">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={ready ? 'success' : 'warning'} className="normal-case tracking-normal">
          {ready ? messages.workPlanReady : messages.workPlanNotReady}
        </Badge>
        <Badge variant="outline" className="normal-case tracking-normal">
          {workPlanPhaseLabel(plan.phase, messages)}
        </Badge>
      </div>
      {ready ? (
        <p className="text-sm">{messages.workPlanReadyAutomatic}</p>
      ) : (
        <p className="text-sm font-medium">{workPlanRemainingSummary(plan.remainingJobCount, messages)}</p>
      )}
      <p className="text-sm text-muted-foreground">{workPlanReadyReasonMessage(plan.readyReason, messages)}</p>
      {!ready && canAddWork && nextStepLabel ? (
        <Button type="button" size="sm" variant="outline" onClick={() => onAddWorkStep(nextStepCategory)}>
          {nextStepLabel}
        </Button>
      ) : null}
      <div>
        <p className="text-xs font-medium text-muted-foreground">{messages.workPlanMandatoryTitle}</p>
        <ul className="mt-2 space-y-1 text-sm">
          {/* LTR-144: PM is a mandatory step. */}
          <MandatoryRow label={messages.pm} phase={plan.mandatory.pm} messages={messages} />
          <MandatoryRow label={messages.alignment} phase={plan.mandatory.alignment} messages={messages} />
          <MandatoryRow label={messages.detailing} phase={plan.mandatory.detailing} messages={messages} />
          <MandatoryRow label={messages.qualityCheck} phase={plan.mandatory.qualityCheck} messages={messages} />
        </ul>
      </div>
    </div>
  );
}

function MandatoryRow({
  label,
  phase,
  messages,
}: {
  label: string;
  phase: WorkPlanMandatoryPhaseDto;
  messages: AdminMessages;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2">
      <Badge variant="outline" className="normal-case tracking-normal">{label}</Badge>
      <Badge variant={workPlanMandatoryStatusVariant(phase.status)} className="normal-case tracking-normal">
        {workPlanMandatoryStatusLabel(phase.status, messages)}
        {phase.jobCount ? ` · ${phase.jobCount}` : ''}
      </Badge>
    </li>
  );
}

function errorCode(errorValue: ApiError) {
  if (typeof errorValue.body === 'object' && errorValue.body !== null && 'code' in errorValue.body) {
    const code = (errorValue.body as { code?: unknown }).code;
    return typeof code === 'string' ? code : null;
  }
  return null;
}

/** Keep the current owner selectable even when they are no longer in the assignable list. */
function withCurrentAssignee<M extends { id: string; name: string }>(
  mechanics: M[],
  current: { id: string; name: string } | null | undefined,
): Array<{ id: string; name: string }> {
  if (!current || mechanics.some((mechanic) => mechanic.id === current.id)) return mechanics;
  return [current, ...mechanics];
}
