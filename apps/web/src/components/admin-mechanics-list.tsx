'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { UserRole, type AdminMechanicSummaryDto } from '@ltl-shop/shared';
import { useActionToast } from './action-toast';
import { ActivateMechanicDialog, CreateMechanicDialog } from './admin-mechanic-roster';
import { AdminWriteTip } from './admin-write-tip';
import { AdminFilterToolbar, DataTable, PageHeader, Badge, Button, EmptyState, LoadFailure, PageSkeleton } from './ui';
import { useCanShowManagerWrites } from '@/lib/admin-actor';
import { useAdminMechanics } from '@/lib/admin-data';
import { adminCapabilityLabel, type AdminLocale, type AdminMessages } from '@/lib/admin-messages';

export function AdminMechanicsList({ messages }: { locale: AdminLocale; messages: AdminMessages }) {
  // D22: the Shop Manager manages the roster (System Admin too); the Job catalog too (D25).
  const canWrite = useCanShowManagerWrites();
  const { showToast } = useActionToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  // LTR-160: deactivated accounts stay hidden unless the Manager asks to see them (e.g. to reactivate).
  const [showInactive, setShowInactive] = useState(searchParams.get('includeInactive') === 'true');
  const [createOpen, setCreateOpen] = useState(false);
  const [activateTarget, setActivateTarget] = useState<AdminMechanicSummaryDto | null>(null);
  const { data, error, isLoading, size, setSize, mutate, isValidating } = useAdminMechanics(query);

  useEffect(() => {
    setSearch(searchParams.get('search') ?? '');
    setShowInactive(searchParams.get('includeInactive') === 'true');
  }, [searchParams]);

  const items = useMemo(() => data?.flatMap((page) => page.items) ?? [], [data]);
  const hasMore = Boolean(data?.[data.length - 1]?.nextCursor);

  return (
    <div className="space-y-6">
      <PageHeader
        title={messages.mechanicsTitle}
        subtitle={canWrite ? messages.mechanicsWriteDescription : messages.mechanicsDescription}
      />
      {canWrite ? (
        <div className="space-y-3">
          <Button type="button" onClick={() => setCreateOpen(true)}>{messages.createMechanic}</Button>
          <AdminWriteTip testId>{messages.mechanicRosterTip}</AdminWriteTip>
        </div>
      ) : null}
      <AdminFilterToolbar
        search={search}
        onSearchChange={setSearch}
        searchLabel={messages.searchMechanics}
        filtersLabel={messages.filters}
        closeLabel={messages.closeDialog}
        activeFilterCount={searchParams.get('includeInactive') === 'true' ? 1 : 0}
        filters={(
          <label className="flex min-h-11 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap text-sm">
            <input type="checkbox" className="size-5" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} />
            {messages.showInactiveMechanics}
          </label>
        )}
        onClear={() => router.replace('/admin/mechanics')}
        clearLabel={messages.clearFilters}
        applyLabel={messages.applyFilters}
        onSubmit={() => {
          const next = new URLSearchParams();
          if (search.trim()) next.set('search', search.trim());
          if (showInactive) next.set('includeInactive', 'true');
          router.replace(`/admin/mechanics${next.size ? `?${next}` : ''}`);
        }}
      />
      {error ? <LoadFailure message={messages.loadError} retryLabel={messages.retry} onRetry={() => void mutate()} /> : null}
      {isLoading && !data ? <PageSkeleton label={messages.mechanicsTitle} header={false} /> : null}
      {!isLoading && !error && items.length === 0 ? <EmptyState><p>{messages.noMechanicsMatch}</p></EmptyState> : null}
      {items.length ? (
        <DataTable
          items={items}
          caption={messages.mechanicsTitle}
          getKey={(item) => item.id}
          getRowLabel={(item) => item.name}
          columns={[
            {
              key: 'mechanic',
              header: messages.mechanics,
              primary: true,
              cell: (item) => (
                <div className="min-w-0">
                  <Link className="tap-inline font-semibold text-primary hover:underline" href={`/admin/mechanics/${item.id}`}>{item.name}</Link>
                  <p className="break-words text-sm text-muted-foreground">{item.email}</p>
                  {!item.active ? <Badge variant="secondary" className="mt-1">{messages.mechanicInactive}</Badge> : null}
                  {canWrite && item.role === UserRole.MECHANIC && !item.active ? (
                    <div className="mt-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => setActivateTarget(item)}>
                        {messages.activateMechanic}
                      </Button>
                    </div>
                  ) : null}
                </div>
              ),
            },
            {
              key: 'capabilities',
              header: messages.capabilitiesLabel,
              // LTR-169: people-facing names, not keys like mechanic.standard.
              cell: (item) => item.capabilities.length ? (
                <div className="flex flex-wrap gap-1 max-md:justify-end">
                  {item.capabilities.map((capability) => <Badge key={capability} variant="outline">{adminCapabilityLabel(capability, messages)}</Badge>)}
                </div>
              ) : <span>—</span>,
            },
            { key: 'open', header: messages.openAssignments, cell: (item) => <span>{item.openWorkOrderCount}</span> },
          ]}
        />
      ) : null}
      {hasMore ? <Button type="button" variant="outline" disabled={isValidating} onClick={() => setSize(size + 1)}>{messages.loadMore}</Button> : null}
      {canWrite ? (
        <>
          <CreateMechanicDialog
            open={createOpen}
            messages={messages}
            onClose={() => setCreateOpen(false)}
            // D22: the dialog stays open on the temporary-password step; Done closes it.
            onCreated={() => {
              showToast('success', messages.mechanicCreated);
              void mutate();
            }}
          />
          <ActivateMechanicDialog
            mechanic={activateTarget}
            messages={messages}
            onClose={() => setActivateTarget(null)}
            onActivated={() => {
              setActivateTarget(null);
              showToast('success', messages.mechanicActivated);
              void mutate();
            }}
          />
        </>
      ) : null}
    </div>
  );
}
