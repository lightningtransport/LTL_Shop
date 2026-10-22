'use client';

import { AdminNavLink } from './admin-nav-link';
import { useMemo, useState } from 'react';
import { CatalogStatus } from '@ltl-shop/shared';
import { AdminCatalogWriteActions } from './admin-catalog-write';
import { AddCategoryButton, CatalogSearchResults, CategoryMenu, CategoryStatusNote } from './admin-catalog-manage';
import { fillPlaceholders } from '@/lib/admin-next-step';
import { Button, DataTable, PageHeader, Card, CardContent, EmptyState, Input, LoadFailure, PageSkeleton } from './ui';
import { useCanShowManagerWrites } from '@/lib/admin-actor';
import { useAdminCatalogCategories, useAdminCustomJobs } from '@/lib/admin-data';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';
import { useDocumentTitle } from './admin-breadcrumb';

export function AdminCatalogList({ messages }: { locale: AdminLocale; messages: AdminMessages }) {
  // LTR-293 §10: the browser tab says which screen this is.
  useDocumentTitle(messages.catalogTitle);
  const canWrite = useCanShowManagerWrites();
  const { data, error, isLoading, mutate } = useAdminCatalogCategories();
  // LTR-57: Custom Jobs waiting in the review inbox.
  const { data: customJobs } = useAdminCustomJobs('pending');
  const toReview = (customJobs ?? []).reduce((sum, group) => sum + group.count, 0);
  const [search, setSearch] = useState('');
  // LTR-198 / JC2: the box filters Categories by name and, below, finds Jobs and aliases across every Category.
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
        actions={(
          <div className="flex flex-wrap gap-2">
            {/* LTR-259: with nothing to review the inbox is a quiet header button, not a stray link row. */}
            {!toReview ? <Button asChild variant="outline"><AdminNavLink href="/admin/catalog/review">{messages.cjInbox}</AdminNavLink></Button> : null}
            {canWrite ? <><AddCategoryButton messages={messages} onAdded={() => void mutate()} />{addJobButton()}</> : null}
          </div>
        )}
      />
      {toReview ? (
        <AdminNavLink className="tap-inline flex items-center justify-between gap-3 rounded-xl border border-warning/40 bg-warning-surface px-4 py-3 text-sm text-warning-foreground hover:underline" href="/admin/catalog/review" data-testid="custom-jobs-to-review">
          {fillPlaceholders(messages.cjInboxCount, { count: String(toReview) })}
          <span aria-hidden="true">›</span>
        </AdminNavLink>
      ) : null}
      <Card className="p-3">
        <CardContent>
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={messages.searchCatalog} aria-label={messages.searchCatalog} />
        </CardContent>
      </Card>
      <CatalogSearchResults query={search} messages={messages} />
      {error ? <LoadFailure message={messages.loadError} retryLabel={messages.retry} onRetry={() => void mutate()} /> : null}
      {isLoading && !data ? <PageSkeleton label={messages.catalogTitle} header={false} /> : null}
      {!isLoading && !error && items.length === 0 && !search.trim() ? (
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
                  <CategoryStatusNote category={item} messages={messages} />
                </div>
              ),
            },
            {
              key: 'jobs',
              header: messages.catalogJobsColumn,
              cell: (item) => (
                <span className={item.status === CatalogStatus.INACTIVE ? 'text-muted-foreground' : undefined}>
                  {item.inactiveJobCount
                    ? fillPlaceholders(messages.catalogJobsCount, { active: String(item.activeJobCount), inactive: String(item.inactiveJobCount) })
                    : item.activeJobCount}
                </span>
              ),
            },
            ...(canWrite ? [{
              key: 'actions',
              header: "",
              cell: (item: (typeof items)[number]) => <div className="flex justify-end"><CategoryMenu category={item} messages={messages} onChanged={() => void mutate()} onDeleted={() => void mutate()} /></div>,
            }] : []),
          ]}
        />
      ) : null}
    </div>
  );
}
