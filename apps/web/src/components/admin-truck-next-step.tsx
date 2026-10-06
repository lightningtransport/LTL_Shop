'use client';

import Link from 'next/link';
import { useState } from 'react';
import { WorkPlanJobLane, type AdminTruckDetailDto, type TruckNextStepDto } from '@ltl-shop/shared';
import { apiFetch } from '@/lib/api';
import {
  completeAdminJob,
  resumeAdminWorkOrder,
} from '@/lib/admin-data';
import { adminPauseReasonLabel, type AdminLocale, type AdminMessages } from '@/lib/admin-messages';
import { fillPlaceholders } from '@/lib/admin-next-step';
import { useActionToast } from './action-toast';
import { AdminBlockerResolve } from './admin-blocker-resolve';
import { CloseWorkOrderDialog } from './close-work-order-dialog';
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
  onChanged,
}: {
  truck: AdminTruckDetailDto;
  locale: AdminLocale;
  messages: AdminMessages;
  canManage: boolean;
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

  function scrollTo(id: string) {
    const target = document.getElementById(id);
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (target instanceof HTMLElement) target.focus({ preventScroll: true });
  }

  const body = renderStep(step);

  // LTR-174: one box under the operational header (no Card inside a Card), same testid and data-kind.
  return (
    <div className="rounded-xl border border-primary/40 bg-card px-4 py-3 text-sm text-card-foreground shadow-soft" role="status" data-testid="truck-next-step" data-kind={step.kind}>
      <p className="group-title">{messages.nextStepTitle}</p>
      <div className="mt-2 space-y-3">
        {body}
        {failure ? <InlineAlert>{failure}</InlineAlert> : null}
      </div>
    </div>
  );

  function renderStep(current: TruckNextStepDto) {
    switch (current.kind) {
      case 'resolve_blocker': {
        const blocker = truck.activeWorkOrder?.latestReportedBlocker;
        if (!blocker || !current.workOrderId) return null;
        return (
          <div className="rounded-lg bg-warning-surface px-3 py-2 text-warning-foreground">
            <AdminBlockerResolve
              workOrderId={current.workOrderId}
              blocker={blocker}
              locale={locale}
              messages={messages}
              canResolve={canManage}
              onResolved={onChanged}
            />
          </div>
        );
      }
      case 'resume':
        return (
          <Action
            text={fillPlaceholders(messages.truckNextStepResume, { reason: current.reason ? adminPauseReasonLabel(current.reason, messages) : '' })}
            label={messages.resumeWorkOrderAction}
            disabled={!canManage || pending}
            onClick={() => void run(messages.resumeWorkOrderSuccess, () => resumeAdminWorkOrder(current.workOrderId!))}
          />
        );
      case 'inspect':
        return (
          <Action
            text={messages.truckNextStepInspect}
            label={messages.truckNextStepInspectAction}
            variant="outline"
            onClick={() => scrollTo('truck-work-plan-title')}
          />
        );
      case 'add_missing_steps':
        return (
          <Action
            text={fillPlaceholders(messages.truckNextStepMissingSteps, {
              steps: (current.missingLanes ?? []).map((lane) => LANE_NAME[lane] ?? lane).join(', '),
            })}
            label={messages.truckNextStepMissingStepsAction}
            disabled={!canManage || pending}
            onClick={() => void run(messages.truckNextStepMissingStepsSuccess, () => apiFetch(
              `/api/admin/trucks/${truck.truck.id}/work-plan/backfill-mandatory`,
              { method: 'POST', body: JSON.stringify({ expectedVersion: version }) },
            ))}
          />
        );
      case 'assign':
        return (
          <Action
            text={fillPlaceholders(messages.truckNextStepAssign, { job: current.jobName ?? '' })}
            label={messages.truckNextStepAssignAction}
            variant="outline"
            disabled={!canManage}
            onClick={() => scrollTo(`assign-job-${current.jobId}`)}
          />
        );
      case 'qc':
        return (
          <Action
            text={messages.truckNextStepQc}
            label={messages.truckNextStepQcAction}
            disabled={!canManage || pending}
            onClick={() => void run(messages.workPlanJobCompleted, () => completeAdminJob(current.jobId!, { expectedVersion: version }))}
          />
        );
      case 'close':
        // Owner decision (2026-10-05): closing confirms — it makes the Truck Ready to Go.
        return (
          <>
            <Action
              text={messages.truckNextStepClose}
              label={messages.truckNextStepCloseAction}
              disabled={!canManage || pending}
              onClick={() => setCloseOpen(true)}
            />
            {current.workOrderId ? (
              <CloseWorkOrderDialog
                open={closeOpen}
                workOrderId={current.workOrderId}
                workOrderDisplayId={truck.workPlan.workOrder?.displayId ?? ''}
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p>{messages.truckNextStepReturnToService}</p>
            {canManage && current.workOrderId ? (
              <>
                <Button type="button" className="w-full sm:w-auto" onClick={() => setReturnOpen(true)}>{messages.returnToServiceTitle}</Button>
                <ReturnToServiceDialog
                  open={returnOpen}
                  truckNumber={truck.truck.truckNumber}
                  workOrderId={current.workOrderId}
                  expectedVersion={version}
                  messages={messages}
                  onClose={() => setReturnOpen(false)}
                  onDone={onChanged}
                />
              </>
            ) : null}
          </div>
        );
      case 'external':
        // LTR-188 / D24, T3: "Returned" lives on the Job's row of the Work Order, so the step links there.
        return (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p>{fillPlaceholders(messages.truckNextStepExternal, { job: current.jobName ?? '' })}</p>
            {current.workOrderId ? (
              <Button asChild variant="outline" className="w-full sm:w-auto">
                <Link href={`/admin/work-orders/${current.workOrderId}`}>{messages.openInWorkOrder}</Link>
              </Button>
            ) : null}
          </div>
        );
      case 'work':
        return (
          <p>{fillPlaceholders(messages.truckNextStepWork, { count: String(current.remaining ?? 0), job: current.jobName ?? '' })}</p>
        );
      case 'create_work_order':
        return (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p>{messages.truckNextStepCreate}</p>
            {canManage ? (
              <Button asChild className="w-full sm:w-auto">
                <Link href={`/admin/work-orders/new?truck=${truck.truck.id}`}>{messages.truckNextStepCreateAction}</Link>
              </Button>
            ) : null}
          </div>
        );
      default:
        return null;
    }
  }
}

function Action({
  text,
  label,
  onClick,
  disabled = false,
  variant,
}: {
  text: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'outline';
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="min-w-0 flex-1">{text}</p>
      <Button type="button" variant={variant} className="w-full sm:w-auto" disabled={disabled} onClick={onClick}>{label}</Button>
    </div>
  );
}
