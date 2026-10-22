'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { FileSearch, Paperclip, Plus, Trash2, X } from 'lucide-react';
import {
  INVOICE_FILE_MAX_BYTES,
  INVOICE_FILE_TYPES,
  centsToInput,
  formatCents,
  lineTotalCents,
  parseMoneyToCents,
  parseQuantityToHundredths,
  readInvoiceLines,
  truckAmounts,
  type AdminInvoiceMatchDto,
  type AdminPartCategoryDto,
  type AdminPurchaseDetailDto,
  type AdminPurchaseFormDataDto,
  type AdminPurchaseJobRefDto,
  type AdminSavePurchaseInput,
  type AdminVendorDto,
} from '@ltl-shop/shared';
import { useActionToast } from './action-toast';
import { AdminNavLink } from './admin-nav-link';
import { duplicateText, invoiceHref } from './admin-outside-repair-form';
import { MissingSummary, OptionalTag, RequiredNote, StickyFormFooter, focusField, type MissingField } from './parts-costs-form-ui';
import { PartDialog, partsCostsFailure } from './admin-parts-catalog';
import { OTHER_PART, PartPicker } from './part-picker';
import { Button, Input, Label, Modal, Select, Textarea, InlineAlert } from './ui';
import {
  checkAdminInvoice,
  createAdminPurchase,
  createAdminVendor,
  requestAdminAttachment,
  updateAdminPurchase,
  uploadInvoiceFile,
  useAdminTruckJobs,
} from '@/lib/admin-data';
import { fillPlaceholders } from '@/lib/admin-next-step';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';
import { ApiError } from '@/lib/api';
import { apiErrorCode } from '@/lib/api-error-message';
import { formatInvoiceDate } from '@/lib/parts-costs-format';
import { pdfTextLines } from '@/lib/pdf-text';
import { useUnsavedChangesGuard } from '@/lib/use-unsaved-changes-guard';

const DRAFT_KEY = 'ltl.admin.purchase-draft';
const OTHER = OTHER_PART;
const ADD_VENDOR = '__add_vendor__';

/** `costFrom`: where the unit cost was filled from when the part was picked (shown until the cost is changed). */
/** `destination`: for a line without a truck; '' = a catalog part goes to stock, an "Other" is a Shop supply (D45 / ST-3). */
type LineState = { partId: string; description: string; quantity: string; unitCost: string; truckId: string; jobId?: string; destination?: '' | 'stock' | 'shop_supplies'; costFrom?: 'last' | 'reference' | null };
type FormState = {
  vendorId: string;
  invoiceNumber: string;
  invoiceDate: string;
  truckId: string;
  split: boolean;
  lines: LineState[];
  tax: string;
  freight: string;
  notes: string;
};
type FileState = { id: string | null; name: string; percent: number; error: string | null };

/** D45 / ST-3: a catalog part without a truck goes to stock unless the Manager says Shop supplies; an "Other", the reverse. */
function lineDestination(line: LineState): 'stock' | 'shop_supplies' {
  if (line.destination) return line.destination;
  return line.partId && line.partId !== OTHER ? 'stock' : 'shop_supplies';
}

const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};
const emptyLine = (): LineState => ({ partId: '', description: '', quantity: '1', unitCost: '', truckId: '' });

function initialState(purchase: AdminPurchaseDetailDto | null, presetTruckId?: string, presetJobId?: string): FormState {
  if (!purchase) {
    const line = { ...emptyLine(), jobId: presetTruckId && presetJobId ? presetJobId : '' };
    return { vendorId: '', invoiceNumber: '', invoiceDate: today(), truckId: presetTruckId ?? '', split: false, lines: [line], tax: '', freight: '', notes: '' };
  }
  const truckIds = [...new Set(purchase.lines.map((line) => line.truck?.id ?? ''))];
  return {
    vendorId: purchase.vendor.id,
    invoiceNumber: purchase.invoiceNumber,
    invoiceDate: purchase.invoiceDate,
    truckId: truckIds.length === 1 ? truckIds[0] : '',
    split: truckIds.length > 1,
    lines: purchase.lines.map((line) => ({
      partId: line.partId ?? OTHER,
      description: line.partId ? '' : line.description,
      quantity: String(Number(line.quantity)),
      unitCost: centsToInput(line.unitCostCents),
      truckId: line.truck?.id ?? '',
      jobId: line.job?.id ?? '',
      destination: line.destination === 'truck' ? '' : line.destination,
    })),
    tax: purchase.taxCents ? centsToInput(purchase.taxCents) : '',
    freight: purchase.freightCents ? centsToInput(purchase.freightCents) : '',
    notes: purchase.notes ?? '',
  };
}

