'use client';

import { useState } from 'react';
import { ApiError, apiFetch } from '@/lib/api';
import { completeAdminWorkOrder } from '@/lib/admin-data';
import { fillPlaceholders } from '@/lib/admin-next-step';
import type { AdminMessages } from '@/lib/admin-messages';
import { apiErrorCode, workOrderActionErrorMessage } from '@/lib/work-order-action-error';
import { useActionToast } from './action-toast';
import { Button, Modal, Textarea } from './ui';

/**
 * Owner decision (2026-10-05): closing a Work Order confirms, the same on the Truck, the Work Order
 * and the Dashboard — it makes the Truck Ready to Go. Completing a single Job stays one tap.
 * Without a known version (Dashboard), the Work Order is read first.
 * D55 R2 (LTR-294): a visit that was not inspected asks why before it closes; the reason goes to the
 * Work Order's history. `needsInspectionReason` opens it straight in that state (the Dashboard's one tap).
 */
export function CloseWorkOrderDialog({
  open,
  workOrderId,
  workOrderDisplayId,
  truckNumber,
  expectedVersion,
  messages,
  needsInspectionReason = false,
  onClose,
  onDone,
}: {
  open: boolean;
  workOrderId: string;
  workOrderDisplayId: string;
  truckNumber: string;
  expectedVersion?: number;
  needsInspectionReason?: boolean;
  messages: AdminMessages;
  onClose: () => void;
  onDone?: () => Promise<unknown> | void;
}) {
  const { showToast } = useActionToast();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [askReason, setAskReason] = useState(needsInspectionReason);
  const [reason, setReason] = useState('');
  const names = { workOrder: workOrderDisplayId, truck: truckNumber };

  function close() {
    if (pending) return;
    setError(null);
    setAskReason(needsInspectionReason);
    setReason('');
    onClose();
  }

  async function confirm() {
    if (pending || (askReason && !reason.trim())) return;
    setPending(true);
    setError(null);
    try {
      const version = expectedVersion ?? (await apiFetch<{ version: number }>(`/api/admin/work-orders/${workOrderId}`)).version;
      await completeAdminWorkOrder(workOrderId, version, undefined, askReason ? reason.trim() : undefined);
      showToast('success', messages.completeWorkOrderSuccess);
      setAskReason(needsInspectionReason);
      setReason('');
      onClose();
      await onDone?.();
    } catch (failure) {
      if (apiErrorCode(failure) === 'INSPECTION_NOT_DONE') {
        setAskReason(true);
        return;
      }
      // 400: not everything is done, nothing was done (D55 R15) or a PM still open; 409: changed in another session.
      const coded = apiErrorCode(failure) === 'NOTHING_DONE';
      const message = failure instanceof ApiError && failure.status === 400 && !coded
        ? messages.completeWorkOrderBadRequest
        : workOrderActionErrorMessage(failure, messages, messages.completeWorkOrderGenericError);
      setError(message);
      showToast('error', message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal open={open} title={fillPlaceholders(messages.closeWorkOrderDialogTitle, names)} closeLabel={messages.closeDialog} onClose={close}>
      <div className="space-y-4" data-testid="close-work-order-dialog">
        <p className="text-sm text-muted-foreground">{fillPlaceholders(messages.closeWorkOrderDialogBody, names)}</p>
        {askReason ? (
          <div className="space-y-2">
            <p className="rounded-md border border-warning/50 bg-warning-surface px-3 py-2 text-sm text-warning-foreground" role="status">
              {fillPlaceholders(messages.closeWithoutInspectionBody, names)}
            </p>
            <label htmlFor="close-inspection-reason" className="text-sm font-medium">{messages.closeWithoutInspectionLabel}</label>
            <Textarea
              id="close-inspection-reason"
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              data-testid="close-inspection-reason"
            />
          </div>
        ) : null}
        {error ? <p className="text-sm font-medium text-destructive-text" role="alert">{error}</p> : null}
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="flex-1" disabled={pending} onClick={close}>{messages.cancel}</Button>
          <Button type="button" className="flex-1" disabled={pending || (askReason && !reason.trim())} onClick={() => void confirm()}>
            {pending ? messages.saving : askReason ? messages.closeWithoutInspectionAction : messages.truckNextStepCloseAction}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
