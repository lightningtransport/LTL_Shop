'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { formatCents, type InternalInvoiceStatus } from '@ltl-shop/shared';
import { useActionToast } from './action-toast';
import { AdminNavLink } from './admin-nav-link';
import { partsCostsFailure } from './admin-parts-catalog';
import { Badge, Button, DataTable, DialogActions, EmptyState, InlineAlert, Input, Label, LoadFailure, Modal, PageHeader, PageSkeleton, Select, type BadgeProps } from './ui';
import { useCanShowManagerWrites } from '@/lib/admin-actor';
import { createAdminInternalInvoice, useAdminInternalInvoices, useAdminPurchaseFormData } from '@/lib/admin-data';
import { fillPlaceholders } from '@/lib/admin-next-step';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';
import { ApiError } from '@/lib/api';
import { apiErrorCode } from '@/lib/api-error-message';

export function invoiceStatusChip(status: InternalInvoiceStatus, messages: AdminMessages): { label: string; variant: BadgeProps['variant'] } {
  if (status === 'draft') return { label: messages.pcInvoiceDraft, variant: 'warning' };
  if (status === 'sent') return { label: messages.pcInvoiceSent, variant: 'default' };
  if (status === 'accepted') return { label: messages.pcInvoiceAccepted, variant: 'success' };
  return { label: messages.pcInvoiceVoid, variant: 'secondary' };
}

/** "Oct 2026" / "oct 2026" from the period start ("2026-10-01"). */
export function invoiceMonth(periodStart: string, locale: AdminLocale) {
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-US' : 'en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${periodStart}T00:00:00Z`));
}

const lastMonth = () => {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

/**
 * LTR-201 / D34 (LB-2): Parts & costs → Internal invoices. One per truck and month; a draft brings what the truck has
 * uncharged up to the end of the month. Sent ones get their SHOP number; Finance gets the PDF outside the app.
 */
export function AdminInternalInvoices({ locale, messages }: { locale: AdminLocale; messages: AdminMessages }) {
  const router = useRouter();
  const canWrite = useCanShowManagerWrites();
  const { data, error, isLoading, mutate } = useAdminInternalInvoices('');
  const { data: formData } = useAdminPurchaseFormData(true);
  const [creating, setCreating] = useState(false);
  const newButton = canWrite ? <Button type="button" onClick={() => setCreating(true)} disabled={!formData}><Plus aria-hidden="true" />{messages.pcNewInvoice}</Button> : null;

  return (
    <div className="space-y-6">
      <PageHeader title={messages.pcInvoicesTitle} subtitle={messages.pcInvoicesSubtitle} actions={newButton} />
      {error ? <LoadFailure message={messages.loadError} retryLabel={messages.retry} onRetry={() => void mutate()} /> : null}
      {isLoading && !data ? <PageSkeleton label={messages.pcInvoicesTitle} header={false} /> : null}
      {data && !data.length ? (
        <EmptyState>
          <p>{messages.pcNoInvoices}</p>
          {newButton ? <div className="mt-4 flex justify-center">{newButton}</div> : null}
        </EmptyState>
      ) : null}
      {data?.length ? (
        <DataTable
          items={data}
          caption={messages.pcInvoicesTitle}
          getKey={(item) => item.id}
          getRowLabel={(item) => item.number ?? messages.pcInvoiceDraft}
          columns={[
            {
              key: 'number',
              header: messages.pcInvoiceColNumber,
              primary: true,
              cell: (item) => (
                <AdminNavLink className={`tap-inline font-mono font-semibold text-primary hover:underline ${item.status === 'void' ? 'line-through' : ''}`} href={`/admin/parts/internal-invoices/${item.id}`}>
                  {item.number ?? messages.pcInvoiceDraft}
                </AdminNavLink>
              ),
            },
            { key: 'truck', header: messages.pcInvoiceTruck, cell: (item) => fillPlaceholders(messages.pcTruckLabel, { truck: item.truck.truckNumber }) },
            { key: 'month', header: messages.pcInvoiceColPeriod, cell: (item) => invoiceMonth(item.periodStart, locale) },
            {
              key: 'status',
              header: messages.pcInvoiceColStatus,
              cell: (item) => {
                const chip = invoiceStatusChip(item.status, messages);
                return <Badge variant={chip.variant}>{chip.label}</Badge>;
              },
            },
            { key: 'lines', header: messages.pcColLines, cell: (item) => fillPlaceholders(messages.pcLinesCount, { count: String(item.lineCount) }) },
            { key: 'total', header: messages.pcColTotal, cell: (item) => <span className={`tabular-nums font-medium ${item.status === 'void' ? 'text-muted-foreground line-through' : ''}`}>{formatCents(item.totalCents, locale)}</span> },
          ]}
        />
      ) : null}
      {creating && formData ? (
        <NewInvoiceDialog
          trucks={formData.trucks}
          messages={messages}
          onClose={() => setCreating(false)}
          onCreated={(id) => { setCreating(false); void mutate(); router.push(`/admin/parts/internal-invoices/${id}`); }}
        />
      ) : null}
    </div>
  );
}

function NewInvoiceDialog({ trucks, messages, onClose, onCreated }: {
  trucks: Array<{ id: string; truckNumber: string }>;
  messages: AdminMessages;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const { showToast } = useActionToast();
  const [truckId, setTruckId] = useState('');
  const [month, setMonth] = useState(lastMonth);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setShowErrors(true);
    if (!truckId || !month || busy) return;
    setBusy(true);
    setError(null);
    setExistingId(null);
    try {
      const created = await createAdminInternalInvoice({ truckId, month });
      showToast('success', messages.pcInvoiceDraft);
      onCreated(created.id);
    } catch (failure) {
      if (failure instanceof ApiError && apiErrorCode(failure) === 'INTERNAL_INVOICE_DRAFT_EXISTS') {
        setExistingId((failure.body as { id?: string } | undefined)?.id ?? null);
      }
      setError(partsCostsFailure(failure, messages));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open title={messages.pcNewInvoice} description={messages.pcInvoiceCreateHelp} onClose={onClose} closeLabel={messages.closeDialog}>
      <form className="space-y-4" onSubmit={(event) => void submit(event)} noValidate data-testid="new-invoice-form">
        <div className="space-y-1.5">
          <Label htmlFor="invoice-truck">{messages.pcInvoiceTruck}</Label>
          <Select id="invoice-truck" value={truckId} onChange={(event) => setTruckId(event.target.value)} disabled={busy} aria-invalid={(showErrors && !truckId) || undefined}>
            <option value="">{messages.pcPickTruck}</option>
            {trucks.map((truck) => <option key={truck.id} value={truck.id}>{fillPlaceholders(messages.pcTruckLabel, { truck: truck.truckNumber })}</option>)}
          </Select>
          {showErrors && !truckId ? <p className="text-xs text-destructive-text">{messages.pcFieldRequired}</p> : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="invoice-month">{messages.pcInvoiceMonth}</Label>
          <Input id="invoice-month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} disabled={busy} />
        </div>
        {error ? (
          <InlineAlert>
            {error}{' '}
            {existingId ? <AdminNavLink className="tap-inline underline" href={`/admin/parts/internal-invoices/${existingId}`}>{messages.pcOpenIt}</AdminNavLink> : null}
          </InlineAlert>
        ) : null}
        <DialogActions>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>{messages.cancel}</Button>
          <Button type="submit" disabled={busy}>{busy ? messages.pcSaving : messages.pcInvoiceCreate}</Button>
        </DialogActions>
      </form>
    </Modal>
  );
}
