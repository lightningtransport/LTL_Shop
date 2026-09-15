'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { AdminFilterToolbar, AdminPageHeader, EmptyState, LoadFailure, PageSkeleton } from './ui/composites';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { useAdminMechanics } from '@/lib/admin-data';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';

export function AdminMechanicsList({ locale, messages }: { locale: AdminLocale; messages: AdminMessages }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const { data, error, isLoading, size, setSize, mutate, isValidating } = useAdminMechanics(query);

  useEffect(() => {
    setSearch(searchParams.get('search') ?? '');
  }, [searchParams]);

  const items = useMemo(() => data?.flatMap((page) => page.items) ?? [], [data]);
  const hasMore = Boolean(data?.[data.length - 1]?.nextCursor);

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader eyebrow={messages.eyebrow} title={messages.mechanicsTitle} subtitle={messages.mechanicsDescription} />
      <AdminFilterToolbar
        onClear={() => router.replace('/admin/mechanics')}
        clearLabel={messages.clearFilters}
        applyLabel={messages.applyFilters}
        onSubmit={(event) => {
          event.preventDefault();
          const next = new URLSearchParams();
          if (search.trim()) next.set('search', search.trim());
          router.replace(`/admin/mechanics${next.size ? `?${next}` : ''}`);
        }}
      >
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={messages.searchMechanics} aria-label={messages.searchMechanics} />
      </AdminFilterToolbar>
      {error ? <LoadFailure message={messages.loadError} retryLabel={messages.retry} onRetry={() => void mutate()} /> : null}
      {isLoading && !data ? <PageSkeleton label={messages.mechanicsTitle} /> : null}
      {!isLoading && !error && items.length === 0 ? <EmptyState><p>{messages.noMechanicsMatch}</p></EmptyState> : null}
      {items.length ? (
        <div className="rounded-xl border">
          <Table className="min-w-[40rem]">
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="px-3">{messages.mechanics}</TableHead>
                <TableHead className="px-3">{messages.capabilitiesLabel}</TableHead>
                <TableHead className="px-3">{messages.openAssignments}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="p-3">
                    <Link className="font-semibold text-primary hover:underline" href={`/admin/mechanics/${item.id}`}>{item.name}</Link>
                    <p className="text-muted-foreground">{item.email}</p>
                    {!item.active ? <Badge variant="secondary">{messages.mechanicInactive}</Badge> : null}
                  </TableCell>
                  <TableCell className="p-3 text-muted-foreground">{item.capabilities.join(', ') || '—'}</TableCell>
                  <TableCell className="p-3">{item.openWorkOrderCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
      {hasMore ? <Button type="button" variant="outline" disabled={isValidating} onClick={() => setSize(size + 1)}>{messages.loadMore}</Button> : null}
      <p className="sr-only">{locale}</p>
    </div>
  );
}
