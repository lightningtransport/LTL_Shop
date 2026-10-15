'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import type { AdminMessages } from '@/lib/admin-messages';
import { Button, DialogActions, Modal, Textarea } from './ui';

/**
 * LTR-216 (D19, D29): Safety returned this truck. Marking its Quality Check complete would skip that review, so the
 * dialog shows what Safety found, offers the work first ("Add work") and completes only with the Manager's reason.
 * The API refuses the plain complete (QC_RETURNED_BY_SAFETY), so every path asks the same.
 */
export function SafetyReturnCompleteDialog({
  open,
  safetyNote,
  reportedBy,
  addWorkHref,
  messages,
  onClose,
  onConfirm,
}: {
  open: boolean;
  safetyNote: string | null;
  reportedBy: string | null;
  addWorkHref: string;
  messages: AdminMessages;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  useEffect(() => {
    if (open) setReason('');
  }, [open]);
  const trimmed = reason.trim();

  return (
    <Modal open={open} title={messages.safetyReturnCompleteTitle} onClose={onClose} closeLabel={messages.closeDialog}>
      <div className="space-y-4">
        <div className="rounded-md border border-warning/50 bg-warning-surface px-3 py-2 text-sm text-warning-foreground" role="status">
          <p className="font-semibold">{reportedBy ? `${messages.safetyReturnCompleteReturnedBy} ${reportedBy}` : messages.safetyReturnCompleteReturnedBy}</p>
          {safetyNote ? <p className="mt-1">“{safetyNote}”</p> : null}
        </div>
        <p className="text-sm text-muted-foreground">{messages.safetyReturnCompleteBody}</p>
        <Button asChild className="w-full">
          <Link href={addWorkHref}><Plus aria-hidden="true" />{messages.safetyReturnCompleteAddWork}</Link>
        </Button>
        <div className="space-y-2 border-t pt-4">
          <label htmlFor="safety-return-reason" className="text-sm font-medium">{messages.safetyReturnCompleteReasonLabel}</label>
          <Textarea
            id="safety-return-reason"
            rows={3}
            value={reason}
            placeholder={messages.safetyReturnCompleteReasonPlaceholder}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
        <DialogActions>
          <Button type="button" variant="outline" onClick={onClose}>{messages.cancel}</Button>
          <Button type="button" variant="destructive" disabled={!trimmed} onClick={() => onConfirm(trimmed)}>
            {messages.safetyReturnCompleteAnyway}
          </Button>
        </DialogActions>
      </div>
    </Modal>
  );
}
