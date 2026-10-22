'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Paperclip, Plus } from 'lucide-react';
import { formatCents, type AdminPurchaseSummaryDto } from '@ltl-shop/shared';
import { AdminNavLink } from './admin-nav-link';
import { PurchaseForm } from './admin-purchase-form';
import { AdminFilterToolbar, Badge, Button, DataTable, EmptyState, Input, Label, LoadFailure, PageHeader, PageSkeleton, Select } from './ui';
import { useCanShowManagerWrites } from '@/lib/admin-actor';
import { useAdminPartsCatalog, useAdminPurchaseFormData, useAdminPurchases, useAdminVendors } from '@/lib/admin-data';
import { fillPlaceholders } from '@/lib/admin-next-step';
import { adminCountLabel, type AdminLocale, type AdminMessages } from '@/lib/admin-messages';
import { formatInvoiceDate } from '@/lib/parts-costs-format';
import { safeAdminPath } from '@/lib/admin-truck-origin';
import { useDebouncedFilterText, useUrlFilters } from '@/lib/use-url-filters';
import { useDocumentTitle } from './admin-breadcrumb';

const PURCHASE_FILTERS = { q: '', vendorId: '', truckId: '', from: '', to: '', noFile: false };

export function purchaseTrucksLabel(item: AdminPurchaseSummaryDto, messages: AdminMessages) {
  const trucks = item.trucks.map((truck) => truck.truckNumber);
  if (!trucks.length) return messages.pcNoTruckOption;
  const label = trucks.length === 1 ? fillPlaceholders(messages.pcTruckLabel, { truck: trucks[0] }) : trucks.join(', ');
  return item.hasNoTruckLines ? `${label} + ${messages.pcNoTruckOption}` : label;
}

/**
 * LTR-200 / D32 (PC-2): Parts & costs → Purchases. Newest first; filters by invoice, vendor or part, vendor, truck
 * ("No truck" included), period and "without invoice file". The line above the table totals what is filtered
 * (voided purchases do not count) and what has no truck. PCA1: the filters live in the URL, so Back keeps them.
 * PCA2: `?new=1&forTruck=<id>&from=<path>` opens New purchase for that truck and goes back to `from` when it closes.
 * D45 / ST-1: `&jobId=<id>` (from a Job on the Work Order) ties the first line to that Job.
 */
