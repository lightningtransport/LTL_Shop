'use client';

import { useState } from 'react';
import { PackageMinus, PackagePlus } from 'lucide-react';
import {
  centsToInput,
  formatCents,
  parseMoneyToCents,
  parseQuantityToHundredths,
  STOCK_REMOVE_REASONS,
  type AdminStockItemDto,
  type AdminStockMovementDto,
} from '@ltl-shop/shared';
import { useActionToast } from './action-toast';
import { AdminNavLink } from './admin-nav-link';
import { partsCostsFailure } from './admin-parts-catalog';
import { Badge, Button, DialogActions, InlineAlert, Input, Label, Modal } from './ui';
import { addAdminStock, removeAdminStock, updateAdminPart, useAdminStockPart } from '@/lib/admin-data';
import { fillPlaceholders } from '@/lib/admin-next-step';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';
import { formatShortDateTime } from '@/lib/work-order-view';

/** "4.00" → "4". */
export const stockQty = (value: string | number) => String(Number(value));

/** D47 / HU-M20: what the truck pays — the average when there is stock, else the reference cost ("ref"). */
export function stockCost(item: Pick<AdminStockItemDto, 'avgCostCents'>, referenceCents: number | null | undefined) {
  if (item.avgCostCents !== null) return { cents: item.avgCostCents, reference: false };
  if (referenceCents !== null && referenceCents !== undefined) return { cents: referenceCents, reference: true };
  return null;
}

function movementText(movement: AdminStockMovementDto, messages: AdminMessages) {
  const job = movement.job ? { job: movement.job.displayName, wo: movement.job.workOrderDisplayId } : { job: '—', wo: '—' };
  switch (movement.kind) {
    case 'purchase_in':
      return fillPlaceholders(messages.pcStockMovePurchase, { invoice: movement.purchase?.invoiceNumber ?? '—', vendor: movement.purchase?.vendorName ?? '—' });
    case 'issue':
      return fillPlaceholders(messages.pcStockMoveIssue, { ...job, truck: movement.truck?.truckNumber ?? '—' });
    case 'return':
      return fillPlaceholders(messages.pcStockMoveReturn, job);
    case 'reversal':
      return fillPlaceholders(messages.pcStockMoveReversal, { invoice: movement.purchase?.invoiceNumber ?? '—' });
    default:
      // D47 / HU-M20: the adjustment says why it moved the shelf.
      switch (movement.reasonCode) {
        case 'received': return messages.pcMoveReasonReceived;
        case 'damaged': return messages.pcMoveReasonDamaged;
        case 'lost': return messages.pcMoveReasonLost;
        case 'other': return messages.pcMoveReasonOther;
        default: return messages.pcMoveReasonCount;
      }
  }
}

/**
 * D47 / HU-M20 (LTR-246): the part's panel, opened from its row in Parts. What is on the shelf, what the truck pays
 * and the reference cost, the minimum (editable here), the movements with their reason, and the stock actions.
 */
