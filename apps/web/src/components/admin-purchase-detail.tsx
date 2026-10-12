'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Ban, Paperclip, Pencil } from 'lucide-react';
import { formatCents } from '@ltl-shop/shared';
import { useActionToast } from './action-toast';
import { AdminNavLink } from './admin-nav-link';
import { partsCostsFailure } from './admin-parts-catalog';
import { PurchaseForm } from './admin-purchase-form';
import { ChargedOnChips, chargedWarning } from './admin-charged-on';
import { InvoiceFileDialog } from './admin-invoice-file-dialog';
import { AdminBackLink, Badge, Button, DataTable, DialogActions, EmptyState, InlineAlert, Label, LoadFailure, Modal, PageHeader, PageSkeleton, SectionCard, Textarea } from './ui';
import { useCanShowManagerWrites } from '@/lib/admin-actor';
import { openAdminAttachment, useAdminPartsCatalog, useAdminPurchase, useAdminPurchaseFormData, useAdminVendors, voidAdminPurchase } from '@/lib/admin-data';
import { fillPlaceholders } from '@/lib/admin-next-step';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';
import { ApiError } from '@/lib/api';
import { formatInvoiceDate } from '@/lib/parts-costs-format';
import { formatShortDateTime } from '@/lib/work-order-view';
import { adminPartsOrigin, adminTruckCostsHref } from '@/lib/admin-truck-origin';

/**
 * LTR-200 / D32 (PC-2): one purchase — its lines, what each truck gets (lines plus its share of tax and freight,
 * D-PC2), the invoice file (a 5-minute link), who loaded it, Edit and Void. A voided purchase stays, crossed out.
 */
