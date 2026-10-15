'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { TruckOperationalStatus, type AdminTruckSummaryDto } from '@ltl-shop/shared';
import { AdminFilterToolbar, Badge, DataTable, PageHeader, Button, EmptyState, LoadFailure, PageSkeleton, Select, WorkOrderStatusBadge } from './ui';
import { useActionToast } from './action-toast';
import { TruckFormDialog } from './admin-truck-admin';
import { useCanShowManagerWrites } from '@/lib/admin-actor';
import { truckNextStepText } from '@/lib/truck-next-step';
import { adminTruckHref } from '@/lib/admin-truck-origin';
import { useAdminTrucks } from '@/lib/admin-data';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';
import { workOrderStatusLabel } from '@/lib/status-chips';
import { formatAdminAgo } from '@/lib/admin-format';
import { fillPlaceholders } from '@/lib/admin-next-step';
import { formatVehicleYmm } from '@/lib/format';
import { faultSeverityLabel, faultSeverityVariant, isStaleLocation, shortLocation } from '@/lib/samsara-view';
import { cn } from '@/lib/utils';

/**
 * Admin → Trucks. TL-1…TL-8 (OPEN_ISSUES §1z, ux-audit/admin-trucks-list): four columns in the order the Manager reads
 * them — the truck, its shop work (Work Order, status and next step together), Samsara faults, and where it is.
 * Company and operational status stay on the Truck page: they were the same for almost every truck.
 */
export function AdminTrucksList({ locale, messages }: { locale: AdminLocale; messages: AdminMessages }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  // D44: deactivated trucks are hidden unless the Manager asks for them.
  const statusFrom = (params: URLSearchParams) => {
    const value = params.get('status');
    return value === 'inactive' || value === 'all' ? value : 'active';
  };
  const [status, setStatus] = useState<'active' | 'inactive' | 'all'>(statusFrom(searchParams));
  const [addOpen, setAddOpen] = useState(false);
  const canWrite = useCanShowManagerWrites();
  const { showToast } = useActionToast();
  const { data, error, isLoading, size, setSize, mutate, isValidating } = useAdminTrucks(query);

  useEffect(() => {
    setSearch(searchParams.get('search') ?? '');
    setStatus(statusFrom(searchParams));
  }, [searchParams]);

  const items = useMemo(() => data?.flatMap((page) => page.items) ?? [], [data]);
  // D35 / S-2 + S-3: the Samsara columns appear once a sync has stored something.
  const showSamsara = items.some((item) => item.truck.samsara);
  const hasMore = Boolean(data?.[data.length - 1]?.nextCursor);
  const faultsHref = (item: AdminTruckSummaryDto) => `${adminTruckHref(item.truck.id, '/admin/trucks')}&tab=faults`;

  return (
    <div className="space-y-6">
      <PageHeader
        title={messages.trucksTitle}
        subtitle={messages.trucksDescription}
        actions={canWrite ? <Button type="button" onClick={() => setAddOpen(true)}>{messages.truckAdd}</Button> : null}
      />
      <AdminFilterToolbar
        search={search}
        onSearchChange={setSearch}
        searchLabel={messages.searchTrucksShort}
        filtersLabel={messages.filters}
        closeLabel={messages.closeDialog}
        activeFilterCount={statusFrom(searchParams) === 'active' ? 0 : 1}
        filters={(
          <label className="flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap text-sm">
            {messages.trucksShow}
            <Select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="w-auto" data-testid="trucks-status-filter">
              <option value="active">{messages.trucksShowActive}</option>
              <option value="inactive">{messages.trucksShowInactive}</option>
              <option value="all">{messages.trucksShowAll}</option>
            </Select>
          </label>
        )}
        onClear={() => router.replace('/admin/trucks')}
        clearLabel={messages.clearFilters}
        applyLabel={messages.searchAction}
        onSubmit={() => {
          const next = new URLSearchParams();
          if (search.trim()) next.set('search', search.trim());
          if (status !== 'active') next.set('status', status);
          router.replace(`/admin/trucks${next.size ? `?${next}` : ''}`);
        }}
      />
      {error ? <LoadFailure message={messages.loadError} retryLabel={messages.retry} onRetry={() => void mutate()} /> : null}
      {isLoading && !data ? <PageSkeleton label={messages.trucksTitle} header={false} /> : null}
      {!isLoading && !error && items.length === 0 ? <EmptyState><p>{messages.noTrucksMatch}</p></EmptyState> : null}
      {items.length ? (
        <DataTable
          items={items}
          caption={messages.trucksTitle}
          getKey={(item) => item.truck.id}
          getRowLabel={(item) => item.truck.truckNumber}
          columns={[
            {
              key: 'truck',
              header: messages.truck,
              primary: true,
              className: 'md:min-w-[15rem]',
              // TL-2: the vehicle once, year make model, under the number (no Make column).
              cell: (item) => (
                <div>
                  <Link className="tap-inline font-semibold text-primary hover:underline" href={adminTruckHref(item.truck.id, '/admin/trucks')}>{item.truck.truckNumber}</Link>
                  <p className="text-sm text-muted-foreground">{formatVehicleYmm(item.truck) || '—'}</p>
                  {item.truck.deactivatedAt || item.samsaraProposedVehicleId ? (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {item.truck.deactivatedAt ? <Badge variant="secondary">{messages.truckInactiveBadge}</Badge> : null}
                      {/* D44: the sync proposes a Samsara vehicle (exact VIN); the Manager connects it on the truck. */}
                      {item.samsaraProposedVehicleId && !item.truck.deactivatedAt ? <Badge variant="default" data-testid="truck-samsara-proposed">{messages.trucksProposedChip}</Badge> : null}
                    </div>
                  ) : null}
                </div>
              ),
            },
            {
              key: 'work',
              header: messages.trucksColWork,
              testId: 'truck-next-step-cell',
              className: 'md:min-w-[18rem]',
              // TL-1, TL-5: the Work Order and its status on one line, the next step under it.
              cell: (item) => <WorkCell item={item} messages={messages} />,
            },
            ...(showSamsara ? [
              {
                key: 'faults',
                header: messages.trucksColFaults,
                testId: 'truck-faults-cell',
                className: 'whitespace-nowrap',
                emptyOnMobile: (item: AdminTruckSummaryDto) => !item.faults?.worst && !item.faults?.active,
                cell: (item: AdminTruckSummaryDto) => <FaultsCell item={item} href={faultsHref(item)} messages={messages} />,
              },
              {
                key: 'location',
                header: messages.trucksColLocation,
                className: 'md:min-w-[11rem]',
                emptyOnMobile: (item: AdminTruckSummaryDto) => !item.truck.samsara?.locationAt,
                cell: (item: AdminTruckSummaryDto) => <LocationCell item={item} locale={locale} messages={messages} />,
              },
            ] : []),
          ]}
        />
      ) : null}
      {hasMore ? <Button type="button" variant="outline" disabled={isValidating} onClick={() => setSize(size + 1)}>{messages.loadMore}</Button> : null}
      {canWrite ? (
        <TruckFormDialog
          open={addOpen}
          messages={messages}
          onClose={() => setAddOpen(false)}
          onSaved={(truck) => {
            setAddOpen(false);
            showToast('success', fillPlaceholders(messages.truckCreated, { truck: truck.truckNumber }));
            void mutate();
            router.push(adminTruckHref(truck.id, '/admin/trucks'));
          }}
        />
      ) : null}
    </div>
  );
}

