'use client';

import { useRef, useState } from 'react';
import { Paperclip, Plus, Trash2, X } from 'lucide-react';
import {
  INVOICE_FILE_MAX_BYTES,
  INVOICE_FILE_TYPES,
  centsToInput,
  formatCents,
  parseMoneyToCents,
  type AdminExternalJobDto,
  type AdminInvoiceMatchDto,
  type AdminOutsideRepairDetailDto,
  type AdminPurchaseFormDataDto,
  type AdminVendorDto,
} from '@ltl-shop/shared';
import { useActionToast } from './action-toast';
import { AdminNavLink } from './admin-nav-link';
import { partsCostsFailure } from './admin-parts-catalog';
import { MissingSummary, OptionalTag, RequiredNote, StickyFormFooter, focusField, type MissingField } from './parts-costs-form-ui';
import { Button, Input, Label, Modal, Select, Textarea, InlineAlert } from './ui';
import {
  checkAdminInvoice,
  createAdminOutsideRepair,
  createAdminVendor,
  requestAdminAttachment,
  updateAdminOutsideRepair,
  uploadInvoiceFile,
  useAdminExternalJobs,
} from '@/lib/admin-data';
import { fillPlaceholders } from '@/lib/admin-next-step';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';
import { ApiError } from '@/lib/api';
import { apiErrorCode } from '@/lib/api-error-message';
import { formatInvoiceDate } from '@/lib/parts-costs-format';
import { useUnsavedChangesGuard } from '@/lib/use-unsaved-changes-guard';

type FileState = { id: string | null; name: string; percent: number; error: string | null };
/** LTR-298: one job on the shop's invoice, as typed. */
type LineState = { description: string; amount: string };
const ADD_VENDOR = '__add_vendor__';
const emptyLine = (): LineState => ({ description: '', amount: '' });

const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

/** "Radiator Repair · WO-001 · part out since Oct 6, 2026" / "… · back Oct 8, 2026". */
export function externalJobLabel(job: AdminExternalJobDto, locale: AdminLocale, messages: AdminMessages) {
  const what = job.kind === 'truck' ? messages.pcWhatTruck : job.kind === 'part' ? messages.pcWhatPart : '';
  const date = (value: string | null) => (value ? formatInvoiceDate(value.slice(0, 10), locale) : '');
  return job.out
    ? fillPlaceholders(messages.pcJobOut, { job: job.displayName, wo: job.workOrderDisplayId, what, date: date(job.sentAt) })
    : fillPlaceholders(messages.pcJobBack, { job: job.displayName, wo: job.workOrderDisplayId, what, date: date(job.returnedAt ?? job.sentAt) });
}

export function duplicateText(match: AdminInvoiceMatchDto, locale: AdminLocale, messages: AdminMessages) {
  const base = fillPlaceholders(messages.pcDuplicateInvoice, {
    vendor: match.vendorName ?? '',
    number: match.invoiceNumber ?? '',
    date: match.invoiceDate ? formatInvoiceDate(match.invoiceDate, locale) : '',
    total: match.totalCents !== undefined ? formatCents(match.totalCents, locale) : '',
  });
  return `${base} ${match.kind === 'outside_repair' ? messages.pcDuplicateIsRepair : messages.pcDuplicateIsPurchase}`;
}

export function invoiceHref(match: AdminInvoiceMatchDto) {
  return match.kind === 'outside_repair' ? `/admin/parts/outside-repairs/${match.id}` : `/admin/parts/purchases/${match.id}`;
}

/**
 * LTR-200 / D32 (PC-3): New / Edit outside repair. Truck first, then the Job sent to an external shop (its Jobs out
 * now or back within 90 days); opened from a Job, both come picked ("From WO-001 · Radiator Repair"). Same guards
 * as a purchase: repeated invoice across purchases and repairs, one Idempotency-Key per open form.
 * LTR-298: the invoice is loaded as jobs (what was done × amount), the total is their sum, and a vendor that is
 * not in Vendors yet is added from here ("+ Add vendor…", born with "Does repairs").
 */
