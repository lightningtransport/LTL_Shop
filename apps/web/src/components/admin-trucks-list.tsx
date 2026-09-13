'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { rankTruckSearchResults, TruckOperationalStatus } from '@ltl-shop/shared';
import { Badge, Button, EmptyState, Input, LoadFailure, PageSkeleton } from './ui';
import { useAdminTrucks } from '@/lib/admin-data';
import { humanize } from '@/lib/admin-format';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';

export function AdminTrucksList({ locale, messages }: { locale: AdminLocale; messages: AdminMessages }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const { data, error, isLoading, size, setSize, mutate, isValidating } = useAdminTrucks(query);

  useEffect(() => {
    setSearch(searchParams.get('search') ?? '');
  }, [searchParams]);

  const searchTerm = searchParams.get('search') ?? '';
  const items = useMemo(() => {
    const all = data?.flatMap((page) => page.items) ?? [];
    return searchTerm
      ? rankTruckSearchResults(all, searchTerm, (item) => item.truck)
      : all;
  }, [data, searchTerm]);
  const hasMore = Boolean(data?.[data.length - 1]?.nextCursor);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-muted-foreground">{messages.eyebrow}</p>
        <h1 className="font-display text-2xl font-semibold">{messages.trucksTitle}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{messages.trucksDescription}</p>
      </div>
      <form
        className="flex flex-col gap-3 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          const next = new URLSearchParams();
          if (search.trim()) next.set('search', search.trim());
          router.replace(`/admin/trucks${next.size ? `?${next}` : ''}`);
        }}
      >
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={messages.searchTrucks} aria-label={messages.searchTrucks} />
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={() => router.replace('/admin/trucks')}>{messages.clearFilters}</Button>
          <Button type="submit">{messages.applyFilters}</Button>
        </div>
      </form>
      {error ? <LoadFailure message={messages.loadError} retryLabel={messages.retry} onRetry={() => void mutate()} /> : null}
      {isLoading && !data ? <PageSkeleton label={messages.trucksTitle} /> : null}
      {!isLoading && !error && items.length === 0 ? <EmptyState><p>{messages.noTrucksMatch}</p></EmptyState> : null}
      {items.length ? (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="p-3 font-medium">{messages.trucks}</th>
                <th className="p-3 font-medium">{messages.operationalStatus}</th>
                <th className="p-3 font-medium">{messages.make}</th>
                <th className="p-3 font-medium">{messages.company}</th>
                <th className="p-3 font-medium">{messages.currentWorkOrder}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.truck.id} className="border-t">
                  <td className="p-3">
                    <Link className="font-semibold text-primary hover:underline" href={`/admin/trucks/${item.truck.id}`}>{item.truck.truckNumber}</Link>
                    <p className="text-muted-foreground">
                      {[item.truck.year, item.truck.model].filter(Boolean).join(' ') || '—'}
                    </p>
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {item.operationalStatus === TruckOperationalStatus.IN_SERVICE
                      ? messages.operationalStatusInService
                      : item.operationalStatus === TruckOperationalStatus.OFF_DUTY
                        ? messages.operationalStatusOffDuty
                        : messages.operationalStatusUnknown}
                  </td>
                  <td className="p-3 text-muted-foreground">{item.truck.make ?? '—'}</td>
                  <td className="p-3 text-muted-foreground">{item.truck.company ?? '—'}</td>
                  <td className="p-3">
                    {item.openWorkOrder ? (
                      <>
                        <Link className="font-medium text-primary hover:underline" href={`/admin/work-orders/${item.openWorkOrder.id}`}>{item.openWorkOrder.displayId}</Link>
                        <p className="text-muted-foreground">{item.openWorkOrder.primaryCategoryName} · <Badge variant="outline">{humanize(item.openWorkOrder.status)}</Badge></p>
                      </>
                    ) : (
                      <span className="text-muted-foreground">{messages.noOpenWorkOrder}</span>
                    )}
                  </td>
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
