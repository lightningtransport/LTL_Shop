'use client';

import { useMemo, useState } from 'react';
import {
  AppCapability,
  JobStatus,
  WorkPlanInspectionOutcome,
  type RecordWorkPlanInspectionInput,
  type TruckWorkPlanDto,
} from '@ltl-shop/shared';
import { ApiError } from '@/lib/api';
import { apiErrorMessage } from '@/lib/api-error-message';
import {
  addAdminWorkPlanJobs,
  assignAdminWorkOrderJob,
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
  type WorkPlanJobDraft,
} from '@/lib/work-plan';
import { AdminReadinessTracker } from './admin-readiness-tracker';
import { WorkPlanAddWork } from './work-plan-add-work';
import { useActionToast } from './action-toast';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, CompactEmpty, Select } from './ui';

type Feedback = { kind: 'success' | 'error'; message: string };

const JOB_ROW_GRID = 'lg:grid-cols-[minmax(0,1fr)_13rem_7.5rem]';

/**
 * The Truck Work Plan card: readiness tracker (with the D14 inspection), the "Add work" form (D6) and
 * the read-only Jobs summary. LTR-174: assigning, reassigning and completing owned Jobs happens on the
 * Work Order; the Truck keeps the mechanic Select only for Jobs with no owner (the `assign` Next step).
 */
