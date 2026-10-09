'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Paperclip, Plus, Trash2, X } from 'lucide-react';
import {
  INVOICE_FILE_MAX_BYTES,
  INVOICE_FILE_TYPES,
  centsToInput,
  formatCents,
  lineTotalCents,
  parseMoneyToCents,
  parseQuantityToHundredths,
  truckAmounts,
  type AdminInvoiceMatchDto,
  type AdminPartCategoryDto,
  type AdminPurchaseDetailDto,
  type AdminPurchaseFormDataDto,
  type AdminSavePurchaseInput,
  type AdminVendorDto,
} from '@ltl-shop/shared';
import { useActionToast } from './action-toast';
import { AdminNavLink } from './admin-nav-link';
import { partsCostsFailure } from './admin-parts-catalog';
import { Button, DialogActions, InlineAlert, Input, Label, Modal, Select, Textarea } from './ui';
import {
  checkAdminInvoice,
  createAdminPurchase,
  createAdminVendor,
  requestAdminAttachment,
  updateAdminPurchase,
  uploadInvoiceFile,
} from '@/lib/admin-data';
import { fillPlaceholders } from '@/lib/admin-next-step';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';
import { ApiError } from '@/lib/api';
import { apiErrorCode } from '@/lib/api-error-message';
import { formatInvoiceDate } from '@/lib/parts-costs-format';

const DRAFT_KEY = 'ltl.admin.purchase-draft';
const OTHER = '__other__';
const ADD_VENDOR = '__add_vendor__';

type LineState = { partId: string; description: string; quantity: string; unitCost: string; truckId: string };
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

const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};
const emptyLine = (): LineState => ({ partId: '', description: '', quantity: '1', unitCost: '', truckId: '' });

