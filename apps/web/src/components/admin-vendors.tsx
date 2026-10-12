'use client';

import { useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { adminCreateVendorSchema, type AdminVendorDto } from '@ltl-shop/shared';
import { useActionToast } from './action-toast';
import { AdminNavLink } from './admin-nav-link';
import { useDocumentTitle } from './admin-breadcrumb';
import { partsCostsFailure } from './admin-parts-catalog';
import { Badge, Button, DataTable, DialogActions, EmptyState, InlineAlert, Input, Label, LoadFailure, Modal, PageHeader, PageSkeleton, Textarea } from './ui';
import { useCanShowManagerWrites } from '@/lib/admin-actor';
import { createAdminVendor, updateAdminVendor, useAdminVendors } from '@/lib/admin-data';
import { fillPlaceholders } from '@/lib/admin-next-step';
import { adminCountLabel, type AdminLocale, type AdminMessages } from '@/lib/admin-messages';
import { formatInvoiceDate } from '@/lib/parts-costs-format';

/**
 * LTR-200 / D32 (PC-1): Parts & costs → Vendors. A vendor with history is never deleted, only made inactive, so it
 * stops being offered. The name is unique without caring about capitals (A55).
 */
export function AdminVendors({ locale, messages }: { locale: AdminLocale; messages: AdminMessages }) {
  const canWrite = useCanShowManagerWrites();
  useDocumentTitle(messages.pcVendorsTitle);
  const { data, error, isLoading, mutate } = useAdminVendors();
  const [editing, setEditing] = useState<AdminVendorDto | 'new' | null>(null);
  const addButton = canWrite ? <Button type="button" onClick={() => setEditing('new')}><Plus aria-hidden="true" />{messages.pcAddVendor}</Button> : null;

  return (
    <div className="space-y-6">
      <PageHeader title={messages.pcVendorsTitle} subtitle={messages.pcVendorsSubtitle} actions={data?.length ? addButton : null} />
      {error ? <LoadFailure message={messages.loadError} retryLabel={messages.retry} onRetry={() => void mutate()} /> : null}
      {isLoading && !data ? <PageSkeleton label={messages.pcVendorsTitle} header={false} /> : null}
      {data && !data.length ? (
        <EmptyState>
          <p>{messages.pcNoVendors}</p>
          {addButton ? <div className="mt-4 flex justify-center">{addButton}</div> : null}
        </EmptyState>
      ) : null}
      {data?.length ? (
        <DataTable
          items={data}
          caption={messages.pcVendorsTitle}
          getKey={(vendor) => vendor.id}
          getRowLabel={(vendor) => vendor.name}
          columns={[
            {
              key: 'name',
              header: messages.pcVendorName,
              primary: true,
              // PCA9 (UX-5-004): the name opens the vendor's invoices (purchases, or repairs if that is what it does).
              cell: (vendor) => (
                <span className={vendor.active ? 'font-medium' : 'font-medium text-muted-foreground'}>
                  <AdminNavLink className="tap-inline text-primary hover:underline" href={vendor.doesParts || !vendor.doesRepairs ? `/admin/parts/purchases?vendorId=${vendor.id}` : `/admin/parts/outside-repairs?vendorId=${vendor.id}`}>{vendor.name}</AdminNavLink>
                  {!vendor.active ? <Badge variant="secondary" className="ml-2">{messages.pcInactive}</Badge> : null}
                </span>
              ),
            },
            {
              key: 'invoices',
              header: messages.pcVendorInvoices,
              cell: (vendor) => (vendor.purchaseCount ?? 0) + (vendor.repairCount ?? 0) === 0
                ? <span className="text-muted-foreground">{messages.pcVendorNoInvoices}</span>
                : (
                  <span className="flex flex-wrap gap-x-2 gap-y-0.5 text-sm" data-testid="vendor-invoices">
                    {vendor.purchaseCount ? <AdminNavLink className="tap-inline text-primary hover:underline" href={`/admin/parts/purchases?vendorId=${vendor.id}`}>{fillPlaceholders(messages.pcVendorPurchasesCount, { count: String(vendor.purchaseCount) })}</AdminNavLink> : null}
                    {vendor.repairCount ? <AdminNavLink className="tap-inline text-primary hover:underline" href={`/admin/parts/outside-repairs?vendorId=${vendor.id}`}>{fillPlaceholders(messages.pcVendorRepairsCount, { count: String(vendor.repairCount) })}</AdminNavLink> : null}
                    {vendor.lastInvoiceDate ? <span className="text-muted-foreground">{fillPlaceholders(messages.pcVendorLastInvoice, { date: formatInvoiceDate(vendor.lastInvoiceDate, locale) })}</span> : null}
                  </span>
                ),
            },
            {
              key: 'does',
              header: messages.pcVendorDoes,
              cell: (vendor) => (
                <span className="flex flex-wrap gap-1">
                  {vendor.doesParts ? <Badge variant="outline">{messages.pcVendorParts}</Badge> : null}
                  {vendor.doesRepairs ? <Badge variant="outline">{messages.pcVendorRepairs}</Badge> : null}
                </span>
              ),
            },
            { key: 'phone', header: messages.pcVendorPhone, cell: (vendor) => vendor.phone ?? '' },
            { key: 'email', header: messages.pcVendorEmail, cell: (vendor) => vendor.email ?? '' },
            {
              key: 'parts',
              header: messages.pcVendorPartCount,
              cell: (vendor) => <span className="tabular-nums">{adminCountLabel(vendor.partCount, messages.pcVendorPartCountValueOne, messages.pcVendorPartCountValue)}</span>,
            },
            ...(canWrite ? [{
              key: 'actions',
              header: '',
              cell: (vendor: AdminVendorDto) => (
                <div className="flex justify-end">
                  <Button type="button" variant="ghost" size="sm" aria-label={`${messages.pcEditVendor}: ${vendor.name}`} onClick={() => setEditing(vendor)}>
                    <Pencil aria-hidden="true" />
                  </Button>
                </div>
              ),
            }] : []),
          ]}
        />
      ) : null}
      {editing ? (
        <VendorDialog
          vendor={editing === 'new' ? null : editing}
          messages={messages}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void mutate(); }}
        />
      ) : null}
    </div>
  );
}

