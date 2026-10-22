'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { formatCents, parseMoneyToCents, type AdminLaborRateDto } from '@ltl-shop/shared';
import { useActionToast } from './action-toast';
import { partsCostsFailure } from './admin-parts-catalog';
import { useDocumentTitle } from './admin-breadcrumb';
import { Button, Card, CardContent, DataTable, DialogActions, InlineAlert, Input, Label, LoadFailure, Modal, PageHeader, PageSkeleton, SectionCard } from './ui';
import { useCanShowManagerWrites } from '@/lib/admin-actor';
import { removeAdminLaborRate, setAdminLaborRate, setAdminPmOilPrice, useAdminLaborRatePreview, useAdminLaborRates, useAdminPmOilPrices } from '@/lib/admin-data';
import { fillPlaceholders } from '@/lib/admin-next-step';
import { adminCountLabel, type AdminLocale, type AdminMessages } from '@/lib/admin-messages';
import { formatInvoiceDate } from '@/lib/parts-costs-format';

const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

/**
 * LTR-201 / D34 (LB-1): Parts & costs → Labor rate. One rate for the whole shop, from a date. Saving re-computes the
 * labor of completed Work Orders with work from that date (reversals in the ledger); earlier work keeps its rate.
 * PCA7 (UX-10-005): the screen says what a date would recalculate before Save, and the latest rate can be taken back
 * while no sent invoice uses it.
 */
