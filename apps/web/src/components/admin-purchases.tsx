'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Paperclip, Plus } from 'lucide-react';
import { formatCents, type AdminPurchaseSummaryDto } from '@ltl-shop/shared';
import { AdminNavLink } from './admin-nav-link';
import { PurchaseForm } from './admin-purchase-form';
import { Badge, Button, Card, CardContent, DataTable, EmptyState, Input, Label, LoadFailure, PageHeader, PageSkeleton, Select } from './ui';
import { useCanShowManagerWrites } from '@/lib/admin-actor';
import { useAdminPartsCatalog, useAdminPurchaseFormData, useAdminPurchases, useAdminVendors } from '@/lib/admin-data';
import { fillPlaceholders } from '@/lib/admin-next-step';
import { adminCountLabel, type AdminLocale, type AdminMessages } from '@/lib/admin-messages';
import { formatInvoiceDate } from '@/lib/parts-costs-format';

export function purchaseTrucksLabel(item: AdminPurchaseSummaryDto, messages: AdminMessages) {
  const trucks = item.trucks.map((truck) => truck.truckNumber);
  if (!trucks.length) return messages.pcNoTruckOption;
  const label = trucks.length === 1 ? fillPlaceholders(messages.pcTruckLabel, { truck: trucks[0] }) : trucks.join(', ');
  return item.hasNoTruckLines ? `${label} + ${messages.pcNoTruckOption}` : label;
}

/**
 * LTR-200 / D32 (PC-2): Parts & costs → Purchases. Newest first; filters by invoice, vendor or part, vendor, truck
 * ("No truck" included), period and "without invoice file". The line above the table totals what is filtered
 * (voided purchases do not count) and what has no truck.
 */
