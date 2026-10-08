'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import {
  Building2,
  CheckCheck,
  CircleAlert,
  CircleCheck,
  CirclePause,
  ClipboardCheck,
  FilePlus,
  Flag,
  ListPlus,
  Play,
  Plus,
  ShieldCheck,
  SquareArrowOutUpRight,
  Truck as TruckIcon,
  UserPlus,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { WorkPlanInspectionOutcome, WorkPlanJobLane, type AdminTruckDetailDto, type RecordWorkPlanInspectionInput } from '@ltl-shop/shared';
import { apiFetch } from '@/lib/api';
import {
  completeAdminJob,
  resumeAdminWorkOrder,
} from '@/lib/admin-data';
import { adminPauseReasonLabel, type AdminLocale, type AdminMessages } from '@/lib/admin-messages';
import { fillPlaceholders } from '@/lib/admin-next-step';
import { useActionToast } from './action-toast';
import { CloseWorkOrderDialog } from './close-work-order-dialog';
import { NextStepAction } from './next-step-action';
import { NextStepCallout, type CalloutTone } from './next-step-callout';
import { BlockerCallout } from './work-order-next-step';
import { formatShortDateTime } from '@/lib/work-order-view';
import { ReturnToServiceDialog } from './return-to-service-dialog';
import { Button, InlineAlert } from './ui';

const LANE_NAME: Partial<Record<WorkPlanJobLane, string>> = {
  [WorkPlanJobLane.PM]: 'PM',
  [WorkPlanJobLane.ALIGNMENT]: 'Alignment',
  [WorkPlanJobLane.DETAILING]: 'Detailing',
  [WorkPlanJobLane.QUALITY_CHECK]: 'Quality Check',
};

/**
 * LTR-158 / D14: one "Next step" card at the top of the Truck with the one button
 * that moves it forward (blocker first). The rule lives in the API
 * (`deriveTruckNextStep`); this card only renders it.
 */
