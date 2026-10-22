'use client';

import { useState } from 'react';
import { Paperclip, X } from 'lucide-react';
import { INVOICE_FILE_MAX_BYTES, INVOICE_FILE_TYPES, type AdminAttachmentDto } from '@ltl-shop/shared';
import { useActionToast } from './action-toast';
import { partsCostsFailure } from './admin-parts-catalog';
import { Button, DialogActions, InlineAlert, Modal } from './ui';
import { requestAdminAttachment, setAdminOutsideRepairAttachment, setAdminPurchaseAttachment, uploadInvoiceFile } from '@/lib/admin-data';
import { fillPlaceholders } from '@/lib/admin-next-step';
import type { AdminMessages } from '@/lib/admin-messages';

type FileState = { id: string | null; name: string; percent: number; error: string | null };

/**
 * PCA6 (UX-10-004): add, replace or remove the invoice file of a saved purchase or outside repair without going
 * through Edit, so the trucks' costs and the internal invoices are not rewritten for a change that is not money.
 */
export function InvoiceFileDialog({ owner, id, current, messages, onClose, onSaved }: {
  owner: 'purchase' | 'repair';
  id: string;
  current: AdminAttachmentDto | null;
  messages: AdminMessages;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { showToast } = useActionToast();
  const [file, setFile] = useState<FileState | null>(current ? { id: current.id, name: current.fileName, percent: 100, error: null } : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const uploading = Boolean(file && !file.id && !file.error);
  const changed = (file?.id ?? null) !== (current?.id ?? null);

  async function pickFile(chosen: File | undefined) {
    if (!chosen) return;
    if (!(INVOICE_FILE_TYPES as readonly string[]).includes(chosen.type)) return setFile({ id: null, name: chosen.name, percent: 0, error: messages.pcFileTypeInvalid });
    if (chosen.size > INVOICE_FILE_MAX_BYTES) return setFile({ id: null, name: chosen.name, percent: 0, error: messages.pcFileTooBig });
    setFile({ id: null, name: chosen.name, percent: 0, error: null });
    try {
      const target = await requestAdminAttachment({ fileName: chosen.name, contentType: chosen.type as (typeof INVOICE_FILE_TYPES)[number], sizeBytes: chosen.size });
      await uploadInvoiceFile(target.uploadUrl, chosen, (percent) => setFile((state) => (state ? { ...state, percent } : state)));
      setFile({ id: target.id, name: chosen.name, percent: 100, error: null });
    } catch {
      setFile({ id: null, name: chosen.name, percent: 0, error: messages.pcFileFailed });
    }
  }

  async function save() {
    if (busy || uploading || !changed) return;
    setBusy(true);
    setError(null);
    try {
      const attachmentId = file?.id ?? null;
      if (owner === 'purchase') await setAdminPurchaseAttachment(id, attachmentId);
      else await setAdminOutsideRepairAttachment(id, attachmentId);
      showToast('success', messages.pcFileSaved);
      onSaved();
    } catch (failure) {
      setError(partsCostsFailure(failure, messages));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open title={messages.pcFileDialogTitle} description={messages.pcFileDialogBody} onClose={onClose} closeLabel={messages.closeDialog} dismissible={!changed}>
      <div className="space-y-4" data-testid="invoice-file-dialog">
        {file ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Paperclip aria-hidden="true" className="size-4 text-muted-foreground" />
            <span className="min-w-0 truncate">{file.name}</span>
            {uploading ? <span className="text-xs text-muted-foreground">{fillPlaceholders(messages.pcFileUploading, { percent: String(file.percent) })}</span> : null}
            {file.error ? <span className="text-xs text-destructive-text">{file.error}</span> : null}
            <Button type="button" variant="ghost" size="sm" aria-label={messages.pcFileRemove} disabled={busy} onClick={() => setFile(null)}><X aria-hidden="true" /></Button>
          </div>
        ) : (
          <label className="flex cursor-pointer flex-col items-start gap-1 rounded-lg border border-dashed px-3 py-3 text-sm hover:bg-accent has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring">
            {/* UX-2-013: the file input is sr-only, so the label draws the keyboard focus ring. */}
            <span className="font-medium text-primary">{messages.pcFileChoose}</span>
            <span className="text-xs text-muted-foreground">{messages.pcFileHint}</span>
            <input type="file" className="sr-only" accept={INVOICE_FILE_TYPES.join(',')} onChange={(event) => void pickFile(event.target.files?.[0])} disabled={busy} />
          </label>
        )}
        {error ? <InlineAlert>{error}</InlineAlert> : null}
        <DialogActions>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>{messages.cancel}</Button>
          <Button loading={busy} type="button" onClick={() => void save()} disabled={busy || uploading || !changed}>{messages.pcFileSave}</Button>
        </DialogActions>
      </div>
    </Modal>
  );
}