export function AdminLaborRate({ locale, messages }: { locale: AdminLocale; messages: AdminMessages }) {
  const canWrite = useCanShowManagerWrites();
  useDocumentTitle(messages.pcLaborRate);
  const { showToast } = useActionToast();
  const { data, error, isLoading, mutate } = useAdminLaborRates();
  const [rate, setRate] = useState('');
  const [from, setFrom] = useState(today);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [removing, setRemoving] = useState<AdminLaborRateDto | null>(null);
  const cents = parseMoneyToCents(rate);
  const { data: preview } = useAdminLaborRatePreview(canWrite && /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : null);
  const previewText = preview
    ? preview.workOrders === 0
      ? fillPlaceholders(messages.pcLaborRatePreviewNone, { date: formatInvoiceDate(from, locale) })
      // LTR-277 §7: "1 completed Work Order", never "1 completed Work Orders".
      : `${fillPlaceholders(messages.pcLaborRatePreview, { workOrders: adminCountLabel(preview.workOrders, messages.pcLaborRatePreviewWorkOrdersOne, messages.pcLaborRatePreviewWorkOrders), date: formatInvoiceDate(from, locale) })}${preview.invoiced ? ` ${adminCountLabel(preview.invoiced, messages.pcLaborRatePreviewInvoicedOne, messages.pcLaborRatePreviewInvoiced)}` : ''}`
    : null;

  async function remove(target: AdminLaborRateDto) {
    setBusy(true);
    setSaveError(null);
    try {
      const removed = await removeAdminLaborRate(target.id);
      showToast('success', fillPlaceholders(messages.pcLaborRateRemoved, { count: String(removed.recalculatedWorkOrders) }));
      setRemoving(null);
      void mutate();
    } catch (failure) {
      setSaveError(partsCostsFailure(failure, messages));
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setShowErrors(true);
    if (typeof cents !== 'number' || !from || busy) return;
    setBusy(true);
    setSaveError(null);
    try {
      const saved = await setAdminLaborRate({ rateCentsPerHour: cents, effectiveFrom: from });
      showToast('success', fillPlaceholders(messages.pcLaborRateSaved, { count: String(saved.recalculatedWorkOrders) }));
      setRate('');
      setShowErrors(false);
      void mutate();
    } catch (failure) {
      setSaveError(partsCostsFailure(failure, messages));
    } finally {
      setBusy(false);
    }
  }

  if (isLoading && !data) return <PageSkeleton label={messages.pcLaborRate} />;
  if (error || !data) return <LoadFailure message={messages.loadError} retryLabel={messages.retry} onRetry={() => void mutate()} />;

  return (
    <div className="space-y-6">
      <PageHeader title={messages.pcLaborRate} subtitle={messages.pcLaborRateSubtitle} />
      <Card className="p-4" data-testid="labor-rate-current">
        <CardContent>
          {data.current ? (
            <p className="text-lg font-semibold">
              {fillPlaceholders(messages.pcLaborRateCurrent, { rate: formatCents(data.current.rateCentsPerHour, locale), date: formatInvoiceDate(data.current.effectiveFrom, locale) })}
            </p>
          ) : <p className="text-sm text-muted-foreground">{messages.pcLaborRateNone}</p>}
        </CardContent>
      </Card>

      {canWrite ? (
        <SectionCard title={messages.pcLaborRateNew}>
          <form className="flex flex-wrap items-start gap-4 px-4 py-3" onSubmit={(event) => void submit(event)} noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="labor-rate">{messages.pcLaborRatePerHour}</Label>
              <div className="relative w-40">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">$</span>
                <Input id="labor-rate" className="pl-7 tabular-nums" inputMode="decimal" placeholder="0.00" value={rate} onChange={(event) => setRate(event.target.value)} disabled={busy} aria-invalid={cents === undefined || (showErrors && cents === null) || undefined} />
              </div>
              {cents === undefined ? <p className="text-xs text-destructive-text">{messages.pcCostInvalid}</p> : showErrors && cents === null ? <p className="text-xs text-destructive-text">{messages.pcLaborRateRequired}</p> : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="labor-rate-from">{messages.pcLaborRateFrom}</Label>
              <Input id="labor-rate-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} disabled={busy} />
            </div>
            <div className="pt-6">
              <Button type="submit" disabled={busy}>{busy ? messages.pcSaving : messages.pcLaborRateSave}</Button>
            </div>
            <div className="basis-full space-y-1">
              <p className="text-xs text-muted-foreground">{messages.pcLaborRateHelp}</p>
              {previewText ? <p className="text-xs" data-testid="labor-rate-preview">{previewText}</p> : null}
              {saveError && !removing ? <InlineAlert>{saveError}</InlineAlert> : null}
            </div>
          </form>
        </SectionCard>
      ) : null}

      {data.rates.length ? (
        <SectionCard title={messages.pcLaborRateHistory} count={data.rates.length}>
          <DataTable
            className="md:rounded-none md:border-0"
            items={data.rates}
            caption={messages.pcLaborRateHistory}
            getKey={(item) => item.id}
            getRowLabel={(item) => item.effectiveFrom}
            columns={[
              { key: 'from', header: messages.pcLaborRateColFrom, primary: true, cell: (item) => formatInvoiceDate(item.effectiveFrom, locale) },
              { key: 'rate', header: messages.pcLaborRateColRate, cell: (item) => <span className="tabular-nums">{formatCents(item.rateCentsPerHour, locale)}</span> },
              { key: 'by', header: messages.pcLaborRateColBy, cell: (item) => item.createdBy?.name ?? '—' },
              ...(canWrite ? [{
                key: 'actions',
                header: messages.pcLaborRateColActions,
                cell: (item: AdminLaborRateDto) => item.deletable
                  ? <Button type="button" variant="ghost" size="sm" data-testid="labor-rate-remove" disabled={busy} onClick={() => { setSaveError(null); setRemoving(item); }}><Trash2 aria-hidden="true" />{messages.pcLaborRateRemove}</Button>
                  : null,
              }] : []),
            ]}
          />
        </SectionCard>
      ) : null}
      {removing ? (
        <Modal open title={messages.pcLaborRateRemoveTitle} description={fillPlaceholders(messages.pcLaborRateRemoveBody, { rate: formatCents(removing.rateCentsPerHour, locale), date: formatInvoiceDate(removing.effectiveFrom, locale) })} onClose={() => setRemoving(null)} closeLabel={messages.closeDialog}>
          {saveError ? <InlineAlert className="mb-3">{saveError}</InlineAlert> : null}
          <DialogActions>
            <Button type="button" variant="outline" onClick={() => setRemoving(null)} disabled={busy}>{messages.cancel}</Button>
            <Button type="button" variant="destructive" disabled={busy} onClick={() => void remove(removing)}>{busy ? messages.pcSaving : messages.pcLaborRateRemove}</Button>
          </DialogActions>
        </Modal>
      ) : null}
      <PmOilPriceCard locale={locale} messages={messages} canWrite={canWrite} />
    </div>
  );
}

/**
 * D45 / ST-5 (LTR-225): the flat price a PM's oil change costs the truck (like a shop charges it). It starts today
 * or later; each PM Work Order is charged the price in effect the day the Manager completes it.
 */
function PmOilPriceCard({ locale, messages, canWrite }: { locale: AdminLocale; messages: AdminMessages; canWrite: boolean }) {
  const { showToast } = useActionToast();
  const { data, mutate } = useAdminPmOilPrices();
  const [price, setPrice] = useState('');
  const [from, setFrom] = useState(today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cents = parseMoneyToCents(price);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (typeof cents !== 'number' || busy) return;
    setBusy(true);
    setError(null);
    try {
      await setAdminPmOilPrice({ amountCents: cents, effectiveFrom: from });
      showToast('success', messages.pcOilPriceSaved);
      setPrice('');
      void mutate();
    } catch (failure) {
      setError(partsCostsFailure(failure, messages));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SectionCard title={messages.pcOilPriceTitle} data-testid="pm-oil-price">
      <div className="space-y-3 px-4 py-3">
        <p className="text-sm text-muted-foreground">{messages.pcOilPriceHelp}</p>
        <p className="text-sm">
          {data?.current
            ? fillPlaceholders(messages.pcOilPriceCurrent, { amount: formatCents(data.current.amountCents, locale), date: formatInvoiceDate(data.current.effectiveFrom, locale) })
            : messages.pcOilPriceNone}
        </p>
        {canWrite ? (
          <form className="flex flex-wrap items-end gap-4" onSubmit={(event) => void submit(event)} noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="oil-price">{messages.pcOilPrice}</Label>
              <div className="relative w-40">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">$</span>
                <Input id="oil-price" className="pl-7 tabular-nums" inputMode="decimal" placeholder="0.00" value={price} onChange={(event) => setPrice(event.target.value)} disabled={busy} aria-invalid={cents === undefined || undefined} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="oil-price-from">{messages.pcOilPriceFrom}</Label>
              <Input id="oil-price-from" type="date" min={today()} value={from} onChange={(event) => setFrom(event.target.value)} disabled={busy} />
            </div>
            <Button type="submit" disabled={busy || typeof cents !== 'number'}>{busy ? messages.pcSaving : messages.pcOilPriceSave}</Button>
          </form>
        ) : null}
        {error ? <InlineAlert>{error}</InlineAlert> : null}
        {data?.prices.length ? (
          <ul className="divide-y text-sm">
            {data.prices.map((item) => (
              <li key={item.id} className="flex justify-between gap-3 py-1.5">
                <span>{formatInvoiceDate(item.effectiveFrom, locale)}{item.createdBy ? <span className="text-muted-foreground"> · {item.createdBy}</span> : null}</span>
                <span className="tabular-nums">{formatCents(item.amountCents, locale)}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </SectionCard>
  );
}
