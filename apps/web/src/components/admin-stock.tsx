'use client';

import { useState } from 'react';
import { Boxes, History } from 'lucide-react';
import {
  centsToInput,
  formatCents,
  parseMoneyToCents,
  parseQuantityToHundredths,
  type AdminStockItemDto,
  type AdminStockMovementDto,
} from '@ltl-shop/shared';
import { useActionToast } from './action-toast';
import { AdminNavLink } from './admin-nav-link';
import { kindLabel, partsCostsFailure, tireLabel } from './admin-parts-catalog';
import { useDocumentTitle } from './admin-breadcrumb';
import {
  Badge, Button, Card, CardContent, DataTable, DialogActions, EmptyState, InlineAlert, Input, Label, LoadFailure, Modal,
  PageHeader, PageSkeleton, Select,
} from './ui';
import { useCanShowManagerWrites } from '@/lib/admin-actor';
import { countAdminStock, useAdminPartsCatalog, useAdminStock, useAdminStockPart } from '@/lib/admin-data';
import { fillPlaceholders } from '@/lib/admin-next-step';
import { adminCountLabel, type AdminLocale, type AdminMessages } from '@/lib/admin-messages';
import { formatShortDateTime } from '@/lib/work-order-view';
import { useDebouncedFilterText, useUrlFilters } from '@/lib/use-url-filters';

const STOCK_FILTERS = { q: '', kind: '', low: false };

const qty = (value: string) => String(Number(value));

/**
 * D45 / ST-3 (LTR-223): Parts & costs → Stock. What the Shop has on the shelf, with its average cost (P27) and
 * "Low" under the part's minimum. **Count** sets what is on the shelf (P25: the first day, the Manager types it);
 * each part opens its movements. Parts leave to a Job from the Work Order ("Parts from stock").
 */
