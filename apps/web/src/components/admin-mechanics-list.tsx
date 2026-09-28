'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { UserRole, type AdminMechanicSummaryDto } from '@ltl-shop/shared';
import { useActionToast } from './action-toast';
import { ActivateMechanicDialog, CreateMechanicDialog } from './admin-mechanic-roster';
import { AdminWriteTip } from './admin-write-tip';
import { AdminFilterToolbar, AdminPageHeader, Badge, Button, EmptyState, Input, LoadFailure, PageSkeleton } from './ui';
import { useCanShowAdminWrites } from '@/lib/admin-actor';
import { useAdminMechanics } from '@/lib/admin-data';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';

export function AdminMechanicsList({ messages }: { locale: AdminLocale; messages: AdminMessages }) {
  const canWrite = useCanShowAdminWrites();
  const { showToast } = useActionToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  // LTR-160: deactivated accounts stay hidden unless the System Admin asks to see them (e.g. to reactivate).
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
    <div className="space-y-5">
      <AdminPageHeader
        eyebrow={messages.eyebrow}
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
        onClear={() => router.replace('/admin/mechanics')}
        clearLabel={messages.clearFilters}
        applyLabel={messages.applyFilters}
        onSubmit={(event) => {
          event.preventDefault();
          const next = new URLSearchParams();
          if (search.trim()) next.set('search', search.trim());
          if (showInactive) next.set('includeInactive', 'true');
          router.replace(`/admin/mechanics${next.size ? `?${next}` : ''}`);
        }}
      >
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={messages.searchMechanics} aria-label={messages.searchMechanics} />
        <label className="flex shrink-0 items-center gap-2 whitespace-nowrap text-sm">
          <input type="checkbox" className="size-4" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} />
          {messages.showInactiveMechanics}
        </label>
      </AdminFilterToolbar>
      {error ? <LoadFailure message={messages.loadError} retryLabel={messages.retry} onRetry={() => void mutate()} /> : null}
      {isLoading && !data ? <PageSkeleton label={messages.mechanicsTitle} /> : null}
      {!isLoading && !error && items.length === 0 ? <EmptyState><p>{messages.noMechanicsMatch}</p></EmptyState> : null}
      {items.length ? (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="p-3 font-medium">{messages.mechanics}</th>
                <th className="p-3 font-medium">{messages.capabilitiesLabel}</th>
                <th className="p-3 font-medium">{messages.openAssignments}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="p-3">
                    <Link className="font-semibold text-primary hover:underline" href={`/admin/mechanics/${item.id}`}>{item.name}</Link>
                    <p className="text-muted-foreground">{item.email}</p>
                    {!item.active ? <Badge variant="secondary">{messages.mechanicInactive}</Badge> : null}
                    {canWrite && item.role === UserRole.MECHANIC && !item.active ? (
                      <div className="mt-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => setActivateTarget(item)}>
                          {messages.activateMechanic}
                        </Button>
                      </div>
                    ) : null}
                  </td>
                  <td className="p-3 text-muted-foreground">{item.capabilities.join(', ') || '—'}</td>
                  <td className="p-3">{item.openWorkOrderCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {hasMore ? <Button type="button" variant="outline" disabled={isValidating} onClick={() => setSize(size + 1)}>{messages.loadMore}</Button> : null}
      {canWrite ? (
        <>
          <CreateMechanicDialog
            open={createOpen}
            messages={messages}
            onClose={() => setCreateOpen(false)}
            onCreated={() => {
              setCreateOpen(false);
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
