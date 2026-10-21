'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Paperclip, Plus } from 'lucide-react';
import { formatCents } from '@ltl-shop/shared';
import { AdminNavLink } from './admin-nav-link';
import { OutsideRepairForm } from './admin-outside-repair-form';
import { AdminFilterToolbar, Badge, Button, DataTable, EmptyState, Input, Label, LoadFailure, PageHeader, PageSkeleton, Select } from './ui';
import { useCanShowManagerWrites } from '@/lib/admin-actor';
import { useAdminOutsideRepairs, useAdminPurchaseFormData, useAdminVendors } from '@/lib/admin-data';
import { fillPlaceholders } from '@/lib/admin-next-step';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';
import { formatInvoiceDate } from '@/lib/parts-costs-format';
import { safeAdminPath } from '@/lib/admin-truck-origin';
import { useDebouncedFilterText, useUrlFilters } from '@/lib/use-url-filters';
import { useDocumentTitle } from './admin-breadcrumb';

const OUTSIDE_FILTERS = { q: '', vendorId: '', truckId: '', from: '', to: '', noFile: false };

/**
 * LTR-200 / D32 (PC-3): Parts & costs → Outside repairs. Each row: date, truck, vendor, what was done, the Job tied
 * ("Radiator Repair · WO-001") and the amount. Opened from a Job's "Add outside repair invoice", New outside repair
 * starts with that truck and Job (`?new=1&forTruck=&jobId=&from=`), and closes back to `from` (PCA2). PCA1: the filters
 * live in the URL.
 */