export function AdminStock({ locale, messages }: { locale: AdminLocale; messages: AdminMessages }) {
  const canWrite = useCanShowManagerWrites();
  useDocumentTitle(messages.pcStock);
  const { filters, set, query } = useUrlFilters(STOCK_FILTERS);
  const [search, setSearch] = useDebouncedFilterText(filters.q, (next) => set('q', next));
  const { data, error, isLoading, mutate } = useAdminStock(query);
  const [counting, setCounting] = useState<AdminStockItemDto | 'new' | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <PageHeader
        title={messages.pcStock}
        subtitle={messages.pcStockSubtitle}
        actions={canWrite ? <Button type="button" onClick={() => setCounting('new')} data-testid="stock-count-new"><Boxes aria-hidden="true" />{messages.pcStockCount}</Button> : null}
      />
      <Card className="p-3">
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1">
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={messages.pcStockSearch} aria-label={messages.pcStockSearch} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="stock-kind-filter">{messages.pcKindFilter}</Label>
            <Select id="stock-kind-filter" value={filters.kind} onChange={(event) => set('kind', event.target.value)}>
              <option value="">{messages.pcKindAll}</option>
              <option value="pm">{messages.pcKindPm}</option>
              <option value="repair">{messages.pcKindRepair}</option>
              <option value="tire">{messages.pcKindTire}</option>
            </Select>
          </div>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" checked={filters.low} onChange={(event) => set('low', event.target.checked)} />
            {messages.pcStockLowOnly}
          </label>
        </CardContent>
      </Card>

      {error ? <LoadFailure message={messages.loadError} retryLabel={messages.retry} onRetry={() => void mutate()} /> : null}
      {isLoading && !data ? <PageSkeleton label={messages.pcStock} header={false} /> : null}
      {data ? (
        <p className="text-sm text-muted-foreground" data-testid="stock-totals">
          {fillPlaceholders(messages.pcStockTotal, { parts: adminCountLabel(data.items.length, messages.pcStockPartsOne, messages.pcStockParts), value: formatCents(data.totals.valueCents, locale), low: String(data.totals.lowCount) })}
        </p>
      ) : null}
      {data && !data.items.length ? <EmptyState><p>{messages.pcStockEmpty}</p></EmptyState> : null}
      {data?.items.length ? (
        <DataTable
          items={data.items}
          caption={messages.pcStock}
          getKey={(item) => item.partId}
          getRowLabel={(item) => item.displayName}
          columns={[
            {
              key: 'part',
              header: messages.pcStockCountPart,
              primary: true,
              cell: (item) => (
                <div>
                  <button type="button" className="tap-inline text-left font-medium text-primary hover:underline" onClick={() => setViewing(item.partId)} data-testid="stock-part">
                    {item.displayName}
                  </button>
                  {item.partNumber ? <span className="ml-2 font-mono text-xs text-muted-foreground">{item.partNumber}</span> : null}
                  <span className="block text-xs text-muted-foreground">
                    {[item.categoryName, item.kind === 'pm' ? null : kindLabel(item.kind, messages), tireLabel(item, messages) || null].filter(Boolean).join(' · ')}
                  </span>
                </div>
              ),
            },
            {
              key: 'onHand',
              header: messages.pcStockOnHand,
              cell: (item) => (
                <span className="tabular-nums" data-testid="stock-on-hand">
                  {qty(item.onHand)}
                  {item.low ? <Badge variant="secondary" className="ml-2 border-warning/50 bg-warning/15 text-warning-foreground">{messages.pcStockLow}</Badge> : null}
                </span>
              ),
            },
            { key: 'min', header: messages.pcStockMin, cell: (item) => <span className="tabular-nums text-muted-foreground">{item.minStock ?? '—'}</span> },
            { key: 'avg', header: messages.pcStockAvgCost, cell: (item) => <span className="tabular-nums">{item.avgCostCents === null ? '—' : formatCents(item.avgCostCents, locale)}</span> },
            { key: 'value', header: messages.pcStockValue, cell: (item) => <span className="tabular-nums">{formatCents(item.valueCents, locale)}</span> },
            ...(canWrite ? [{
              key: 'actions',
              header: '',
              cell: (item: AdminStockItemDto) => (
                <div className="flex justify-end gap-1">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setViewing(item.partId)} aria-label={`${messages.pcStockMovements} · ${item.displayName}`}><History aria-hidden="true" /></Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setCounting(item)}>{messages.pcStockCount}</Button>
                </div>
              ),
            }] : []),
          ]}
        />
      ) : null}

      {counting ? (
        <CountDialog
          item={counting === 'new' ? null : counting}
          locale={locale}
          messages={messages}
          onClose={() => setCounting(null)}
          onSaved={() => { setCounting(null); void mutate(); }}
        />
      ) : null}
      {viewing ? <MovementsDialog partId={viewing} locale={locale} messages={messages} onClose={() => setViewing(null)} /> : null}
    </div>
  );
}