export function OutsideRepairForm({
  repair,
  preset,
  vendors,
  formData,
  locale,
  messages,
  onClose,
  onSaved,
  onVendorAdded,
  notice,
}: {
  repair: AdminOutsideRepairDetailDto | null;
  /** LTR-298: reloads Vendors after "+ Add vendor…" here. */
  onVendorAdded?: () => void;
  /** PCA4 (UX-10-002): said above the fields when the repair is already on a sent invoice. */
  notice?: string | null;
  preset?: { truckId?: string; jobId?: string };
  vendors: AdminVendorDto[];
  formData: AdminPurchaseFormDataDto;
  locale: AdminLocale;
  messages: AdminMessages;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const { showToast } = useActionToast();
  const initial = {
    truckId: repair?.truck.id ?? preset?.truckId ?? '',
    vendorId: repair?.vendor.id ?? '',
    invoiceNumber: repair?.invoiceNumber ?? '',
    invoiceDate: repair?.invoiceDate ?? today(),
    lines: repair ? repair.lines.map((line) => ({ description: line.description, amount: centsToInput(line.amountCents) })) : [emptyLine()],
    jobId: repair?.job?.id ?? preset?.jobId ?? '',
    notes: repair?.notes ?? '',
  };
  const [form, setForm] = useState(initial);
  const [idempotencyKey] = useState(() => globalThis.crypto.randomUUID());
  const [file, setFile] = useState<FileState | null>(repair?.attachment ? { id: repair.attachment.id, name: repair.attachment.fileName, percent: 100, error: null } : null);
  const [duplicate, setDuplicate] = useState<AdminInvoiceMatchDto | null>(null);
  const [newVendor, setNewVendor] = useState<string | null>(null);
  // One vendor per tap; the ref stops a second tap before React re-renders the disabled button.
  const [addingVendor, setAddingVendor] = useState(false);
  const addingVendorRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const { data: externalJobs } = useAdminExternalJobs(form.truckId);
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((current) => ({ ...current, [key]: value }));
  const setLine = (index: number, patch: Partial<LineState>) =>
    setForm((current) => ({ ...current, lines: current.lines.map((line, at) => (at === index ? { ...line, ...patch } : line)) }));

  // LTR-298: each job's amount; the invoice total is their sum.
  const lineAmounts = form.lines.map((line) => parseMoneyToCents(line.amount));
  const linesValid = form.lines.every((line, index) => line.description.trim() && typeof lineAmounts[index] === 'number');
  const amount = linesValid ? lineAmounts.reduce<number>((sum, cents) => sum + (cents as number), 0) : null;
  const description = form.lines.map((line) => line.description.trim()).filter(Boolean).join(' · ');
  const jobs = [...(externalJobs ?? [])];
  if (repair?.job && !jobs.some((job) => job.jobId === repair.job!.id)) {
    jobs.push({ jobId: repair.job.id, displayName: repair.job.displayName, workOrderId: repair.job.workOrderId, workOrderDisplayId: repair.job.workOrderDisplayId, kind: repair.job.kind, sentAt: null, returnedAt: null, out: false });
  }
  const presetJob = !repair && preset?.jobId ? jobs.find((job) => job.jobId === preset.jobId) : undefined;
  const vendorChoices = [...vendors.filter((vendor) => vendor.active || vendor.id === form.vendorId)]
    .sort((left, right) => Number(right.doesRepairs) - Number(left.doesRepairs) || left.name.localeCompare(right.name));
  const uploading = Boolean(file && !file.id && !file.error);
  const valid = Boolean(form.truckId && form.vendorId && form.invoiceNumber.trim() && form.invoiceDate && linesValid);
  // UX-7-026 / PC1: what stops the save, in form order.
  const missing: MissingField[] = [
    ...(!form.truckId ? [{ label: messages.pcMissingTruck, fieldId: 'outside-truck' }] : []),
    ...(!form.vendorId ? [{ label: messages.pcMissingVendor, fieldId: 'outside-vendor' }] : []),
    ...(!form.invoiceDate ? [{ label: messages.pcMissingDate, fieldId: 'outside-date' }] : []),
    ...(!form.invoiceNumber.trim() ? [{ label: messages.pcMissingInvoice, fieldId: 'outside-invoice' }] : []),
    ...form.lines.flatMap((line, index) => {
      const n = String(index + 1);
      return [
        ...(!line.description.trim() ? [{ label: fillPlaceholders(messages.pcMissingRepairLineWhat, { n }), fieldId: `repair-line-what-${index}` }] : []),
        ...(typeof lineAmounts[index] !== 'number' ? [{ label: fillPlaceholders(messages.pcMissingRepairLineAmount, { n }), fieldId: `repair-line-amount-${index}` }] : []),
      ];
    }),
  ];
  const dirty = JSON.stringify(form) !== JSON.stringify(initial) || (file?.id ?? null) !== (repair?.attachment?.id ?? null);

  // LTR-293 §2: a reload, closing the tab or a link away asks first, not only closing this dialog.
  useUnsavedChangesGuard(dirty && !busy, messages.unsavedChangesConfirm);

  async function checkDuplicate() {
    if (!form.vendorId || !form.invoiceNumber.trim()) return setDuplicate(null);
    try {
      const match = await checkAdminInvoice(form.vendorId, form.invoiceNumber.trim(), repair?.id);
      setDuplicate(match.exists ? match : null);
    } catch {
      setDuplicate(null);
    }
  }

  async function addVendor() {
    if (!newVendor?.trim() || addingVendorRef.current) return;
    addingVendorRef.current = true;
    setAddingVendor(true);
    try {
      const created = await createAdminVendor({ name: newVendor.trim(), doesParts: false, doesRepairs: true });
      onVendorAdded?.();
      set('vendorId', created.id);
      setNewVendor(null);
      showToast('success', messages.pcVendorAdded);
    } catch (failure) {
      setError(partsCostsFailure(failure, messages));
    } finally {
      addingVendorRef.current = false;
      setAddingVendor(false);
    }
  }

  async function pickFile(chosen: File | undefined) {
    if (!chosen) return;
    if (!(INVOICE_FILE_TYPES as readonly string[]).includes(chosen.type)) return setFile({ id: null, name: chosen.name, percent: 0, error: messages.pcFileTypeInvalid });
    if (chosen.size > INVOICE_FILE_MAX_BYTES) return setFile({ id: null, name: chosen.name, percent: 0, error: messages.pcFileTooBig });
    setFile({ id: null, name: chosen.name, percent: 0, error: null });
    try {
      const target = await requestAdminAttachment({ fileName: chosen.name, contentType: chosen.type as (typeof INVOICE_FILE_TYPES)[number], sizeBytes: chosen.size });
      await uploadInvoiceFile(target.uploadUrl, chosen, (percent) => setFile((current) => (current ? { ...current, percent } : current)));
      setFile({ id: target.id, name: chosen.name, percent: 100, error: null });
    } catch {
      setFile({ id: null, name: chosen.name, percent: 0, error: messages.pcFileFailed });
    }
  }

  /** UX-7-029 / PC4: closing with changes asks first (Cancel used to close at once and lose what was typed). */
  function close() {
    if (dirty && !busy) setConfirmDiscard(true);
    else onClose();
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setShowErrors(true);
    if (!valid) {
      if (missing[0]) focusField(missing[0].fieldId);
      return;
    }
    if (busy || uploading) return;
    setBusy(true);
    setError(null);
    const body = {
      truckId: form.truckId,
      vendorId: form.vendorId,
      invoiceNumber: form.invoiceNumber.trim(),
      invoiceDate: form.invoiceDate,
      description,
      amountCents: amount as number,
      lines: form.lines.map((line, index) => ({ description: line.description.trim(), amountCents: lineAmounts[index] as number })),
      workOrderJobId: form.jobId || null,
      notes: form.notes,
      attachmentId: file?.id ?? null,
    };
    try {
      const saved = repair ? await updateAdminOutsideRepair(repair.id, body) : await createAdminOutsideRepair(body, idempotencyKey);
      showToast('success', fillPlaceholders(messages.pcOutsideSaved, { total: formatCents(amount as number, locale) }));
      onSaved(saved.id);
    } catch (failure) {
      if (failure instanceof ApiError && apiErrorCode(failure) === 'DUPLICATE_INVOICE') {
        setDuplicate(failure.body as AdminInvoiceMatchDto);
      } else {
        setError(failure instanceof ApiError && failure.status >= 500 ? messages.pcOutsideFailed : partsCostsFailure(failure, messages));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open title={repair ? messages.pcEditOutside : messages.pcNewOutside} description={presetJob ? fillPlaceholders(messages.pcFromJob, { wo: presetJob.workOrderDisplayId, job: presetJob.displayName }) : undefined} onClose={close} closeLabel={messages.closeDialog} dismissible={!dirty} className="sm:max-w-2xl">
      <form className="space-y-4" onSubmit={(event) => void submit(event)} data-testid="outside-repair-form" noValidate>
        {notice ? <InlineAlert data-testid="outside-charged-notice">{notice}</InlineAlert> : null}
        {showErrors ? <MissingSummary missing={missing} messages={messages} /> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="outside-truck">{messages.pcTruckRequired}</Label>
            <Select id="outside-truck" value={form.truckId} disabled={busy} aria-invalid={(showErrors && !form.truckId) || undefined} onChange={(event) => setForm((current) => ({ ...current, truckId: event.target.value, jobId: '' }))}>
              <option value="">{messages.pcPickTruck}</option>
              {formData.trucks.map((truck) => <option key={truck.id} value={truck.id}>{fillPlaceholders(messages.pcTruckLabel, { truck: truck.truckNumber })}</option>)}
            </Select>
            <RequiredNote show={showErrors && !form.truckId} messages={messages} />
          </div>
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="outside-vendor">{messages.pcVendorField}</Label>
            <Select
              id="outside-vendor"
              value={newVendor !== null ? ADD_VENDOR : form.vendorId}
              disabled={busy}
              aria-invalid={(showErrors && !form.vendorId) || undefined}
              onChange={(event) => {
                if (event.target.value === ADD_VENDOR) return setNewVendor('');
                setNewVendor(null);
                set('vendorId', event.target.value);
                setDuplicate(null);
              }}
            >
              <option value="">{messages.pcPickVendor}</option>
              {vendorChoices.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
              <option value={ADD_VENDOR}>{messages.pcAddVendorOption}</option>
            </Select>
            <RequiredNote show={showErrors && !form.vendorId && newVendor === null} messages={messages} />
            {newVendor !== null ? (
              <div className="flex gap-2">
                <Input aria-label={messages.pcNewVendorName} placeholder={messages.pcNewVendorName} value={newVendor} onChange={(event) => setNewVendor(event.target.value)} autoComplete="off" />
                <Button type="button" variant="outline" disabled={!newVendor.trim() || addingVendor} aria-busy={addingVendor || undefined} onClick={() => void addVendor()}>{messages.pcAddVendor}</Button>
              </div>
            ) : null}
          </div>
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="outside-date">{messages.pcInvoiceDate}</Label>
            <Input id="outside-date" type="date" value={form.invoiceDate} onChange={(event) => set('invoiceDate', event.target.value)} disabled={busy} />
          </div>
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="outside-invoice">{messages.pcInvoiceNumber}</Label>
            <Input id="outside-invoice" className="font-mono" spellCheck={false} autoCapitalize="characters" autoCorrect="off" value={form.invoiceNumber} onChange={(event) => { set('invoiceNumber', event.target.value); setDuplicate(null); }} onBlur={() => void checkDuplicate()} disabled={busy} autoComplete="off" aria-invalid={(showErrors && !form.invoiceNumber.trim()) || Boolean(duplicate) || undefined} />
            <RequiredNote show={showErrors && !form.invoiceNumber.trim()} messages={messages} />
          </div>
        </div>
        {duplicate?.exists ? (
          <p className="rounded-lg border border-warning/40 bg-warning-surface px-3 py-2 text-sm text-warning-foreground" role="alert" data-testid="duplicate-invoice">
            {duplicateText(duplicate, locale, messages)}{' '}
            <AdminNavLink className="tap-inline font-medium underline" href={invoiceHref(duplicate)}>{messages.pcOpenIt}</AdminNavLink>
          </p>
        ) : null}

        <div className="min-w-0 space-y-1.5">
          <Label htmlFor="outside-job">{messages.pcExternalJob}<OptionalTag messages={messages} /></Label>
          <Select id="outside-job" value={form.jobId} disabled={busy || !form.truckId} onChange={(event) => set('jobId', event.target.value)}>
            <option value="">{messages.pcNotLinked}</option>
            {jobs.map((job) => <option key={job.jobId} value={job.jobId}>{externalJobLabel(job, locale, messages)}</option>)}
          </Select>
          {form.truckId && externalJobs && !jobs.length ? <p className="text-xs text-muted-foreground">{messages.pcNoExternalJobs}</p> : null}
        </div>

        {/* LTR-298: the invoice as the shop wrote it: one job per line, each with its amount. */}
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">{messages.pcRepairLines}</legend>
          <p className="text-xs text-muted-foreground">{messages.pcRepairLinesHelp}</p>
          {form.lines.map((line, index) => {
            const cents = lineAmounts[index];
            return (
              <div key={index} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_8rem_auto]" data-testid="repair-line">
                <div className="space-y-1">
                  <Label htmlFor={`repair-line-what-${index}`} className="text-xs">{messages.pcRepairLineWhat}</Label>
                  <Input id={`repair-line-what-${index}`} value={line.description} onChange={(event) => setLine(index, { description: event.target.value })} disabled={busy} autoComplete="off" aria-invalid={(showErrors && !line.description.trim()) || undefined} />
                  <RequiredNote show={showErrors && !line.description.trim()} messages={messages} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`repair-line-amount-${index}`} className="text-xs">{messages.pcRepairLineAmount}</Label>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">$</span>
                    <Input id={`repair-line-amount-${index}`} className="pl-7 tabular-nums" inputMode="decimal" placeholder="0.00" value={line.amount} onChange={(event) => setLine(index, { amount: event.target.value })} disabled={busy} aria-invalid={cents === undefined || (showErrors && cents === null) || undefined} />
                  </div>
                  {cents === undefined ? <p className="text-xs text-destructive-text">{messages.pcCostInvalid}</p> : <RequiredNote show={showErrors && cents === null} messages={messages} />}
                </div>
                <div className="flex items-end">
                  <Button type="button" variant="ghost" size="sm" aria-label={fillPlaceholders(messages.pcRemoveRepairLine, { number: String(index + 1) })} disabled={busy || form.lines.length === 1} onClick={() => set('lines', form.lines.filter((_, at) => at !== index))}>
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              </div>
            );
          })}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => set('lines', [...form.lines, emptyLine()])}>
              <Plus aria-hidden="true" />{messages.pcAddRepairLine}
            </Button>
            <p className="text-sm" aria-live="polite">
              <span className="text-muted-foreground">{messages.pcRepairTotal}</span>{' '}
              <span className="text-base font-semibold tabular-nums" data-testid="outside-total">{formatCents(lineAmounts.reduce<number>((sum, cents) => sum + (typeof cents === 'number' ? cents : 0), 0), locale)}</span>
            </p>
          </div>
        </fieldset>

        <div className="min-w-0 space-y-1.5">
          <span className="block text-sm font-medium">{messages.pcInvoiceFile}<OptionalTag messages={messages} /></span>
          {!formData.filesEnabled ? (
            <p className="text-xs text-muted-foreground" data-testid="files-off">{messages.pcFilesOff}</p>
          ) : file ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Paperclip aria-hidden="true" className="size-4 text-muted-foreground" />
              <span className="min-w-0 truncate">{file.name}</span>
              {!file.id && !file.error ? <span className="text-xs text-muted-foreground">{fillPlaceholders(messages.pcFileUploading, { percent: String(file.percent) })}</span> : null}
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
        </div>
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor="outside-notes">{messages.pcNotes}<OptionalTag messages={messages} /></Label>
          <Textarea id="outside-notes" rows={2} value={form.notes} onChange={(event) => set('notes', event.target.value)} disabled={busy} />
        </div>

        <StickyFormFooter
          error={error}
          confirmDiscard={confirmDiscard}
          onDiscard={onClose}
          onKeepEditing={() => setConfirmDiscard(false)}
          onCancel={close}
          submitLabel={repair ? messages.pcSaveChanges : messages.pcNewOutside}
          submitDisabled={busy || uploading || Boolean(duplicate?.exists)}
          busy={busy}
          messages={messages}
        />
      </form>
    </Modal>
  );
}