export function AdminPurchaseDetail({ id, locale, messages }: { id: string; locale: AdminLocale; messages: AdminMessages }) {
  const canWrite = useCanShowManagerWrites();
  const { showToast } = useActionToast();
  const { data, error, isLoading, mutate } = useAdminPurchase(id);
  const [editing, setEditing] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const [filing, setFiling] = useState(false);
  const { data: formData } = useAdminPurchaseFormData(canWrite);
  const { data: catalog } = useAdminPartsCatalog('includeInactive=true');
  const { data: vendors, mutate: mutateVendors } = useAdminVendors();
  // PCA2 (UX-5-002): back to the Truck's costs, the invoice or the filtered list this purchase was opened from.
  const from = useSearchParams().get('from');
  const origin = adminPartsOrigin(from, { href: '/admin/parts/purchases', backLabel: messages.pcBackToPurchases }, messages);
  const here = `/admin/parts/purchases/${id}`;

  if (isLoading) return <PageSkeleton label={messages.pcPurchasesTitle} />;
  if (error instanceof ApiError && error.status === 404) {
    return <EmptyState><p>{messages.pcPurchaseNotFound}</p><Button asChild variant="outline" className="mt-4"><AdminNavLink href="/admin/parts/purchases">{messages.pcBackToPurchases}</AdminNavLink></Button></EmptyState>;
  }
  if (error || !data) return <LoadFailure message={messages.loadError} retryLabel={messages.retry} onRetry={() => void mutate()} />;

  async function openFile() {
    try {
      const { url } = await openAdminAttachment(data!.attachment!.id);
      window.open(url, '_blank', 'noopener');
    } catch {
      showToast('error', messages.pcFileOpenFailed);
    }
  }

  const live = !data.voidedAt;
  // UX-4-012 / PC5: "Per truck" adds something only with several trucks, or a part with no truck.
  const showShares = data.truckShares.length > 1 || (data.truckShares.length > 0 && data.noTruckCents > 0);
  const destination = data.truckShares.length
    ? data.truckShares.map((share) => fillPlaceholders(messages.pcTruckLabel, { truck: share.truckNumber })).join(', ') + (data.noTruckCents ? ` + ${messages.pcNoTruckOption}` : '')
    : messages.pcNoTruckOption;
  return (
    <div className="space-y-6">
      <AdminBackLink href={origin.href}>{origin.backLabel}</AdminBackLink>
      <PageHeader
        title={`${data.vendor.name} · ${data.invoiceNumber}`}
        subtitle={formatInvoiceDate(data.invoiceDate, locale)}
        badges={data.voidedAt ? <Badge variant="secondary">{messages.pcVoided}</Badge> : null}
        actions={canWrite && live ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={!formData || !catalog || !vendors} onClick={() => setEditing(true)}><Pencil aria-hidden="true" />{messages.pcEditPurchase}</Button>
            <Button type="button" variant="outline" onClick={() => setVoiding(true)}><Ban aria-hidden="true" />{messages.pcVoid}</Button>
          </div>
        ) : null}
      />
      {data.voidedAt ? (
        <p className="rounded-xl border bg-muted px-4 py-3 text-sm" data-testid="purchase-voided">
          {fillPlaceholders(messages.pcVoidedBy, { name: data.voidedBy?.name ?? '—', date: formatShortDateTime(data.voidedAt, locale), reason: data.voidReason ?? '' })}
        </p>
      ) : null}

      {/* UX-4-012 / PC5: what was bought, from whom, how much and for which truck, before the detail. */}
      <section className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-[1fr_auto]" data-testid="purchase-summary">
        <dl className="grid grid-cols-[8.5rem_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">{messages.pcVendorField}</dt>
          <dd className="font-medium">{data.vendor.name}</dd>
          <dt className="text-muted-foreground">{messages.pcInvoiceNumber}</dt>
          <dd className="font-mono">{data.invoiceNumber}</dd>
          <dt className="text-muted-foreground">{messages.pcInvoiceDate}</dt>
          <dd>{formatInvoiceDate(data.invoiceDate, locale)}</dd>
          <dt className="text-muted-foreground">{messages.pcColTrucks}</dt>
          <dd>
            {data.truckShares.length === 1 && !data.noTruckCents
              ? <AdminNavLink className="tap-inline text-primary hover:underline" href={adminTruckCostsHref(data.truckShares[0].id, here)}>{destination}</AdminNavLink>
              : destination}
          </dd>
          <dt className="text-muted-foreground">{messages.pcInvoiceFile}</dt>
          <dd className="flex flex-wrap items-center gap-2">
            {data.attachment ? (
              <>
                <Paperclip aria-hidden="true" className="size-4 text-muted-foreground" />
                <span className="min-w-0 truncate">{data.attachment.fileName}</span>
                <Button type="button" variant="outline" size="sm" onClick={() => void openFile()}>{messages.pcOpenFile}</Button>
              </>
            ) : <Badge variant="warning">{messages.pcNoInvoiceFile}</Badge>}
            {/* PCA6 (UX-10-004): the file on its own, without Edit (which would rewrite the trucks' costs). */}
            {canWrite && live && formData?.filesEnabled ? (
              <Button type="button" variant="ghost" size="sm" data-testid="purchase-file-action" onClick={() => setFiling(true)}>{data.attachment ? messages.pcReplaceFile : messages.pcAddFile}</Button>
            ) : null}
          </dd>
          {/* PCA4 (UX-10-002): whether Finance already has this on an invoice, before anyone edits or voids it. */}
          <dt className="text-muted-foreground">{messages.pcChargedToFinance}</dt>
          <dd><ChargedOnChips chargedOn={data.chargedOn} from={here} messages={messages} testId="purchase-charged-on" /></dd>
        </dl>
        <dl className="grid min-w-56 grid-cols-[1fr_auto] content-start gap-x-6 gap-y-1 rounded-lg bg-muted/60 px-4 py-3 text-sm">
          <dt>{messages.pcSubtotal}</dt><dd className="text-right tabular-nums">{formatCents(data.subtotalCents, locale)}</dd>
          <dt className="text-muted-foreground">{messages.pcTax}</dt><dd className="text-right tabular-nums text-muted-foreground">{formatCents(data.taxCents, locale)}</dd>
          <dt className="text-muted-foreground">{messages.pcFreight}</dt><dd className="text-right tabular-nums text-muted-foreground">{formatCents(data.freightCents, locale)}</dd>
          <dt className="mt-1 border-t pt-1 text-base font-semibold">{messages.pcTotal}</dt>
          <dd className={`mt-1 border-t pt-1 text-right text-base font-semibold tabular-nums ${live ? '' : 'line-through'}`} data-testid="purchase-detail-total">{formatCents(data.totalCents, locale)}</dd>
        </dl>
        <p className="text-xs text-muted-foreground sm:col-span-2">
          {fillPlaceholders(messages.pcLoadedBy, { name: data.createdBy?.name ?? '—', date: formatShortDateTime(data.createdAt, locale) })}
        </p>
      </section>

      <SectionCard title={messages.pcLines} count={data.lines.length}>
        <DataTable
          className="md:rounded-none md:border-0"
          items={data.lines}
          caption={messages.pcLines}
          getKey={(line) => line.id}
          getRowLabel={(line) => line.description}
          columns={[
            {
              key: 'part',
              header: messages.pcLinePart,
              primary: true,
              cell: (line) => <span>{line.description}{line.partNumber ? <span className="ml-2 font-mono text-xs text-muted-foreground">{line.partNumber}</span> : null}</span>,
            },
            { key: 'qty', header: messages.pcLineQty, cell: (line) => <span className="tabular-nums">{Number(line.quantity)}</span> },
            { key: 'unit', header: messages.pcLineUnitCost, cell: (line) => <span className="tabular-nums">{formatCents(line.unitCostCents, locale)}</span> },
            { key: 'total', header: messages.pcLineTotal, cell: (line) => <span className="tabular-nums">{formatCents(line.lineTotalCents, locale)}</span> },
            ...(data.truckShares.length > 1 || data.noTruckCents ? [{
              key: 'truck',
              header: messages.pcLineTruck,
              cell: (line: (typeof data.lines)[number]) => line.truck
                ? <AdminNavLink className="tap-inline text-primary hover:underline" href={adminTruckCostsHref(line.truck.id, here)}>{fillPlaceholders(messages.pcTruckLabel, { truck: line.truck.truckNumber })}</AdminNavLink>
                : <span className="text-muted-foreground">{messages.pcNoTruckOption}</span>,
            }] : []),
          ]}
        />
      </SectionCard>

      {showShares ? (
        <SectionCard title={messages.pcTruckShares}>
          <div className="space-y-2 px-4 py-3 text-sm">
            <p className="text-xs text-muted-foreground">{messages.pcTruckSharesHint}</p>
            <ul className="divide-y" data-testid="truck-shares">
              {data.truckShares.map((share) => (
                <li key={share.id} className="flex justify-between gap-3 py-1.5">
                  <AdminNavLink className="tap-inline text-primary hover:underline" href={adminTruckCostsHref(share.id, here)}>{fillPlaceholders(messages.pcTruckLabel, { truck: share.truckNumber })}</AdminNavLink>
                  <span className="tabular-nums">{formatCents(share.amountCents, locale)}</span>
                </li>
              ))}
              {data.noTruckCents ? (
                <li className="flex justify-between gap-3 py-1.5 text-muted-foreground">
                  <span>{messages.pcNoTruckShare}</span>
                  <span className="tabular-nums">{formatCents(data.noTruckCents, locale)}</span>
                </li>
              ) : null}
            </ul>
          </div>
        </SectionCard>
      ) : null}

      {data.notes ? (
        <SectionCard title={messages.pcNotes}>
          <p className="whitespace-pre-line px-4 py-3 text-sm">{data.notes}</p>
        </SectionCard>
      ) : null}
      {editing && formData && catalog && vendors ? (
        <PurchaseForm
          purchase={data}
          categories={catalog.categories}
          vendors={vendors}
          formData={formData}
          locale={locale}
          messages={messages}
          onClose={() => setEditing(false)}
          onVendorAdded={() => void mutateVendors()}
          onSaved={() => { setEditing(false); void mutate(); }}
          notice={chargedWarning('edit', 'purchase', data.chargedOn, messages)}
        />
      ) : null}
      {voiding ? <VoidDialog id={data.id} warning={chargedWarning('void', 'purchase', data.chargedOn, messages)} messages={messages} onClose={() => setVoiding(false)} onDone={() => { setVoiding(false); void mutate(); }} /> : null}
      {filing ? <InvoiceFileDialog owner="purchase" id={data.id} current={data.attachment} messages={messages} onClose={() => setFiling(false)} onSaved={() => { setFiling(false); void mutate(); }} /> : null}
    </div>
  );
}