export function AdminTruckNextStep({
  truck,
  locale,
  messages,
  canManage,
  fromPath,
  inspectionPending,
  onRecordInspection,
  onAddWork,
  onNewWorkOrder,
  onChanged,
}: {
  truck: AdminTruckDetailDto;
  locale: AdminLocale;
  messages: AdminMessages;
  canManage: boolean;
  /** This Truck's path, for the Work Order's back link. */
  fromPath: string;
  inspectionPending: boolean;
  onRecordInspection: (outcome: RecordWorkPlanInspectionInput['outcome']) => void;
  /** Opens the Add work panel. */
  onAddWork: () => void;
  /** Opens the New Work Order dialog (owner decision 2026-10-05: the Manager stays on the Truck). */
  onNewWorkOrder: () => void;
  onChanged: () => Promise<unknown> | void;
}) {
  const step = truck.nextStep;
  const { showToast } = useActionToast();
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [returnOpen, setReturnOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  if (!step) return null;
  const version = truck.workPlan.workOrder?.version ?? 0;

  async function run(success: string, action: () => Promise<unknown>) {
    if (pending) return;
    setPending(true);
    setFailure(null);
    try {
      await action();
      showToast('success', success);
      await onChanged();
    } catch {
      setFailure(messages.truckNextStepFailed);
    } finally {
      setPending(false);
    }
  }

  const date = (value: string | null | undefined) => formatShortDateTime(value, locale);
  const workOrder = truck.workPlan.workOrder;
  const readOnly = !canManage ? <p className="text-muted-foreground">{messages.calloutStepReadOnly}</p> : null;
  const failureLine = failure ? <InlineAlert>{failure}</InlineAlert> : null;
  const box = (props: { tone: CalloutTone; icon: LucideIcon; eyebrow: string; title: string; sub?: string | null; actions?: ReactNode; extra?: ReactNode }) => (
    <NextStepCallout
      id="next-step"
      testId="truck-next-step"
      kind={step!.kind}
      tone={props.tone}
      icon={props.icon}
      eyebrow={props.eyebrow}
      title={props.title}
      sub={props.sub}
      actions={props.actions}
      extra={<>{props.extra}{readOnly}{failureLine}</>}
    />
  );
  const act = (label: string, Icon: LucideIcon | null, onClick: () => void, variant?: 'outline') => canManage ? (
    <Button type="button" variant={variant} disabled={pending} onClick={onClick}>{Icon ? <Icon aria-hidden="true" /> : null}{pending ? messages.saving : label}</Button>
  ) : null;

  // Stage 8 (mockup): one callout per Next step kind — tone, icon, title, sub and the action that moves it forward.
  switch (step.kind) {
    case 'resolve_blocker': {
      const blocker = truck.activeWorkOrder?.latestReportedBlocker;
      if (!blocker || !step.workOrderId) return null;
      return (
        <BlockerCallout
          testId="truck-next-step"
          blocker={blocker}
          more={0}
          workOrderId={step.workOrderId}
          locale={locale}
          messages={messages}
          canResolve={canManage}
          footer={null}
          onResolved={onChanged}
        />
      );
    }
    case 'resume':
      return box({
        tone: 'warning',
        icon: CirclePause,
        eyebrow: messages.calloutTruckPausedEyebrow,
        title: fillPlaceholders(messages.truckNextStepResume, { reason: step.reason ? adminPauseReasonLabel(step.reason, messages) : '' }),
        sub: fillPlaceholders(messages.calloutTruckPausedSub, { date: date(truck.activeWorkOrder?.currentPause?.startedAt) }),
        actions: act(messages.resumeShort, Play, () => void run(messages.resumeWorkOrderSuccess, () => resumeAdminWorkOrder(step.workOrderId!))),
      });
    case 'inspect':
      // Stage 4: the inspection is recorded right here (D14). "Issues found" is the primary one.
      return box({
        tone: 'primary',
        icon: ClipboardCheck,
        eyebrow: messages.calloutNextStep,
        title: messages.calloutInspectTitle,
        sub: messages.calloutTruckInspectSub,
        actions: truck.workPlan.capabilities.canRecordInspection ? (
          <>
            <Button type="button" variant="outline" disabled={inspectionPending} onClick={() => onRecordInspection(WorkPlanInspectionOutcome.NO_ISSUES_FOUND)}>{messages.workPlanNoIssuesFound}</Button>
            <Button type="button" disabled={inspectionPending} onClick={() => onRecordInspection(WorkPlanInspectionOutcome.ISSUES_FOUND)}>{messages.workPlanIssuesFound}</Button>
          </>
        ) : null,
      });
    case 'add_missing_steps':
      return box({
        tone: 'danger',
        icon: CircleAlert,
        eyebrow: messages.calloutNextStep,
        title: fillPlaceholders(messages.truckNextStepMissingSteps, { steps: (step.missingLanes ?? []).map((lane) => LANE_NAME[lane] ?? lane).join(', ') }),
        sub: messages.calloutMissingSub,
        actions: act(messages.truckNextStepMissingStepsAction, ListPlus, () => void run(messages.truckNextStepMissingStepsSuccess, () => apiFetch(
          `/api/admin/trucks/${truck.truck.id}/work-plan/backfill-mandatory`,
          { method: 'POST', body: JSON.stringify({ expectedVersion: version }) },
        ))),
      });
    case 'assign': {
      const job = truck.workPlan.jobs.find((candidate) => candidate.id === step.jobId);
      return box({
        tone: 'primary',
        icon: UserPlus,
        eyebrow: messages.calloutNextStep,
        title: fillPlaceholders(messages.truckNextStepAssign, { job: step.jobName ?? '' }),
        sub: job ? job.category.name : null,
        // Stage 2/4: the mechanic picker opens next to the button (PM → PM mechanics).
        actions: (
          <NextStepAction
            step={step}
            place="work-order"
            truck={{ id: truck.truck.id, truckNumber: truck.truck.truckNumber }}
            workOrderDisplayId={workOrder?.displayId ?? ''}
            expectedVersion={version}
            fromPath={fromPath}
            canManage={canManage}
            messages={messages}
            onChanged={onChanged}
          />
        ),
      });
    }
    case 'qc':
      return box({
        tone: 'primary',
        icon: ShieldCheck,
        eyebrow: messages.calloutQc,
        title: messages.calloutQcTitle,
        sub: messages.calloutQcSub,
        actions: act(messages.truckNextStepQcAction, null, () => void run(messages.workPlanJobCompleted, () => completeAdminJob(step.jobId!, { expectedVersion: version })), 'outline'),
        // D-SET6: the Manager reaches Quality Check as backup from here (D29).
        extra: <Link className="tap-inline text-sm font-medium text-primary hover:underline" href="/qc">{messages.shopWorkflowQcBackupLink}</Link>,
      });
    case 'close':
      // Owner decision (2026-10-05): closing confirms — it makes the Truck Ready to Go.
      return (
        <>
          {box({
            tone: 'primary',
            icon: Flag,
            eyebrow: messages.calloutNextStep,
            title: messages.calloutCloseTitle,
            sub: messages.calloutCloseSub,
            actions: act(messages.truckNextStepCloseAction, CheckCheck, () => setCloseOpen(true)),
          })}
          {step.workOrderId ? (
            <CloseWorkOrderDialog
              open={closeOpen}
              workOrderId={step.workOrderId}
              workOrderDisplayId={workOrder?.displayId ?? ''}
              truckNumber={truck.truck.truckNumber}
              expectedVersion={version}
              messages={messages}
              onClose={() => setCloseOpen(false)}
              onDone={onChanged}
            />
          ) : null}
        </>
      );
    case 'return_to_service':
      // D7 / UX-4-002: one button and a confirmation dialog (optional reason), the same as the Yard.
      return (
        <>
          {box({
            tone: 'success',
            icon: CircleCheck,
            eyebrow: messages.calloutReadyToGo,
            title: messages.calloutRtsTitle,
            sub: fillPlaceholders(messages.calloutRtsSub, { workOrder: workOrder?.displayId ?? '', date: date(workOrder?.completedAt) }),
            actions: step.workOrderId ? act(messages.returnToServiceTitle, TruckIcon, () => setReturnOpen(true)) : null,
          })}
          {canManage && step.workOrderId ? (
            <ReturnToServiceDialog
              open={returnOpen}
              truckNumber={truck.truck.truckNumber}
              workOrderId={step.workOrderId}
              expectedVersion={version}
              messages={messages}
              onClose={() => setReturnOpen(false)}
              onDone={onChanged}
            />
          ) : null}
        </>
      );
    case 'external': {
      // LTR-188 / D24, T3: "Returned" lives on the Job's row of the Work Order, so the step links there.
      const job = truck.workPlan.jobs.find((candidate) => candidate.id === step.jobId);
      const what = job?.external ? fillPlaceholders(job.external.kind === 'truck' ? messages.calloutExternalTruck : messages.calloutExternalPart, { date: date(job.external.since), note: job.external.note }) : '';
      return box({
        tone: 'primary',
        icon: Building2,
        eyebrow: messages.calloutWaiting,
        title: fillPlaceholders(messages.calloutExternalTitle, { job: step.jobName ?? '' }),
        sub: what ? `${what}${messages.calloutTruckExternalHint}` : messages.calloutTruckExternalHint.trim(),
        actions: step.workOrderId ? (
          <Button asChild variant="outline">
            <Link href={`/admin/work-orders/${step.workOrderId}?from=${encodeURIComponent(fromPath)}${step.jobId ? `#job-${step.jobId}` : ''}`}>
              <SquareArrowOutUpRight aria-hidden="true" />{messages.openInWorkOrder}
            </Link>
          </Button>
        ) : null,
      });
    }
    case 'work':
      return box({
        tone: 'muted',
        icon: Wrench,
        eyebrow: messages.calloutNextStep,
        title: messages.calloutWorkingTitle,
        sub: fillPlaceholders(messages.calloutWorkingSub, { count: String(step.remaining ?? 0), job: step.jobName ?? '' }),
      });
    case 'create_work_order': {
      // Owner decision (2026-10-05): New Work Order is a dialog here. After "Issues found", adding the
      // work is what opens the Work Order, so Add work comes first.
      const outcome = truck.workPlan.inspection.outcome;
      const issues = outcome === WorkPlanInspectionOutcome.ISSUES_FOUND;
      const sub = issues
        ? messages.calloutTruckCreateIssues
        : outcome === WorkPlanInspectionOutcome.NO_ISSUES_FOUND ? messages.calloutTruckCreateNoIssues : messages.calloutTruckCreateNone;
      return box({
        tone: 'muted',
        icon: FilePlus,
        eyebrow: messages.calloutNextStep,
        title: messages.calloutTruckCreateTitle,
        sub,
        actions: canManage ? (
          <>
            {issues && truck.workPlan.capabilities.canAddWork ? <Button type="button" onClick={onAddWork}><Plus aria-hidden="true" />{messages.workPlanAddWork}</Button> : null}
            <Button type="button" variant={outcome === WorkPlanInspectionOutcome.NO_ISSUES_FOUND ? 'default' : 'outline'} onClick={onNewWorkOrder}>
              <FilePlus aria-hidden="true" />{messages.truckNextStepCreateAction}
            </Button>
          </>
        ) : null,
      });
    }
    default:
      return null;
  }
}
