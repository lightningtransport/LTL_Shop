'use client';

import { AdminNavLink } from './admin-nav-link';
import { useMemo, useState } from 'react';
import { CatalogStatus } from '@ltl-shop/shared';
import { AdminCatalogWriteActions } from './admin-catalog-write';
import { AdminWriteTip } from './admin-write-tip';
import { DataTable, PageHeader, Badge, Card, CardContent, EmptyState, Input, LoadFailure, PageSkeleton } from './ui';
import { useCanShowManagerWrites } from '@/lib/admin-actor';
import { useAdminCatalogCategories } from '@/lib/admin-data';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';

export function AdminCatalogList({ messages }: { locale: AdminLocale; messages: AdminMessages }) {
  const canWrite = useCanShowManagerWrites();
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
      {isLoading && !data ? <PageSkeleton label={messages.catalogTitle} header={false} /> : null}
      {!isLoading && !error && items.length === 0 ? (
        <EmptyState>
          <p>{search.trim() ? messages.catalogNoMatches : messages.catalogNoCategories}</p>
          {canWrite ? <div className="mt-4 flex justify-center">{addJobButton()}</div> : null}
        </EmptyState>
      ) : null}
      {items.length ? (
        <DataTable
          items={items}
          caption={messages.catalogTitle}
          getKey={(item) => item.id}
          getRowLabel={(item) => item.name}
          columns={[
            {
              key: 'category',
              header: messages.catalogCategoryColumn,
              primary: true,
              cell: (item) => (
                <div className="flex flex-wrap items-center gap-2">
                  <AdminNavLink className="tap-inline font-semibold text-primary hover:underline" href={`/admin/catalog/categories/${item.id}`}>{item.name}</AdminNavLink>
                  {item.status === CatalogStatus.INACTIVE ? <Badge variant="secondary">{messages.catalogInactive}</Badge> : null}
                </div>
              ),
            },
            { key: 'jobs', header: messages.catalogJobsColumn, cell: (item) => <span>{item.activeJobCount}</span> },
            { key: 'inactive', header: messages.catalogInactiveJobs, cell: (item) => <span className="text-muted-foreground">{item.inactiveJobCount}</span> },
            { key: 'aliases', header: messages.catalogAliasesColumn, cell: (item) => <span className="text-muted-foreground">{item.aliasCount}</span> },
          ]}
        />
      ) : null}
    </div>
  );
}
