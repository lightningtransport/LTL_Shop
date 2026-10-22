'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { UserRole, type AdminMechanicSummaryDto } from '@ltl-shop/shared';
import { useActionToast } from './action-toast';
import { ActivateMechanicDialog, CreateMechanicDialog } from './admin-mechanic-roster';
import { stepLabel } from './admin-shop-workflow';
import { currentMode } from './admin-mechanic-roster';
import { AdminFilterToolbar, DataTable, PageHeader, Badge, Button, EmptyState, LoadFailure, PageSkeleton, Select } from './ui';
import { useCanShowManagerWrites, useIsSystemAdmin } from '@/lib/admin-actor';
import { useAdminMechanics } from '@/lib/admin-data';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';
import { MechanicMode } from '@ltl-shop/shared';
import { useDocumentTitle } from './admin-breadcrumb';

/** ME5: Standard, PM, Safety — or System Admin for an admin row on the roster. */
export function personTypeLabel(person: Pick<AdminMechanicSummaryDto, 'role' | 'capabilities'>, messages: AdminMessages) {
  if (person.role === UserRole.ADMIN) return messages.peopleSystemAdminType;
  // LTR-253 / D48: People lists the Shop Managers too.
  if (person.role === UserRole.MANAGER) return messages.roleLabelManager;
  const mode = currentMode(person.capabilities);
  return mode === MechanicMode.PM ? messages.mechanicPm : mode === MechanicMode.SAFETY ? messages.capabilitySafety : messages.mechanicStandard;
}

export function AdminMechanicsList({ messages }: { locale: AdminLocale; messages: AdminMessages }) {
  // LTR-293 §10: the browser tab says which screen this is.
  useDocumentTitle(messages.mechanicsTitle);
  // D22: the Shop Manager manages the roster (System Admin too); the Job catalog too (D25).
  const canWrite = useCanShowManagerWrites();
  // LTR-253 / D48: only a System Admin adds Shop Managers and System Admins.
  const isSystemAdmin = useIsSystemAdmin();
  const { showToast } = useActionToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  // LTR-160: deactivated accounts stay hidden unless the Manager asks to see them (e.g. to reactivate).
  // LTR-199 / D31: removed people show only under "Removed from the Shop".
  // DM2 (LTR-204): the select reads whatever the URL asked the API for. Apply writes `includeInactive=true`; a link
  // or a typed `?status=all` (or `all_in_shop`, `inactive`) also lists inactive people, so it reads "Active and inactive".
  const showFrom = (params: URLSearchParams): 'active' | 'all' | 'removed' => {
    const status = params.get('status');
    if (status === 'removed') return 'removed';
    if (status === 'all' || status === 'all_in_shop' || status === 'inactive' || params.get('includeInactive') === 'true') return 'all';
    return 'active';
  };
  const [show, setShow] = useState(showFrom(searchParams));
  const [createOpen, setCreateOpen] = useState(false);
  const [activateTarget, setActivateTarget] = useState<AdminMechanicSummaryDto | null>(null);
  const { data, error, isLoading, size, setSize, mutate, isValidating } = useAdminMechanics(query);

  useEffect(() => {
    setSearch(searchParams.get('search') ?? '');
    setShow(showFrom(searchParams));
  }, [searchParams]);

  const items = useMemo(() => data?.flatMap((page) => page.items) ?? [], [data]);
  const hasMore = Boolean(data?.[data.length - 1]?.nextCursor);

  return (
    <div className="space-y-6">
      <PageHeader
        title={messages.mechanicsTitle}
        subtitle={canWrite ? (isSystemAdmin ? messages.mechanicsWriteDescriptionAdmin : messages.mechanicsWriteDescription) : messages.mechanicsDescription}
        actions={canWrite ? <Button type="button" onClick={() => setCreateOpen(true)}>{messages.createMechanic}</Button> : undefined}
      />
      <AdminFilterToolbar
        search={search}
        onSearchChange={setSearch}
        searchLabel={messages.searchMechanics}
        filtersLabel={messages.filters}
        closeLabel={messages.closeDialog}
        activeFilterCount={showFrom(searchParams) === 'active' ? 0 : 1}
        filters={(
          <label className="block min-w-[12rem] flex-1 space-y-2 text-sm font-medium">
            <span className="block">{messages.peopleShow}</span>
            <Select value={show} onChange={(event) => setShow(event.target.value as typeof show)}>
              <option value="active">{messages.peopleShowActive}</option>
              <option value="all">{messages.peopleShowActiveInactive}</option>
              <option value="removed">{messages.peopleShowRemoved}</option>
            </Select>
          </label>
        )}
        onClear={() => router.replace('/admin/mechanics')}
        clearLabel={messages.clearFilters}
        applyLabel={messages.applyFilters}
        onSubmit={() => {
          const next = new URLSearchParams();
          if (search.trim()) next.set('search', search.trim());
          if (show === 'all') next.set('includeInactive', 'true');
          if (show === 'removed') next.set('status', 'removed');
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
                  {item.removedAt ? <Badge variant="secondary" className="mt-1">{messages.peopleRemovedBadge}</Badge>
                    : !item.active ? <Badge variant="secondary" className="mt-1">{messages.mechanicInactive}</Badge> : null}
                  {canWrite && item.role === UserRole.MECHANIC && !item.active && !item.removedAt ? (
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
              key: 'type',
              header: messages.peopleTypeColumn,
              // ME5: one type per person, in people-facing words (LTR-169), not a list of permissions.
              cell: (item) => <Badge variant="outline">{personTypeLabel(item, messages)}</Badge>,
            },
            {
              key: 'teams',
              header: messages.peopleTeamsColumn,
              cell: (item) => item.teamStepKeys?.length ? (
                <div className="flex flex-wrap gap-1 max-md:justify-end">
                  {item.teamStepKeys.map((stepKey) => <Badge key={stepKey} variant="secondary">{stepLabel(stepKey, messages)}</Badge>)}
                </div>
              ) : <span className="text-muted-foreground">—</span>,
            },
            { key: 'pending', header: messages.peoplePendingColumn, cell: (item) => <span>{item.pendingJobCount ?? item.openWorkOrderCount}</span> },
          ]}
        />
      ) : null}
      {items.length ? <p className="text-xs text-muted-foreground">{messages.peoplePendingHint}</p> : null}
      {hasMore ? <Button type="button" variant="outline" disabled={isValidating} onClick={() => setSize(size + 1)}>{messages.loadMore}</Button> : null}
      {canWrite ? (
        <>
          <CreateMechanicDialog
            open={createOpen}
            messages={messages}
            allowStaff={isSystemAdmin}
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
