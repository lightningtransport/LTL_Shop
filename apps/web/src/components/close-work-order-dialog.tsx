'use client';

import { useState } from 'react';
import { ApiError, apiFetch } from '@/lib/api';
import { completeAdminWorkOrder } from '@/lib/admin-data';
import { fillPlaceholders } from '@/lib/admin-next-step';
import type { AdminMessages } from '@/lib/admin-messages';
import { workOrderActionErrorMessage } from '@/lib/work-order-action-error';
import { useActionToast } from './action-toast';
import { Button, Modal } from './ui';

/**
 * Owner decision (2026-10-05): closing a Work Order confirms, the same on the Truck, the Work Order
 * and the Dashboard — it makes the Truck Ready to Go. Completing a single Job stays one tap.
 * Without a known version (Dashboard), the Work Order is read first.
 */
export function CloseWorkOrderDialog({
  open,
  workOrderId,
  workOrderDisplayId,
  truckNumber,
  expectedVersion,
  messages,
  onClose,
  onDone,
}: {
  open: boolean;
  workOrderId: string;
  workOrderDisplayId: string;
  truckNumber: string;
  expectedVersion?: number;
  messages: AdminMessages;
  onClose: () => void;
  onDone?: () => Promise<unknown> | void;
}) {
  const { showToast } = useActionToast();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const names = { workOrder: workOrderDisplayId, truck: truckNumber };

  function close() {
    if (pending) return;
    setError(null);
    onClose();
  }

  async function confirm() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const version = expectedVersion ?? (await apiFetch<{ version: number }>(`/api/admin/work-orders/${workOrderId}`)).version;
      await completeAdminWorkOrder(workOrderId, version);
      showToast('success', messages.completeWorkOrderSuccess);
      onClose();
      await onDone?.();
    } catch (failure) {
      // 400: not everything is done (or a PM still open); 409: changed in another session.
      const message = failure instanceof ApiError && failure.status === 400
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
        {error ? <p className="text-sm font-medium text-destructive-text" role="alert">{error}</p> : null}
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="flex-1" disabled={pending} onClick={close}>{messages.cancel}</Button>
          <Button type="button" className="flex-1" disabled={pending} onClick={() => void confirm()}>
            {pending ? messages.saving : messages.truckNextStepCloseAction}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
