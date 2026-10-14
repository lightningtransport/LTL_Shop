'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { TruckOperationalStatus } from '@ltl-shop/shared';
import { AdminFilterToolbar, Badge, DataTable, PageHeader, Button, EmptyState, LoadFailure, PageSkeleton, WorkOrderStatusBadge } from './ui';
import { truckNextStepText } from '@/lib/truck-next-step';
import { adminTruckHref } from '@/lib/admin-truck-origin';
import { useAdminTrucks } from '@/lib/admin-data';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';
import { workOrderStatusLabel } from '@/lib/status-chips';
import { formatAdminAgo } from '@/lib/admin-format';
import { fillPlaceholders } from '@/lib/admin-next-step';
import { faultSeverityLabel, faultSeverityVariant } from '@/lib/samsara-view';

export function AdminTrucksList({ locale, messages }: { locale: AdminLocale; messages: AdminMessages }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const { data, error, isLoading, size, setSize, mutate, isValidating } = useAdminTrucks(query);

  useEffect(() => {
    setSearch(searchParams.get('search') ?? '');
  }, [searchParams]);

  const items = useMemo(() => data?.flatMap((page) => page.items) ?? [], [data]);
  const showOperationalStatus = items.some((item) => item.operationalStatus !== TruckOperationalStatus.UNKNOWN);
  // D35 / S-2 + S-3: the Samsara columns appear once a sync has stored something.
  const showSamsara = items.some((item) => item.truck.samsara);
  const hasMore = Boolean(data?.[data.length - 1]?.nextCursor);

  return (
    <div className="space-y-6">
      <PageHeader title={messages.trucksTitle} subtitle={messages.trucksDescription} />
      <AdminFilterToolbar
        search={search}
        onSearchChange={setSearch}
        searchLabel={messages.searchTrucksShort}
        filtersLabel={messages.filters}
        closeLabel={messages.closeDialog}
        onClear={() => router.replace('/admin/trucks')}
        clearLabel={messages.clearFilters}
        applyLabel={messages.searchAction}
        onSubmit={() => {
          const next = new URLSearchParams();
          if (search.trim()) next.set('search', search.trim());
          router.replace(`/admin/trucks${next.size ? `?${next}` : ''}`);
        }}
      />
      {error ? <LoadFailure message={messages.loadError} retryLabel={messages.retry} onRetry={() => void mutate()} /> : null}
      {isLoading && !data ? <PageSkeleton label={messages.trucksTitle} header={false} /> : null}
      {!isLoading && !error && items.length === 0 ? <EmptyState><p>{messages.noTrucksMatch}</p></EmptyState> : null}
      {items.length ? (
        // LTR-169: what matters first (Truck, its Work Order, the next step); make and company last and
        // only from md, since every Truck is Lightning Transport today.
        <DataTable
          items={items}
          caption={messages.trucksTitle}
          getKey={(item) => item.truck.id}
          getRowLabel={(item) => item.truck.truckNumber}
          columns={[
            {
              key: 'truck',
              header: messages.trucks,
              primary: true,
              cell: (item) => (
                <div>
                  <Link className="tap-inline font-semibold text-primary hover:underline" href={adminTruckHref(item.truck.id, '/admin/trucks')}>{item.truck.truckNumber}</Link>
                  <p className="text-sm text-muted-foreground">{[item.truck.year, item.truck.model].filter(Boolean).join(' ') || '—'}</p>
                </div>
              ),
            },
            ...(showSamsara ? [
              {
                key: 'faults',
                header: messages.trucksColFaults,
                testId: 'truck-faults-cell',
                cell: (item: (typeof items)[number]) => {
                  // S3-4: a badge only when a dash light is on or a code lit check engine; other codes are just counted.
                  const codes = item.faults?.active ?? 0;
                  const count = codes ? <span className="text-xs text-muted-foreground">{codes === 1 ? messages.faultsOneCode : fillPlaceholders(messages.faultsCodes, { count: String(codes) })}</span> : null;
                  if (item.faults?.worst) {
                    return (
                      <Link className="inline-flex flex-wrap items-center gap-1" href={`${adminTruckHref(item.truck.id, '/admin/trucks')}&tab=faults`}>
                        <Badge variant={faultSeverityVariant(item.faults.worst)}>{faultSeverityLabel(item.faults.worst, messages)}</Badge>
                        {count}
                      </Link>
                    );
                  }
                  if (codes) return <Link href={`${adminTruckHref(item.truck.id, '/admin/trucks')}&tab=faults`}>{count}</Link>;
                  return <span className="text-muted-foreground">{item.truck.samsara ? messages.faultsNone : '—'}</span>;
                },
              },
              {
                key: 'location',
                header: messages.trucksColLocation,
                hideOnMobile: true,
                cell: (item: (typeof items)[number]) => item.truck.samsara?.locationAt ? (
                  <div>
                    <p>{item.truck.location ?? '—'}</p>
                    <p className="text-xs text-muted-foreground">{formatAdminAgo(item.truck.samsara.locationAt, locale)}</p>
                  </div>
                ) : <span className="text-muted-foreground">—</span>,
              },
            ] : []),
            {
              key: 'work-order',
              header: messages.currentWorkOrder,
              cell: (item) => item.openWorkOrder ? (
                <div className="space-y-1">
                  <Link className="tap-inline font-medium text-primary hover:underline" href={`/admin/work-orders/${item.openWorkOrder.id}`}>{item.openWorkOrder.displayId}</Link>
                  {/* LTR-189 (W4): a <div>, not a <p> — the badge is a block element and <p> cannot contain it (hydration error). */}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground max-md:justify-end">
                    <span>{item.openWorkOrder.primaryCategoryName}</span>
                    <WorkOrderStatusBadge status={item.openWorkOrder.status}>{workOrderStatusLabel(item.openWorkOrder.status, messages)}</WorkOrderStatusBadge>
                  </div>
                </div>
              ) : <span className="text-muted-foreground">{messages.noOpenWorkOrder}</span>,
            },
            {
              key: 'next-step',
              header: messages.nextStepTitle,
              testId: 'truck-next-step-cell',
              cell: (item) => <span>{item.nextStep && item.nextStep.kind !== 'create_work_order' ? truckNextStepText(item.nextStep, messages) : '—'}</span>,
            },
            // LTR-111: hide the column while every truck is Unknown (no service-status events yet).
            ...(showOperationalStatus ? [{
              key: 'status',
              header: messages.operationalStatus,
              cell: (item: (typeof items)[number]) => (
                <span className="text-muted-foreground">
                  {/* LTR-159: "In Service" contradicts an open Work Order; show nothing then. */}
                  {item.openWorkOrder && item.operationalStatus === TruckOperationalStatus.IN_SERVICE
                    ? '—'
                    : item.operationalStatus === TruckOperationalStatus.IN_SERVICE
                      ? messages.operationalStatusInService
                      : item.operationalStatus === TruckOperationalStatus.OFF_DUTY
                        ? messages.operationalStatusOffDuty
                        : messages.operationalStatusUnknown}
                </span>
              ),
            }] : []),
            { key: 'make', header: messages.make, hideOnMobile: true, cell: (item) => <span className="text-muted-foreground">{item.truck.make ?? '—'}</span> },
            { key: 'company', header: messages.company, hideOnMobile: true, cell: (item) => <span className="text-muted-foreground">{item.truck.company ?? '—'}</span> },
          ]}
        />
      ) : null}
      {hasMore ? <Button type="button" variant="outline" disabled={isValidating} onClick={() => setSize(size + 1)}>{messages.loadMore}</Button> : null}
    </div>
  );
}
