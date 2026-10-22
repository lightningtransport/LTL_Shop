'use client';

import { useState } from 'react';
import { CircleDot, ShoppingCart, Undo2 } from 'lucide-react';
import { formatCents, parseQuantityToHundredths, type AdminWorkOrderJobDto } from '@ltl-shop/shared';
import { useActionToast } from './action-toast';
import { AdminNavLink } from './admin-nav-link';
import { kindLabel, partsCostsFailure, tireLabel } from './admin-parts-catalog';
import { stockQty } from './admin-stock-actions';
import { MissingSummary, RequiredNote, focusField, type MissingField } from './parts-costs-form-ui';
import { Badge, Button, DialogActions, InlineAlert, Input, Label, Modal, Select } from './ui';
import { issueAdminStock, returnAdminStock, useAdminPmPreview, useAdminStock, type AdminPmPreviewDto } from '@/lib/admin-data';
import { fillPlaceholders } from '@/lib/admin-next-step';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';

/**
 * D47 / LTR-247: the Job's one "Parts…" sheet (it replaces "Add parts invoice", "Parts from stock" and "Tires to put").
 * - Tires from the inspection: only on the Job that has them (ST-4); "Confirm tires…" opens the tire dialog.
 * - On this Job: what was bought for it and what left the stock, with "Return…" (how many and why).
 * - From stock: a part on the shelf, how many, "Take from stock" (D45 / ST-3, at the average cost, P27).
 * - Buy for this Job: New purchase with the truck and the Job set; saving comes back to the Work Order.
 * - On the PM Job: what completing it will charge, per part the mechanic picked (LTR-242), and the PM parts are not
 *   offered from stock, because the PM takes them by itself.
 */
