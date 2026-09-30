'use client';

import type { ReactNode } from 'react';
import { WorkPlanInspectionOutcome, WorkPlanJobLane, type TruckWorkPlanDto, type WorkPlanMandatoryPhaseDto } from '@ltl-shop/shared';
import type { AdminMessages } from '@/lib/admin-messages';
import {
  workPlanMandatoryStatusLabel,
  workPlanMandatoryStatusVariant,
  workPlanReadyReasonMessage,
  workPlanRemainingSummary,
} from '@/lib/work-plan';
import { Badge, type BadgeProps } from './ui';

/**
 * LTR-174: "Can this Truck leave, and if not, what blocks it?" — one row per step of the Work Plan
 * (Inspection, PM, Alignment, Detailing, Quality Check, Close Work Order) with the status the DTO
 * already carries. No new calculation and no percentages: the API derives readiness (D1) and this
 * only lays it out. The Inspection row hosts the D14 buttons ("No issues found" / "Issues found").
 */
export function AdminReadinessTracker({
  plan,
  messages,
  inspection,
  renderJobs,
}: {
  plan: TruckWorkPlanDto;
  messages: AdminMessages;
  /** The Inspection row content: the recorded outcome and, for the Manager, the two D14 buttons. */
  inspection: ReactNode;
  /** The Jobs that belong to a step (one list, no second table): Job · Mechanic · Status rows. */
  renderJobs: (lanes: WorkPlanJobLane[]) => ReactNode;
}) {
  const ready = plan.readiness === 'ready';
  const close = closeWorkOrderStatus(plan, messages);
  // No Work Order yet: the only step that exists is the arrival inspection (D14). PM, Alignment, Detailing,
  // Quality Check and Close belong to the Work Order that the inspection / Add work creates.
  if (!plan.workOrder) {
    return (
      <div className="space-y-3" aria-live="polite">
        {/* Once the inspection is recorded, the API's reason says what the Work Order still needs. */}
        {plan.inspection.outcome !== WorkPlanInspectionOutcome.NOT_STARTED ? (
          <p className="text-sm text-muted-foreground">{workPlanReadyReasonMessage(plan.readyReason, messages)}</p>
        ) : null}
        <ul className="divide-y text-sm" aria-label={messages.jobsInPlan}>
          <TrackerRow
            label={<span id="work-plan-inspection-title" title={messages.workPlanInspectionDescription}>{messages.inspection}</span>}
            badge={inspectionBadge(plan.inspection.outcome, messages)}
          >
            {inspection}
          </TrackerRow>
        </ul>
      </div>
    );
  }
  return (
    <div className="space-y-3" aria-live="polite">
      <div>
        <h3 className="group-title">{messages.readiness}</h3>
        {ready ? (
          <p className="text-sm">{messages.workPlanReadyAutomatic}</p>
        ) : (
          <p className="text-sm font-medium">{workPlanRemainingSummary(plan.remainingJobCount, messages)}</p>
        )}
        <p className="text-sm text-muted-foreground">{workPlanReadyReasonMessage(plan.readyReason, messages)}</p>
      </div>
      {/* One list: the step, its status, and the Jobs of that step underneath (LTR-174: no second Jobs table). */}
      <ul className="divide-y text-sm" aria-label={messages.jobsInPlan}>
        <TrackerRow
          label={<span id="work-plan-inspection-title" title={messages.workPlanInspectionDescription}>{messages.inspection}</span>}
          badge={inspectionBadge(plan.inspection.outcome, messages)}
        >
          {inspection}
          {renderJobs([WorkPlanJobLane.INSPECTION])}
        </TrackerRow>
        <TrackerRow label={messages.shopWork} badge={shopWorkBadge(plan, messages)}>
          {renderJobs([WorkPlanJobLane.SHOP_WORK])}
        </TrackerRow>
        <MandatoryRow label={messages.pm} phase={plan.mandatory.pm} messages={messages}>{renderJobs([WorkPlanJobLane.PM])}</MandatoryRow>
        <MandatoryRow label={messages.alignment} phase={plan.mandatory.alignment} messages={messages}>{renderJobs([WorkPlanJobLane.ALIGNMENT])}</MandatoryRow>
        <MandatoryRow label={messages.detailing} phase={plan.mandatory.detailing} messages={messages}>{renderJobs([WorkPlanJobLane.DETAILING])}</MandatoryRow>
        <MandatoryRow label={messages.qualityCheck} phase={plan.mandatory.qualityCheck} messages={messages}>{renderJobs([WorkPlanJobLane.QUALITY_CHECK])}</MandatoryRow>
        <TrackerRow label={messages.readinessCloseWorkOrder} badge={<Badge variant={close.variant}>{close.label}</Badge>} />
      </ul>
    </div>
  );
}

function TrackerRow({ label, badge, children }: { label: ReactNode; badge: ReactNode; children?: ReactNode }) {
  return (
    <li className="space-y-2 py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">{label}</span>
        {badge}
      </div>
      {children}
    </li>
  );
}

function MandatoryRow({ label, phase, messages, children }: { label: string; phase: WorkPlanMandatoryPhaseDto; messages: AdminMessages; children?: ReactNode }) {
  return (
    <TrackerRow
      label={label}
      badge={(
        <Badge variant={workPlanMandatoryStatusVariant(phase.status)}>
          {workPlanMandatoryStatusLabel(phase.status, messages)}
          {phase.remainingCount > 0 ? ` · ${phase.remainingCount}` : ''}
        </Badge>
      )}
    >
      {children}
    </TrackerRow>
  );
}

/** Shop Work is not a mandatory phase: it only reads its own Jobs (nothing derived). */
function shopWorkBadge(plan: TruckWorkPlanDto, messages: AdminMessages) {
  const jobs = plan.jobs.filter((job) => job.lane === WorkPlanJobLane.SHOP_WORK && job.status !== 'cancelled');
  if (!jobs.length) return <Badge variant="secondary">{messages.workPlanMandatoryNotApplicable}</Badge>;
  const remaining = jobs.filter((job) => job.status === 'to_do').length;
  if (!remaining) return <Badge variant="success">{messages.workPlanMandatoryComplete}</Badge>;
  return <Badge variant="outline">{messages.workPlanMandatoryPending} · {remaining}</Badge>;
}

function inspectionBadge(outcome: TruckWorkPlanDto['inspection']['outcome'], messages: AdminMessages) {
  if (outcome === WorkPlanInspectionOutcome.NO_ISSUES_FOUND) return <Badge variant="success">{messages.workPlanNoIssuesFound}</Badge>;
  if (outcome === WorkPlanInspectionOutcome.ISSUES_FOUND) return <Badge variant="warning">{messages.workPlanIssuesFound}</Badge>;
  return <Badge variant="outline">{messages.workPlanMandatoryPending}</Badge>;
}

/** The last row reads the Work Order status and the API's `readyReason`; nothing is derived here (D1). */
function closeWorkOrderStatus(plan: TruckWorkPlanDto, messages: AdminMessages): { label: string; variant: BadgeProps['variant'] } {
  if (!plan.workOrder) return { label: messages.workPlanMandatoryNotApplicable, variant: 'secondary' };
  if (plan.workOrder.status === 'completed') return { label: messages.workPlanMandatoryComplete, variant: 'success' };
  if (plan.readyReason === 'work_order_open') return { label: messages.readinessReadyToClose, variant: 'default' };
  return { label: messages.workPlanMandatoryPending, variant: 'outline' };
}