export function AdminOutsideRepairs({ locale, messages }: { locale: AdminLocale; messages: AdminMessages }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const canWrite = useCanShowManagerWrites();
  useDocumentTitle(messages.pcOutsideTitle);
  const { filters, set, setMany, clear, query, here, active: filtered } = useUrlFilters(OUTSIDE_FILTERS);
  const [search, setSearch] = useDebouncedFilterText(filters.q, (next) => set('q', next));
  const { data, error, isLoading, mutate } = useAdminOutsideRepairs(query);
  const { data: formData } = useAdminPurchaseFormData(true);
  const { data: vendors } = useAdminVendors();
  // PCA9 (UX-5-004): only vendors that do outside repairs; an inactive one stays only while it is the filter.
  const vendorOptions = (vendors ?? []).filter((vendor) => (vendor.doesRepairs && vendor.active) || vendor.id === filters.vendorId);
  // PCA13 (UX-5-008): the shared toolbar; on phones the fields live in a "Filters" sheet and apply together.
  const [draft, setDraft] = useState({ vendorId: filters.vendorId, truckId: filters.truckId, from: filters.from, to: filters.to, noFile: filters.noFile });
  useEffect(() => {
    setDraft({ vendorId: filters.vendorId, truckId: filters.truckId, from: filters.from, to: filters.to, noFile: filters.noFile });
  }, [filters.vendorId, filters.truckId, filters.from, filters.to, filters.noFile]);
  const activeFilterCount = [filters.vendorId, filters.truckId, filters.from, filters.to].filter(Boolean).length + (filters.noFile ? 1 : 0);
  const [form, setForm] = useState<{ truckId?: string; jobId?: string } | null>(null);
  const [returnTo, setReturnTo] = useState<string | null>(null);
  const ready = Boolean(formData && vendors);

  // Opened from a Job or a Truck: the form starts with its truck and Job; the address keeps only the filters.
  useEffect(() => {
    if (params.get('new') !== '1' || !canWrite) return;
    setForm({ truckId: params.get('forTruck') ?? undefined, jobId: params.get('jobId') ?? undefined });
    setReturnTo(safeAdminPath(params.get('from')));
    const next = new URLSearchParams(params.toString());
    for (const key of ['new', 'forTruck', 'jobId', 'from']) next.delete(key);
    router.replace(`${pathname}${next.size ? `?${next}` : ''}`, { scroll: false });
  }, [params, canWrite, router, pathname]);

  const newButton = canWrite ? <Button type="button" onClick={() => setForm({})} disabled={!ready}><Plus aria-hidden="true" />{messages.pcNewOutside}</Button> : null;

  return (
    <div className="space-y-6">
      <PageHeader title={messages.pcOutsideTitle} subtitle={messages.pcOutsideSubtitle} actions={newButton} />
      <AdminFilterToolbar
        search={search}
        onSearchChange={setSearch}
        searchLabel={messages.pcSearchOutside}
        searchPlaceholder={messages.pcSearchOutsidePlaceholder}
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
              <Label htmlFor="outside-filter-vendor">{messages.pcFilterVendor}</Label>
              <Select id="outside-filter-vendor" value={draft.vendorId} onChange={(event) => setDraft((current) => ({ ...current, vendorId: event.target.value }))}>
                <option value="">{messages.pcAnyVendor}</option>
                {vendorOptions.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.active ? vendor.name : `${vendor.name} ${messages.pcInactiveSuffix}`}</option>)}
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="outside-filter-truck">{messages.pcFilterTruck}</Label>
              <Select id="outside-filter-truck" value={draft.truckId} onChange={(event) => setDraft((current) => ({ ...current, truckId: event.target.value }))}>
                <option value="">{messages.pcAnyTruck}</option>
                {(formData?.trucks ?? []).map((truck) => <option key={truck.id} value={truck.id}>{fillPlaceholders(messages.pcTruckLabel, { truck: truck.truckNumber })}</option>)}
              </Select>
            </div>
            <div className="min-w-[9.5rem] flex-1 space-y-1">
              <Label htmlFor="outside-filter-from">{messages.pcFrom}</Label>
              <Input id="outside-filter-from" type="date" value={draft.from} onChange={(event) => setDraft((current) => ({ ...current, from: event.target.value }))} />
            </div>
            <div className="min-w-[9.5rem] flex-1 space-y-1">
              <Label htmlFor="outside-filter-to">{messages.pcTo}</Label>
              <Input id="outside-filter-to" type="date" value={draft.to} onChange={(event) => setDraft((current) => ({ ...current, to: event.target.value }))} />
            </div>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" checked={draft.noFile} onChange={(event) => setDraft((current) => ({ ...current, noFile: event.target.checked }))} />
              {messages.pcNoFileFilter}
            </label>
          </>
        )}
      />

      {error ? <LoadFailure message={messages.loadError} retryLabel={messages.retry} onRetry={() => void mutate()} /> : null}
      {isLoading && !data ? <PageSkeleton label={messages.pcOutsideTitle} header={false} /> : null}
      {data ? (
        <p className="text-sm text-muted-foreground" data-testid="outside-summary">
          {fillPlaceholders(messages.pcOutsideSummary, { count: String(data.totals.count), total: formatCents(data.totals.totalCents, locale) })}
        </p>
      ) : null}
      {data && !data.items.length ? (
        <EmptyState>
          <p>{filtered ? messages.pcNoOutsideMatch : messages.pcNoOutside}</p>
          {filtered ? (
            <Button type="button" variant="outline" className="mt-4" onClick={clear}>{messages.pcClearFilters}</Button>
          ) : newButton ? <div className="mt-4 flex justify-center">{newButton}</div> : null}
        </EmptyState>
      ) : null}
      {data?.items.length ? (
        <DataTable
          items={data.items}
          caption={messages.pcOutsideTitle}
          getKey={(item) => item.id}
          getRowLabel={(item) => `${item.vendor.name} ${item.invoiceNumber}`}
          columns={[
            {
              key: 'what',
              header: messages.pcColWhatDone,
              primary: true,
              cell: (item) => (
                <div className={item.voidedAt ? 'text-muted-foreground line-through' : undefined}>
                  <AdminNavLink className="tap-inline font-semibold text-primary hover:underline" href={`/admin/parts/outside-repairs/${item.id}?from=${encodeURIComponent(here)}`}>{item.description}</AdminNavLink>
                  <span className="ml-2 font-mono text-xs text-muted-foreground">{item.invoiceNumber}</span>
                  {item.voidedAt ? <Badge variant="secondary" className="ml-2 no-underline">{messages.pcVoided}</Badge> : null}
                </div>
              ),
            },
            { key: 'date', header: messages.pcColDate, cell: (item) => formatInvoiceDate(item.invoiceDate, locale) },
            { key: 'truck', header: messages.pcColTrucks, cell: (item) => fillPlaceholders(messages.pcTruckLabel, { truck: item.truck.truckNumber }) },
            { key: 'vendor', header: messages.pcColVendor, cell: (item) => item.vendor.name },
            {
              key: 'job',
              header: messages.pcColJob,
              cell: (item) => item.job
                ? <AdminNavLink className="tap-inline text-primary hover:underline" href={`/admin/work-orders/${item.job.workOrderId}`}>{item.job.displayName} · {item.job.workOrderDisplayId}{item.job.kind ? ` · ${item.job.kind === 'truck' ? messages.pcWhatTruck : messages.pcWhatPart}` : ''}</AdminNavLink>
                : <span className="text-muted-foreground">{messages.pcNotLinked}</span>,
            },
            {
              key: 'amount',
              header: messages.pcColAmount,
              cell: (item) => (
                <span className="flex flex-wrap items-center gap-2">
                  <span className={item.voidedAt ? 'tabular-nums text-muted-foreground line-through' : 'tabular-nums font-medium'}>{formatCents(item.amountCents, locale)}</span>
                  {item.hasFile ? <Paperclip aria-label={messages.pcHasFile} className="size-4 text-muted-foreground" /> : <Badge variant="warning">{messages.pcNoInvoiceFile}</Badge>}
                </span>
              ),
            },
          ]}
        />
      ) : null}

      {form && formData && vendors ? (
        <OutsideRepairForm
          repair={null}
          preset={form}
          vendors={vendors}
          formData={formData}
          locale={locale}
          messages={messages}
          onClose={() => { setForm(null); if (returnTo) router.push(returnTo); setReturnTo(null); }}
          // PCA2: opened from a Job or a Truck, saving goes back there; otherwise to the repair.
          onSaved={(id) => { setForm(null); void mutate(); router.push(returnTo ?? `/admin/parts/outside-repairs/${id}?from=${encodeURIComponent(here)}`); setReturnTo(null); }}
        />
      ) : null}
    </div>
  );
}