export function PartStockPanel({ partId, referenceCents, canWrite, locale, messages, onClose, onAdd, onRemove, onEdit, onChanged }: {
  partId: string;
  referenceCents: number | null;
  canWrite: boolean;
  locale: AdminLocale;
  messages: AdminMessages;
  onClose: () => void;
  onAdd: (item: AdminStockItemDto) => void;
  onRemove: (item: AdminStockItemDto) => void;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const { showToast } = useActionToast();
  const { data, error, mutate } = useAdminStockPart(partId);
  const [minimum, setMinimum] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const item = data?.item;
  const minValue = minimum ?? (item?.minStock === null || item?.minStock === undefined ? '' : String(item.minStock));
  const minValid = minValue.trim() === '' || /^\d+$/.test(minValue.trim());
  const minChanged = item ? minValue.trim() !== (item.minStock === null ? '' : String(item.minStock)) : false;

  async function saveMinimum() {
    if (!item || !minValid || !minChanged) return;
    setBusy(true);
    try {
      await updateAdminPart(item.partId, { minStock: minValue.trim() === '' ? null : Number(minValue.trim()) });
      showToast('success', messages.pcMinSaved);
      setMinimum(null);
      await mutate();
      onChanged();
    } catch (failure) {
      showToast('error', partsCostsFailure(failure, messages));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open title={item?.displayName ?? messages.pcStockMovements} onClose={onClose} closeLabel={messages.closeDialog}>
      {error ? <InlineAlert>{messages.loadError}</InlineAlert> : null}
      {item && data ? (
        <div className="space-y-4" data-testid="part-panel">
          <p className="text-sm text-muted-foreground">{[item.partNumber, item.categoryName].filter(Boolean).join(' · ')}</p>
          <dl className="grid grid-cols-3 gap-2 text-sm">
            <div className="rounded-lg bg-muted p-2">
              <dt className="text-xs text-muted-foreground">{messages.pcInStockCol}</dt>
              <dd className="text-lg font-semibold tabular-nums" data-testid="part-panel-on-hand">{stockQty(item.onHand)}</dd>
              {item.low ? <dd><Badge variant="secondary" className="border-warning/50 bg-warning/15 text-warning-foreground">{messages.pcStockLow}</Badge></dd> : null}
            </div>
            <div className="rounded-lg bg-muted p-2">
              <dt className="text-xs text-muted-foreground">{messages.pcPartPanelAvg}</dt>
              <dd className="text-lg font-semibold tabular-nums">{item.avgCostCents === null ? '—' : formatCents(item.avgCostCents, locale)}</dd>
              <dd className="text-xs text-muted-foreground">{messages.pcPartPanelAvgHint}</dd>
            </div>
            <div className="rounded-lg bg-muted p-2">
              <dt className="text-xs text-muted-foreground">{messages.pcPartPanelRef}</dt>
              <dd className="text-lg font-semibold tabular-nums">{referenceCents === null ? '—' : formatCents(referenceCents, locale)}</dd>
              <dd className="text-xs text-muted-foreground">{messages.pcPartPanelRefHint}</dd>
            </div>
          </dl>
          {canWrite ? (
            <>
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="part-panel-min">{messages.pcMinStock}</Label>
                  <Input id="part-panel-min" inputMode="numeric" className="tabular-nums" value={minValue} onChange={(event) => setMinimum(event.target.value)} disabled={busy} aria-invalid={!minValid || undefined} />
                </div>
                <Button type="button" variant="outline" disabled={busy || !minValid || !minChanged} onClick={() => void saveMinimum()}>{messages.pcMinSave}</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => onAdd(item)}><PackagePlus aria-hidden="true" />{messages.pcAddToStock}</Button>
                <Button type="button" variant="outline" onClick={() => onRemove(item)} disabled={Number(item.onHand) <= 0}><PackageMinus aria-hidden="true" />{messages.pcRemoveFromStock}</Button>
                <Button type="button" variant="ghost" onClick={onEdit}>{messages.pcEditPart}</Button>
              </div>
            </>
          ) : null}
          <div>
            <h3 className="text-sm font-semibold">{messages.pcStockMovements}</h3>
            <ul className="mt-1 divide-y text-sm" data-testid="stock-movements">
              {data.movements.map((movement) => (
                <li key={movement.id} className="flex items-start justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p>
                      {movement.purchase ? (
                        <AdminNavLink className="tap-inline text-primary hover:underline" href={`/admin/parts/purchases/${movement.purchase.id}`}>{movementText(movement, messages)}</AdminNavLink>
                      ) : movement.job ? (
                        <AdminNavLink className="tap-inline text-primary hover:underline" href={`/admin/work-orders/${movement.job.workOrderId}`}>{movementText(movement, messages)}</AdminNavLink>
                      ) : movementText(movement, messages)}
                      {movement.kind === 'issue' && movement.undone ? <Badge variant="secondary" className="ml-2">{messages.pcStockReturned}</Badge> : null}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatShortDateTime(movement.createdAt, locale)} · {movement.createdBy}{movement.reason ? ` · ${movement.reason}` : ''}</p>
                  </div>
                  <div className="shrink-0 text-right tabular-nums">
                    <p className={Number(movement.quantity) < 0 ? 'text-destructive-text' : ''}>{Number(movement.quantity) > 0 ? '+' : ''}{stockQty(movement.quantity)}</p>
                    <p className="text-xs text-muted-foreground">{formatCents(movement.valueCents, locale)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

/** D47 / HU-M20: parts that came in without an invoice, at the cost of each one. */
export function AddToStockDialog({ item, referenceCents, locale, messages, onClose, onSaved }: {
  item: AdminStockItemDto;
  referenceCents: number | null;
  locale: AdminLocale;
  messages: AdminMessages;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { showToast } = useActionToast();
  const suggested = item.avgCostCents ?? referenceCents;
  const [quantity, setQuantity] = useState('');
  const [cost, setCost] = useState(suggested === null ? '' : centsToInput(suggested));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hundredths = parseQuantityToHundredths(quantity);
  const costCents = parseMoneyToCents(cost);
  const canSave = !busy && hundredths !== undefined && costCents !== undefined && costCents !== null && cost.trim() !== '';
  const value = canSave ? Math.round((costCents! * hundredths!) / 100) : null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSave) return;
    setBusy(true);
    setError(null);
    try {
      await addAdminStock({ partId: item.partId, quantity: quantity.trim(), unitCostCents: costCents!, note: note.trim() || undefined });
      showToast('success', messages.pcAddedToStock);
      onSaved();
    } catch (failure) {
      setError(partsCostsFailure(failure, messages));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open title={`${messages.pcAddToStock} · ${item.displayName}`} onClose={onClose} closeLabel={messages.closeDialog} dismissible={!quantity.trim()}>
      <form className="space-y-4" onSubmit={(event) => void submit(event)} data-testid="stock-add-dialog">
        <p className="text-sm text-muted-foreground">{messages.pcAddToStockHelp}</p>
        <p className="text-sm">{messages.pcInStockCol}: <span className="font-medium tabular-nums">{stockQty(item.onHand)}</span>{item.avgCostCents !== null ? ` · ${formatCents(item.avgCostCents, locale)}` : ''}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="stock-add-qty">{messages.pcAddToStockQty}</Label>
            <Input id="stock-add-qty" inputMode="decimal" className="tabular-nums" value={quantity} onChange={(event) => setQuantity(event.target.value)} disabled={busy} autoComplete="off" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="stock-add-cost">{messages.pcAddToStockCost}</Label>
            <Input id="stock-add-cost" inputMode="decimal" className="tabular-nums" placeholder="0.00" value={cost} onChange={(event) => setCost(event.target.value)} disabled={busy} autoComplete="off" aria-describedby="stock-add-cost-help" required />
            <p id="stock-add-cost-help" className="text-xs text-muted-foreground">{messages.pcAddToStockCostHint}</p>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="stock-add-note">{messages.pcStockNote}</Label>
          <Input id="stock-add-note" value={note} onChange={(event) => setNote(event.target.value)} disabled={busy} autoComplete="off" />
        </div>
        {error ? <InlineAlert>{error}</InlineAlert> : null}
        <DialogActions>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>{messages.cancel}</Button>
          <Button type="submit" disabled={!canSave}>
            {value === null ? messages.pcAddToStock : fillPlaceholders(messages.pcAddToStockSubmit, { qty: stockQty(hundredths! / 100), value: formatCents(value, locale) })}
          </Button>
        </DialogActions>
      </form>
    </Modal>
  );
}

/** D47 / HU-M20: how many leave and why. The field only means "how many leave"; the preview shows the result. */
export function RemoveFromStockDialog({ item, locale, messages, onClose, onSaved }: {
  item: AdminStockItemDto;
  locale: AdminLocale;
  messages: AdminMessages;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { showToast } = useActionToast();
  const [reason, setReason] = useState<(typeof STOCK_REMOVE_REASONS)[number]>('damaged');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onHand = Math.round(Number(item.onHand) * 100);
  const hundredths = parseQuantityToHundredths(quantity);
  const tooMany = hundredths !== undefined && hundredths > onHand;
  const needsNote = reason === 'other' && !note.trim();
  const canSave = !busy && hundredths !== undefined && !tooMany && !needsNote;
  const unit = item.avgCostCents ?? 0;
  const labels = { damaged: messages.pcRemoveDamaged, lost: messages.pcRemoveLost, other: messages.pcRemoveOther };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSave) return;
    setBusy(true);
    setError(null);
    try {
      await removeAdminStock({ partId: item.partId, quantity: quantity.trim(), reason, note: note.trim() || undefined });
      showToast('success', messages.pcRemoved);
      onSaved();
    } catch (failure) {
      setError(partsCostsFailure(failure, messages));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open title={fillPlaceholders(messages.pcRemoveTitle, { part: item.displayName })} onClose={onClose} closeLabel={messages.closeDialog} dismissible={!quantity.trim()}>
      <form className="space-y-4" onSubmit={(event) => void submit(event)} data-testid="stock-remove-dialog">
        <p className="text-sm text-muted-foreground">{messages.pcInStockCol}: <span className="tabular-nums">{stockQty(item.onHand)}</span>{item.avgCostCents !== null ? ` · ${formatCents(item.avgCostCents, locale)}` : ''}</p>
        <fieldset>
          <legend className="text-sm font-medium">{messages.pcRemoveWhy}</legend>
          <div className="mt-1 grid grid-cols-3 gap-2 text-sm">
            {STOCK_REMOVE_REASONS.map((value) => (
              <label key={value} className="flex min-h-11 items-center gap-2 rounded-lg border p-2">
                <input type="radio" name="stock-remove-reason" checked={reason === value} onChange={() => setReason(value)} disabled={busy} />
                {labels[value]}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="space-y-1.5">
          <Label htmlFor="stock-remove-qty">{messages.pcRemoveQty}</Label>
          <Input id="stock-remove-qty" inputMode="decimal" className="tabular-nums" value={quantity} onChange={(event) => setQuantity(event.target.value)} disabled={busy} autoComplete="off" aria-invalid={tooMany || undefined} required />
          {tooMany ? <p className="text-xs text-destructive-text">{fillPlaceholders(messages.pcStockNotEnough, { qty: stockQty(item.onHand) })}</p> : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="stock-remove-note">{reason === 'other' ? messages.pcRemoveNoteOther : messages.pcStockNote}</Label>
          <Input id="stock-remove-note" value={note} onChange={(event) => setNote(event.target.value)} disabled={busy} autoComplete="off" required={reason === 'other'} />
        </div>
        {hundredths !== undefined && !tooMany ? (
          <p className="rounded-lg bg-muted p-2 text-sm tabular-nums" data-testid="stock-remove-preview">
            {fillPlaceholders(messages.pcRemovePreview, {
              before: stockQty(item.onHand),
              after: stockQty((onHand - hundredths) / 100),
              qty: stockQty(hundredths / 100),
              cost: formatCents(unit, locale),
              value: formatCents(Math.round((unit * hundredths) / 100), locale),
            })}
          </p>
        ) : null}
        {error ? <InlineAlert>{error}</InlineAlert> : null}
        <DialogActions>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>{messages.cancel}</Button>
          <Button type="submit" disabled={!canSave}>{hundredths === undefined ? messages.pcRemoveFromStock : fillPlaceholders(messages.pcRemoveSubmit, { qty: stockQty(hundredths / 100) })}</Button>
        </DialogActions>
      </form>
    </Modal>
  );
}
