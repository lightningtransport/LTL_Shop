'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { formatCents, type AdminInternalInvoiceSummaryDto, type AdminInvoiceMonthDto, type InternalInvoiceStatus } from '@ltl-shop/shared';
import { useActionToast } from './action-toast';
import { AdminNavLink } from './admin-nav-link';
import { partsCostsFailure } from './admin-parts-catalog';
import { Badge, Button, Card, CardContent, DataTable, DialogActions, EmptyState, InlineAlert, Input, Label, LoadFailure, Modal, PageHeader, PageSkeleton, SectionCard, Select, type BadgeProps } from './ui';
import { useDocumentTitle } from './admin-breadcrumb';
import { useUrlFilters } from '@/lib/use-url-filters';
import { useCanShowManagerWrites } from '@/lib/admin-actor';
import { createAdminInternalInvoice, createAllAdminInternalInvoices, useAdminInternalInvoices, useAdminInvoiceMonth, useAdminPurchaseFormData } from '@/lib/admin-data';
import { fillPlaceholders } from '@/lib/admin-next-step';
import { adminCountLabel, type AdminLocale, type AdminMessages } from '@/lib/admin-messages';
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

const INVOICE_FILTERS = { status: '', month: '' };

/** The last 24 months, newest first ("2026-10"), plus a month from the URL that is older. */
function monthChoices(selected: string): string[] {
  const now = new Date();
  const months = Array.from({ length: 24 }, (_, back) => {
    const date = new Date(now.getFullYear(), now.getMonth() - back, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  });
  return /^\d{4}-\d{2}$/.test(selected) && !months.includes(selected) ? [...months, selected] : months;
}

/**
 * LTR-201 / D34 (LB-2): Parts & costs → Internal invoices. One per truck and month; a draft brings what the truck has
 * uncharged up to the end of the month. Sent ones get their SHOP number; Finance gets the PDF outside the app.
 * PCA14 (UX-5-009): grouped by month with what each month adds up to, filtered by status and month from the URL.
 */
export function AdminInternalInvoices({ locale, messages }: { locale: AdminLocale; messages: AdminMessages }) {
  const router = useRouter();
  const canWrite = useCanShowManagerWrites();
  useDocumentTitle(messages.pcInvoicesTitle);
  const { filters, set, clear, query, active: filtered } = useUrlFilters(INVOICE_FILTERS);
  const { data, error, isLoading, mutate } = useAdminInternalInvoices(query);
  const { data: formData } = useAdminPurchaseFormData(true);
  const [creating, setCreating] = useState(false);
  const newButton = canWrite ? <Button type="button" onClick={() => setCreating(true)} disabled={!formData}><Plus aria-hidden="true" />{messages.pcNewInvoice}</Button> : null;
  const months = useMemo(() => {
    const groups = new Map<string, AdminInternalInvoiceSummaryDto[]>();
    for (const item of data ?? []) groups.set(item.periodStart, [...(groups.get(item.periodStart) ?? []), item]);
    return [...groups.entries()].sort(([left], [right]) => right.localeCompare(left));
  }, [data]);
  const statuses: Array<[InternalInvoiceStatus, string]> = [['draft', messages.pcInvoiceDraft], ['sent', messages.pcInvoiceSent], ['accepted', messages.pcInvoiceAccepted], ['void', messages.pcInvoiceVoid]];

  return (
    <div className="space-y-6">
      <PageHeader title={messages.pcInvoicesTitle} subtitle={messages.pcInvoicesSubtitle} actions={newButton} />
      <MonthClose locale={locale} messages={messages} canWrite={canWrite} onChanged={() => void mutate()} />
      <Card className="p-3">
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="invoices-status">{messages.pcInvoiceFilterStatus}</Label>
            <Select id="invoices-status" value={filters.status} onChange={(event) => set('status', event.target.value)}>
              <option value="">{messages.pcInvoiceAnyStatus}</option>
              {statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="invoices-month">{messages.pcInvoiceFilterMonth}</Label>
            {/* LTR-277 §7: empty means any month, and the control says so (a bare month input drew dashes). */}
            <Select id="invoices-month" value={filters.month} onChange={(event) => set('month', event.target.value)}>
              <option value="">{messages.pcInvoiceAnyMonth}</option>
              {monthChoices(filters.month).map((month) => <option key={month} value={month}>{invoiceMonth(`${month}-01`, locale)}</option>)}
            </Select>
          </div>
          {filtered ? <Button type="button" variant="ghost" onClick={clear}>{messages.pcClearFilters}</Button> : null}
        </CardContent>
      </Card>
      {error ? <LoadFailure message={messages.loadError} retryLabel={messages.retry} onRetry={() => void mutate()} /> : null}
      {isLoading && !data ? <PageSkeleton label={messages.pcInvoicesTitle} header={false} table /> : null}
      {data && !data.length ? (
        <EmptyState>
          <p>{filtered ? messages.pcInvoiceNoMatch : messages.pcNoInvoices}</p>
          {filtered ? <Button type="button" variant="outline" className="mt-4" onClick={clear}>{messages.pcClearFilters}</Button> : newButton ? <div className="mt-4 flex justify-center">{newButton}</div> : null}
        </EmptyState>
      ) : null}
      {months.map(([periodStart, items]) => {
        const count = (status: InternalInvoiceStatus) => items.filter((item) => item.status === status).length;
        const invoiced = items.filter((item) => item.status === 'sent' || item.status === 'accepted').reduce((sum, item) => sum + item.totalCents, 0);
        return (
          <SectionCard key={periodStart} title={invoiceMonth(periodStart, locale)} count={items.length} data-testid="invoices-month">
            <p className="px-4 pt-3 text-xs text-muted-foreground" data-testid="invoices-month-summary">
              {fillPlaceholders(messages.pcInvoiceMonthSummary, {
                // LTR-277 §7: "1 draft", never "1 drafts".
                sent: adminCountLabel(count('sent'), messages.pcInvoiceMonthSentOne, messages.pcInvoiceMonthSent),
                accepted: adminCountLabel(count('accepted'), messages.pcInvoiceMonthAcceptedOne, messages.pcInvoiceMonthAccepted),
                drafts: adminCountLabel(count('draft'), messages.pcInvoiceMonthDraftsOne, messages.pcInvoiceMonthDrafts),
                total: formatCents(invoiced, locale),
              })}
            </p>
            <DataTable
              wholeCardOpens
              className="md:rounded-none md:border-0"
              items={items}
              caption={invoiceMonth(periodStart, locale)}
              getKey={(item) => item.id}
              getRowLabel={(item) => item.number ?? messages.pcInvoiceDraft}
              columns={[
                {
                  key: 'number',
                  header: messages.pcInvoiceColNumber,
                  primary: true,
                  cell: (item) => (
                    <AdminNavLink className={`tap-inline font-mono font-semibold text-primary hover:underline ${item.status === 'void' ? 'line-through' : ''}`} href={`/admin/parts/internal-invoices/${item.id}`}>
                      {item.number ?? fillPlaceholders(messages.pcInvoiceDraftLabel, { truck: item.truck.truckNumber, month: invoiceMonth(item.periodStart, locale) })}
                    </AdminNavLink>
                  ),
                },
                { key: 'truck', header: messages.pcInvoiceTruck, cell: (item) => fillPlaceholders(messages.pcTruckLabel, { truck: item.truck.truckNumber }) },
                {
                  key: 'status',
                  header: messages.pcInvoiceColStatus,
                  cell: (item) => {
                    const chip = invoiceStatusChip(item.status, messages);
                    return <Badge variant={chip.variant}>{chip.label}</Badge>;
                  },
                },
                { key: 'lines', header: messages.pcColLines, cell: (item) => adminCountLabel(item.lineCount, messages.pcLinesCountOne, messages.pcLinesCount) },
                { key: 'total', header: messages.pcColTotal, cell: (item) => <span className={`tabular-nums font-medium ${item.status === 'void' ? 'text-muted-foreground line-through' : ''}`}>{formatCents(item.totalCents, locale)}</span> },
              ]}
            />
          </SectionCard>
        );
      })}
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

/**
 * PCA16 (D37, P15): the month's close as one screen. Every truck with something to charge up to the end of the month,
 * what it has, and its invoice if it already has one; "Create drafts for all" makes the missing drafts. Sending, the
 * number and the PDF stay per truck.
 */
function MonthClose({ locale, messages, canWrite, onChanged }: { locale: AdminLocale; messages: AdminMessages; canWrite: boolean; onChanged: () => void }) {
  const { showToast } = useActionToast();
  const [month, setMonth] = useState(lastMonth);
  const valid = /^\d{4}-\d{2}$/.test(month);
  const { data, error, isLoading, mutate } = useAdminInvoiceMonth(valid ? month : null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const monthLabel = valid ? invoiceMonth(`${month}-01`, locale) : month;

  async function run(action: () => Promise<unknown>, toast: (result: unknown) => string) {
    setBusy(true);
    setActionError(null);
    try {
      const result = await action();
      showToast('success', toast(result));
      await mutate();
      onChanged();
    } catch (failure) {
      setActionError(partsCostsFailure(failure, messages));
    } finally {
      setBusy(false);
    }
  }
  const toCharge = (row: AdminInvoiceMonthDto['rows'][number]) => row.uncharged.count > 0 && (!row.invoice || row.invoice.status === 'void');

  return (
    <SectionCard
      title={messages.pcCloseTitle}
      data-testid="invoice-month-close"
      action={canWrite && data && data.totals.trucksToCharge > 0 ? (
        <Button type="button" disabled={busy} data-testid="invoice-create-all" onClick={() => void run(() => createAllAdminInternalInvoices(month), (result) => fillPlaceholders(messages.pcCloseCreated, { count: String((result as { created: number }).created) }))}>
          <Plus aria-hidden="true" />{fillPlaceholders(messages.pcCloseCreateAll, { count: String(data.totals.trucksToCharge) })}
        </Button>
      ) : null}
    >
      <div className="flex flex-wrap items-end gap-3 px-4 py-3">
        <div className="space-y-1">
          <Label htmlFor="close-month">{messages.pcCloseMonth}</Label>
          <Input id="close-month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
        </div>
        <p className="min-w-60 flex-1 text-xs text-muted-foreground">{fillPlaceholders(messages.pcCloseHint, { month: monthLabel })}</p>
      </div>
      {actionError ? <InlineAlert className="mx-4 mb-3">{actionError}</InlineAlert> : null}
      {error ? <div className="px-4 pb-3"><LoadFailure message={messages.loadError} retryLabel={messages.retry} onRetry={() => void mutate()} /></div> : null}
      {isLoading && !data ? <div className="px-4 pb-3"><PageSkeleton label={messages.pcCloseTitle} header={false} /></div> : null}
      {data ? (
        <p className="border-t px-4 py-2 text-sm" data-testid="invoice-month-summary-line">
          {fillPlaceholders(messages.pcCloseSummary, { trucks: String(data.totals.trucksToCharge), uncharged: formatCents(data.totals.unchargedCents, locale), invoiced: formatCents(data.totals.invoicedCents, locale) })}
        </p>
      ) : null}
      {data && !data.rows.length ? <p className="border-t px-4 py-3 text-sm text-muted-foreground">{fillPlaceholders(messages.pcCloseEmpty, { month: monthLabel })}</p> : null}
      {data?.rows.length ? (
        <DataTable
          className="md:rounded-none md:border-0"
          items={data.rows}
          caption={messages.pcCloseTitle}
          getKey={(row) => row.truck.id}
          getRowLabel={(row) => row.truck.truckNumber}
          columns={[
            { key: 'truck', header: messages.pcCloseColTruck, primary: true, className: 'md:align-middle', cell: (row) => fillPlaceholders(messages.pcTruckLabel, { truck: row.truck.truckNumber }) },
            {
              key: 'uncharged',
              className: 'md:align-middle',
              header: messages.pcCloseColUncharged,
              cell: (row) => row.uncharged.count
                ? <span className="tabular-nums">{fillPlaceholders(row.uncharged.count === 1 ? messages.pcCloseUnchargedOne : messages.pcCloseUncharged, { count: String(row.uncharged.count), amount: formatCents(row.uncharged.totalCents, locale) })}</span>
                : <span className="text-muted-foreground">{messages.pcCloseNothing}</span>,
            },
            {
              key: 'invoice',
              className: 'md:align-middle',
              header: messages.pcCloseColInvoice,
              cell: (row) => {
                if (!row.invoice) return <span className="text-muted-foreground">—</span>;
                const chip = invoiceStatusChip(row.invoice.status, messages);
                return (
                  <span className="flex flex-wrap items-center gap-2">
                    <AdminNavLink className="tap-inline font-mono text-primary hover:underline" href={`/admin/parts/internal-invoices/${row.invoice.id}`}>{row.invoice.number ?? messages.pcInvoiceDraft}</AdminNavLink>
                    <Badge variant={chip.variant}>{chip.label}</Badge>
                    <span className="tabular-nums">{formatCents(row.invoice.totalCents, locale)}</span>
                  </span>
                );
              },
            },
            ...(canWrite ? [{
              key: 'action',
              className: 'md:align-middle md:text-right',
              header: '',
              cell: (row: AdminInvoiceMonthDto['rows'][number]) => toCharge(row)
                ? <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void run(() => createAdminInternalInvoice({ truckId: row.truck.id, month }), () => messages.pcInvoiceDraft)}>{messages.pcCloseMakeDraft}</Button>
                : null,
            }] : []),
          ]}
        />
      ) : null}
    </SectionCard>
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
          <Button loading={busy} type="submit">{messages.pcInvoiceCreate}</Button>
        </DialogActions>
      </form>
    </Modal>
  );
}