function initialState(purchase: AdminPurchaseDetailDto | null, presetTruckId?: string): FormState {
  if (!purchase) {
    return { vendorId: '', invoiceNumber: '', invoiceDate: today(), truckId: presetTruckId ?? '', split: false, lines: [emptyLine()], tax: '', freight: '', notes: '' };
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
  categories,
  vendors,
  formData,
  locale,
  messages,
  onClose,
  onSaved,
  onVendorAdded,
}: {
  purchase: AdminPurchaseDetailDto | null;
  presetTruckId?: string;
  categories: AdminPartCategoryDto[];
  vendors: AdminVendorDto[];
  formData: AdminPurchaseFormDataDto;
  locale: AdminLocale;
  messages: AdminMessages;
  onClose: () => void;
  onSaved: (id: string) => void;
  onVendorAdded: () => void;
}) {
  const { showToast } = useActionToast();
  const restored = useRef(false);
  const [state, setState] = useState<FormState>(() => {
    const draft = !purchase && !presetTruckId ? readDraft() : null;
    restored.current = Boolean(draft);
    return draft ?? initialState(purchase, presetTruckId);
  });
  const [idempotencyKey] = useState(() => globalThis.crypto.randomUUID());
  const [file, setFile] = useState<FileState | null>(
    purchase?.attachment ? { id: purchase.attachment.id, name: purchase.attachment.fileName, percent: 100, error: null } : null,
  );
  const [duplicate, setDuplicate] = useState<AdminInvoiceMatchDto | null>(null);
  const [newVendor, setNewVendor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const pristine = useRef(JSON.stringify(initialState(purchase, presetTruckId)));

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
  function startingCost(partId: string, vendorId: string) {
    const paid = formData.lastPaid.find((row) => row.partId === partId && row.vendorId === vendorId);
    if (paid) return centsToInput(paid.unitCostCents);
    const part = partById.get(partId);
    return part?.unitCostCents !== null && part?.unitCostCents !== undefined ? centsToInput(part.unitCostCents) : '';
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
    };
  });
  const tax = parseMoneyToCents(state.tax);
  const freight = parseMoneyToCents(state.freight);
  const subtotal = computed.reduce((sum, line) => sum + (line.total ?? 0), 0);
  const extra = (tax ?? 0) + (freight ?? 0);
  const total = subtotal + extra;
  const shares = truckAmounts(computed.map((line) => ({ truckId: line.truckId, lineTotalCents: line.total ?? 0 })), extra);
  const toTrucks = shares.filter((row) => row.truckId).reduce((sum, row) => sum + row.amountCents, 0);
  const linesValid = computed.every((line) => !line.needsPart && line.hundredths !== undefined && typeof line.unit === 'number');
  const moneyValid = tax !== undefined && freight !== undefined;
  const uploading = Boolean(file && !file.id && !file.error);
  const valid = Boolean(state.vendorId && state.invoiceNumber.trim() && state.invoiceDate && linesValid && moneyValid);
  const dirty = JSON.stringify(state) !== pristine.current || (file?.id ?? null) !== (purchase?.attachment?.id ?? null);

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
    if (!newVendor?.trim()) return;
    try {
      const created = await createAdminVendor({ name: newVendor.trim(), doesParts: true });
      onVendorAdded();
      set('vendorId', created.id);
      setNewVendor(null);
      showToast('success', messages.pcVendorAdded);
    } catch (failure) {
      setError(partsCostsFailure(failure, messages));
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
    if (!valid || busy || uploading) return;
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
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
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
            {newVendor !== null ? (
              <div className="flex gap-2">
                <Input aria-label={messages.pcNewVendorName} placeholder={messages.pcNewVendorName} value={newVendor} onChange={(event) => setNewVendor(event.target.value)} autoComplete="off" />
                <Button type="button" variant="outline" disabled={!newVendor.trim()} onClick={() => void addVendor()}>{messages.pcAddVendor}</Button>
              </div>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="purchase-date">{messages.pcInvoiceDate}</Label>
            <Input id="purchase-date" type="date" value={state.invoiceDate} onChange={(event) => set('invoiceDate', event.target.value)} disabled={busy} required />
          </div>
          <div className="space-y-1.5">
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
          </div>
        </div>
        {duplicate?.exists ? (
          <p className="rounded-lg border border-warning/40 bg-warning-surface px-3 py-2 text-sm text-warning-foreground" role="alert" data-testid="duplicate-invoice">
            {fillPlaceholders(messages.pcDuplicateInvoice, {
              vendor: duplicate.vendorName ?? '',
              number: duplicate.invoiceNumber ?? '',
              date: duplicate.invoiceDate ? formatInvoiceDate(duplicate.invoiceDate, locale) : '',
              total: duplicate.totalCents !== undefined ? formatCents(duplicate.totalCents, locale) : '',
            })}{' '}
            <AdminNavLink className="tap-inline font-medium underline" href={`/admin/parts/purchases/${duplicate.id}`}>{messages.pcOpenIt}</AdminNavLink>
          </p>
        ) : null}

        <div className="flex flex-wrap items-end gap-4">
          {!state.split ? (
            <div className="min-w-56 space-y-1.5">
              <Label htmlFor="purchase-truck">{messages.pcTruckOptional}</Label>
              <Select id="purchase-truck" value={state.truckId} onChange={(event) => set('truckId', event.target.value)} disabled={busy}>
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
                lines: current.lines.map((line) => ({ ...line, truckId: event.target.checked ? current.truckId : line.truckId })),
              }))}
            />
            {messages.pcSplitTrucks}
          </label>
        </div>

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">{messages.pcLines}</legend>
          {state.lines.map((line, index) => {
            const row = computed[index];
            const paid = line.partId && line.partId !== OTHER ? formData.lastPaid.find((item) => item.partId === line.partId && item.vendorId === state.vendorId) : null;
            return (
              <div key={index} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[minmax(0,2fr)_5rem_7rem_6rem_auto]" data-testid="purchase-line">
                <div className="space-y-1">
                  <Label htmlFor={`line-part-${index}`} className="text-xs">{messages.pcLinePart}</Label>
                  <Select
                    id={`line-part-${index}`}
                    value={line.partId}
                    disabled={busy}
                    aria-invalid={(showErrors && row.needsPart) || undefined}
                    onChange={(event) => {
                      const partId = event.target.value;
                      setLine(index, { partId, unitCost: partId && partId !== OTHER ? startingCost(partId, state.vendorId) || line.unitCost : line.unitCost });
                    }}
                  >
                    <option value="">{messages.pcLinePart}…</option>
                    {categories.map((category) => (
                      <optgroup key={category.id} label={category.name}>
                        {category.parts.filter((part) => part.active || part.id === line.partId).map((part) => (
                          <option key={part.id} value={part.id}>{part.displayName}{part.partNumber ? ` · ${part.partNumber}` : ''}</option>
                        ))}
                      </optgroup>
                    ))}
                    <option value={OTHER}>{messages.pcLineOther}</option>
                  </Select>
                  {line.partId === OTHER ? (
                    <Input aria-label={messages.pcLineDescription} placeholder={messages.pcLineDescription} value={line.description} onChange={(event) => setLine(index, { description: event.target.value })} disabled={busy} autoComplete="off" />
                  ) : null}
                  {paid ? <p className="text-xs text-muted-foreground">{fillPlaceholders(messages.pcLastPaidHint, { amount: formatCents(paid.unitCostCents, locale), date: formatInvoiceDate(paid.invoiceDate, locale) })}</p> : null}
                  {showErrors && row.needsPart ? <p className="text-xs text-destructive-text">{messages.pcLineNeedsPart}</p> : null}
                  {state.split ? (
                    <Select aria-label={`${messages.pcLineTruck} ${index + 1}`} value={line.truckId} onChange={(event) => setLine(index, { truckId: event.target.value })} disabled={busy}>
                      <option value="">{messages.pcNoTruckOption}</option>
                      {formData.trucks.map((truck) => <option key={truck.id} value={truck.id}>{fillPlaceholders(messages.pcTruckLabel, { truck: truck.truckNumber })}</option>)}
                    </Select>
                  ) : null}
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`line-qty-${index}`} className="text-xs">{messages.pcLineQty}</Label>
                  <Input id={`line-qty-${index}`} inputMode="decimal" className="tabular-nums" value={line.quantity} onChange={(event) => setLine(index, { quantity: event.target.value })} disabled={busy} aria-invalid={row.hundredths === undefined || undefined} />
                  {row.hundredths === undefined ? <p className="text-xs text-destructive-text">{messages.pcQtyInvalid}</p> : null}
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`line-cost-${index}`} className="text-xs">{messages.pcLineUnitCost}</Label>
                  <Input id={`line-cost-${index}`} inputMode="decimal" className="tabular-nums" placeholder="0.00" value={line.unitCost} onChange={(event) => setLine(index, { unitCost: event.target.value })} disabled={busy} aria-invalid={typeof row.unit !== 'number' && (showErrors || row.unit === undefined) || undefined} />
                  {row.unit === undefined ? <p className="text-xs text-destructive-text">{messages.pcCostInvalid}</p> : null}
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
              <Label htmlFor={`purchase-${key}`}>{key === 'tax' ? messages.pcTax : messages.pcFreight}</Label>
              <Input id={`purchase-${key}`} inputMode="decimal" className="tabular-nums" placeholder="0.00" value={state[key]} onChange={(event) => set(key, event.target.value)} disabled={busy} aria-invalid={parseMoneyToCents(state[key]) === undefined || undefined} />
              {parseMoneyToCents(state[key]) === undefined ? <p className="text-xs text-destructive-text">{messages.pcCostInvalid}</p> : null}
            </div>
          ))}
          <div className="rounded-lg bg-muted/60 px-3 py-2 text-sm" aria-live="polite">
            <p className="flex justify-between gap-2"><span>{messages.pcSubtotal}</span><span className="tabular-nums">{formatCents(subtotal, locale)}</span></p>
            <p className="flex justify-between gap-2 text-base font-semibold"><span>{messages.pcTotal}</span><span className="tabular-nums" data-testid="purchase-total">{formatCents(total, locale)}</span></p>
            {toTrucks && toTrucks !== total ? (
              <p className="text-xs text-muted-foreground">{fillPlaceholders(messages.pcAssignedSplit, { trucks: formatCents(toTrucks, locale), none: formatCents(total - toTrucks, locale) })}</p>
            ) : null}
            {extra && shares.filter((row) => row.truckId).length > 1 ? <p className="text-xs text-muted-foreground">{messages.pcSharedNote}</p> : null}
          </div>
        </div>
        {state.split ? (
          <p className="text-xs text-muted-foreground">
            {shares.filter((row) => row.truckId).map((row) => `${fillPlaceholders(messages.pcTruckLabel, { truck: truckNumber(row.truckId!) })}: ${formatCents(row.amountCents, locale)}`).join(' · ')}
          </p>
        ) : null}

        <div className="space-y-1.5">
          <span className="block text-sm font-medium">{messages.pcInvoiceFile}</span>
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
            <label className="flex cursor-pointer flex-col items-start gap-1 rounded-lg border border-dashed px-3 py-3 text-sm hover:bg-accent">
              <span className="font-medium text-primary">{messages.pcFileChoose}</span>
              <span className="text-xs text-muted-foreground">{messages.pcFileHint}</span>
              <input type="file" className="sr-only" accept={INVOICE_FILE_TYPES.join(',')} onChange={(event) => void pickFile(event.target.files?.[0])} disabled={busy} />
            </label>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="purchase-notes">{messages.pcNotes}</Label>
          <Textarea id="purchase-notes" rows={2} value={state.notes} onChange={(event) => set('notes', event.target.value)} disabled={busy} />
        </div>

        {error ? <InlineAlert>{error}</InlineAlert> : null}
        {confirmDiscard ? (
          <div className="rounded-lg border px-3 py-3 text-sm" role="alertdialog" aria-label={messages.pcDiscardTitle}>
            <p className="font-medium">{messages.pcDiscardTitle}</p>
            <p className="text-muted-foreground">{messages.pcDiscardBody}</p>
            <div className="mt-2 flex gap-2">
              <Button type="button" variant="destructive" size="sm" onClick={discard}>{messages.pcDiscard}</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setConfirmDiscard(false)}>{messages.pcKeepEditing}</Button>
            </div>
          </div>
        ) : null}
        <DialogActions>
          <Button type="button" variant="outline" onClick={close} disabled={busy}>{messages.cancel}</Button>
          <Button type="submit" disabled={busy || uploading || Boolean(duplicate?.exists)}>{busy ? messages.pcSaving : messages.pcSavePurchase}</Button>
        </DialogActions>
      </form>
    </Modal>
  );
}
