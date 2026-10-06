'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSWRConfig } from 'swr';
import type { CatalogJobDto, JobCategoryDto, TruckWorkPlanDto } from '@ltl-shop/shared';
import { useCanShowManagerWrites } from '@/lib/admin-actor';
import { createAdminCatalogJob } from '@/lib/admin-data';
import type { AdminMessages } from '@/lib/admin-messages';
import { ApiError } from '@/lib/api';
import { apiErrorCode } from '@/lib/api-error-message';
import { fillPlaceholders } from '@/lib/admin-next-step';
import {
  draftContainsCatalogJob,
  draftContainsCustomName,
  existingWorkPlanCatalogJobIds,
  existingWorkPlanCustomNames,
  isDuplicateCustomOnPlan,
  type WorkPlanJobDraft,
} from '@/lib/work-plan';
import { useCatalogJobs, useCategories } from '@/lib/shop-data';
import { adminWriteFailureMessage } from '@/lib/system-admin';
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
  preferredCategoryName,
  standardMechanics = [],
  onSubmit,
}: {
  plan: TruckWorkPlanDto;
  messages: AdminMessages;
  disabled: boolean;
  submitting: boolean;
  preferredCategoryName?: string | null;
  /** D14: active Standard mechanics the Manager can name as each Job is added. */
  standardMechanics?: ReadonlyArray<{ id: string; name: string }>;
  onSubmit: (jobs: WorkPlanJobDraft[]) => Promise<boolean | void> | boolean | void;
}) {
  const [categoryId, setCategoryId] = useState('');
  const [jobQuery, setJobQuery] = useState('');
  const [customName, setCustomName] = useState('');
  const [drafts, setDrafts] = useState<WorkPlanJobDraft[]>([]);
  // D25: the Manager (or System Admin) can save the custom Job into the catalog as it is added.
  const canAddToCatalog = useCanShowManagerWrites();
  const [alsoAddToCatalog, setAlsoAddToCatalog] = useState(false);
  const [catalogSaving, setCatalogSaving] = useState(false);
  const [catalogNotice, setCatalogNotice] = useState<string | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const { mutate } = useSWRConfig();
  const { data: categories, error: categoriesError, isLoading: categoriesLoading } = useCategories(true);
  const {
    data: catalogJobs,
    error: jobsError,
    isLoading: jobsLoading,
    mutate: refreshCatalogJobs,
  } = useCatalogJobs(categoryId, Boolean(categoryId));

  // LTR-145: the PM Category is a normal Work Plan step.
  const standardCategories = categories ?? [];
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

  useEffect(() => {
    if (!preferredCategoryName || !standardCategories.length) return;
    const match = standardCategories.find((category) => category.name === preferredCategoryName);
    if (!match) return;
    setCategoryId(match.id);
    setJobQuery('');
    setCustomName('');
  }, [preferredCategoryName, standardCategories]);

  function catalogDraft(category: JobCategoryDto, job: Pick<CatalogJobDto, 'id' | 'displayName'>): WorkPlanJobDraft {
    return {
      key: crypto.randomUUID(),
      catalogJobId: job.id,
      categoryId: category.id,
      categoryName: category.name,
      displayName: job.displayName,
    };
  }

  function toggleCatalogJob(job: CatalogJobDto) {
    if (!selectedCategory || disabled) return;
    setDrafts((current) => {
      if (draftContainsCatalogJob(current, job.id)) {
        return current.filter((draft) => draft.catalogJobId !== job.id);
      }
      return [...current, catalogDraft(selectedCategory, job)];
    });
  }

  function selectCatalogJob(category: JobCategoryDto, job: Pick<CatalogJobDto, 'id' | 'displayName'>) {
    setDrafts((current) => (draftContainsCatalogJob(current, job.id) ? current : [...current, catalogDraft(category, job)]));
  }

  /**
   * D25: "Also add to the catalog". The Job is created in the catalog first and goes on the
   * draft as a catalog Job. When the name is already in that category (CATALOG_JOB_EXISTS), the
   * existing catalog Job is selected instead.
   */
  async function addCustomJobToCatalog(category: JobCategoryDto, name: string) {
    setCatalogSaving(true);
    try {
      const created = await createAdminCatalogJob({ categoryId: category.id, displayName: name });
      selectCatalogJob(category, created);
      setCustomName('');
      setAlsoAddToCatalog(false);
      void mutate((key) => typeof key === 'string' && key.startsWith('/api/admin/catalog/'));
      await refreshCatalogJobs();
    } catch (failure) {
      const existingId = apiErrorCode(failure) === 'CATALOG_JOB_EXISTS' && failure instanceof ApiError
        ? (failure.body as { jobId?: unknown }).jobId
        : null;
      const list = existingId ? (await refreshCatalogJobs()) ?? catalogJobs ?? [] : [];
      const existing = list.find((job) => job.id === existingId)
        ?? list.find((job) => job.displayName.trim().toLowerCase() === name.toLowerCase());
      if (existing && !existingCatalogIds.includes(existing.id)) {
        selectCatalogJob(category, existing);
        setCustomName('');
        setAlsoAddToCatalog(false);
        setCatalogNotice(fillPlaceholders(messages.customJobAlreadyInCatalog, { job: existing.displayName }));
      } else {
        setCatalogError(adminWriteFailureMessage(failure, {
          locale: messages.locale,
          apiError: messages.apiError,
          forbidden: messages.catalogWriteForbidden,
          conflict: messages.catalogWriteConflict,
          failed: messages.catalogWriteFailed,
        }));
      }
    } finally {
      setCatalogSaving(false);
    }
  }

  function addCustomJob() {
    if (!selectedCategory || !customName.trim() || customIsDuplicate || disabled || catalogSaving) return;
    const name = customName.trim();
    setCatalogNotice(null);
    setCatalogError(null);
    if (canAddToCatalog && alsoAddToCatalog) {
      void addCustomJobToCatalog(selectedCategory, name);
      return;
    }
    setDrafts((current) => [...current, {
      key: crypto.randomUUID(),
      categoryId: selectedCategory.id,
      categoryName: selectedCategory.name,
      displayName: name,
      customDescription: name,
    }]);
    setCustomName('');
  }

  function setDraftOwner(key: string, mechanicId: string) {
    setDrafts((current) => current.map((draft) => (
      draft.key === key ? { ...draft, assignedMechanicId: mechanicId || undefined } : draft
    )));
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
              setCatalogNotice(null);
              setCatalogError(null);
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
          {selectedCategory.name === 'Suspension & Steering' ? (
            <p className="text-xs text-muted-foreground">{messages.workPlanAlignmentHint}</p>
          ) : null}
          {selectedCategory.name === 'Quality Check' ? (
            <p className="text-xs text-muted-foreground">{messages.workPlanQcHint}</p>
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
            <Button type="button" disabled={disabled || catalogSaving || !customName.trim() || customIsDuplicate} onClick={addCustomJob}>
              {catalogSaving ? messages.addCustomJobToCatalogBusy : messages.addCustomJob}
            </Button>
          </div>
          {canAddToCatalog ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-5"
                checked={alsoAddToCatalog}
                disabled={disabled || catalogSaving}
                onChange={(event) => setAlsoAddToCatalog(event.target.checked)}
              />
              <span>{messages.addCustomJobToCatalog}</span>
            </label>
          ) : null}
          {customIsDuplicate ? <p className="text-sm text-muted-foreground" role="status">{messages.jobsInPlan}</p> : null}
          {catalogNotice ? <p className="text-sm text-muted-foreground" role="status">{catalogNotice}</p> : null}
          {catalogError ? <InlineAlert>{catalogError}</InlineAlert> : null}
        </div>
      ) : null}
      <div className="space-y-2">
        <p className="text-sm font-medium">{messages.jobsInPlan}</p>
        {drafts.length ? (
          <ul className="divide-y rounded-xl border">
            {drafts.map((job) => (
              <li key={job.key} className="flex flex-wrap items-center justify-between gap-2 px-3 py-3 text-sm">
                <span className="min-w-0">
                  <span className="font-medium">{job.displayName}</span>
                  <Badge variant="outline" className="ml-2">{job.categoryName}</Badge>
                </span>
                {/* D14: the PM job goes to a PM mechanic and Quality Check has no owner; both are set on the plan. */}
                {job.categoryName !== 'PM' && job.categoryName !== 'Quality Check' ? (
                  <label className="flex items-center gap-2 sm:ml-auto">
                    <span className="shrink-0 whitespace-nowrap text-xs font-medium text-muted-foreground">{messages.workPlanJobOwnerLabel}</span>
                    <Select
                      aria-label={fillPlaceholders(messages.workPlanJobOwnerFor, { job: job.displayName })}
                      className="w-full sm:w-44"
                      value={job.assignedMechanicId ?? ''}
                      disabled={disabled}
                      onChange={(event) => setDraftOwner(job.key, event.target.value)}
                    >
                      <option value="">{messages.jobUnassigned}</option>
                      {standardMechanics.map((mechanic) => (
                        <option key={mechanic.id} value={mechanic.id}>{mechanic.name}</option>
                      ))}
                    </Select>
                  </label>
                ) : null}
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
