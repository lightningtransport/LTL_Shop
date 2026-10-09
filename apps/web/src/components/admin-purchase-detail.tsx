'use client';

import { useState } from 'react';
import { Ban, Paperclip, Pencil } from 'lucide-react';
import { formatCents } from '@ltl-shop/shared';
import { useActionToast } from './action-toast';
import { AdminNavLink } from './admin-nav-link';
import { partsCostsFailure } from './admin-parts-catalog';
import { PurchaseForm } from './admin-purchase-form';
import { purchaseTrucksLabel } from './admin-purchases';
import { AdminBackLink, Badge, Button, DataTable, DialogActions, EmptyState, InlineAlert, Label, LoadFailure, Modal, PageHeader, PageSkeleton, SectionCard, Textarea } from './ui';
import { useCanShowManagerWrites } from '@/lib/admin-actor';
import { openAdminAttachment, useAdminPartsCatalog, useAdminPurchase, useAdminPurchaseFormData, useAdminVendors, voidAdminPurchase } from '@/lib/admin-data';
import { fillPlaceholders } from '@/lib/admin-next-step';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';
import { ApiError } from '@/lib/api';
import { formatInvoiceDate } from '@/lib/parts-costs-format';
import { formatShortDateTime } from '@/lib/work-order-view';

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
  const { data: formData } = useAdminPurchaseFormData(canWrite);
  const { data: catalog } = useAdminPartsCatalog('includeInactive=true');
  const { data: vendors, mutate: mutateVendors } = useAdminVendors();

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
  return (
    <div className="space-y-6">
      <AdminBackLink href="/admin/parts/purchases">{messages.pcBackToPurchases}</AdminBackLink>
      <PageHeader
        title={`${data.vendor.name} · ${data.invoiceNumber}`}
        subtitle={`${formatInvoiceDate(data.invoiceDate, locale)} · ${purchaseTrucksLabel(data, messages)}`}
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
            {
              key: 'truck',
              header: messages.pcLineTruck,
              cell: (line) => line.truck
                ? <AdminNavLink className="tap-inline text-primary hover:underline" href={`/admin/trucks/${line.truck.id}`}>{fillPlaceholders(messages.pcTruckLabel, { truck: line.truck.truckNumber })}</AdminNavLink>
                : <span className="text-muted-foreground">{messages.pcNoTruckOption}</span>,
            },
          ]}
        />
        <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1 border-t px-4 py-3 text-sm sm:ml-auto sm:max-w-xs">
          <dt>{messages.pcSubtotal}</dt><dd className="text-right tabular-nums">{formatCents(data.subtotalCents, locale)}</dd>
          <dt>{messages.pcTax}</dt><dd className="text-right tabular-nums">{formatCents(data.taxCents, locale)}</dd>
          <dt>{messages.pcFreight}</dt><dd className="text-right tabular-nums">{formatCents(data.freightCents, locale)}</dd>
          <dt className="font-semibold">{messages.pcTotal}</dt><dd className={`text-right font-semibold tabular-nums ${live ? '' : 'line-through'}`}>{formatCents(data.totalCents, locale)}</dd>
        </dl>
      </SectionCard>

      <SectionCard title={messages.pcTruckShares}>
        <div className="space-y-2 px-4 py-3 text-sm">
          <p className="text-xs text-muted-foreground">{messages.pcTruckSharesHint}</p>
          <ul className="divide-y" data-testid="truck-shares">
            {data.truckShares.map((share) => (
              <li key={share.id} className="flex justify-between gap-3 py-1.5">
                <AdminNavLink className="tap-inline text-primary hover:underline" href={`/admin/trucks/${share.id}`}>{fillPlaceholders(messages.pcTruckLabel, { truck: share.truckNumber })}</AdminNavLink>
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

      <SectionCard title={messages.pcInvoiceFile}>
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
          {data.attachment ? (
            <>
              <Paperclip aria-hidden="true" className="size-4 text-muted-foreground" />
              <span className="min-w-0 truncate">{data.attachment.fileName}</span>
              <Button type="button" variant="outline" size="sm" onClick={() => void openFile()}>{messages.pcOpenFile}</Button>
            </>
          ) : <Badge variant="warning">{messages.pcNoInvoiceFile}</Badge>}
        </div>
        {data.notes ? <p className="border-t px-4 py-3 text-sm whitespace-pre-line">{data.notes}</p> : null}
        <p className="border-t px-4 py-2 text-xs text-muted-foreground">
          {fillPlaceholders(messages.pcLoadedBy, { name: data.createdBy?.name ?? '—', date: formatShortDateTime(data.createdAt, locale) })}
        </p>
      </SectionCard>

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
        />
      ) : null}
      {voiding ? <VoidDialog id={data.id} messages={messages} onClose={() => setVoiding(false)} onDone={() => { setVoiding(false); void mutate(); }} /> : null}
    </div>
  );
}

function VoidDialog({ id, messages, onClose, onDone }: { id: string; messages: AdminMessages; onClose: () => void; onDone: () => void }) {
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
