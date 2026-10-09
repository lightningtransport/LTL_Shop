'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CatalogStatus } from '@ltl-shop/shared';
import { AdminCatalogWriteActions } from './admin-catalog-write';
import { CatalogJobRow, CategoryMenu, CategoryStatusNote } from './admin-catalog-manage';
import { AdminWriteTip } from './admin-write-tip';
import { AdminBackLink, PageHeader, Badge, Button, EmptyState, LoadFailure, PageSkeleton, SectionCard } from './ui';
import { ApiError } from '@/lib/api';
import { useCanShowManagerWrites } from '@/lib/admin-actor';
import { useAdminCatalogCategory } from '@/lib/admin-data';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';

/**
 * LTR-198 / D30: one Category — its Jobs with status, the System Job lock, "Used by", alias chips and a "…" per Job;
 * the Category's own "…" (rename, activate or deactivate with a reason, delete) unless it is a Shop workflow one.
 */
export function AdminCatalogCategoryDetail({ id, messages }: { id: string; locale: AdminLocale; messages: AdminMessages }) {
  const canWrite = useCanShowManagerWrites();
  const router = useRouter();
  const { data, error, isLoading, mutate } = useAdminCatalogCategory(id);
  if (isLoading) return <PageSkeleton label={messages.catalogTitle} />;
  if (error instanceof ApiError && error.status === 404) {
    return <EmptyState><p>{messages.catalogNotFound}</p><Button asChild variant="outline" className="mt-4"><Link href="/admin/catalog">{messages.backToCatalog}</Link></Button></EmptyState>;
  }
  if (error || !data) return <LoadFailure message={messages.loadError} retryLabel={messages.retry} onRetry={() => void mutate()} />;
  const active = data.status === CatalogStatus.ACTIVE;
  const activeJobs = data.jobs.filter((job) => job.status === CatalogStatus.ACTIVE).length;

  return (
    <div className="space-y-6">
      <AdminBackLink href="/admin/catalog">{messages.backToCatalog}</AdminBackLink>
      <PageHeader
        title={data.name}
        subtitle={data.systemKey ? messages.catalogSystemCategoryHint : data.holdsSystemJob ? messages.catalogHoldsSystemJobHint : (canWrite ? messages.catalogWriteDescription : messages.catalogDescription)}
        badges={<><CategoryStatusNote category={data} messages={messages} />{!canWrite ? <Badge variant="outline">{messages.readOnly}</Badge> : null}</>}
        actions={canWrite ? (
          <div className="flex items-center gap-2">
            {active ? (
              <AdminCatalogWriteActions messages={messages} categories={[data]} categoryId={data.id} onChanged={() => void mutate()} />
            ) : null}
            <CategoryMenu category={data} messages={messages} onChanged={() => void mutate()} onDeleted={() => router.push('/admin/catalog')} />
          </div>
        ) : null}
      />
      {canWrite ? <AdminWriteTip testId>{messages.catalogAddJobTip}</AdminWriteTip> : null}
      <SectionCard title={messages.catalogJobsColumn} count={activeJobs}>
        {data.jobs.length ? (
          <ul className="divide-y">
            {data.jobs.map((job) => (
              canWrite ? (
                <CatalogJobRow key={job.id} job={job} categoryActive={active} messages={messages} onChanged={() => void mutate()} />
              ) : (
                <li key={job.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{job.displayName}</p>
                    {job.status === CatalogStatus.INACTIVE ? <Badge variant="secondary">{messages.catalogInactive}</Badge> : null}
                  </div>
                  {job.aliases.length ? <p className="mt-1 text-sm text-muted-foreground">{messages.catalogJobAliases}: {job.aliases.join(', ')}</p> : null}
                </li>
              )
            ))}
          </ul>
        ) : (
          <EmptyState>
            <p>{messages.catalogNoJobs}</p>
            {canWrite && active ? (
              <div className="mt-4 flex justify-center">
                <AdminCatalogWriteActions messages={messages} categories={[data]} categoryId={data.id} onChanged={() => void mutate()} />
              </div>
            ) : null}
          </EmptyState>
        )}
      </SectionCard>
      <p className="text-xs text-muted-foreground">{messages.catalogAliasesIgnoreAccents}</p>
    </div>
  );
}