export function AdminTruckWorkPlan({
  truckId,
  plan,
  messages,
  addWorkOpen,
  onAddWorkOpenChange,
  onPlanUpdated,
}: {
  truckId: string;
  plan: TruckWorkPlanDto;
  messages: AdminMessages;
  addWorkOpen: boolean;
  onAddWorkOpenChange: (open: boolean) => void;
  onPlanUpdated: (next: TruckWorkPlanDto) => Promise<void> | void;
}) {
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const { showToast } = useActionToast();
  const [preferredCategoryName, setPreferredCategoryName] = useState<string | null>(null);
  const canInspect = plan.capabilities.canRecordInspection;
  const canAddWork = plan.capabilities.canAddWork;
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
    onAddWorkOpenChange(true);
  }

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
          ...(job.assignedMechanicId ? { assignedMechanicId: job.assignedMechanicId } : {}),
        })),
        expectedVersion: plan.workOrder?.version,
      }));
      if (!next) return false;
      await onPlanUpdated(next);
      onAddWorkOpenChange(false);
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

  return (
    <section aria-labelledby="truck-work-plan-title">
      <Card>
        <CardHeader>
          <CardTitle id="truck-work-plan-title">{messages.workPlanSection}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 divide-y [&>*+*]:pt-5">
          {feedback ? (
            <div
              className={feedback.kind === 'error'
                ? 'rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive-text'
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

          <AdminReadinessTracker
            plan={plan}
            messages={messages}
            inspection={(
              <InspectionPanel
                plan={plan}
                messages={messages}
                canInspect={canInspect}
                pending={Boolean(pendingAction)}
                onRecord={(outcome) => void handleInspection(outcome)}
              />
            )}
          />

          {addWorkOpen && canAddWork ? (
            <div id="work-plan-add-work">
              <WorkPlanAddWork
                plan={plan}
                messages={messages}
                disabled={Boolean(pendingAction)}
                submitting={pendingAction === 'add-work'}
                preferredCategoryName={preferredCategoryName}
                standardMechanics={standardMechanics}
                onSubmit={handleAddWork}
              />
            </div>
          ) : null}

          <div>
            <h3 className="group-title mb-2">{messages.jobsInPlan}</h3>
            {plan.jobs.length ? (
              <>
                <div className={`hidden border-b pb-2 text-xs text-muted-foreground lg:grid lg:gap-3 ${JOB_ROW_GRID}`} aria-hidden="true">
                  <span>{messages.jobTableJob}</span>
                  <span>{messages.jobTableMechanic}</span>
                  <span>{messages.jobTableStatus}</span>
                </div>
                <ul className="divide-y" aria-label={messages.jobsInPlan}>
                  {plan.jobs.map((job) => {
                    // LTR-174: the Truck assigns only Jobs with no owner (the `assign` Next step); the rest is done on the Work Order.
                    // LTR-164 (#2) / D19: Quality Check has no picker (Safety takes it).
                    const canAssignHere = canAddWork && plan.workOrder && job.status === JobStatus.TO_DO && job.assignedMechanic === null && job.lane !== 'quality_check';
                    return (
                      <li key={job.id} className={`space-y-2 py-3 text-sm first:pt-0 lg:grid lg:items-center lg:gap-3 lg:space-y-0 ${JOB_ROW_GRID}`}>
                        <div className="flex items-start justify-between gap-3 lg:contents">
                          <div className="min-w-0 lg:order-1">
                            <p className="font-medium">{job.displayName}</p>
                            <p className="text-xs text-muted-foreground">{job.category.name}</p>
                          </div>
                          <div className="shrink-0 lg:order-3">
                            <Badge variant={workPlanJobUiStatusVariant(job.uiStatus)}>
                              {workPlanJobUiStatusLabel(job.uiStatus, messages)}
                            </Badge>
                          </div>
                        </div>
                        <div className="min-w-0 lg:order-2">
                          {job.assignedMechanic === undefined ? null : canAssignHere ? (
                            <Select
                              id={`assign-job-${job.id}`}
                              aria-label={fillPlaceholders(messages.assignJobMechanicFor, { job: job.displayName })}
                              className="h-9 w-full text-sm sm:w-52 lg:w-full"
                              value=""
                              disabled={Boolean(pendingAction)}
                              onChange={(event) => { if (event.target.value) void handleAssign(job.id, event.target.value); }}
                            >
                              <option value="">{messages.jobUnassigned}</option>
                              {(job.lane === 'pm' ? pmMechanics : standardMechanics).map((mechanic) => (
                                <option key={mechanic.id} value={mechanic.id}>{mechanic.name}</option>
                              ))}
                            </Select>
                          ) : (
                            <p className="text-xs text-muted-foreground" title={job.lane === 'quality_check' ? messages.workPlanQcHint : undefined}>
                              {job.assignedMechanic ? `${messages.jobAssignee}: ${job.assignedMechanic.name}` : messages.jobUnassigned}
                            </p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : (
              <CompactEmpty>{messages.workPlanNoJobs}</CompactEmpty>
            )}
          </div>

          {!canAddWork && !canInspect ? (
            <p className="text-sm text-muted-foreground">{messages.permissionReadOnly}</p>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}

/** The Inspection row of the readiness tracker: the recorded outcome and the D14 buttons. */
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
    <div className="space-y-2" aria-labelledby="work-plan-inspection-title">
      {/* LTR-112: always state the inspection result, never a Ready label here. */}
      {outcome === 'not_started' ? (
        <p className="text-sm text-muted-foreground">{messages.workPlanInspectionNotStarted}</p>
      ) : outcome === 'no_issues_found' ? (
        <p className="text-sm text-muted-foreground">{messages.workPlanNoIssuesFoundHelp}</p>
      ) : (
        <p className="text-sm text-muted-foreground">{messages.workPlanIssuesFoundHelp}</p>
      )}
      {canInspect ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={outcome === 'no_issues_found' ? 'secondary' : 'outline'}
            disabled={pending}
            aria-pressed={outcome === 'no_issues_found'}
            onClick={() => onRecord(WorkPlanInspectionOutcome.NO_ISSUES_FOUND)}
          >
            {messages.workPlanNoIssuesFound}
          </Button>
          <Button
            type="button"
            size="sm"
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

function errorCode(errorValue: ApiError) {
  if (typeof errorValue.body === 'object' && errorValue.body !== null && 'code' in errorValue.body) {
    const code = (errorValue.body as { code?: unknown }).code;
    return typeof code === 'string' ? code : null;
  }
  return null;
}