export function AdminPurchases({ locale, messages }: { locale: AdminLocale; messages: AdminMessages }) {
  const router = useRouter();
  const canWrite = useCanShowManagerWrites();
  useDocumentTitle(messages.pcPurchasesTitle);
  const { filters, set, setMany, clear, query, here, active: filtered } = useUrlFilters(PURCHASE_FILTERS);
  const [search, setSearch] = useDebouncedFilterText(filters.q, (next) => set('q', next));
  const { data, error, isLoading, mutate } = useAdminPurchases(query);
  const [formOpen, setFormOpen] = useState(false);
  const [presetTruckId, setPresetTruckId] = useState<string | undefined>();
  const [presetJobId, setPresetJobId] = useState<string | undefined>();
  const [returnTo, setReturnTo] = useState<string | null>(null);
  const pathname = usePathname();
  const params = useSearchParams();
  // PC-4: "Add purchase" from Truck → Costs opens New purchase with that truck; the address keeps only the filters.
  useEffect(() => {
    if (params.get('new') !== '1' || !canWrite) return;
    setPresetTruckId(params.get('forTruck') ?? undefined);
    setPresetJobId(params.get('jobId') ?? undefined);
    setReturnTo(safeAdminPath(params.get('from')));
    setFormOpen(true);
    const next = new URLSearchParams(params.toString());
    for (const key of ['new', 'forTruck', 'jobId', 'from']) next.delete(key);
    router.replace(`${pathname}${next.size ? `?${next}` : ''}`, { scroll: false });
  }, [params, canWrite, router, pathname]);
  const { data: formData } = useAdminPurchaseFormData(true);
  const { data: catalog, mutate: mutateCatalog } = useAdminPartsCatalog('includeInactive=true');
  const { data: vendors, mutate: mutateVendors } = useAdminVendors();
  // PCA9 (UX-5-004): only vendors that sell parts; an inactive one stays only while it is the filter.
  const vendorOptions = (vendors ?? []).filter((vendor) => (vendor.doesParts && vendor.active) || vendor.id === filters.vendorId);
  // PCA13 (UX-5-008): the shared toolbar; on phones the fields live in a "Filters" sheet and apply together.
  const [draft, setDraft] = useState({ vendorId: filters.vendorId, truckId: filters.truckId, from: filters.from, to: filters.to, noFile: filters.noFile });
  useEffect(() => {
    setDraft({ vendorId: filters.vendorId, truckId: filters.truckId, from: filters.from, to: filters.to, noFile: filters.noFile });
  }, [filters.vendorId, filters.truckId, filters.from, filters.to, filters.noFile]);
  const activeFilterCount = [filters.vendorId, filters.truckId, filters.from, filters.to].filter(Boolean).length + (filters.noFile ? 1 : 0);
  const ready = Boolean(formData && catalog && vendors);
  const newButton = canWrite ? (
    <Button type="button" onClick={() => setFormOpen(true)} disabled={!ready}><Plus aria-hidden="true" />{messages.pcNewPurchase}</Button>
  ) : null;

  return (
    <div className="space-y-6">
      <PageHeader title={messages.pcPurchasesTitle} subtitle={messages.pcPurchasesSubtitle} actions={newButton} />
      <AdminFilterToolbar
        search={search}
        onSearchChange={setSearch}
        searchLabel={messages.pcSearchPurchases}
        searchPlaceholder={messages.pcSearchPurchasesPlaceholder}
        filtersLabel={messages.filters}
        closeLabel={messages.closeDialog}
        clearLabel={messages.pcClearFilters}
        applyLabel={messages.searchAction}
        activeFilterCount={activeFilterCount}
        onClear={clear}
        onSubmit={() => setMany(draft)}
        filters={(
          <>
            <div className="space-y-1">
              <Label htmlFor="purchases-vendor">{messages.pcFilterVendor}</Label>
              <Select id="purchases-vendor" value={draft.vendorId} onChange={(event) => setDraft((current) => ({ ...current, vendorId: event.target.value }))}>
                <option value="">{messages.pcAnyVendor}</option>
                {vendorOptions.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.active ? vendor.name : `${vendor.name} ${messages.pcInactiveSuffix}`}</option>)}
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="purchases-truck">{messages.pcFilterTruck}</Label>
              <Select id="purchases-truck" value={draft.truckId} onChange={(event) => setDraft((current) => ({ ...current, truckId: event.target.value }))}>
                <option value="">{messages.pcAnyTruck}</option>
                <option value="none">{messages.pcNoTruckOption}</option>
                {(formData?.trucks ?? []).map((truck) => <option key={truck.id} value={truck.id}>{fillPlaceholders(messages.pcTruckLabel, { truck: truck.truckNumber })}</option>)}
              </Select>
            </div>
            <div className="min-w-[9.5rem] flex-1 space-y-1">
              <Label htmlFor="purchases-from">{messages.pcFrom}</Label>
              <Input id="purchases-from" type="date" value={draft.from} onChange={(event) => setDraft((current) => ({ ...current, from: event.target.value }))} />
            </div>
            <div className="min-w-[9.5rem] flex-1 space-y-1">
              <Label htmlFor="purchases-to">{messages.pcTo}</Label>
              <Input id="purchases-to" type="date" value={draft.to} onChange={(event) => setDraft((current) => ({ ...current, to: event.target.value }))} />
            </div>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" checked={draft.noFile} onChange={(event) => setDraft((current) => ({ ...current, noFile: event.target.checked }))} />
              {messages.pcNoFileFilter}
            </label>
          </>
        )}
      />

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
            <Button type="button" variant="outline" className="mt-4" onClick={clear}>{messages.pcClearFilters}</Button>
          ) : newButton ? <div className="mt-4 flex justify-center">{newButton}</div> : null}
        </EmptyState>
      ) : null}
      {data?.items.length ? (
        <DataTable
              wholeCardOpens
          items={data.items}
          caption={messages.pcPurchasesTitle}
          getKey={(item) => item.id}
          getRowLabel={(item) => `${item.vendor.name} ${item.invoiceNumber}`}
          columns={[
            {
              key: 'invoice',
              header: messages.pcColInvoice,
              primary: true,
              // UX-4-009: number, date and total stay on one line in a narrow table.
              className: 'whitespace-nowrap',
              cell: (item) => (
                <div className={item.voidedAt ? 'text-muted-foreground line-through' : undefined}>
                  <AdminNavLink className="tap-inline font-mono font-semibold text-primary hover:underline" href={`/admin/parts/purchases/${item.id}?from=${encodeURIComponent(here)}`}>{item.invoiceNumber}</AdminNavLink>
                  {item.voidedAt ? <Badge variant="secondary" className="ml-2 no-underline">{messages.pcVoided}</Badge> : null}
                </div>
              ),
            },
            { key: 'date', header: messages.pcColDate, className: 'whitespace-nowrap', cell: (item) => formatInvoiceDate(item.invoiceDate, locale) },
            { key: 'vendor', header: messages.pcColVendor, cell: (item) => item.vendor.name },
            { key: 'lines', header: messages.pcColLines, cell: (item) => adminCountLabel(item.lineCount, messages.pcLinesCountOne, messages.pcLinesCount) },
            { key: 'trucks', header: messages.pcColTrucks, cell: (item) => purchaseTrucksLabel(item, messages) },
            {
              key: 'total',
              header: messages.pcColTotal,
              className: 'whitespace-nowrap',
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
          presetJobId={presetJobId}
          categories={catalog.categories}
          vendors={vendors}
          formData={formData}
          locale={locale}
          messages={messages}
          onClose={() => { setFormOpen(false); setPresetTruckId(undefined); setPresetJobId(undefined); if (returnTo) router.push(returnTo); setReturnTo(null); }}
          onVendorAdded={() => void mutateVendors()}
          onCatalogChanged={() => mutateCatalog()}
          // PCA2: opened from a Truck's Costs, saving goes back there (where the new cost shows); otherwise to the purchase.
          onSaved={(id) => { setFormOpen(false); void mutate(); router.push(returnTo ?? `/admin/parts/purchases/${id}?from=${encodeURIComponent(here)}`); setReturnTo(null); }}
        />
      ) : null}
    </div>
  );
}
