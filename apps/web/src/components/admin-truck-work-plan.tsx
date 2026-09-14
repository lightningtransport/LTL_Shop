'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ApiError } from '@/lib/api';
import { addAdminWorkPlanJobs, recordAdminWorkPlanInspection } from '@/lib/admin-data';
import type { AdminMessages } from '@/lib/admin-messages';
import { useCategories } from '@/lib/shop-data';
import {
  shouldShowQualityCheckMandatory,
  workPlanJobUiStatusLabel,
  workPlanJobUiStatusVariant,
  workPlanMandatoryStatusLabel,
  workPlanPhaseLabel,
  workPlanReadyReasonMessage,
  workPlanRemainingSummary,
  type TruckWorkPlanDto,
  type WorkPlanInspectionOutcome,
  type WorkPlanJobDraft,
  type WorkPlanMandatoryPhaseDto,
} from '@/lib/work-plan';
import { WorkPlanAddWork } from './work-plan-add-work';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, CompactEmpty } from './ui';

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
  const [addWorkOpen, setAddWorkOpen] = useState(plan.inspection.outcome === 'issues_found' && plan.jobs.length === 0);
  const canInspect = plan.capabilities.canRecordInspection;
  const canAddWork = plan.capabilities.canAddWork;
  const ready = plan.readiness === 'ready';
  useCategories(true);

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

  async function handleInspection(outcome: Exclude<WorkPlanInspectionOutcome, 'not_started'>) {
    try {
      const next = await run('inspection', () => recordAdminWorkPlanInspection(truckId, outcome));
      if (!next) return;
      await onPlanUpdated(next);
      if (outcome === 'issues_found') setAddWorkOpen(true);
      setFeedback({ kind: 'success', message: messages.workPlanInspectionRecorded });
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
      return true;
    } catch (errorValue) {
      setFeedback({
        kind: 'error',
        message: mutationError(errorValue, messages.workPlanAddWorkFailed, messages.workPlanAddWorkForbidden),
      });
      return false;
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
                onClick={() => setAddWorkOpen((open) => !open)}
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
                onSubmit={handleAddWork}
              />
            </div>
          ) : null}

          <WorkPlanSummary plan={plan} messages={messages} ready={ready} />

          <div>
            <h3 className="mb-2 font-medium">{messages.jobsInPlan}</h3>
            {plan.jobs.length ? (
              <ul className="divide-y rounded-xl border" aria-label={messages.jobsInPlan}>
                {plan.jobs.map((job) => (
                  <li key={job.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium">{job.displayName}</p>
                      <p className="text-xs text-muted-foreground">{job.category.name}</p>
                    </div>
                    <Badge variant={workPlanJobUiStatusVariant(job.uiStatus)} className="normal-case tracking-normal">
                      {workPlanJobUiStatusLabel(job.uiStatus, messages)}
                    </Badge>
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
  onRecord: (outcome: Exclude<WorkPlanInspectionOutcome, 'not_started'>) => void;
}) {
  const outcome = plan.inspection.outcome;
  return (
    <div className="space-y-3 rounded-xl border p-3" aria-labelledby="work-plan-inspection-title">
      <div>
        <h3 id="work-plan-inspection-title" className="font-medium">{messages.workPlanInspectionTitle}</h3>
        <p className="text-sm text-muted-foreground">{messages.workPlanInspectionDescription}</p>
      </div>
      {outcome === 'not_started' ? (
        <p className="text-sm">{messages.workPlanInspectionNotStarted}</p>
      ) : outcome === 'no_issues_found' ? (
        <p className="text-sm">{messages.workPlanNoIssuesFoundHelp}</p>
      ) : null}
      {canInspect ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={outcome === 'no_issues_found' ? 'secondary' : 'outline'}
            disabled={pending}
            aria-pressed={outcome === 'no_issues_found'}
            onClick={() => onRecord('no_issues_found')}
          >
            {messages.workPlanNoIssuesFound}
          </Button>
          <Button
            type="button"
            variant={outcome === 'issues_found' ? 'default' : 'outline'}
            disabled={pending}
            aria-pressed={outcome === 'issues_found'}
            onClick={() => onRecord('issues_found')}
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
}: {
  plan: TruckWorkPlanDto;
  messages: AdminMessages;
  ready: boolean;
}) {
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
      <div>
        <p className="text-xs font-medium text-muted-foreground">{messages.workPlanMandatoryTitle}</p>
        <ul className="mt-2 space-y-1 text-sm">
          <MandatoryRow label={messages.alignment} phase={plan.mandatory.alignment} messages={messages} />
          <MandatoryRow label={messages.detailing} phase={plan.mandatory.detailing} messages={messages} />
          {shouldShowQualityCheckMandatory(plan) ? (
            <MandatoryRow label={messages.qualityCheck} phase={plan.mandatory.qualityCheck} messages={messages} />
          ) : null}
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
      <span>{label}</span>
      <span className="text-muted-foreground">
        {workPlanMandatoryStatusLabel(phase.status, messages)}
        {phase.jobCount ? ` · ${phase.jobCount}` : ''}
      </span>
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
