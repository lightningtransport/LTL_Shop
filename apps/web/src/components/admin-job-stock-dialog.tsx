'use client';

import { useState } from 'react';
import { Undo2 } from 'lucide-react';
import { formatCents, parseQuantityToHundredths, type AdminWorkOrderJobDto } from '@ltl-shop/shared';
import { useActionToast } from './action-toast';
import { kindLabel, partsCostsFailure, tireLabel } from './admin-parts-catalog';
import { Button, DialogActions, InlineAlert, Input, Label, Modal, Select } from './ui';
import { issueAdminStock, returnAdminStock, useAdminStock } from '@/lib/admin-data';
import { fillPlaceholders } from '@/lib/admin-next-step';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';

/**
 * D45 / ST-3 (LTR-223): "Parts from stock" on a Job. The Manager picks a part on the shelf and how many; it leaves
 * at the average cost (P27) and goes to this truck on this Work Order. What already left for the Job is listed with
 * "Return to stock" (it comes back at the same cost and the truck's cost is reversed).
 */
export function JobStockDialog({ job, locale, messages, onClose, onChanged }: {
  job: AdminWorkOrderJobDto;
  locale: AdminLocale;
  messages: AdminMessages;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { showToast } = useActionToast();
  const { data: stock, mutate: mutateStock } = useAdminStock('');
  const [partId, setPartId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [returning, setReturning] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const available = (stock?.items ?? []).filter((item) => Number(item.onHand) > 0);
  const picked = available.find((item) => item.partId === partId);
  const hundredths = parseQuantityToHundredths(quantity);
  const tooMany = Boolean(picked && hundredths !== undefined && hundredths > Math.round(Number(picked.onHand) * 100));
  const canSave = !busy && Boolean(picked) && hundredths !== undefined && !tooMany;
  const onJob = job.stockParts ?? [];

  async function take(event: React.FormEvent) {
    event.preventDefault();
    if (!canSave) return;
    setBusy(true);
    setError(null);
    try {
      await issueAdminStock({ partId, quantity: quantity.trim(), workOrderJobId: job.id });
      showToast('success', messages.pcStockIssued);
      setPartId('');
      setQuantity('1');
      void mutateStock();
      onChanged();
    } catch (failure) {
      setError(partsCostsFailure(failure, messages));
    } finally {
      setBusy(false);
    }
  }

  async function giveBack(movementId: string) {
    if (!reason.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await returnAdminStock(movementId, reason.trim());
      showToast('success', messages.pcStockReturnedToast);
      setReturning(null);
      setReason('');
      void mutateStock();
      onChanged();
    } catch (failure) {
      setError(partsCostsFailure(failure, messages));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open title={fillPlaceholders(messages.pcStockIssueTitle, { job: job.displayName })} onClose={onClose} closeLabel={messages.closeDialog} dismissible={!busy}>
      <div className="space-y-5" data-testid="job-stock-dialog">
        {onJob.length ? (
          <section className="space-y-2">
            <h3 className="text-sm font-medium">{messages.pcStockOnJob}</h3>
            <ul className="divide-y rounded-lg border text-sm">
              {onJob.map((part) => (
                <li key={part.movementId} className="space-y-2 px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className={part.returned ? 'text-muted-foreground line-through' : ''}>
                      {part.description} × {Number(part.quantity)}
                      {part.valueCents !== undefined ? <span className="ml-2 tabular-nums text-muted-foreground">{formatCents(part.valueCents, locale)}</span> : null}
                    </span>
                    {part.returned ? (
                      <span className="text-xs text-muted-foreground">{messages.pcStockReturned}</span>
                    ) : (
                      <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => { setReturning(part.movementId); setReason(''); }} data-testid="job-stock-return">
                        <Undo2 aria-hidden="true" />{messages.pcStockReturn}
                      </Button>
                    )}
                  </div>
                  {returning === part.movementId ? (
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="min-w-48 flex-1 space-y-1">
                        <Label htmlFor={`stock-return-${part.movementId}`} className="text-xs">{messages.pcStockReturnReason}</Label>
                        <Input id={`stock-return-${part.movementId}`} value={reason} onChange={(event) => setReason(event.target.value)} disabled={busy} autoComplete="off" />
                      </div>
                      <Button type="button" size="sm" disabled={busy || !reason.trim()} onClick={() => void giveBack(part.movementId)}>{messages.pcStockReturn}</Button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <form className="space-y-4" onSubmit={(event) => void take(event)}>
          <p className="text-sm text-muted-foreground">{messages.pcStockIssueHelp}</p>
          {stock && !available.length ? <InlineAlert>{messages.pcStockNoParts}</InlineAlert> : null}
          <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
            <div className="space-y-1.5">
              <Label htmlFor="job-stock-part">{messages.pcStockIssuePart}</Label>
              <Select id="job-stock-part" value={partId} onChange={(event) => setPartId(event.target.value)} disabled={busy || !available.length}>
                <option value="">{messages.pcStockIssuePick}</option>
                {available.map((item) => (
                  <option key={item.partId} value={item.partId}>
                    {[item.displayName, item.partNumber, tireLabel(item, messages) || null, item.kind === 'pm' ? null : kindLabel(item.kind, messages)].filter(Boolean).join(' · ')}
                  </option>
                ))}
              </Select>
              {picked ? (
                <p className="text-xs text-muted-foreground" data-testid="job-stock-available">
                  {fillPlaceholders(messages.pcStockIssueAvailable, { qty: String(Number(picked.onHand)), cost: picked.avgCostCents === null ? '—' : formatCents(picked.avgCostCents, locale) })}
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="job-stock-qty">{messages.pcStockIssueQty}</Label>
              <Input id="job-stock-qty" inputMode="decimal" className="tabular-nums" value={quantity} onChange={(event) => setQuantity(event.target.value)} disabled={busy} autoComplete="off" aria-invalid={hundredths === undefined || tooMany || undefined} />
              {tooMany && picked ? <p className="text-xs text-destructive-text">{fillPlaceholders(messages.pcStockNotEnough, { qty: String(Number(picked.onHand)) })}</p> : null}
            </div>
          </div>
          {error ? <InlineAlert>{error}</InlineAlert> : null}
          <DialogActions>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>{messages.closeDialog}</Button>
            <Button type="submit" disabled={!canSave}>{messages.pcStockIssueSave}</Button>
          </DialogActions>
        </form>
      </div>
    </Modal>
  );
}
