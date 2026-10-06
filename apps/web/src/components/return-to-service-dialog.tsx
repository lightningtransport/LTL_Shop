'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { returnToServiceErrorMessage } from '@/lib/return-to-service';
import { returnAdminWorkOrderToService } from '@/lib/admin-data';
import { fillPlaceholders } from '@/lib/admin-next-step';
import type { AdminMessages } from '@/lib/admin-messages';
import { useActionToast } from './action-toast';
import { Button, Modal, Textarea } from './ui';

/**
 * D7 / UX-5-008: Return to Service asks to confirm, with an optional reason, the same way on the
 * Yard and the Truck. It takes the truck off the board, so it is never a single accidental tap.
 * When the caller has no Work Order version (the Yard card), it reads it before sending.
 */
export function ReturnToServiceDialog({
  open,
  truckNumber,
  workOrderId,
  expectedVersion,
  messages,
  onClose,
  onDone,
}: {
  open: boolean;
  truckNumber: string;
  workOrderId: string;
  expectedVersion?: number;
  messages: AdminMessages;
  onClose: () => void;
  onDone?: () => Promise<unknown> | void;
}) {
  const { showToast } = useActionToast();
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    if (pending) return;
    setReason('');
    setError(null);
    onClose();
  }

  async function confirm() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const version = expectedVersion ?? (await apiFetch<{ version: number }>(`/api/admin/work-orders/${workOrderId}`)).version;
      await returnAdminWorkOrderToService(workOrderId, { reason: reason.trim() || undefined, expectedVersion: version });
      showToast('success', messages.returnToServiceSuccess);
      setReason('');
      onClose();
      await onDone?.();
    } catch (failure) {
      const message = returnToServiceErrorMessage(failure, messages);
      setError(message);
      showToast('error', message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal open={open} title={fillPlaceholders(messages.returnToServiceDialogTitle, { truck: truckNumber })} closeLabel={messages.closeDialog} onClose={close}>
      <form
        className="space-y-3"
        data-testid="return-to-service-dialog"
        onSubmit={(event) => {
          event.preventDefault();
          void confirm();
        }}
      >
        <p className="text-sm text-muted-foreground">{messages.returnToServiceDescription}</p>
        <label className="block space-y-1">
          <span className="text-sm font-medium">{messages.returnToServiceReason}</span>
          <Textarea
            aria-label={messages.returnToServiceReason}
            value={reason}
            maxLength={1000}
            disabled={pending}
            onChange={(event) => setReason(event.target.value)}
          />
          <span className="text-xs text-muted-foreground">{messages.returnToServiceReasonHelp}</span>
        </label>
        {error ? <p className="text-sm font-medium text-destructive-text" role="alert">{error}</p> : null}
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="flex-1" disabled={pending} onClick={close}>{messages.cancel}</Button>
          <Button type="submit" className="flex-1" disabled={pending}>{pending ? messages.saving : messages.returnToServiceConfirm}</Button>
        </div>
      </form>
    </Modal>
  );
}
