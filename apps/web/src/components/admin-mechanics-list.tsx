'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, EmptyState, Input, LoadFailure, PageSkeleton } from './ui';
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
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-muted-foreground">{messages.eyebrow}</p>
        <h1 className="font-display text-2xl font-semibold">{messages.mechanicsTitle}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{messages.mechanicsDescription}</p>
      </div>
      <form
        className="flex flex-col gap-3 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          const next = new URLSearchParams();
          if (search.trim()) next.set('search', search.trim());
          router.replace(`/admin/mechanics${next.size ? `?${next}` : ''}`);
        }}
      >
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={messages.searchMechanics} aria-label={messages.searchMechanics} />
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={() => router.replace('/admin/mechanics')}>{messages.clearFilters}</Button>
          <Button type="submit">{messages.applyFilters}</Button>
        </div>
      </form>
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
      <p className="sr-only">{locale}</p>
    </div>
  );
}