export function AdminPurchases({ locale, messages }: { locale: AdminLocale; messages: AdminMessages }) {
  const router = useRouter();
  const canWrite = useCanShowManagerWrites();
  const [filters, setFilters] = useState({ q: '', vendorId: '', truckId: '', from: '', to: '', noFile: false });
  const query = useMemo(() => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value === true) params.set(key, 'true');
      else if (typeof value === 'string' && value.trim()) params.set(key, value.trim());
    }
    return params.toString();
  }, [filters]);
  const { data, error, isLoading, mutate } = useAdminPurchases(query);
  const [formOpen, setFormOpen] = useState(false);
  const [presetTruckId, setPresetTruckId] = useState<string | undefined>();
  const pathname = usePathname();
  const params = useSearchParams();
  // PC-4: "Add purchase" from Truck → Costs opens New purchase with that truck.
  useEffect(() => {
    if (params.get('new') !== '1' || !canWrite) return;
    setPresetTruckId(params.get('truckId') ?? undefined);
    setFormOpen(true);
    router.replace(pathname);
  }, [params, canWrite, router, pathname]);
  const { data: formData } = useAdminPurchaseFormData(true);
  const { data: catalog } = useAdminPartsCatalog('includeInactive=true');
  const { data: vendors, mutate: mutateVendors } = useAdminVendors();
  const set = <K extends keyof typeof filters>(key: K, value: (typeof filters)[K]) => setFilters((current) => ({ ...current, [key]: value }));
  const filtered = Boolean(query);
  const ready = Boolean(formData && catalog && vendors);
  const newButton = canWrite ? (
    <Button type="button" onClick={() => setFormOpen(true)} disabled={!ready}><Plus aria-hidden="true" />{messages.pcNewPurchase}</Button>
  ) : null;

  return (
    <div className="space-y-6">
      <PageHeader title={messages.pcPurchasesTitle} subtitle={messages.pcPurchasesSubtitle} actions={newButton} />
      <Card className="p-3">
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1">
            <Input value={filters.q} onChange={(event) => set('q', event.target.value)} placeholder={messages.pcSearchPurchases} aria-label={messages.pcSearchPurchases} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="purchases-vendor">{messages.pcFilterVendor}</Label>
            <Select id="purchases-vendor" value={filters.vendorId} onChange={(event) => set('vendorId', event.target.value)}>
              <option value="">{messages.pcAnyVendor}</option>
              {(vendors ?? []).map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="purchases-truck">{messages.pcFilterTruck}</Label>
            <Select id="purchases-truck" value={filters.truckId} onChange={(event) => set('truckId', event.target.value)}>
              <option value="">{messages.pcAnyTruck}</option>
              <option value="none">{messages.pcNoTruckOption}</option>
              {(formData?.trucks ?? []).map((truck) => <option key={truck.id} value={truck.id}>{fillPlaceholders(messages.pcTruckLabel, { truck: truck.truckNumber })}</option>)}
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="purchases-from">{messages.pcFrom}</Label>
            <Input id="purchases-from" type="date" value={filters.from} onChange={(event) => set('from', event.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="purchases-to">{messages.pcTo}</Label>
            <Input id="purchases-to" type="date" value={filters.to} onChange={(event) => set('to', event.target.value)} />
          </div>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" checked={filters.noFile} onChange={(event) => set('noFile', event.target.checked)} />
            {messages.pcNoFileFilter}
          </label>
        </CardContent>
      </Card>

      {error ? <LoadFailure message={messages.loadError} retryLabel={messages.retry} onRetry={() => void mutate()} /> : null}
      {isLoading && !data ? <PageSkeleton label={messages.pcPurchasesTitle} header={false} /> : null}
      {data ? (
        <p className="text-sm text-muted-foreground" data-testid="purchases-summary">
          {fillPlaceholders(messages.pcPurchasesSummary, { count: String(data.totals.count), total: formatCents(data.totals.totalCents, locale) })}
          {data.totals.noTruckCents ? ` · ${fillPlaceholders(messages.pcPurchasesNoTruck, { amount: formatCents(data.totals.noTruckCents, locale) })}` : null}
        </p>
      ) : null}
      {data && !data.items.length ? (
        <EmptyState>
          <p>{filtered ? messages.pcNoPurchasesMatch : messages.pcNoPurchases}</p>
          {filtered ? (
            <Button type="button" variant="outline" className="mt-4" onClick={() => setFilters({ q: '', vendorId: '', truckId: '', from: '', to: '', noFile: false })}>{messages.pcClearFilters}</Button>
          ) : newButton ? <div className="mt-4 flex justify-center">{newButton}</div> : null}
        </EmptyState>
      ) : null}
      {data?.items.length ? (
        <DataTable
          items={data.items}
          caption={messages.pcPurchasesTitle}
          getKey={(item) => item.id}
          getRowLabel={(item) => `${item.vendor.name} ${item.invoiceNumber}`}
          columns={[
            {
              key: 'invoice',
              header: messages.pcColInvoice,
              primary: true,
              cell: (item) => (
                <div className={item.voidedAt ? 'text-muted-foreground line-through' : undefined}>
                  <AdminNavLink className="tap-inline font-mono font-semibold text-primary hover:underline" href={`/admin/parts/purchases/${item.id}`}>{item.invoiceNumber}</AdminNavLink>
                  {item.voidedAt ? <Badge variant="secondary" className="ml-2 no-underline">{messages.pcVoided}</Badge> : null}
                </div>
              ),
            },
            { key: 'date', header: messages.pcColDate, cell: (item) => formatInvoiceDate(item.invoiceDate, locale) },
            { key: 'vendor', header: messages.pcColVendor, cell: (item) => item.vendor.name },
            { key: 'lines', header: messages.pcColLines, cell: (item) => adminCountLabel(item.lineCount, messages.pcLinesCountOne, messages.pcLinesCount) },
            { key: 'trucks', header: messages.pcColTrucks, cell: (item) => purchaseTrucksLabel(item, messages) },
            {
              key: 'total',
              header: messages.pcColTotal,
              cell: (item) => (
                <span className="flex flex-wrap items-center gap-2">
                  <span className={item.voidedAt ? 'tabular-nums text-muted-foreground line-through' : 'tabular-nums font-medium'}>{formatCents(item.totalCents, locale)}</span>
                  {item.hasFile
                    ? <Paperclip aria-label={messages.pcHasFile} className="size-4 text-muted-foreground" />
                    : <Badge variant="warning">{messages.pcNoInvoiceFile}</Badge>}
                </span>
              ),
            },
          ]}
        />
      ) : null}

      {formOpen && formData && catalog && vendors ? (
        <PurchaseForm
          purchase={null}
          presetTruckId={presetTruckId}
          categories={catalog.categories}
          vendors={vendors}
          formData={formData}
          locale={locale}
          messages={messages}
          onClose={() => { setFormOpen(false); setPresetTruckId(undefined); }}
          onVendorAdded={() => void mutateVendors()}
          onSaved={(id) => { setFormOpen(false); void mutate(); router.push(`/admin/parts/purchases/${id}`); }}
        />
      ) : null}
    </div>
  );
}
