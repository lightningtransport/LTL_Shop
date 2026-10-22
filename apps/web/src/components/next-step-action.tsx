'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { CheckCheck, CircleX, ClipboardCheck, FilePlus, ListPlus, Play, SquareArrowOutUpRight, Truck as TruckIcon, UserPlus, type LucideIcon } from 'lucide-react';
import { AppCapability, isPmCategory, type AdminWorkOrderDetailDto, type TruckNextStepDto } from '@ltl-shop/shared';
import { apiFetch } from '@/lib/api';
import { assignAdminWorkOrderJob, completeAdminJob, completeAdminWorkOrder, resumeAdminWorkOrder, unassignAdminWorkOrderJob, useAdminAssignableMechanics } from '@/lib/admin-data';
import { fillPlaceholders } from '@/lib/admin-next-step';
import type { AdminMessages } from '@/lib/admin-messages';
import { adminTruckHref } from '@/lib/admin-truck-origin';
import { truckNextStepActionLabel } from '@/lib/truck-next-step';
import { apiErrorCode, workOrderActionErrorMessage } from '@/lib/work-order-action-error';
import { useActionToast } from './action-toast';
import { CloseWorkOrderDialog } from './close-work-order-dialog';
import { MechanicPicker, type PickerMechanic } from './mechanic-picker';
import { ReturnToServiceDialog } from './return-to-service-dialog';
import { Button } from './ui';

const STEP_ICON: Partial<Record<TruckNextStepDto['kind'], LucideIcon>> = {
  resume: Play,
  add_missing_steps: ListPlus,
  close: CheckCheck,
  cancel_work_order: CircleX,
  return_to_service: TruckIcon,
  inspect: ClipboardCheck,
  create_work_order: FilePlus,
  external: SquareArrowOutUpRight,
};

/** Where the button is: it decides which steps navigate (only what lives on another screen). */
export type NextStepPlace = 'dashboard' | 'work-order-list' | 'work-order';

/**
 * Stage 2 / UX-5-004, UX-5-005, T2: the Next step button **acts where you are**. Resume, Mark QC
 * complete, Close (with its confirmation), Return to Service (dialog), Add missing steps and Assign
 * (mechanic picker) happen on this screen. Only what lives on another screen navigates: the
 * inspection and new Work Orders on the Truck, "Returned" (external shop) on the Work Order.
 * Without permission there is no button (the caller shows why).
 */