/** P25: what is on the shelf now. More comes in at the cost typed; fewer leave at the average cost. */
function CountDialog({ item, locale, messages, onClose, onSaved }: {
  item: AdminStockItemDto | null;
  locale: AdminLocale;
  messages: AdminMessages;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { showToast } = useActionToast();
  const { data: catalog } = useAdminPartsCatalog('');
  const [partId, setPartId] = useState(item?.partId ?? '');
  const [counted, setCounted] = useState(item ? qty(item.onHand) : '');
  const [cost, setCost] = useState(item?.avgCostCents !== null && item?.avgCostCents !== undefined ? centsToInput(item.avgCostCents) : '');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const countValid = counted.trim() === '0' || parseQuantityToHundredths(counted) !== undefined;
  const costCents = parseMoneyToCents(cost);
  const canSave = !busy && partId && countValid && costCents !== undefined && reason.trim();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSave) return;
    setBusy(true);
    setError(null);
    try {
      await countAdminStock({ partId, counted: counted.trim(), unitCostCents: costCents ?? null, reason: reason.trim() });
      showToast('success', messages.pcStockCountSaved);
      onSaved();
    } catch (failure) {
      setError(partsCostsFailure(failure, messages));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open title={item ? fillPlaceholders(messages.pcStockCountTitle, { part: item.displayName }) : messages.pcStockCount} onClose={onClose} closeLabel={messages.closeDialog} dismissible={!reason.trim()}>
      <form className="space-y-4" onSubmit={(event) => void submit(event)} data-testid="stock-count-dialog">
        <p className="text-sm text-muted-foreground">{messages.pcStockCountHelp}</p>
        {!item ? (
          <div className="space-y-1.5">
            <Label htmlFor="stock-count-part">{messages.pcStockCountPart}</Label>
            <Select id="stock-count-part" value={partId} onChange={(event) => setPartId(event.target.value)} disabled={busy}>
              <option value="">{messages.pcStockIssuePick}</option>
              {(catalog?.categories ?? []).map((category) => (
                <optgroup key={category.id} label={category.kind === 'pm' ? category.name : `${category.name} · ${kindLabel(category.kind, messages)}`}>
                  {category.parts.map((part) => (
                    <option key={part.id} value={part.id}>{[part.displayName, part.partNumber, tireLabel(part, messages) || null].filter(Boolean).join(' · ')}</option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </div>
        ) : (
          <p className="text-sm">{messages.pcStockOnHand}: <span className="tabular-nums font-medium">{qty(item.onHand)}</span>{item.avgCostCents !== null ? ` · ${formatCents(item.avgCostCents, locale)}` : ''}</p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="stock-counted">{messages.pcStockCounted}</Label>
            <Input id="stock-counted" inputMode="decimal" className="tabular-nums" value={counted} onChange={(event) => setCounted(event.target.value)} disabled={busy} autoComplete="off" aria-invalid={(counted.trim() !== '' && !countValid) || undefined} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="stock-unit-cost">{messages.pcStockUnitCost}</Label>
            <Input id="stock-unit-cost" inputMode="decimal" className="tabular-nums" placeholder="0.00" value={cost} onChange={(event) => setCost(event.target.value)} disabled={busy} autoComplete="off" aria-invalid={costCents === undefined || undefined} aria-describedby="stock-unit-cost-help" />
            <p id="stock-unit-cost-help" className="text-xs text-muted-foreground">{messages.pcStockUnitCostHelp}</p>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="stock-reason">{messages.pcStockReason}</Label>
          <Input id="stock-reason" value={reason} onChange={(event) => setReason(event.target.value)} disabled={busy} autoComplete="off" required />
        </div>
        {error ? <InlineAlert>{error}</InlineAlert> : null}
        <DialogActions>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>{messages.cancel}</Button>
          <Button type="submit" disabled={!canSave}>{messages.pcStockCount}</Button>
        </DialogActions>
      </form>
    </Modal>
  );
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
      return messages.pcStockMoveAdjust;
  }
}

function MovementsDialog({ partId, locale, messages, onClose }: { partId: string; locale: AdminLocale; messages: AdminMessages; onClose: () => void }) {
  const { data, error } = useAdminStockPart(partId);
  return (
    <Modal open title={data ? `${data.item.displayName} · ${messages.pcStockMovements}` : messages.pcStockMovements} onClose={onClose} closeLabel={messages.closeDialog}>
      {error ? <InlineAlert>{messages.loadError}</InlineAlert> : null}
      {data ? (
        <div className="space-y-3" data-testid="stock-movements">
          <p className="text-sm">
            {messages.pcStockOnHand}: <span className="font-medium tabular-nums">{qty(data.item.onHand)}</span>
            {data.item.avgCostCents !== null ? ` · ${messages.pcStockAvgCost} ${formatCents(data.item.avgCostCents, locale)}` : ''}
          </p>
          <ul className="divide-y text-sm">
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
                  <p className={Number(movement.quantity) < 0 ? 'text-destructive-text' : ''}>{Number(movement.quantity) > 0 ? '+' : ''}{qty(movement.quantity)}</p>
                  <p className="text-xs text-muted-foreground">{formatCents(movement.valueCents, locale)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Modal>
  );
}
