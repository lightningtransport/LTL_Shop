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
import { Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Button,
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
  onCancel,
}: {
  plan: TruckWorkPlanDto;
  messages: AdminMessages;
  disabled: boolean;
  submitting: boolean;
  preferredCategoryName?: string | null;
  /** D14: active Standard mechanics the Manager can name as each Job is added. */
  standardMechanics?: ReadonlyArray<{ id: string; name: string }>;
  onSubmit: (jobs: WorkPlanJobDraft[]) => Promise<boolean | void> | boolean | void;
  onCancel?: () => void;
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
  const customIsDuplicate = Boolean(customName.trim())
    && (
      draftContainsCustomName(drafts, customName)
      || isDuplicateCustomOnPlan(existingCustomNames, customName)
    );

  // Stage 8 (mockup): the first category starts chosen.
  useEffect(() => {
    if (categoryId || preferredCategoryName || !standardCategories.length) return;
    setCategoryId(standardCategories[0].id);
  }, [categoryId, preferredCategoryName, standardCategories]);

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
    <div className="flex min-h-full flex-col">
      <div className="flex-1 space-y-5 px-5 py-4">
        {categoriesError ? <InlineAlert>{messages.loadError}</InlineAlert> : null}
        {categoriesLoading && !categories ? <p className="text-muted-foreground">{messages.loadingCategories}</p> : null}
        {!categoriesLoading && !categoriesError && standardCategories.length === 0 ? (
          <p className="rounded-lg border border-dashed px-3 py-4 text-center text-muted-foreground">{messages.noCategoriesAvailable}</p>
        ) : null}
        {standardCategories.length ? (
          <div className="space-y-2">
            <p className="font-medium" id="add-work-category-label">{messages.category}</p>
            {/* Stage 8 (mockup): the categories as buttons, the first one already chosen. */}
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={messages.jobPickerCategoryLabel}>
              {standardCategories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  role="radio"
                  aria-checked={category.id === categoryId}
                  disabled={disabled}
                  className={cn(
                    'min-h-9 rounded-md border px-2.5 text-xs font-medium',
                    category.id === categoryId ? 'border-primary bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                  onClick={() => {
                    setCategoryId(category.id);
                    setJobQuery('');
                    setCustomName('');
                    setCatalogNotice(null);
                    setCatalogError(null);
                  }}
                >
                  {category.name}
                </button>
              ))}
            </div>
            {selectedCategory && CATEGORY_HINT[selectedCategory.name] ? (
              <p className="flex gap-2 rounded-md bg-sunken px-3 py-2 text-muted-foreground">
                <Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />{messages[CATEGORY_HINT[selectedCategory.name]!]}
              </p>
            ) : null}
          </div>
        ) : null}
        {selectedCategory ? (
          <>
            <CategoryJobList
              categoryName={selectedCategory.name}
              jobs={catalogJobs ?? []}
              isLoading={jobsLoading}
              error={Boolean(jobsError)}
              query={jobQuery}
              onQueryChange={setJobQuery}
              selectedIds={selectedCatalogJobIds}
              onPlanIds={existingCatalogIds}
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
                onPlan: messages.addWorkOnPlan,
              }}
            />
            <form className="space-y-1.5" onSubmit={(event) => { event.preventDefault(); addCustomJob(); }}>
              <label htmlFor="add-work-custom" className="font-medium">{messages.addWorkCustomLabel}</label>
              <div className="flex gap-2">
                <Input
                  id="add-work-custom"
                  aria-label={messages.customJobPlaceholder}
                  className="min-w-0 flex-1"
                  placeholder={messages.customJobPlaceholder}
                  maxLength={120}
                  value={customName}
                  disabled={disabled}
                  onChange={(event) => setCustomName(event.target.value)}
                />
                <Button type="submit" variant="outline" aria-label={messages.addCustomJob} disabled={disabled || catalogSaving || !customName.trim() || customIsDuplicate}>
                  {catalogSaving ? messages.addCustomJobToCatalogBusy : messages.addShort}
                </Button>
              </div>
              {customIsDuplicate ? <p className="text-destructive-text" role="alert">{messages.customJobDuplicate}</p> : null}
              {canAddToCatalog ? (
                <label className="flex min-h-9 items-center gap-2">
                  <input
                    type="checkbox"
                    className="size-4"
                    checked={alsoAddToCatalog}
                    disabled={disabled || catalogSaving}
                    onChange={(event) => setAlsoAddToCatalog(event.target.checked)}
                  />
                  <span>{messages.addCustomJobToCatalog}</span>
                </label>
              ) : null}
              <p className="text-xs text-muted-foreground">{fillPlaceholders(messages.addWorkCustomGoesTo, { category: selectedCategory.name })}</p>
              {catalogNotice ? <p className="text-muted-foreground" role="status">{catalogNotice}</p> : null}
              {catalogError ? <InlineAlert>{catalogError}</InlineAlert> : null}
            </form>
          </>
        ) : null}
        <div className="space-y-2">
          <p className="font-medium">{messages.addWorkToAdd} <span className="tnum text-muted-foreground">{drafts.length}</span></p>
          {drafts.length ? (
            <ul className="divide-y rounded-lg border">
              {drafts.map((job) => (
                <li key={job.key} className="flex items-center gap-2 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {job.displayName}
                      {job.customDescription ? <span className="text-xs font-normal text-muted-foreground"> · {messages.addWorkCustomShort}</span> : null}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{job.categoryName}</p>
                  </div>
                  {/* D14: Quality Check is Safety's; the PM job goes to a PM mechanic on the plan. */}
                  {job.categoryName === 'Quality Check' ? (
                    <span className="text-muted-foreground">Safety</span>
                  ) : job.categoryName !== 'PM' ? (
                    <Select
                      aria-label={fillPlaceholders(messages.workPlanJobOwnerFor, { job: job.displayName })}
                      className="h-10 w-36 sm:h-9"
                      value={job.assignedMechanicId ?? ''}
                      disabled={disabled}
                      onChange={(event) => setDraftOwner(job.key, event.target.value)}
                    >
                      <option value="">{messages.workPlanJobOwnerLabel}</option>
                      {standardMechanics.map((mechanic) => (
                        <option key={mechanic.id} value={mechanic.id}>{mechanic.name}</option>
                      ))}
                    </Select>
                  ) : null}
                  <button
                    type="button"
                    className="grid size-10 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent sm:size-9"
                    aria-label={`${messages.removeJobAction} ${job.displayName}`}
                    disabled={disabled}
                    onClick={() => setDrafts((current) => current.filter((item) => item.key !== job.key))}
                  >
                    <X aria-hidden="true" className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="text-muted-foreground">{messages.addWorkPickHint}</p>}
        </div>
      </div>
      <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t bg-card px-5 py-3 pb-[calc(0.75rem+var(--app-safe-bottom))] sm:flex-row sm:items-center sm:justify-end">
        {!drafts.length ? <p className="text-xs text-muted-foreground sm:mr-auto">{messages.addWorkAtLeastOne}</p> : null}
        {onCancel ? <Button type="button" variant="outline" onClick={onCancel}>{messages.cancel}</Button> : null}
        <Button type="button" aria-label={messages.workPlanAddWorkSubmit} disabled={disabled || submitting || drafts.length === 0} onClick={() => void submit()}>
          {submitting ? messages.workPlanAddingWork : drafts.length ? fillPlaceholders(messages.addWorkSubmitCount, { count: String(drafts.length) }) : messages.workPlanAddWorkSubmit}
        </Button>
      </div>
    </div>
  );
}

const CATEGORY_HINT: Record<string, 'workPlanDetailingHint' | 'workPlanAlignmentHint' | 'workPlanQcHint'> = {
  Detailing: 'workPlanDetailingHint',
  'Suspension & Steering': 'workPlanAlignmentHint',
  'Quality Check': 'workPlanQcHint',
};
