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
import { adminListFromPath, adminTruckHref, adminWorkOrderHref } from '@/lib/admin-truck-origin';
import { useAdminTrucks } from '@/lib/admin-data';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';
import { workOrderStatusLabel } from '@/lib/status-chips';
import { formatAdminAgo } from '@/lib/admin-format';
import { fillPlaceholders } from '@/lib/admin-next-step';
import { formatVehicleYmm } from '@/lib/format';
import { faultSeverityLabel, faultSeverityVariant, isOpenWorkOrderStatus, isStaleLocation, shortLocation, yardPlaceText } from '@/lib/samsara-view';
import { cn } from '@/lib/utils';
import { useDocumentTitle } from './admin-breadcrumb';

/**
 * Admin → Trucks. TL-1…TL-8 (OPEN_ISSUES §1z, ux-audit/admin-trucks-list): four columns in the order the Manager reads
 * them — the truck, its shop work (Work Order, status and next step together), Samsara faults, and where it is.
 * Company and operational status stay on the Truck page: they were the same for almost every truck.
 */
export function AdminTrucksList({ locale, messages }: { locale: AdminLocale; messages: AdminMessages }) {
  // LTR-293 §10: the browser tab says which screen this is.
  useDocumentTitle(messages.trucksTitle);
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
  // D49 (LTR-257): only the trucks in our yard, or in the yard with an open Work Order (the shop).
  const placeFrom = (params: URLSearchParams) => {
    const value = params.get('place');
    return value === 'in_yard' || value === 'in_shop' || value === 'in_yard_no_wo' ? value : '';
  };
  const [place, setPlace] = useState<'' | 'in_yard' | 'in_shop' | 'in_yard_no_wo'>(placeFrom(searchParams));
  const [addOpen, setAddOpen] = useState(false);
  const canWrite = useCanShowManagerWrites();
  const { showToast } = useActionToast();
  const { data, error, isLoading, size, setSize, mutate, isValidating } = useAdminTrucks(query);
  // LTR-245 (UX-5-008): the Truck and the Work Order come back here with the same search and filters.
  const fromPath = adminListFromPath('/admin/trucks', query);

  useEffect(() => {
    setSearch(searchParams.get('search') ?? '');
    setStatus(statusFrom(searchParams));
    setPlace(placeFrom(searchParams));
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
        activeFilterCount={(statusFrom(searchParams) === 'active' ? 0 : 1) + (placeFrom(searchParams) ? 1 : 0)}
        filters={(
          <>
            <label className="block min-w-[12rem] flex-1 space-y-2 text-sm font-medium">
              <span className="block">{messages.trucksShow}</span>
              <Select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} data-testid="trucks-status-filter">
                <option value="active">{messages.trucksShowActive}</option>
                <option value="inactive">{messages.trucksShowInactive}</option>
                <option value="all">{messages.trucksShowAll}</option>
              </Select>
            </label>
            <label className="block min-w-[12rem] flex-1 space-y-2 text-sm font-medium">
              <span className="block">{messages.trucksWhere}</span>
              <Select value={place} onChange={(event) => setPlace(event.target.value as typeof place)} data-testid="trucks-place-filter">
                <option value="">{messages.trucksWhereAnywhere}</option>
                <option value="in_yard">{messages.trucksWhereInYard}</option>
                <option value="in_shop">{messages.trucksWhereInShop}</option>
                <option value="in_yard_no_wo">{messages.trucksWhereInYardNoWo}</option>
              </Select>
            </label>
          </>
        )}
        onClear={() => router.replace('/admin/trucks')}
        clearLabel={messages.clearFilters}
        // LTR-236 / LTR-189: a list with extra filters (D44 added Show) says "Apply filters", like People and Work Orders.
        applyLabel={messages.applyFilters}
        onSubmit={() => {
          const next = new URLSearchParams();
          if (search.trim()) next.set('search', search.trim());
          if (status !== 'active') next.set('status', status);
          if (place) next.set('place', place);
          router.replace(`/admin/trucks${next.size ? `?${next}` : ''}`);
        }}
      />
      {error ? <LoadFailure message={messages.loadError} retryLabel={messages.retry} onRetry={() => void mutate()} /> : null}
      {isLoading && !data ? <PageSkeleton label={messages.trucksTitle} header={false} table /> : null}
      {!isLoading && !error && items.length === 0 ? <EmptyState><p>{messages.noTrucksMatch}</p>{/* LTR-293 §11: an empty filtered list offers the way out. */}{searchParams.toString() ? <Button type="button" variant="outline" className="mt-4" onClick={() => router.replace('/admin/trucks')}>{messages.pcClearFilters}</Button> : null}</EmptyState> : null}
      {items.length ? (
        <DataTable
              wholeCardOpens
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
                  <Link className="tap-inline font-semibold text-primary hover:underline" href={adminTruckHref(item.truck.id, fromPath)}>{item.truck.truckNumber}</Link>
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
              cell: (item) => <WorkCell item={item} messages={messages} fromPath={fromPath} />,
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

function WorkCell({ item, messages, fromPath }: { item: AdminTruckSummaryDto; messages: AdminMessages; fromPath: string }) {
  const next = item.nextStep && item.nextStep.kind !== 'create_work_order' ? truckNextStepText(item.nextStep, messages) : null;
  // TL-3: "In Service" only when it says something (no open Work Order and the truck is back on the road).
  const inService = !item.openWorkOrder && item.operationalStatus === TruckOperationalStatus.IN_SERVICE;
  return (
    <div className="space-y-1">
      {item.openWorkOrder ? (
        <div className="flex flex-wrap items-center gap-2 max-md:justify-end">
          <Link className="tap-inline font-medium text-primary hover:underline" href={adminWorkOrderHref(item.openWorkOrder.id, fromPath)}>{item.openWorkOrder.displayId}</Link>
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
  const yardPlace = yardPlaceText(item.truck.samsara, isOpenWorkOrderStatus(item.openWorkOrder?.status), locale, messages);
  // TL-4, TL-7: city and state, how old; older than a day reads "No signal" in amber. Full address in the title.
  // D49: in our yard it reads "In yard · since …" ("In shop" with an open Work Order); in another geofence, its name.
  return (
    <div title={item.truck.location ?? undefined}>
      {yardPlace
        ? <p className="font-medium text-success" data-testid="truck-yard-place">{yardPlace}</p>
        : <p>{item.truck.samsara?.geofenceName ?? shortLocation(item.truck.location) ?? '—'}</p>}
      <p className={cn('text-xs', stale ? 'font-medium text-warning-foreground' : 'text-muted-foreground')}>
        {stale ? fillPlaceholders(messages.trucksLocationNoSignal, { ago }) : ago}
      </p>
    </div>
  );
}
