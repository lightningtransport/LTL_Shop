'use client';

import { useMemo } from 'react';
import { Check, CheckCheck, Plus, Search } from 'lucide-react';
import type { CatalogJobDto } from '@ltl-shop/shared';
import { filterCatalogJobs } from '@/lib/job-catalog';
import { cn } from '@/lib/utils';
import { InlineAlert } from './ui';

export type CategoryJobListCopy = {
  searchLabel: string;
  loading: string;
  loadError: string;
  emptyCategory: string;
  emptyCategoryHint?: string;
  noMatches: string;
  listLabel: string;
  addJob: string;
};

/**
 * Stage 8 (mockup): a search with its icon, then the category's Jobs as chips — "+" to add, a check when
 * picked, and the ones already on the plan disabled with "· on plan".
 */
export function CategoryJobList({
  categoryName,
  jobs,
  isLoading,
  error,
  query,
  onQueryChange,
  selectedIds,
  onPlanIds = [],
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
  /** Jobs already on the Work Plan: shown, but they cannot be added twice. */
  onPlanIds?: readonly string[];
  onSelect: (job: CatalogJobDto) => void;
  copy: CategoryJobListCopy & { onPlan?: string };
}) {
  const visibleJobs = useMemo(() => filterCatalogJobs(jobs, query), [jobs, query]);
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const onPlan = useMemo(() => new Set(onPlanIds), [onPlanIds]);

  if (error) return <InlineAlert>{copy.loadError}</InlineAlert>;
  if (isLoading && !jobs.length) return <p className="text-muted-foreground">{copy.loading}</p>;
  if (!jobs.length) {
    return (
      <p className="rounded-lg border border-dashed px-3 py-4 text-center text-muted-foreground">
        {copy.emptyCategory}{copy.emptyCategoryHint ? ` ${copy.emptyCategoryHint}` : ''}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2 rounded-md border bg-background px-3 focus-within:border-ring">
        <Search aria-hidden="true" className="size-3.5 text-muted-foreground" />
        <span className="sr-only">{copy.searchLabel}</span>
        <input
          className="h-10 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
          placeholder={copy.searchLabel}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </label>
      {visibleJobs.length ? (
        <ul className="flex max-h-64 flex-wrap gap-1.5 overflow-auto" aria-label={`${copy.listLabel}: ${categoryName}`}>
          {visibleJobs.map((job) => {
            const isSelected = selected.has(job.id);
            const planned = onPlan.has(job.id);
            const Icon = isSelected ? Check : planned ? CheckCheck : Plus;
            return (
              <li key={job.id} className="max-w-full">
                <button
                  type="button"
                  aria-pressed={isSelected}
                  aria-label={`${copy.addJob} ${job.displayName}`}
                  disabled={planned}
                  className={cn(
                    'inline-flex min-h-10 max-w-full items-center gap-1.5 rounded-full border px-3 sm:min-h-9',
                    isSelected ? 'border-primary bg-primary/15 text-primary' : planned ? 'cursor-not-allowed text-muted-foreground opacity-60' : 'hover:bg-accent',
                  )}
                  onClick={() => onSelect(job)}
                >
                  <Icon aria-hidden="true" className="size-3.5 shrink-0" />
                  <span className="truncate">{job.displayName}</span>
                  {planned && copy.onPlan ? <span className="text-xs">{copy.onPlan}</span> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed px-3 py-4 text-center text-muted-foreground">{copy.noMatches}</p>
      )}
    </div>
  );
}
