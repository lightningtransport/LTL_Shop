'use client';

import { useMemo } from 'react';
import { Check } from 'lucide-react';
import type { CatalogJobDto } from '@ltl-shop/shared';
import { filterCatalogJobs } from '@/lib/job-catalog';
import { Button, Card, CompactEmpty, EmptyState, InlineAlert, Input } from './ui';

export type CategoryJobListCopy = {
  searchLabel: string;
  loading: string;
  loadError: string;
  emptyCategory: string;
  noMatches: string;
  listLabel: string;
  addJob: string;
};

export function CategoryJobList({
  categoryName,
  jobs,
  isLoading,
  error,
  query,
  onQueryChange,
  selectedIds,
  onSelect,
  copy,
}: {
  categoryName: string;
  jobs: CatalogJobDto[];
  isLoading: boolean;
  error: boolean;
  query: string;
  onQueryChange: (query: string) => void;
  selectedIds: readonly string[];
  onSelect: (job: CatalogJobDto) => void;
  copy: CategoryJobListCopy;
}) {
  const visibleJobs = useMemo(() => filterCatalogJobs(jobs, query), [jobs, query]);
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);

  if (error) return <InlineAlert>{copy.loadError}</InlineAlert>;
  if (isLoading && !jobs.length) {
    return <Card className="text-sm text-muted-foreground">{copy.loading}</Card>;
  }
  if (!jobs.length) {
    return <EmptyState>{copy.emptyCategory}</EmptyState>;
  }

  return (
    <div className="space-y-2">
      <Input
        aria-label={copy.searchLabel}
        placeholder={copy.searchLabel}
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
      />
      {visibleJobs.length ? (
        <ul
          className="flex max-h-64 flex-wrap gap-2 overflow-auto"
          aria-label={`${copy.listLabel}: ${categoryName}`}
        >
          {visibleJobs.map((job) => {
            const isSelected = selected.has(job.id);
            return (
              <li key={job.id}>
                <Button
                  type="button"
                  variant={isSelected ? 'default' : 'secondary'}
                  aria-pressed={isSelected}
                  aria-label={`${copy.addJob} ${job.displayName}`}
                  className="max-w-full"
                  onClick={() => onSelect(job)}
                >
                  {isSelected ? <Check aria-hidden="true" className="size-3.5 shrink-0" /> : null}
                  <span className="truncate">{job.displayName}</span>
                </Button>
              </li>
            );
          })}
        </ul>
      ) : (
        <CompactEmpty>{copy.noMatches}</CompactEmpty>
      )}
    </div>
  );
}