export function JobStockDialog({ job, isPm, buyHref, locale, messages, onClose, onChanged, onTires }: {
  job: AdminWorkOrderJobDto;
  isPm: boolean;
  buyHref: string;
  locale: AdminLocale;
  messages: AdminMessages;
  onClose: () => void;
  onChanged: () => void;
  onTires?: () => void;
}) {
  const { showToast } = useActionToast();
  const { data: stock, mutate: mutateStock } = useAdminStock('');
  const { data: preview, mutate: mutatePreview } = useAdminPmPreview(isPm ? job.id : null);
  const [partId, setPartId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [returning, setReturning] = useState<string | null>(null);
  const [returnQty, setReturnQty] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pmPicked = new Set((preview?.parts ?? []).map((row) => row.partId));
  const available = (stock?.items ?? []).filter((item) => Number(item.onHand) > 0 && !pmPicked.has(item.partId));
  const picked = available.find((item) => item.partId === partId);
  const hundredths = parseQuantityToHundredths(quantity);
  const tooMany = Boolean(picked && hundredths !== undefined && hundredths > Math.round(Number(picked.onHand) * 100));
  const [showErrors, setShowErrors] = useState(false);
  const [showReturnErrors, setShowReturnErrors] = useState(false);
  const canSave = !busy && Boolean(picked) && hundredths !== undefined && !tooMany;
  // LTR-293 §3: what stops "Take from stock", in form order (same rules as canSave).
  const missing: MissingField[] = [
    ...(!picked ? [{ label: messages.pcStockIssuePart, fieldId: 'job-stock-part' }] : []),
    ...(hundredths === undefined || tooMany ? [{ label: messages.pcStockIssueQty, fieldId: 'job-stock-qty' }] : []),
  ];
  const partMissing = showErrors && !picked;
  const qtyBad = showErrors && hundredths === undefined;
  const qtyError = tooMany || qtyBad;
  const bought = job.parts ?? [];
  const fromStock = (job.stockParts ?? []).filter((part) => !part.returned);
  const total = bought.reduce((sum, part) => sum + (part.lineTotalCents ?? 0), 0) + fromStock.reduce((sum, part) => sum + (part.valueCents ?? 0), 0);
  const tires = job.tires ?? [];
  const refresh = () => { void mutateStock(); void mutatePreview(); onChanged(); };

  async function take(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!canSave) {
      setShowErrors(true);
      if (missing[0]) focusField(missing[0].fieldId);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await issueAdminStock({ partId, quantity: quantity.trim(), workOrderJobId: job.id });
      showToast('success', messages.pcStockIssued);
      setShowErrors(false);
      setPartId('');
      setQuantity('1');
      refresh();
    } catch (failure) {
      setError(partsCostsFailure(failure, messages));
    } finally {
      setBusy(false);
    }
  }

  async function giveBack(movementId: string, issued: string) {
    const back = returnQty.trim() || stockQty(issued);
    if (busy) return;
    // LTR-293 §3: same rule as before (quantity that parses + a reason); now it says which one is missing.
    if (parseQuantityToHundredths(returnQty) === undefined || !reason.trim()) {
      setShowReturnErrors(true);
      focusField(parseQuantityToHundredths(returnQty) === undefined ? `stock-return-qty-${movementId}` : `stock-return-${movementId}`);
      return;
    }
    if (parseQuantityToHundredths(back) === undefined) return;
    setBusy(true);
    setError(null);
    try {
      await returnAdminStock(movementId, reason.trim(), back === stockQty(issued) ? undefined : back);
      showToast('success', messages.pcStockReturnedToast);
      setShowReturnErrors(false);
      setReturning(null);
      setReason('');
      setReturnQty('');
      refresh();
    } catch (failure) {
      setError(partsCostsFailure(failure, messages));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open title={fillPlaceholders(messages.pcJobPartsTitle, { job: job.displayName })} onClose={onClose} closeLabel={messages.closeDialog} dismissible={!busy}>
      <div className="space-y-5" data-testid="job-stock-dialog">
        {tires.length && onTires ? (
          <section className="space-y-2" data-testid="job-parts-tires">
            <h3 className="text-sm font-medium">{messages.pcJobTiresSection}</h3>
            <ul className="divide-y rounded-lg border text-sm">
              {tires.map((tire) => (
                <li key={tire.id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <span>{tire.position} · {tire.part ? tire.part.displayName : tire.tireType === 'new' ? messages.pcTireNew : messages.pcTireRecap}</span>
                  <Badge variant="secondary">{tire.status}</Badge>
                </li>
              ))}
            </ul>
            <Button type="button" variant="outline" size="sm" onClick={onTires}><CircleDot aria-hidden="true" />{messages.pcJobTiresOpen}</Button>
          </section>
        ) : null}

        {isPm ? <PmPreview preview={preview} locale={locale} messages={messages} /> : null}

        {bought.length || fromStock.length || (job.stockParts ?? []).length ? (
          <section className="space-y-2">
            <h3 className="text-sm font-medium">{messages.pcStockOnJob}</h3>
            <ul className="divide-y rounded-lg border text-sm">
              {bought.map((part, index) => (
                <li key={`${part.purchaseId}-${index}`} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span>
                    {part.description} × {stockQty(part.quantity)}
                    <span className="ml-2 text-muted-foreground">· {fillPlaceholders(messages.pcJobBoughtFrom, { vendor: part.vendorName })}{part.lineTotalCents !== undefined ? ` · ${formatCents(part.lineTotalCents, locale)}` : ''}</span>
                  </span>
                  <AdminNavLink className="tap-inline text-xs text-primary hover:underline" href={`/admin/parts/purchases/${part.purchaseId}`}>{messages.pcJobOpenPurchase}</AdminNavLink>
                </li>
              ))}
              {(job.stockParts ?? []).map((part) => (
                <li key={part.movementId} className="space-y-2 px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className={part.returned ? 'text-muted-foreground line-through' : ''}>
                      {part.description} × {stockQty(part.quantity)}
                      <span className="ml-2 text-muted-foreground">· {messages.pcJobFromStock}{part.valueCents !== undefined ? ` · ${formatCents(part.valueCents, locale)}` : ''}</span>
                    </span>
                    {part.returned ? (
                      <span className="text-xs text-muted-foreground">{messages.pcStockReturned}</span>
                    ) : (
                      <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => { setReturning(part.movementId); setShowReturnErrors(false); setReason(''); setReturnQty(stockQty(part.quantity)); }} data-testid="job-stock-return">
                        <Undo2 aria-hidden="true" />{messages.pcStockReturn}
                      </Button>
                    )}
                  </div>
                  {returning === part.movementId ? (
                    <div className="grid gap-2 sm:grid-cols-[6rem_1fr_auto] sm:items-end">
                      <div className="space-y-1">
                        <Label htmlFor={`stock-return-qty-${part.movementId}`} className="text-xs">{messages.pcJobReturnHowMany}</Label>
                        <Input id={`stock-return-qty-${part.movementId}`} inputMode="decimal" className="tabular-nums" value={returnQty} onChange={(event) => setReturnQty(event.target.value)} disabled={busy} autoComplete="off" aria-invalid={(showReturnErrors && parseQuantityToHundredths(returnQty) === undefined) || undefined} aria-describedby={showReturnErrors && parseQuantityToHundredths(returnQty) === undefined ? `stock-return-qty-${part.movementId}-error` : undefined} />
                        <RequiredNote show={showReturnErrors && parseQuantityToHundredths(returnQty) === undefined} id={`stock-return-qty-${part.movementId}-error`} messages={messages} text={returnQty.trim() ? messages.pcQtyInvalid : undefined} />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`stock-return-${part.movementId}`} className="text-xs">{messages.pcStockReturnReason}</Label>
                        <Input id={`stock-return-${part.movementId}`} value={reason} onChange={(event) => setReason(event.target.value)} disabled={busy} autoComplete="off" aria-invalid={(showReturnErrors && !reason.trim()) || undefined} aria-describedby={showReturnErrors && !reason.trim() ? `stock-return-${part.movementId}-error` : undefined} />
                        <RequiredNote show={showReturnErrors && !reason.trim()} id={`stock-return-${part.movementId}-error`} messages={messages} />
                      </div>
                      {/* LTR-293 §3: stays on (only off while saving); a missing reason or quantity says "Required" under it. */}
                      <Button type="button" size="sm" disabled={busy} onClick={() => void giveBack(part.movementId, part.quantity)}>
                        {fillPlaceholders(messages.pcJobReturnSubmit, { qty: stockQty(returnQty || part.quantity) })}
                      </Button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <form className="space-y-3" onSubmit={(event) => void take(event)} noValidate>
          <h3 className="text-sm font-medium">{isPm ? messages.pcJobOtherFromStock : messages.pcJobFromStockSection}</h3>
          <p className="text-sm text-muted-foreground">{messages.pcStockIssueHelp}</p>
          {showErrors && missing.length > 1 ? <MissingSummary missing={missing} messages={messages} /> : null}
          <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
            <div className="space-y-1.5">
              <Label htmlFor="job-stock-part">{messages.pcStockIssuePart}</Label>
              <Select id="job-stock-part" value={partId} onChange={(event) => setPartId(event.target.value)} disabled={busy || !available.length} aria-invalid={partMissing || undefined} aria-describedby={partMissing ? 'job-stock-part-error' : undefined}>
                <option value="">{messages.pcStockIssuePick}</option>
                {available.map((item) => (
                  <option key={item.partId} value={item.partId}>
                    {[item.displayName, item.partNumber, tireLabel(item, messages) || null, item.kind === 'pm' ? null : kindLabel(item.kind, messages)].filter(Boolean).join(' · ')}
                  </option>
                ))}
              </Select>
              <RequiredNote show={partMissing} id="job-stock-part-error" messages={messages} />
              {picked ? (
                <p className="text-xs text-muted-foreground" data-testid="job-stock-available">
                  {fillPlaceholders(messages.pcStockIssueAvailable, { qty: String(Number(picked.onHand)), cost: picked.avgCostCents === null ? '—' : formatCents(picked.avgCostCents, locale) })}
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="job-stock-qty">{messages.pcStockIssueQty}</Label>
              <Input id="job-stock-qty" inputMode="decimal" className="tabular-nums" value={quantity} onChange={(event) => setQuantity(event.target.value)} disabled={busy} autoComplete="off" aria-invalid={hundredths === undefined || tooMany || undefined} aria-describedby={qtyError ? 'job-stock-qty-error' : undefined} />
              {tooMany && picked ? <p id="job-stock-qty-error" className="text-xs text-destructive-text">{fillPlaceholders(messages.pcStockNotEnough, { qty: String(Number(picked.onHand)) })}</p> : null}
              <RequiredNote show={qtyBad} id="job-stock-qty-error" messages={messages} text={quantity.trim() ? messages.pcQtyInvalid : undefined} />
            </div>
          </div>
          {stock && !available.length ? <InlineAlert>{messages.pcStockNoParts}</InlineAlert> : null}
          <div className="flex justify-end">
            {/* LTR-293 §3: stays on while there is stock to take (off only while saving, or when the shelf is empty —
                that already says so above); a Save with no part or a bad quantity says what, under the field. */}
            <Button type="submit" disabled={busy || Boolean(stock && !available.length)}>{messages.pcStockIssueSave}</Button>
          </div>
        </form>

        <section className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
          <Button asChild variant="outline" size="sm"><AdminNavLink href={buyHref} data-testid="job-parts-buy"><ShoppingCart aria-hidden="true" />{messages.pcJobBuy}</AdminNavLink></Button>
          <p className="mt-1 text-xs text-muted-foreground">{messages.pcJobBuyHelp}</p>
        </section>

        {error ? <InlineAlert>{error}</InlineAlert> : null}
        <DialogActions>
          <p className="mr-auto self-center text-sm tabular-nums" data-testid="job-parts-total">{fillPlaceholders(messages.pcJobTotal, { value: formatCents(total, locale) })}</p>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>{messages.closeDialog}</Button>
        </DialogActions>
      </div>
    </Modal>
  );
}

/** D47 / LTR-247: what completing the PM will charge, per part the mechanic picked (same rule as LTR-242). */
function PmPreview({ preview, locale, messages }: { preview: AdminPmPreviewDto | undefined; locale: AdminLocale; messages: AdminMessages }) {
  if (!preview) return null;
  const status = (row: AdminPmPreviewDto['parts'][number]) => {
    switch (row.status) {
      case 'from_stock': return fillPlaceholders(messages.pcPmFromStock, { cost: formatCents(row.unitCostCents ?? 0, locale) });
      case 'bought_for_job': return messages.pcPmBought;
      case 'taken_for_job': return messages.pcPmTaken;
      default: return messages.pcPmNotInStock;
    }
  };
  const total = preview.parts.reduce((sum, row) => sum + (row.status === 'from_stock' ? row.unitCostCents ?? 0 : 0), 0) + (preview.oilCents ?? 0);
  const names = new Map(preview.parts.map((row) => [row.partId, row.displayName]));
  return (
    <section className="space-y-2" data-testid="job-parts-pm-preview">
      <h3 className="text-sm font-medium">{messages.pcPmPreviewTitle}</h3>
      <ul className="divide-y rounded-lg border text-sm">
        {preview.parts.map((row) => (
          <li key={row.partId} className="flex items-center justify-between gap-3 px-3 py-2" data-status={row.status}>
            <span>{row.displayName}</span>
            <span className={row.status === 'from_stock' ? 'tabular-nums' : row.status === 'not_in_stock' ? 'text-warning-foreground' : 'text-muted-foreground'}>{status(row)}</span>
          </li>
        ))}
        {preview.oilCents !== null ? (
          <li className="flex items-center justify-between gap-3 px-3 py-2">
            <span>{messages.pcPmOil}</span>
            <span className="tabular-nums">{formatCents(preview.oilCents, locale)}</span>
          </li>
        ) : null}
      </ul>
      {preview.truckPurchasesWithoutJob.map((row) => (
        <p key={`${row.purchaseId}-${row.partId}`} className="rounded-lg border border-warning/40 bg-warning/10 p-2 text-sm" data-testid="job-parts-pm-loose">
          {fillPlaceholders(messages.pcPmLoose, { invoice: row.invoiceNumber, part: names.get(row.partId) ?? '—' })}{' '}
          <AdminNavLink className="tap-inline text-primary hover:underline" href={`/admin/parts/purchases/${row.purchaseId}`}>{messages.pcJobOpenPurchase}</AdminNavLink>
        </p>
      ))}
      <p className="text-sm tabular-nums">{fillPlaceholders(messages.pcPmOnComplete, { value: formatCents(total, locale) })}</p>
    </section>
  );
}