export function NextStepAction({
  step,
  place,
  truck,
  workOrderDisplayId,
  expectedVersion,
  fromPath,
  canManage,
  messages,
  onChanged,
  onResolve,
}: {
  step: TruckNextStepDto | null | undefined;
  place: NextStepPlace;
  truck: { id: string; truckNumber: string };
  workOrderDisplayId: string;
  /** Known on the Work Order; read from the API on the Dashboard. */
  expectedVersion?: number;
  /** Back path for links to the Truck. */
  fromPath: string;
  canManage: boolean;
  messages: AdminMessages;
  onChanged: () => Promise<unknown> | void;
  /** When the blocker can be resolved right here (below on the Work Order), the button goes there. */
  onResolve?: () => void;
}) {
  const { showToast } = useActionToast();
  const [pending, setPending] = useState(false);
  const [dialog, setDialog] = useState<'close' | 'close-reason' | 'return' | null>(null);
  const label = truckNextStepActionLabel(step, messages);
  if (!step || !canManage) return null;
  const workOrderId = step.workOrderId;
  const truckHref = adminTruckHref(truck.id, fromPath);

  async function version() {
    if (expectedVersion !== undefined) return expectedVersion;
    return (await apiFetch<{ version: number }>(`/api/admin/work-orders/${workOrderId}`)).version;
  }

  async function run(success: string, fallback: string, action: () => Promise<unknown>) {
    if (pending) return;
    setPending(true);
    try {
      await action();
      showToast('success', success);
      await onChanged();
    } catch (failure) {
      // D55 R2: the one-tap close of a visit that was not inspected asks why, in the close dialog.
      if (apiErrorCode(failure) === 'INSPECTION_NOT_DONE') {
        setDialog('close-reason');
        return;
      }
      showToast('error', workOrderActionErrorMessage(failure, messages, fallback));
    } finally {
      setPending(false);
    }
  }

  // Stage 8 (mockups): full-size buttons with the step's icon.
  const Icon = STEP_ICON[step.kind];
  const button = (text: string, onClick: () => void, variant: 'default' | 'outline' = 'default') => (
    <Button loading={pending} type="button" variant={variant} onClick={onClick} data-testid="next-step-action" data-kind={step.kind}>
      {Icon ? <Icon aria-hidden="true" /> : null}{text}
    </Button>
  );
  const link = (text: string, href: string) => (
    <Button asChild variant="outline" data-testid="next-step-action" data-kind={step.kind}>
      <Link href={href}>{Icon ? <Icon aria-hidden="true" /> : null}{text}</Link>
    </Button>
  );

  switch (step.kind) {
    case 'resolve_blocker':
      if (onResolve) return button(messages.nextStepResolveBelow, onResolve, 'outline');
      // The Dashboard resolves inline (its own block); the list sends to the Work Order, where Resolve is.
      return place === 'work-order-list' && workOrderId ? link(messages.resolveBlocker, `/admin/work-orders/${workOrderId}`) : null;
    case 'resume':
      // On the Work Order, Pause / Resume already sit in its header: one button, not two.
      if (place === 'work-order') return null;
      return workOrderId ? button(label ?? messages.resumeWorkOrderAction, () => void run(messages.resumeWorkOrderSuccess, messages.truckNextStepFailed, () => resumeAdminWorkOrder(workOrderId))) : null;
    case 'qc':
      return step.jobId ? button(label ?? '', () => void run(messages.workPlanJobCompleted, messages.truckNextStepFailed, async () => completeAdminJob(step.jobId!, { expectedVersion: await version() })), 'outline') : null;
    case 'add_missing_steps':
      return button(label ?? '', () => void run(messages.truckNextStepMissingStepsSuccess, messages.truckNextStepFailed, async () => apiFetch(
        `/api/admin/trucks/${truck.id}/work-plan/backfill-mandatory`,
        { method: 'POST', body: JSON.stringify({ expectedVersion: await version() }) },
      )));
    case 'close':
      // P5 (owner, 2026-10-06): on the Dashboard, closing is one tap, like the mockup (it can be reopened from the
      // Work Order). The Work Order and the Truck still confirm (D27).
      if (place === 'dashboard' && workOrderId) {
        return (
          <>
            {button(label ?? '', () => void run(messages.completeWorkOrderSuccess, messages.completeWorkOrderGenericError, async () => completeAdminWorkOrder(workOrderId, await version())))}
            {dialog === 'close-reason' ? (
              <CloseWorkOrderDialog
                open
                needsInspectionReason
                workOrderId={workOrderId}
                workOrderDisplayId={workOrderDisplayId}
                truckNumber={truck.truckNumber}
                expectedVersion={expectedVersion}
                messages={messages}
                onClose={() => setDialog(null)}
                onDone={onChanged}
              />
            ) : null}
          </>
        );
      }
      return workOrderId ? (
        <>
          {button(label ?? '', () => setDialog('close'))}
          <CloseWorkOrderDialog
            open={dialog === 'close'}
            workOrderId={workOrderId}
            workOrderDisplayId={workOrderDisplayId}
            truckNumber={truck.truckNumber}
            expectedVersion={expectedVersion}
            messages={messages}
            onClose={() => setDialog(null)}
            onDone={onChanged}
          />
        </>
      ) : null;
    case 'return_to_service':
      return workOrderId ? (
        <>
          {button(label ?? '', () => setDialog('return'), 'outline')}
          <ReturnToServiceDialog
            open={dialog === 'return'}
            truckNumber={truck.truckNumber}
            workOrderId={workOrderId}
            expectedVersion={expectedVersion}
            messages={messages}
            onClose={() => setDialog(null)}
            onDone={onChanged}
          />
        </>
      ) : null;
    case 'assign':
      return workOrderId && step.jobId ? (
        <AssignAction step={step} workOrderId={workOrderId} expectedVersion={expectedVersion} messages={messages} onChanged={onChanged} />
      ) : null;
    case 'cancel_work_order':
      // D55 R15 (LTR-295): nothing was done — cancelling asks for a reason on the Work Order, where the dialog is.
      if (place === 'work-order' || !workOrderId) return null;
      return link(label ?? '', `/admin/work-orders/${workOrderId}#next-step`);
    case 'inspect':
      // D41 (replaces P3): the inspection is always the sheet — "Start inspection", from the Dashboard too.
      return (
        <Button asChild variant={place === 'dashboard' ? 'default' : 'outline'} data-testid="next-step-action" data-kind={step.kind}>
          <Link href={`${truckHref.split('?')[0]}/inspection`}>{Icon ? <Icon aria-hidden="true" /> : null}{messages.inspectionStart}</Link>
        </Button>
      );
    case 'create_work_order':
      return link(label ?? '', truckHref);
    case 'external':
      // "Returned" is on the Job's row of the Work Order; on the Work Order itself the row is right below.
      return place === 'work-order' || !workOrderId ? null : link(messages.openInWorkOrder, `/admin/work-orders/${workOrderId}`);
    default:
      return null;
  }
}

