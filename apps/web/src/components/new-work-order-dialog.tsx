'use client';

import { useState } from 'react';
import { Priority } from '@ltl-shop/shared';
import { useSWRConfig } from 'swr';
import { ApiError } from '@/lib/api';
import { createAdminWorkOrder } from '@/lib/admin-data';
import { fillPlaceholders } from '@/lib/admin-next-step';
import type { AdminMessages } from '@/lib/admin-messages';
import { adminPriorityLabel } from '@/lib/status-chips';
import { isWorkOrderRelatedListKey } from '@/lib/swr-cache-keys';
import { WORK_ORDER_LIST_REVALIDATE } from '@/lib/swr-work-order-cache';
import { useActionToast } from './action-toast';
import { Button, Modal, Select, Textarea } from './ui';
import { draftKeys, useLocalDraft } from '@/lib/local-draft';

/**
 * Owner decision (2026-10-05): "New Work Order" on the Truck is a dialog (priority and an optional
 * note). The Work Order is created with its mandatory steps and the Manager stays on the Truck.
 * `/admin/work-orders/new` stays for the Work Orders list.
 */
export function NewWorkOrderDialog({
  open,
  truck,
  messages,
  onClose,
  onCreated,
}: {
  open: boolean;
  truck: { id: string; truckNumber: string };
  messages: AdminMessages;
  onClose: () => void;
  onCreated: () => Promise<unknown> | void;
}) {
  const { showToast } = useActionToast();
  const { mutate } = useSWRConfig();
  const [priority, setPriority] = useState<Priority>(Priority.NORMAL);
  // LTR-293 §2: the note stays on this device for this truck until the Work Order is created.
  const [notes, setNotes, clearNotes] = useLocalDraft(draftKeys.newWorkOrderNote(truck.id));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    if (pending) return;
    setError(null);
    setPriority(Priority.NORMAL);
    onClose();
  }

  async function create() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const created = await createAdminWorkOrder({ truckId: truck.id, priority, notes: notes.trim() || undefined, jobs: [] });
      showToast('success', fillPlaceholders(messages.newWorkOrderCreated, { id: created.displayId, truck: truck.truckNumber }));
      void mutate(isWorkOrderRelatedListKey, undefined, WORK_ORDER_LIST_REVALIDATE);
      setPriority(Priority.NORMAL);
      clearNotes();
      onClose();
      await onCreated();
    } catch (failure) {
      const message = failure instanceof ApiError && failure.message ? failure.message : messages.createWorkOrderFailed;
      setError(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal open={open} title={fillPlaceholders(messages.newWorkOrderDialogTitle, { truck: truck.truckNumber })} closeLabel={messages.closeDialog} onClose={close}>
      <div className="space-y-4" data-testid="new-work-order-dialog">
        <p className="text-sm text-muted-foreground">{messages.createMandatoryStepsHelp}</p>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">{messages.priority}</span>
          <Select aria-label={messages.priority} value={priority} disabled={pending} onChange={(event) => setPriority(event.target.value as Priority)}>
            {Object.values(Priority).map((value) => (
              <option key={value} value={value}>{adminPriorityLabel(value, messages)}</option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">{messages.notesOptional}</span>
          <Textarea
            aria-label={messages.notesOptional}
            className="min-h-20"
            placeholder={messages.notesPlaceholder}
            value={notes}
            maxLength={2000}
            disabled={pending}
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>
        {error ? <p className="text-sm font-medium text-destructive-text" role="alert">{error}</p> : null}
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="flex-1" disabled={pending} onClick={close}>{messages.cancel}</Button>
          <Button type="button" className="flex-1" disabled={pending} onClick={() => void create()}>
            {pending ? messages.creatingWorkOrder : messages.newWorkOrderCreate}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
