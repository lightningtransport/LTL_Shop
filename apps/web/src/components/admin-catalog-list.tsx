'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { CatalogStatus } from '@ltl-shop/shared';
import { AdminCatalogWriteActions } from './admin-catalog-write';
import { AdminWriteTip } from './admin-write-tip';
import { PageHeader, Badge, Card, CardContent, EmptyState, Input, LoadFailure, PageSkeleton } from './ui';
import { useCanShowAdminWrites } from '@/lib/admin-actor';
import { useAdminCatalogCategories } from '@/lib/admin-data';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';

export function AdminCatalogList({ messages }: { locale: AdminLocale; messages: AdminMessages }) {
  const canWrite = useCanShowAdminWrites();
  const { data, error, isLoading, mutate } = useAdminCatalogCategories();
  const [search, setSearch] = useState('');
  const items = useMemo(() => {
    const query = search.trim().toLowerCase();
    const categories = data ?? [];
    if (!query) return categories;
    return categories.filter((category) => category.name.toLowerCase().includes(query));
  }, [data, search]);

  const addJobButton = () => (
    <AdminCatalogWriteActions messages={messages} categories={data ?? []} onChanged={() => void mutate()} />
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={messages.catalogTitle}
        subtitle={canWrite ? messages.catalogWriteDescription : messages.catalogDescription}
        actions={canWrite ? addJobButton() : null}
      />
      {canWrite ? <AdminWriteTip testId>{messages.catalogAddJobTip}</AdminWriteTip> : null}
      <Card className="p-3">
        <CardContent>
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={messages.searchCatalog} aria-label={messages.searchCatalog} />
        </CardContent>
      </Card>
      {error ? <LoadFailure message={messages.loadError} retryLabel={messages.retry} onRetry={() => void mutate()} /> : null}
      {isLoading && !data ? <PageSkeleton label={messages.catalogTitle} /> : null}
      {!isLoading && !error && items.length === 0 ? (
        <EmptyState>
          <p>{search.trim() ? messages.catalogNoMatches : messages.catalogNoCategories}</p>
          {canWrite ? <div className="mt-4 flex justify-center">{addJobButton()}</div> : null}
        </EmptyState>
      ) : null}
      {items.length ? (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="p-3 font-medium">{messages.catalogCategoryColumn}</th>
                <th className="p-3 font-medium">{messages.catalogJobsColumn}</th>
                <th className="p-3 font-medium">{messages.catalogInactiveJobs}</th>
                <th className="p-3 font-medium">{messages.catalogAliasesColumn}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="p-3">
                    <Link className="font-semibold text-primary hover:underline" href={`/admin/catalog/categories/${item.id}`}>{item.name}</Link>
                    {item.status === CatalogStatus.INACTIVE ? <Badge variant="secondary" className="ml-2">{messages.catalogInactive}</Badge> : null}
                  </td>
                  <td className="p-3">{item.activeJobCount}</td>
                  <td className="p-3 text-muted-foreground">{item.inactiveJobCount}</td>
                  <td className="p-3 text-muted-foreground">{item.aliasCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