function readDraft(): FormState | null {
  try {
    const raw = globalThis.sessionStorage?.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as FormState) : null;
  } catch {
    return null;
  }
}

function writeDraft(state: FormState | null) {
  try {
    if (state) globalThis.sessionStorage?.setItem(DRAFT_KEY, JSON.stringify(state));
    else globalThis.sessionStorage?.removeItem(DRAFT_KEY);
  } catch {
    // Storage blocked: the form still works, just without the draft.
  }
}

/**
 * LTR-200 / D32 (PC-2): New purchase / Edit purchase. The total is live and the API recomputes it (a total that
 * does not match is refused). One Idempotency-Key per open form (A59). Leaving the invoice # field warns about a
 * repeated invoice with "Open it" (D-PC8). The draft of a new purchase stays in this tab until saved or discarded.
 */
export function PurchaseForm({
  purchase,
  presetTruckId,
  presetJobId,
  categories,
  vendors,
  formData,
  locale,
  messages,
  onClose,
  onSaved,
  onVendorAdded,
  onCatalogChanged,
  notice,
}: {
  purchase: AdminPurchaseDetailDto | null;
  /** PCA4 (UX-10-002): said above the fields when the purchase is already on a sent invoice. */
  notice?: string | null;
  presetTruckId?: string;
  /** D45 / ST-1: opened from a Job on the Work Order; the first line is tied to it. */
  presetJobId?: string;
  categories: AdminPartCategoryDto[];
  vendors: AdminVendorDto[];
  formData: AdminPurchaseFormDataDto;
  locale: AdminLocale;
  messages: AdminMessages;
  onClose: () => void;
  onSaved: (id: string) => void;
  onVendorAdded: () => void;
  /** D45 / ST-2 (HU-R2): reloads the catalog after "Add to catalog" on an "Other" line. */
  onCatalogChanged?: () => Promise<unknown> | void;
}) {
  const { showToast } = useActionToast();
  const [cataloging, setCataloging] = useState<number | null>(null);
  // D45 / ST-6: what the PDF reader filled, said until the Manager saves (nothing is saved on its own).
  const [reading, setReading] = useState<{ busy: boolean; note: string | null; warn: boolean }>({ busy: false, note: null, warn: false });
  const restored = useRef(false);
  const [state, setState] = useState<FormState>(() => {
    const draft = !purchase && !presetTruckId ? readDraft() : null;
    restored.current = Boolean(draft);
    return draft ?? initialState(purchase, presetTruckId, presetJobId);
  });
  const [idempotencyKey] = useState(() => globalThis.crypto.randomUUID());
  const [file, setFile] = useState<FileState | null>(
    purchase?.attachment ? { id: purchase.attachment.id, name: purchase.attachment.fileName, percent: 100, error: null } : null,
  );
  const [duplicate, setDuplicate] = useState<AdminInvoiceMatchDto | null>(null);
  const [newVendor, setNewVendor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // LTR-293 §5: one vendor per tap; the ref stops a second tap before React re-renders the disabled button.
  const [addingVendor, setAddingVendor] = useState(false);
  const addingVendorRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const pristine = useRef(JSON.stringify(initialState(purchase, presetTruckId, presetJobId)));

  useEffect(() => {
    if (restored.current) showToast('success', messages.pcDraftRestored);
    // Only on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!purchase) writeDraft(JSON.stringify(state) === pristine.current ? null : state);
  }, [purchase, state]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setState((current) => ({ ...current, [key]: value }));
  const setLine = (index: number, patch: Partial<LineState>) =>
    setState((current) => ({ ...current, lines: current.lines.map((line, at) => (at === index ? { ...line, ...patch } : line)) }));

  const partById = useMemo(() => new Map(categories.flatMap((category) => category.parts).map((part) => [part.id, part])), [categories]);
  const vendorChoices = vendors.filter((vendor) => (vendor.active && vendor.doesParts) || vendor.id === state.vendorId);
  const truckNumber = (id: string) => formData.trucks.find((truck) => truck.id === id)?.truckNumber ?? '';

  /** D-PC6: the last price paid to this vendor, else the part's reference cost. */
  function startingCost(partId: string, vendorId: string): { cost: string; from: 'last' | 'reference' | null } {
    const paid = formData.lastPaid.find((row) => row.partId === partId && row.vendorId === vendorId);
    if (paid) return { cost: centsToInput(paid.unitCostCents), from: 'last' };
    const part = partById.get(partId);
    return part?.unitCostCents !== null && part?.unitCostCents !== undefined ? { cost: centsToInput(part.unitCostCents), from: 'reference' } : { cost: '', from: null };
  }

  const computed = state.lines.map((line) => {
    const hundredths = parseQuantityToHundredths(line.quantity);
    const unit = parseMoneyToCents(line.unitCost);
    const needsPart = !line.partId || (line.partId === OTHER && !line.description.trim());
    return {
      hundredths,
      unit,
      needsPart,
      total: hundredths !== undefined && typeof unit === 'number' ? lineTotalCents(hundredths, unit) : null,
      truckId: (state.split ? line.truckId : state.truckId) || null,
      // D45 / ST-3: where a line without a truck goes.
      destination: lineDestination(line),
    };
  });
  const tax = parseMoneyToCents(state.tax);
  const freight = parseMoneyToCents(state.freight);
  const subtotal = computed.reduce((sum, line) => sum + (line.total ?? 0), 0);
  const extra = (tax ?? 0) + (freight ?? 0);
  const total = subtotal + extra;
  const shares = truckAmounts(computed.map((line) => ({ truckId: line.truckId, lineTotalCents: line.total ?? 0 })), extra);
  const toTrucks = shares.filter((row) => row.truckId).reduce((sum, row) => sum + row.amountCents, 0);
  const stockNeedsPart = (index: number) => !computed[index].truckId && computed[index].destination === 'stock' && state.lines[index].partId === OTHER;
  const linesValid = computed.every((line, index) => !line.needsPart && line.hundredths !== undefined && typeof line.unit === 'number' && !stockNeedsPart(index));
  const moneyValid = tax !== undefined && freight !== undefined;
  const uploading = Boolean(file && !file.id && !file.error);
  const valid = Boolean(state.vendorId && state.invoiceNumber.trim() && state.invoiceDate && linesValid && moneyValid);
  // UX-7-026 / PC1: everything that stops the save, in form order, with the field to go to.
  const missing: MissingField[] = [
    ...(!state.vendorId ? [{ label: messages.pcMissingVendor, fieldId: 'purchase-vendor' }] : []),
    ...(!state.invoiceDate ? [{ label: messages.pcMissingDate, fieldId: 'purchase-date' }] : []),
    ...(!state.invoiceNumber.trim() ? [{ label: messages.pcMissingInvoice, fieldId: 'purchase-invoice' }] : []),
    ...computed.flatMap((line, index) => {
      const n = String(index + 1);
      return [
        ...(line.needsPart ? [{ label: fillPlaceholders(messages.pcMissingLinePart, { n }), fieldId: `line-part-${index}` }] : []),
        ...(line.hundredths === undefined ? [{ label: fillPlaceholders(messages.pcMissingLineQty, { n }), fieldId: `line-qty-${index}` }] : []),
        ...(typeof line.unit !== 'number' ? [{ label: fillPlaceholders(messages.pcMissingLineCost, { n }), fieldId: `line-cost-${index}` }] : []),
        ...(stockNeedsPart(index) ? [{ label: messages.pcLineStockNeedsPart, fieldId: `line-goes-${index}` }] : []),
      ];
    }),
    ...(tax === undefined ? [{ label: messages.pcMissingTax, fieldId: 'purchase-tax' }] : []),
    ...(freight === undefined ? [{ label: messages.pcMissingFreight, fieldId: 'purchase-freight' }] : []),
  ];
  const trucksInvoiced = shares.filter((row) => row.truckId);
  const dirty = JSON.stringify(state) !== pristine.current || (file?.id ?? null) !== (purchase?.attachment?.id ?? null);

  // LTR-293 §2: a reload, closing the tab or a link away asks first, not only closing this dialog.
  useUnsavedChangesGuard(dirty && !busy, messages.unsavedChangesConfirm);

  async function checkDuplicate() {
    if (!state.vendorId || !state.invoiceNumber.trim()) return setDuplicate(null);
    try {
      const match = await checkAdminInvoice(state.vendorId, state.invoiceNumber.trim(), purchase?.id);
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
      const created = await createAdminVendor({ name: newVendor.trim(), doesParts: true });
      onVendorAdded();
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

  /**
   * D45 / ST-6 (LTR-226, P30): reads the supplier's PDF and fills what it finds — vendor, invoice #, date, lines, tax
   * and freight. Fields the Manager already typed stay; lines are replaced only while the form has none filled in.
   * The same file is attached as the invoice file when files are on.
   */
  async function readPdf(chosen: File | undefined) {
    if (!chosen) return;
    setReading({ busy: true, note: null, warn: false });
    try {
      const textLines = await pdfTextLines(chosen);
      if (!textLines.length) {
        setReading({ busy: false, note: messages.pcPdfNoText, warn: true });
        return;
      }
      const parts = categories.flatMap((category) => category.parts).filter((part) => part.active);
      const proposal = readInvoiceLines(textLines, {
        vendors: vendors.filter((vendor) => vendor.active && vendor.doesParts).map((vendor) => ({ id: vendor.id, name: vendor.name })),
        parts: parts.map((part) => ({ id: part.id, partNumber: part.partNumber, displayName: part.displayName })),
      });
      const linesEmpty = state.lines.every((line) => !line.partId && !line.description.trim() && !line.unitCost.trim());
      setState((current) => ({
        ...current,
        vendorId: current.vendorId || proposal.vendorId || '',
        invoiceNumber: current.invoiceNumber.trim() ? current.invoiceNumber : proposal.invoiceNumber ?? '',
        invoiceDate: proposal.invoiceDate && current.invoiceDate === today() ? proposal.invoiceDate : current.invoiceDate,
        tax: current.tax.trim() || proposal.taxCents === null ? current.tax : centsToInput(proposal.taxCents),
        freight: current.freight.trim() || proposal.freightCents === null ? current.freight : centsToInput(proposal.freightCents),
        lines: linesEmpty && proposal.lines.length
          ? proposal.lines.map((line) => ({
              ...emptyLine(),
              truckId: current.split ? '' : current.truckId,
              partId: line.partId ?? OTHER,
              description: line.partId ? '' : line.description,
              quantity: line.quantity,
              unitCost: centsToInput(line.unitCostCents),
            }))
          : current.lines,
      }));
      const linesTotal = proposal.lines.reduce((sum, line) => sum + Math.round(Number(line.quantity) * line.unitCostCents), 0);
      const expected = proposal.totalCents;
      const off = expected !== null && linesTotal + (proposal.taxCents ?? 0) + (proposal.freightCents ?? 0) !== expected;
      setReading({
        busy: false,
        warn: off || !proposal.lines.length,
        note: [
          fillPlaceholders(messages.pcPdfRead, { lines: String(proposal.lines.length) }),
          !proposal.vendorId ? messages.pcPdfNoVendor : null,
          off && expected !== null ? fillPlaceholders(messages.pcPdfTotalOff, { total: formatCents(expected, locale) }) : null,
          !linesEmpty && proposal.lines.length ? messages.pcPdfKeptLines : null,
        ].filter(Boolean).join(' '),
      });
      if (formData.filesEnabled && !file) void pickFile(chosen);
    } catch {
      setReading({ busy: false, note: messages.pcPdfFailed, warn: true });
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
    const body: AdminSavePurchaseInput = {
      vendorId: state.vendorId,
      invoiceNumber: state.invoiceNumber.trim(),
      invoiceDate: state.invoiceDate,
      taxCents: tax ?? 0,
      freightCents: freight ?? 0,
      notes: state.notes,
      expectedTotalCents: total,
      attachmentId: file?.id ?? null,
      lines: state.lines.map((line, index) => ({
        partId: line.partId === OTHER ? null : line.partId,
        description: line.partId === OTHER ? line.description.trim() : undefined,
        quantity: line.quantity.trim(),
        unitCostCents: computed[index].unit as number,
        truckId: computed[index].truckId,
        workOrderJobId: computed[index].truckId && line.jobId ? line.jobId : null,
        destination: computed[index].truckId ? 'truck' : computed[index].destination,
      })),
    };
    try {
      const saved = purchase ? await updateAdminPurchase(purchase.id, body) : await createAdminPurchase(body, idempotencyKey);
      if (!purchase) writeDraft(null);
      const truckCount = shares.filter((row) => row.truckId).length;
      showToast('success', truckCount > 1
        ? fillPlaceholders(messages.pcPurchaseSavedTrucks, { total: formatCents(total, locale), count: String(truckCount) })
        : fillPlaceholders(messages.pcPurchaseSaved, { total: formatCents(total, locale) }));
      onSaved(saved.id);
    } catch (failure) {
      if (failure instanceof ApiError && apiErrorCode(failure) === 'DUPLICATE_INVOICE') {
        setDuplicate(failure.body as AdminInvoiceMatchDto);
        setError(null);
      } else {
        setError(failure instanceof ApiError && failure.status >= 500 ? messages.pcPurchaseFailed : partsCostsFailure(failure, messages));
      }
    } finally {
      setBusy(false);
    }
  }

  function close() {
    if (dirty && !busy) setConfirmDiscard(true);
    else onClose();
  }

  function discard() {
    if (!purchase) writeDraft(null);
    onClose();
  }

  return (
    <Modal open title={purchase ? messages.pcEditPurchase : messages.pcNewPurchase} onClose={close} closeLabel={messages.closeDialog} dismissible={!dirty} className="sm:max-w-3xl">
      <form className="space-y-5" onSubmit={(event) => void submit(event)} data-testid="purchase-form" noValidate>
        {notice ? <InlineAlert data-testid="purchase-charged-notice">{notice}</InlineAlert> : null}
        {showErrors ? <MissingSummary missing={missing} messages={messages} /> : null}
        {!purchase ? (
          <div className="space-y-1.5 rounded-lg border border-dashed px-3 py-3" data-testid="purchase-read-pdf">
            <label className="flex cursor-pointer flex-wrap items-center gap-2 text-sm has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring">
              <FileSearch aria-hidden="true" className="size-4 text-primary" />
              <span className="font-medium text-primary">{reading.busy ? messages.pcPdfReading : messages.pcPdfRead_action}</span>
              <span id="purchase-read-pdf-hint" className="text-xs text-muted-foreground">{messages.pcPdfHint}</span>
              {/* Its own name: the hint ("Fills vendor, invoice #…") is a description, not the field's label. */}
              <input type="file" className="sr-only" accept="application/pdf" aria-label={messages.pcPdfRead_action} aria-describedby="purchase-read-pdf-hint" disabled={busy || reading.busy} onChange={(event) => { void readPdf(event.target.files?.[0]); event.target.value = ''; }} />
            </label>
            {reading.note ? (
              <p className={reading.warn ? 'text-xs text-warning-foreground dark:text-warning' : 'text-xs text-muted-foreground'} role="status" data-testid="purchase-read-pdf-note">{reading.note}</p>
            ) : null}
          </div>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="purchase-vendor">{messages.pcVendorField}</Label>
            <Select
              id="purchase-vendor"
              value={newVendor !== null ? ADD_VENDOR : state.vendorId}
              disabled={busy}
              aria-invalid={(showErrors && !state.vendorId) || undefined}
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
            <RequiredNote show={showErrors && !state.vendorId && newVendor === null} messages={messages} />
            {newVendor !== null ? (
              <div className="flex gap-2">
                <Input aria-label={messages.pcNewVendorName} placeholder={messages.pcNewVendorName} value={newVendor} onChange={(event) => setNewVendor(event.target.value)} autoComplete="off" />
                <Button type="button" variant="outline" disabled={!newVendor.trim() || addingVendor} aria-busy={addingVendor || undefined} onClick={() => void addVendor()}>{messages.pcAddVendor}</Button>
              </div>
            ) : null}
          </div>
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="purchase-date">{messages.pcInvoiceDate}</Label>
            <Input id="purchase-date" type="date" value={state.invoiceDate} onChange={(event) => set('invoiceDate', event.target.value)} disabled={busy} required aria-invalid={(showErrors && !state.invoiceDate) || undefined} />
            <RequiredNote show={showErrors && !state.invoiceDate} messages={messages} />
          </div>
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="purchase-invoice">{messages.pcInvoiceNumber}</Label>
            <Input
              id="purchase-invoice"
              className="font-mono"
              value={state.invoiceNumber}
              onChange={(event) => { set('invoiceNumber', event.target.value); setDuplicate(null); }}
              onBlur={() => void checkDuplicate()}
              disabled={busy}
              autoComplete="off"
              aria-invalid={(showErrors && !state.invoiceNumber.trim()) || Boolean(duplicate) || undefined}
            />
            <RequiredNote show={showErrors && !state.invoiceNumber.trim()} messages={messages} />
          </div>
        </div>
        {duplicate?.exists ? (
          <p className="rounded-lg border border-warning/40 bg-warning-surface px-3 py-2 text-sm text-warning-foreground" role="alert" data-testid="duplicate-invoice">
            {duplicateText(duplicate, locale, messages)}{' '}
            <AdminNavLink className="tap-inline font-medium underline" href={invoiceHref(duplicate)}>{messages.pcOpenIt}</AdminNavLink>
          </p>
        ) : null}

        <div className="flex flex-wrap items-end gap-4">
          {!state.split ? (
            <div className="min-w-56 space-y-1.5">
              <Label htmlFor="purchase-truck">{messages.pcTruckOptional}</Label>
              <Select id="purchase-truck" value={state.truckId} onChange={(event) => { const truckId = event.target.value; setState((current) => ({ ...current, truckId, lines: current.lines.map((line) => ({ ...line, jobId: '' })) })); }} disabled={busy}>
                <option value="">{messages.pcNoTruckOption}</option>
                {formData.trucks.map((truck) => <option key={truck.id} value={truck.id}>{fillPlaceholders(messages.pcTruckLabel, { truck: truck.truckNumber })}</option>)}
              </Select>
            </div>
          ) : null}
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={state.split}
              disabled={busy}
              onChange={(event) => setState((current) => ({
                ...current,
                split: event.target.checked,
                // A Job stays only while its line keeps the same truck (D45 / ST-1).
                lines: current.lines.map((line) => (event.target.checked
                  ? { ...line, truckId: current.truckId }
                  : { ...line, jobId: line.truckId === current.truckId ? line.jobId : '' })),
              }))}
            />
            {messages.pcSplitTrucks}
          </label>
        </div>

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">{messages.pcLines}</legend>
          <p className="text-xs text-muted-foreground">{messages.pcLinesHelp}</p>
          {state.lines.map((line, index) => {
            const row = computed[index];
            const paid = line.partId && line.partId !== OTHER ? formData.lastPaid.find((item) => item.partId === line.partId && item.vendorId === state.vendorId) : null;
            return (
              <div key={index} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[minmax(0,2fr)_5rem_7rem_6rem_auto]" data-testid="purchase-line">
                <div className="space-y-1">
                  <Label htmlFor={`line-part-${index}`} className="text-xs">{messages.pcLinePart}</Label>
                  {/* LTR-298: typed, not picked from a long list; what is not in Parts is used as typed or added from here. */}
                  <PartPicker
                    id={`line-part-${index}`}
                    categories={categories}
                    value={line.partId}
                    description={line.description}
                    disabled={busy}
                    invalid={showErrors && row.needsPart}
                    messages={messages}
                    onChange={(partId, description) => {
                      if (partId === line.partId && description === line.description) return;
                      const start = partId && partId !== OTHER ? startingCost(partId, state.vendorId) : { cost: '', from: null };
                      setLine(index, start.cost ? { partId, description, unitCost: start.cost, costFrom: start.from } : { partId, description, costFrom: null });
                    }}
                    onAddToCatalog={onCatalogChanged ? () => setCataloging(index) : undefined}
                  />
                  {line.partId === OTHER ? (
                    <>
                      {/* UX-7-028 / PC3: an "Other" line stays on this invoice; parts are added to the catalog in Parts. */}
                      <p className="text-xs text-muted-foreground" data-testid="other-hint">
                        {messages.pcOtherHint}{' '}
                        {onCatalogChanged ? (
                          // D45 / ST-2 (HU-R2): the part goes into the catalog and this line uses it.
                          <button type="button" className="tap-inline font-medium text-primary underline" onClick={() => setCataloging(index)} disabled={busy} data-testid="add-to-catalog">{messages.pcAddToCatalog}</button>
                        ) : (
                          <a className="tap-inline underline" href="/admin/parts/catalog" target="_blank" rel="noopener">{messages.pcOtherCatalogLink}</a>
                        )}
                      </p>
                    </>
                  ) : null}
                  {line.costFrom === 'last' && paid ? (
                    <p className="text-xs text-muted-foreground" data-testid="cost-source">{fillPlaceholders(messages.pcCostFromLast, { vendor: paid.vendorName, date: formatInvoiceDate(paid.invoiceDate, locale) })}</p>
                  ) : line.costFrom === 'reference' ? (
                    <p className="text-xs text-muted-foreground" data-testid="cost-source">{messages.pcCostFromRef}</p>
                  ) : paid ? <p className="text-xs text-muted-foreground">{fillPlaceholders(messages.pcLastPaidHint, { amount: formatCents(paid.unitCostCents, locale), date: formatInvoiceDate(paid.invoiceDate, locale) })}</p> : null}
                  {showErrors && row.needsPart ? <p className="text-xs text-destructive-text">{messages.pcLineNeedsPart}</p> : null}
                  {state.split ? (
                    <Select aria-label={`${messages.pcLineTruck} ${index + 1}`} value={line.truckId} onChange={(event) => setLine(index, { truckId: event.target.value, jobId: '' })} disabled={busy}>
                      <option value="">{messages.pcNoTruckOption}</option>
                      {formData.trucks.map((truck) => <option key={truck.id} value={truck.id}>{fillPlaceholders(messages.pcTruckLabel, { truck: truck.truckNumber })}</option>)}
                    </Select>
                  ) : null}
                  {!row.truckId ? (
                    <div className="space-y-1">
                      <Label htmlFor={`line-goes-${index}`} className="text-xs">{messages.pcLineGoesTo}</Label>
                      <Select id={`line-goes-${index}`} value={row.destination} onChange={(event) => setLine(index, { destination: event.target.value as 'stock' | 'shop_supplies' })} disabled={busy} data-testid="line-goes-to" aria-invalid={stockNeedsPart(index) || undefined}>
                        <option value="stock">{messages.pcLineToStock}</option>
                        <option value="shop_supplies">{messages.pcLineShopSupplies}</option>
                      </Select>
                      {stockNeedsPart(index) ? <p className="text-xs text-destructive-text">{messages.pcLineStockNeedsPart}</p> : null}
                    </div>
                  ) : null}
                  {row.truckId ? (
                    <LineJobSelect
                      index={index}
                      truckId={row.truckId}
                      value={line.jobId ?? ''}
                      current={purchase?.lines[index]?.job ?? null}
                      disabled={busy}
                      messages={messages}
                      onChange={(jobId) => setLine(index, { jobId })}
                    />
                  ) : null}
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`line-qty-${index}`} className="text-xs">{messages.pcLineQty}</Label>
                  <Input id={`line-qty-${index}`} inputMode="decimal" className="tabular-nums" value={line.quantity} onChange={(event) => setLine(index, { quantity: event.target.value })} disabled={busy} aria-invalid={row.hundredths === undefined || undefined} />
                  {row.hundredths === undefined ? <p className="text-xs text-destructive-text">{messages.pcQtyInvalid}</p> : null}
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`line-cost-${index}`} className="text-xs">{messages.pcLineUnitCost}</Label>
                  <Input id={`line-cost-${index}`} inputMode="decimal" className="tabular-nums" placeholder="0.00" value={line.unitCost} onChange={(event) => setLine(index, { unitCost: event.target.value, costFrom: null })} disabled={busy} aria-invalid={typeof row.unit !== 'number' && (showErrors || row.unit === undefined) || undefined} />
                  {row.unit === undefined ? <p className="text-xs text-destructive-text">{messages.pcCostInvalid}</p> : <RequiredNote show={showErrors && row.unit === null} messages={messages} />}
                </div>
                <div className="space-y-1">
                  <span className="block text-xs font-medium">{messages.pcLineTotal}</span>
                  <span className="flex min-h-11 items-center tabular-nums" data-testid="line-total">{row.total !== null ? formatCents(row.total, locale) : '—'}</span>
                </div>
                <div className="flex items-end">
                  <Button type="button" variant="ghost" size="sm" aria-label={fillPlaceholders(messages.pcRemoveLine, { number: String(index + 1) })} disabled={busy || state.lines.length === 1} onClick={() => set('lines', state.lines.filter((_, at) => at !== index))}>
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              </div>
            );
          })}
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => set('lines', [...state.lines, { ...emptyLine(), truckId: state.split ? '' : state.truckId }])}>
            <Plus aria-hidden="true" />{messages.pcAddLine}
          </Button>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-[1fr_1fr_1.4fr]">
          {(['tax', 'freight'] as const).map((key) => (
            <div key={key} className="space-y-1.5">
              <Label htmlFor={`purchase-${key}`}>{key === 'tax' ? messages.pcTax : messages.pcFreight}<OptionalTag messages={messages} /></Label>
              <Input id={`purchase-${key}`} inputMode="decimal" className="tabular-nums" placeholder="0.00" value={state[key]} onChange={(event) => set(key, event.target.value)} disabled={busy} aria-invalid={parseMoneyToCents(state[key]) === undefined || undefined} />
              {parseMoneyToCents(state[key]) === undefined ? <p className="text-xs text-destructive-text">{messages.pcCostInvalid}</p> : null}
            </div>
          ))}
          <div className="rounded-lg bg-muted/60 px-3 py-2 text-sm" aria-live="polite">
            {/* UX-7-027 / PC2: every amount that makes the total, and where it goes. */}
            <p className="flex justify-between gap-2"><span>{messages.pcSubtotal}</span><span className="tabular-nums">{formatCents(subtotal, locale)}</span></p>
            <p className="flex justify-between gap-2 text-muted-foreground"><span>{messages.pcTax}</span><span className="tabular-nums">{formatCents(tax ?? 0, locale)}</span></p>
            <p className="flex justify-between gap-2 text-muted-foreground"><span>{messages.pcFreight}</span><span className="tabular-nums">{formatCents(freight ?? 0, locale)}</span></p>
            <p className="mt-1 flex justify-between gap-2 border-t pt-1 text-base font-semibold"><span>{messages.pcTotal}</span><span className="tabular-nums" data-testid="purchase-total">{formatCents(total, locale)}</span></p>
            <div className="mt-1 space-y-0.5 text-xs text-muted-foreground" data-testid="purchase-destination">
              {!trucksInvoiced.length ? <p>{messages.pcAllNoTruck}</p> : null}
              {trucksInvoiced.length === 1 && toTrucks === total ? <p>{fillPlaceholders(messages.pcAllToTruck, { truck: truckNumber(trucksInvoiced[0].truckId!) })}</p> : null}
              {trucksInvoiced.length > 1 || (trucksInvoiced.length && toTrucks !== total) ? (
                <>
                  {trucksInvoiced.map((row) => <p key={row.truckId}>{fillPlaceholders(messages.pcTruckLabel, { truck: truckNumber(row.truckId!) })}: {formatCents(row.amountCents, locale)}</p>)}
                  {toTrucks !== total ? <p>{messages.pcNoTruckOption}: {formatCents(total - toTrucks, locale)}</p> : null}
                  {extra ? <p>{messages.pcSharedNote}</p> : null}
                </>
              ) : null}
            </div>
          </div>
        </div>

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
          <Label htmlFor="purchase-notes">{messages.pcNotes}<OptionalTag messages={messages} /></Label>
          <Textarea id="purchase-notes" rows={2} value={state.notes} onChange={(event) => set('notes', event.target.value)} disabled={busy} />
        </div>

        <StickyFormFooter
          error={error}
          confirmDiscard={confirmDiscard}
          onDiscard={discard}
          onKeepEditing={() => setConfirmDiscard(false)}
          onCancel={close}
          submitLabel={messages.pcSavePurchase}
          submitDisabled={busy || uploading || Boolean(duplicate?.exists)}
          busy={busy}
          messages={messages}
        />
      </form>
      {/* Outside the purchase's <form>: React bubbles a portal's submit to its parent form. */}
      {cataloging !== null ? (
        <PartDialog
          part={null}
          categories={categories}
          truckMakes={[...new Set(formData.trucks.map((truck) => truck.make).filter((make): make is string => Boolean(make)))]}
          vendors={vendors}
          locale={locale}
          messages={messages}
          preset={{ displayName: state.lines[cataloging]?.description ?? '' }}
          onClose={() => setCataloging(null)}
          onSaved={(partId) => {
            const index = cataloging;
            setCataloging(null);
            void Promise.resolve(onCatalogChanged?.()).then(() => {
              setLine(index, { partId, description: '' });
              showToast('success', messages.pcAddedToCatalog);
            });
          }}
        />
      ) : null}
    </Modal>
  );
}

/**
 * D45 / ST-1: the Job of the line's truck this part was bought for (optional). Open Work Orders come first; a Job
 * the purchase already had stays listed even if it is no longer offered.
 */
function LineJobSelect({
  index,
  truckId,
  value,
  current,
  disabled,
  messages,
  onChange,
}: {
  index: number;
  truckId: string;
  value: string;
  current: AdminPurchaseJobRefDto | null;
  disabled: boolean;
  messages: AdminMessages;
  onChange: (jobId: string) => void;
}) {
  const { data } = useAdminTruckJobs(truckId);
  const jobs = data ?? [];
  const extra = value && current?.id === value && !jobs.some((job) => job.id === value) ? [current] : [];
  const open = jobs.filter((job) => job.open);
  const closed = jobs.filter((job) => !job.open);
  const label = (job: AdminPurchaseJobRefDto) => fillPlaceholders(messages.pcLineJobOption, { job: job.displayName, wo: job.workOrderDisplayId });
  return (
    <div className="space-y-1">
      <Label htmlFor={`line-job-${index}`} className="text-xs">{messages.pcLineJob}<OptionalTag messages={messages} /></Label>
      <Select id={`line-job-${index}`} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} data-testid="line-job">
        <option value="">{messages.pcLineNoJob}</option>
        {extra.map((job) => <option key={job.id} value={job.id}>{label(job)}</option>)}
        {open.length ? <optgroup label={messages.pcLineJobsOpen}>{open.map((job) => <option key={job.id} value={job.id}>{label(job)}</option>)}</optgroup> : null}
        {closed.length ? <optgroup label={messages.pcLineJobsClosed}>{closed.map((job) => <option key={job.id} value={job.id}>{label(job)}</option>)}</optgroup> : null}
      </Select>
    </div>
  );
}