/** Assign from the Next step: reads the Work Order (Job category and version), then the picker offers the right mechanics. */
function AssignAction({ step, workOrderId, expectedVersion, messages, onChanged }: {
  step: TruckNextStepDto;
  workOrderId: string;
  expectedVersion?: number;
  messages: AdminMessages;
  onChanged: () => Promise<unknown> | void;
}) {
  const { showToast } = useActionToast();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [detail, setDetail] = useState<AdminWorkOrderDetailDto | null>(null);
  const { data: pages, isLoading } = useAdminAssignableMechanics();
  const job = detail?.jobs.find((candidate) => candidate.id === step.jobId);
  const mechanics: PickerMechanic[] = useMemo(() => {
    if (!job) return [];
    const capability = isPmCategory(job.category.name) ? AppCapability.MECHANIC_PM : AppCapability.MECHANIC_STANDARD;
    return (pages?.flatMap((page) => page.items) ?? [])
      .filter((mechanic) => mechanic.active && mechanic.capabilities.includes(capability))
      .map((mechanic) => ({ id: mechanic.id, name: mechanic.name }));
  }, [pages, job]);

  async function openPicker(next: boolean) {
    setOpen(next);
    if (next && !detail) {
      try {
        setDetail(await apiFetch<AdminWorkOrderDetailDto>(`/api/admin/work-orders/${workOrderId}`));
      } catch (failure) {
        setOpen(false);
        showToast('error', workOrderActionErrorMessage(failure, messages, messages.truckNextStepFailed));
      }
    }
  }

  async function pick(mechanic: PickerMechanic) {
    setOpen(false);
    setPending(true);
    try {
      const jobId = step.jobId!;
      const assigned = await assignAdminWorkOrderJob(workOrderId, jobId, { mechanicId: mechanic.id, expectedVersion: detail?.version ?? expectedVersion ?? 0 });
      // LTR-218 (UX-1-007): say which Job went to whom, and offer it back — the row moves to the next Job.
      showToast('success', fillPlaceholders(messages.assignJobTo, { job: step.jobName ?? '', name: mechanic.name }), {
        label: messages.undo,
        onAction: () => {
          void unassignAdminWorkOrderJob(workOrderId, jobId, assigned.version)
            .then(() => onChanged())
            .catch((failure) => showToast('error', workOrderActionErrorMessage(failure, messages, messages.truckNextStepFailed)));
        },
      });
      setDetail(null);
      await onChanged();
    } catch (failure) {
      showToast('error', workOrderActionErrorMessage(failure, messages, messages.truckNextStepFailed));
    } finally {
      setPending(false);
    }
  }

  return (
    <MechanicPicker
      open={open}
      onOpenChange={(next) => void openPicker(next)}
      title={fillPlaceholders(messages.assignJobMechanicFor, { job: step.jobName ?? '' })}
      mechanics={mechanics}
      loading={!detail || isLoading}
      currentId={job?.assignedMechanic?.id ?? null}
      messages={messages}
      onPick={(mechanic) => void pick(mechanic)}
      trigger={(
        <Button loading={pending} type="button" aria-haspopup="listbox" data-testid="next-step-action" data-kind="assign">
          <UserPlus aria-hidden="true" />
          {messages.truckNextStepAssignAction}
        </Button>
      )}
    />
  );
}