function VoidDialog({ id, warning, messages, onClose, onDone }: { id: string; warning: string | null; messages: AdminMessages; onClose: () => void; onDone: () => void }) {
  const { showToast } = useActionToast();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!reason.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await voidAdminPurchase(id, reason.trim());
      showToast('success', messages.pcVoidDone);
      onDone();
    } catch (failure) {
      setError(partsCostsFailure(failure, messages));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open title={messages.pcVoidTitle} description={messages.pcVoidBody} onClose={onClose} closeLabel={messages.closeDialog} dismissible={!reason.trim()}>
      <form className="space-y-4" onSubmit={(event) => void submit(event)}>
        {warning ? <InlineAlert data-testid="purchase-void-charged">{warning}</InlineAlert> : null}
        <div className="space-y-1.5">
          <Label htmlFor="void-reason">{messages.pcVoidReason}</Label>
          <Textarea id="void-reason" rows={2} value={reason} onChange={(event) => setReason(event.target.value)} disabled={busy} />
        </div>
        {error ? <InlineAlert>{error}</InlineAlert> : null}
        <DialogActions>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>{messages.cancel}</Button>
          <Button type="submit" variant="destructive" disabled={busy || !reason.trim()}>{messages.pcVoid}</Button>
        </DialogActions>
      </form>
    </Modal>
  );
}