function VendorDialog({ vendor, messages, onClose, onSaved }: {
  vendor: AdminVendorDto | null;
  messages: AdminMessages;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { showToast } = useActionToast();
  const [form, setForm] = useState({
    name: vendor?.name ?? '',
    doesParts: vendor?.doesParts ?? true,
    doesRepairs: vendor?.doesRepairs ?? false,
    phone: vendor?.phone ?? '',
    email: vendor?.email ?? '',
    accountNumber: vendor?.accountNumber ?? '',
    notes: vendor?.notes ?? '',
    active: vendor?.active ?? true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((current) => ({ ...current, [key]: value }));
  const needsKind = !form.doesParts && !form.doesRepairs;
  const emailInvalid = Boolean(form.email.trim()) && !adminCreateVendorSchema.innerType().shape.email.safeParse(form.email).success;
  const canSave = !busy && form.name.trim() && !needsKind && !emailInvalid;
  const dirty = vendor
    ? Object.entries(form).some(([key, value]) => value !== ((vendor as unknown as Record<string, unknown>)[key] ?? ''))
    : Boolean(form.name.trim() || form.phone.trim() || form.email.trim());

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSave) return;
    setBusy(true);
    setError(null);
    const { active, ...fields } = form;
    try {
      if (vendor) await updateAdminVendor(vendor.id, { ...fields, active });
      else await createAdminVendor(fields);
      showToast('success', vendor ? messages.pcVendorSaved : messages.pcVendorAdded);
      onSaved();
    } catch (failure) {
      setError(partsCostsFailure(failure, messages));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open title={vendor ? messages.pcEditVendor : messages.pcAddVendor} onClose={onClose} closeLabel={messages.closeDialog} dismissible={!dirty}>
      <form className="space-y-4" onSubmit={(event) => void submit(event)} data-testid="vendor-dialog">
        <div className="space-y-1.5">
          <Label htmlFor="vendor-name">{messages.pcVendorName}</Label>
          <Input id="vendor-name" value={form.name} onChange={(event) => set('name', event.target.value)} disabled={busy} autoComplete="off" required />
        </div>
        <fieldset className="space-y-1.5">
          <legend className="text-sm font-medium">{messages.pcVendorDoes}</legend>
          <div className="flex flex-wrap gap-4">
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" checked={form.doesParts} disabled={busy} onChange={(event) => set('doesParts', event.target.checked)} />
              {messages.pcVendorParts}
            </label>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" checked={form.doesRepairs} disabled={busy} onChange={(event) => set('doesRepairs', event.target.checked)} />
              {messages.pcVendorRepairs}
            </label>
          </div>
          {needsKind ? <p className="text-xs text-destructive-text">{messages.pcVendorNeedsKind}</p> : null}
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="vendor-phone">{messages.pcVendorPhone}</Label>
            <Input id="vendor-phone" type="tel" value={form.phone} onChange={(event) => set('phone', event.target.value)} disabled={busy} autoComplete="off" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vendor-email">{messages.pcVendorEmail}</Label>
            <Input id="vendor-email" type="email" value={form.email} onChange={(event) => set('email', event.target.value)} disabled={busy} autoComplete="off" aria-invalid={emailInvalid || undefined} />
            {emailInvalid ? <p className="text-xs text-destructive-text">{messages.pcEmailInvalid}</p> : null}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vendor-account">{messages.pcVendorAccount}</Label>
          <Input id="vendor-account" className="font-mono" value={form.accountNumber} onChange={(event) => set('accountNumber', event.target.value)} disabled={busy} autoComplete="off" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vendor-notes">{messages.pcVendorNotes}</Label>
          <Textarea id="vendor-notes" rows={3} value={form.notes} onChange={(event) => set('notes', event.target.value)} disabled={busy} />
        </div>
        {vendor ? (
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={form.active} disabled={busy} onChange={(event) => set('active', event.target.checked)} />
            <span>{messages.pcActive}<span className="block text-xs text-muted-foreground">{messages.pcVendorActiveHelp}</span></span>
          </label>
        ) : null}
        {error ? <InlineAlert>{error}</InlineAlert> : null}
        <DialogActions>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>{messages.cancel}</Button>
          <Button type="submit" disabled={!canSave}>{vendor ? messages.pcSaveChanges : messages.pcAddVendor}</Button>
        </DialogActions>
      </form>
    </Modal>
  );
}
