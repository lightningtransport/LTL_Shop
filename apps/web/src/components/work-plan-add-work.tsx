'use client';

import { useMemo, useState } from 'react';
import type { CatalogJobDto, TruckWorkPlanDto } from '@ltl-shop/shared';
import type { AdminMessages } from '@/lib/admin-messages';
import {
  draftContainsCatalogJob,
  draftContainsCustomName,
  existingWorkPlanCatalogJobIds,
  existingWorkPlanCustomNames,
  isDuplicateCustomOnPlan,
  type WorkPlanJobDraft,
} from '@/lib/work-plan';
import { useCatalogJobs, useCategories } from '@/lib/shop-data';
import { CategoryJobList } from './category-job-list';
import {
  Badge,
  Button,
  CompactEmpty,
  EmptyState,
  InlineAlert,
  Input,
  Select,
} from './ui';

export function WorkPlanAddWork({
  plan,
  messages,
  disabled,
  submitting,
  onSubmit,
}: {
  plan: TruckWorkPlanDto;
  messages: AdminMessages;
  disabled: boolean;
  submitting: boolean;
  onSubmit: (jobs: WorkPlanJobDraft[]) => Promise<boolean | void> | boolean | void;
}) {
  const [categoryId, setCategoryId] = useState('');
  const [jobQuery, setJobQuery] = useState('');
  const [customName, setCustomName] = useState('');
  const [drafts, setDrafts] = useState<WorkPlanJobDraft[]>([]);
  const { data: categories, error: categoriesError, isLoading: categoriesLoading } = useCategories(true);
  const { data: catalogJobs, error: jobsError, isLoading: jobsLoading } = useCatalogJobs(categoryId, Boolean(categoryId));

  const standardCategories = useMemo(
    () => (categories ?? []).filter((category) => category.name !== 'PM'),
    [categories],
  );
  const selectedCategory = standardCategories.find((category) => category.id === categoryId) ?? null;
  const existingCatalogIds = useMemo(() => existingWorkPlanCatalogJobIds(plan), [plan]);
  const existingCustomNames = useMemo(() => existingWorkPlanCustomNames(plan), [plan]);
  const selectedCatalogJobIds = useMemo(
    () => drafts.flatMap((job) => (job.catalogJobId ? [job.catalogJobId] : [])),
    [drafts],
  );
  const availableJobs = useMemo(
    () => (catalogJobs ?? []).filter((job) => !existingCatalogIds.includes(job.id)),
    [catalogJobs, existingCatalogIds],
  );
  const customIsDuplicate = Boolean(customName.trim())
    && (
      draftContainsCustomName(drafts, customName)
      || isDuplicateCustomOnPlan(existingCustomNames, customName)
    );

  function toggleCatalogJob(job: CatalogJobDto) {
    if (!selectedCategory || disabled) return;
    setDrafts((current) => {
      if (draftContainsCatalogJob(current, job.id)) {
        return current.filter((draft) => draft.catalogJobId !== job.id);
      }
      return [...current, {
        key: crypto.randomUUID(),
        catalogJobId: job.id,
        categoryId: selectedCategory.id,
        categoryName: selectedCategory.name,
        displayName: job.displayName,
      }];
    });
  }

  function addCustomJob() {
    if (!selectedCategory || !customName.trim() || customIsDuplicate || disabled) return;
    const name = customName.trim();
    setDrafts((current) => [...current, {
      key: crypto.randomUUID(),
      categoryId: selectedCategory.id,
      categoryName: selectedCategory.name,
      displayName: name,
      customDescription: name,
    }]);
    setCustomName('');
  }

  async function submit() {
    if (!drafts.length || disabled || submitting) return;
    const added = await onSubmit(drafts);
    if (added === false) return;
    setDrafts([]);
    setCustomName('');
    setJobQuery('');
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{messages.workPlanIssuesFoundHelp}</p>
      {categoriesError ? <InlineAlert>{messages.loadError}</InlineAlert> : null}
      {categoriesLoading && !categories ? (
        <p className="text-sm text-muted-foreground">{messages.loadingCategories}</p>
      ) : null}
      {!categoriesLoading && !categoriesError && standardCategories.length === 0 ? (
        <EmptyState>{messages.noCategoriesAvailable}</EmptyState>
      ) : null}
      {standardCategories.length ? (
        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted-foreground">{messages.category}</span>
          <Select
            aria-label={messages.jobPickerCategoryLabel}
            value={categoryId}
            disabled={disabled}
            onChange={(event) => {
              setCategoryId(event.target.value);
              setJobQuery('');
              setCustomName('');
            }}
          >
            <option value="">{messages.category}</option>
            {standardCategories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </Select>
        </label>
      ) : null}
      {selectedCategory ? (
        <div className="space-y-2">
          {selectedCategory.name === 'Detailing' ? (
            <p className="text-xs text-muted-foreground">{messages.workPlanDetailingHint}</p>
          ) : null}
          <CategoryJobList
            categoryName={selectedCategory.name}
            jobs={availableJobs}
            isLoading={jobsLoading}
            error={Boolean(jobsError)}
            query={jobQuery}
            onQueryChange={setJobQuery}
            selectedIds={selectedCatalogJobIds}
            onSelect={toggleCatalogJob}
            copy={{
              searchLabel: messages.searchJobsLabel,
              loading: messages.loadingJobs,
              loadError: messages.loadError,
              emptyCategory: messages.noJobsInCategory,
              emptyCategoryHint: messages.emptyCategoryCustomHint,
              noMatches: messages.noMatchingCategoryJobs,
              listLabel: messages.categoryJobsLabel,
              addJob: messages.addCatalogJob,
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Input
              aria-label={messages.customJobPlaceholder}
              className="flex-1"
              placeholder={messages.customJobPlaceholder}
              value={customName}
              disabled={disabled}
              onChange={(event) => setCustomName(event.target.value)}
            />
            <Button type="button" disabled={disabled || !customName.trim() || customIsDuplicate} onClick={addCustomJob}>
              {messages.addCustomJob}
            </Button>
          </div>
          {customIsDuplicate ? <p className="text-sm text-muted-foreground" role="status">{messages.jobsInPlan}</p> : null}
        </div>
      ) : null}
      <div className="space-y-2">
        <p className="text-sm font-medium">{messages.jobsInPlan}</p>
        {drafts.length ? (
          <ul className="divide-y rounded-xl border">
            {drafts.map((job) => (
              <li key={job.key} className="flex items-center justify-between gap-2 px-3 py-3 text-sm">
                <span className="min-w-0">
                  <span className="font-medium">{job.displayName}</span>
                  <Badge variant="outline" className="ml-2 normal-case tracking-normal">{job.categoryName}</Badge>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={disabled}
                  onClick={() => setDrafts((current) => current.filter((item) => item.key !== job.key))}
                >
                  {messages.removeJobAction}
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <CompactEmpty>{messages.noJobsYet}</CompactEmpty>
        )}
      </div>
      <Button type="button" className="w-full" disabled={disabled || submitting || drafts.length === 0} onClick={() => void submit()}>
        {submitting ? messages.workPlanAddingWork : messages.workPlanAddWorkSubmit}
      </Button>
    </div>
  );
}
