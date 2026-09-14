'use client';

import Link from 'next/link';
import { CatalogStatus } from '@ltl-shop/shared';
import { AdminBackLink, AdminPageHeader, Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState, LoadFailure, PageSkeleton } from './ui';
import { ApiError } from '@/lib/api';
import { useAdminCatalogCategory } from '@/lib/admin-data';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';

export function AdminCatalogCategoryDetail({ id, locale, messages }: { id: string; locale: AdminLocale; messages: AdminMessages }) {
  const { data, error, isLoading, mutate } = useAdminCatalogCategory(id);
  if (isLoading) return <PageSkeleton label={messages.catalogTitle} />;
  if (error instanceof ApiError && error.status === 404) {
    return <EmptyState><p>{messages.catalogNotFound}</p><Button asChild variant="outline" className="mt-4"><Link href="/admin/catalog">{messages.backToCatalog}</Link></Button></EmptyState>;
  }
  if (error || !data) return <LoadFailure message={messages.loadError} retryLabel={messages.retry} onRetry={() => void mutate()} />;

  return (
    <div className="space-y-5">
      <AdminBackLink href="/admin/catalog">{messages.backToCatalog}</AdminBackLink>
      <AdminPageHeader
        eyebrow={messages.eyebrow}
        title={data.name}
        subtitle={messages.catalogDescription}
        badges={data.status === CatalogStatus.INACTIVE ? <Badge variant="secondary">{messages.catalogInactive}</Badge> : null}
      />
      <Card>
        <CardHeader>
          <CardTitle>{messages.catalogJobsColumn}</CardTitle>
        </CardHeader>
        <CardContent>
          {data.jobs.length ? (
            <ul className="divide-y">
              {data.jobs.map((job) => (
                <li key={job.id} className="py-3 first:pt-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{job.displayName}</p>
                    {job.status === CatalogStatus.INACTIVE ? <Badge variant="secondary">{messages.catalogInactive}</Badge> : null}
                  </div>
                  {job.aliases.length ? (
                    <p className="mt-1 text-sm text-muted-foreground">{messages.catalogJobAliases}: {job.aliases.join(', ')}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>{messages.catalogNoJobs}</EmptyState>
          )}
        </CardContent>
      </Card>
      <p className="sr-only">{locale}</p>
    </div>
  );
}
