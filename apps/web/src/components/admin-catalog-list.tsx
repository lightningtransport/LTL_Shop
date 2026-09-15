'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { CatalogStatus } from '@ltl-shop/shared';
import { AdminPageHeader, EmptyState, LoadFailure, PageSkeleton } from './ui';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import { Input } from './ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { useAdminCatalogCategories } from '@/lib/admin-data';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';

export function AdminCatalogList({ locale, messages }: { locale: AdminLocale; messages: AdminMessages }) {
  const { data, error, isLoading, mutate } = useAdminCatalogCategories();
  const [search, setSearch] = useState('');
  const items = useMemo(() => {
    const query = search.trim().toLowerCase();
    const categories = data ?? [];
    if (!query) return categories;
    return categories.filter((category) => category.name.toLowerCase().includes(query));
  }, [data, search]);

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader eyebrow={messages.eyebrow} title={messages.catalogTitle} subtitle={messages.catalogDescription} />
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
        </EmptyState>
      ) : null}
      {items.length ? (
        <div className="rounded-xl border">
          <Table className="min-w-[40rem]">
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="px-3">{messages.catalogCategoryColumn}</TableHead>
                <TableHead className="px-3">{messages.catalogJobsColumn}</TableHead>
                <TableHead className="px-3">{messages.catalogInactiveJobs}</TableHead>
                <TableHead className="px-3">{messages.catalogAliasesColumn}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="p-3">
                    <Link className="font-semibold text-primary hover:underline" href={`/admin/catalog/categories/${item.id}`}>{item.name}</Link>
                    {item.status === CatalogStatus.INACTIVE ? <Badge variant="secondary" className="ml-2">{messages.catalogInactive}</Badge> : null}
                  </TableCell>
                  <TableCell className="p-3">{item.activeJobCount}</TableCell>
                  <TableCell className="p-3 text-muted-foreground">{item.inactiveJobCount}</TableCell>
                  <TableCell className="p-3 text-muted-foreground">{item.aliasCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
      <p className="sr-only">{locale}</p>
    </div>
  );
}