function WorkCell({ item, messages }: { item: AdminTruckSummaryDto; messages: AdminMessages }) {
  const next = item.nextStep && item.nextStep.kind !== 'create_work_order' ? truckNextStepText(item.nextStep, messages) : null;
  // TL-3: "In Service" only when it says something (no open Work Order and the truck is back on the road).
  const inService = !item.openWorkOrder && item.operationalStatus === TruckOperationalStatus.IN_SERVICE;
  return (
    <div className="space-y-1">
      {item.openWorkOrder ? (
        <div className="flex flex-wrap items-center gap-2 max-md:justify-end">
          <Link className="tap-inline font-medium text-primary hover:underline" href={`/admin/work-orders/${item.openWorkOrder.id}`}>{item.openWorkOrder.displayId}</Link>
          <WorkOrderStatusBadge status={item.openWorkOrder.status}>{workOrderStatusLabel(item.openWorkOrder.status, messages)}</WorkOrderStatusBadge>
        </div>
      ) : !next ? (
        <span className="flex flex-wrap items-center gap-2 text-muted-foreground max-md:justify-end">
          {messages.noOpenWorkOrder}
          {inService ? <Badge variant="success">{messages.operationalStatusInService}</Badge> : null}
        </span>
      ) : null}
      {next ? <p className={cn('line-clamp-2 text-sm', item.openWorkOrder ? 'text-muted-foreground' : 'text-foreground')}>{next}</p> : null}
    </div>
  );
}

function FaultsCell({ item, href, messages }: { item: AdminTruckSummaryDto; href: string; messages: AdminMessages }) {
  // TL-6: color only for STOP, Warning and Check engine; codes that light nothing in gray; "—" when not in Samsara.
  const codes = item.faults?.active ?? 0;
  const count = codes ? <span className="text-xs text-muted-foreground">{codes === 1 ? messages.faultsOneCode : fillPlaceholders(messages.faultsCodes, { count: String(codes) })}</span> : null;
  if (item.faults?.worst) {
    return (
      <Link className="inline-flex flex-wrap items-center gap-1.5" href={href}>
        <Badge variant={faultSeverityVariant(item.faults.worst)}>{faultSeverityLabel(item.faults.worst, messages)}</Badge>
        {count}
      </Link>
    );
  }
  if (codes) return <Link href={href}>{count}</Link>;
  return <span className="text-muted-foreground" title={item.truck.samsara ? undefined : messages.trucksNotInSamsara}>—</span>;
}

function LocationCell({ item, locale, messages }: { item: AdminTruckSummaryDto; locale: AdminLocale; messages: AdminMessages }) {
  const at = item.truck.samsara?.locationAt ?? null;
  if (!at) return <span className="text-muted-foreground" title={messages.trucksNotInSamsara}>—</span>;
  const ago = formatAdminAgo(at, locale);
  const stale = isStaleLocation(at);
  // TL-4, TL-7: city and state, how old; older than a day reads "No signal" in amber. Full address in the title.
  return (
    <div title={item.truck.location ?? undefined}>
      <p>{shortLocation(item.truck.location) ?? '—'}</p>
      <p className={cn('text-xs', stale ? 'font-medium text-warning-foreground' : 'text-muted-foreground')}>
        {stale ? fillPlaceholders(messages.trucksLocationNoSignal, { ago }) : ago}
      </p>
    </div>
  );
}
