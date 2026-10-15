'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSWRConfig } from 'swr';
import { isPmCategory, type CatalogJobDto, type JobCategoryDto, type TruckFaultRecommendationDto, type TruckWorkPlanDto } from '@ltl-shop/shared';
import { useCanShowManagerWrites } from '@/lib/admin-actor';
import { adminFaultRecommendationsKey, createAdminCatalogJob, dismissAdminTruckFault, linkAdminTruckFaults, useAdminFaultRecommendations } from '@/lib/admin-data';
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
import { WorkPlanFaultRecommendations } from './work-plan-fault-recommendations';
import { Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Button,
  InlineAlert,
  Input,
  Select,
} from './ui';

export function WorkPlanAddWork({
  truckId,
  plan,
  messages,
  disabled,
  submitting,
  preferredCategoryName,
  standardMechanics = [],
  onSubmit,
  onCancel,
}: {
  /** D42 / S-6: the truck whose Samsara faults are recommended at the top. */
  truckId?: string;
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

  // D42 / S-6: Samsara faults recommended as Jobs; the ones with a learned Job start checked.
  const { data: recommendations, mutate: refreshRecommendations } = useAdminFaultRecommendations(truckId ?? null);
  const [pickingFaultId, setPickingFaultId] = useState<string | null>(null);
  const [faultError, setFaultError] = useState<string | null>(null);
  const preselected = useRef(false);
  const checkedFaultIds = useMemo(() => new Set(drafts.flatMap((draft) => draft.samsaraFaultIds ?? [])), [drafts]);
  const pickingFault = recommendations?.items.find((item) => item.fault.id === pickingFaultId) ?? null;

  useEffect(() => {
    if (preselected.current || !recommendations) return;
    preselected.current = true;
    for (const item of recommendations.items) {
      if (item.suggestedJob && !item.existingJob) addFaultToJob(item, { id: item.suggestedJob.categoryId, name: item.suggestedJob.categoryName }, { id: item.suggestedJob.catalogJobId, displayName: item.suggestedJob.displayName });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the recommendations first load
  }, [recommendations]);

  /** Adds the fault to the draft of that catalog Job (one Job for several faults), creating the draft if needed. */
  function addFaultToJob(item: TruckFaultRecommendationDto, category: Pick<JobCategoryDto, 'id' | 'name'>, job: Pick<CatalogJobDto, 'id' | 'displayName'>) {
    setDrafts((current) => {
      const existing = current.find((draft) => draft.catalogJobId === job.id);
      if (existing) {
        if (existing.samsaraFaultIds?.includes(item.fault.id)) return current;
        return current.map((draft) => (draft === existing
          ? { ...draft, samsaraFaultIds: [...(draft.samsaraFaultIds ?? []), item.fault.id], samsaraFaultCodes: [...(draft.samsaraFaultCodes ?? []), item.fault.code] }
          : draft));
      }
      return [...current, {
        key: crypto.randomUUID(), catalogJobId: job.id, categoryId: category.id, categoryName: category.name, displayName: job.displayName,
        samsaraFaultIds: [item.fault.id], samsaraFaultCodes: [item.fault.code], fromSamsara: true,
      }];
    });
  }

  function removeFault(faultId: string) {
    setDrafts((current) => current.flatMap((draft) => {
      if (!draft.samsaraFaultIds?.includes(faultId)) return [draft];
      const index = draft.samsaraFaultIds.indexOf(faultId);
      const ids = draft.samsaraFaultIds.filter((id) => id !== faultId);
      const codes = (draft.samsaraFaultCodes ?? []).filter((_, i) => i !== index);
      if (!ids.length && draft.fromSamsara) return [];
      return [{ ...draft, samsaraFaultIds: ids.length ? ids : undefined, samsaraFaultCodes: ids.length ? codes : undefined }];
    }));
  }

  function toggleSuggested(item: TruckFaultRecommendationDto) {
    if (!item.suggestedJob || disabled) return;
    if (checkedFaultIds.has(item.fault.id)) removeFault(item.fault.id);
    else addFaultToJob(item, { id: item.suggestedJob.categoryId, name: item.suggestedJob.categoryName }, { id: item.suggestedJob.catalogJobId, displayName: item.suggestedJob.displayName });
  }

  async function linkToExisting(item: TruckFaultRecommendationDto) {
    if (!truckId || !item.existingJob) return;
    setFaultError(null);
    try {
      await refreshRecommendations(await linkAdminTruckFaults(truckId, { workOrderJobId: item.existingJob.id, faultIds: [item.fault.id] }), { revalidate: false });
      setCatalogNotice(fillPlaceholders(messages.faultRecLinked, { job: item.existingJob.displayName }));
      void mutate(`/api/admin/trucks/${truckId}/faults`);
    } catch {
      setFaultError(messages.faultRecFailed);
    }
  }

  async function dismissFault(item: TruckFaultRecommendationDto, reason: string) {
    if (!truckId) return;
    setFaultError(null);
    try {
      removeFault(item.fault.id);
      await refreshRecommendations(await dismissAdminTruckFault(truckId, item.fault.id, reason), { revalidate: false });
      setCatalogNotice(messages.faultRecDismissed);
      void mutate(`/api/admin/trucks/${truckId}/faults`);
    } catch {
      setFaultError(messages.faultRecFailed);
    }
  }

  // LTR-145: the PM Category is a normal Work Plan step.
  const standardCategories = categories ?? [];
  const selectedCategory = standardCategories.find((category) => category.id === categoryId) ?? null;
  const existingCatalogIds = useMemo(() => existingWorkPlanCatalogJobIds(plan), [plan]);
  // LTR-219 (LTR-145): one PM Job per Work Order. With one on the plan, the other PM services cannot be added here
  // (the API answers PM_JOB_EXISTS); they say so instead of failing after "Add to Work Plan".
  const planHasPm = plan.jobs.some((job) => isPmCategory(job.category.name) && job.status !== 'cancelled');
  const pmLocked = Boolean(selectedCategory && isPmCategory(selectedCategory.name) && planHasPm);
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

  // Stage 8 (mockup): the first category starts chosen. LTR-219: not PM — every Work Order already has its PM Job,
  // so opening on PM made the first thing the Manager picked fail.
  useEffect(() => {
    if (categoryId || preferredCategoryName || !standardCategories.length) return;
    setCategoryId((standardCategories.find((category) => !isPmCategory(category.name)) ?? standardCategories[0]).id);
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
    // D42 / S-6: picking the Job for a new fault code ties the fault to it (and the code learns it when added).
    if (pickingFault) {
      addFaultToJob(pickingFault, selectedCategory, job);
      setPickingFaultId(null);
      return;
    }
    setDrafts((current) => {
      if (draftContainsCatalogJob(current, job.id)) {
        return current.filter((draft) => draft.catalogJobId !== job.id);
      }
      return [...current, catalogDraft(selectedCategory, job)];
    });
  }

  function selectCatalogJob(category: JobCategoryDto, job: Pick<CatalogJobDto, 'id' | 'displayName'>) {
    if (pickingFault) {
      addFaultToJob(pickingFault, category, job);
      setPickingFaultId(null);
      return;
    }
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
      ...(pickingFault ? { samsaraFaultIds: [pickingFault.fault.id], samsaraFaultCodes: [pickingFault.fault.code], fromSamsara: true } : {}),
    }]);
    setPickingFaultId(null);
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
    if (truckId) {
      void mutate(adminFaultRecommendationsKey(truckId));
      void mutate(`/api/admin/trucks/${truckId}/faults`);
    }
    setDrafts([]);
    setCustomName('');
    setJobQuery('');
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1 space-y-5 px-5 py-4">
        {recommendations?.items.length ? (
          <WorkPlanFaultRecommendations
            items={recommendations.items}
            messages={messages}
            disabled={disabled}
            checkedFaultIds={checkedFaultIds}
            pickingFaultId={pickingFaultId}
            onToggleSuggested={toggleSuggested}
            onPick={(item) => { setPickingFaultId(item.fault.id); document.getElementById('add-work-category-label')?.scrollIntoView({ block: 'start', behavior: 'smooth' }); }}
            onCancelPick={() => setPickingFaultId(null)}
            onLink={linkToExisting}
            onDismiss={dismissFault}
            error={faultError}
          />
        ) : null}
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
                    category.id === categoryId ? 'border-primary bg-primary/15 text-primary-text' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
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
            {pmLocked ? (
              <p className="flex gap-2 rounded-md bg-sunken px-3 py-2 text-muted-foreground" data-testid="add-work-pm-locked">
                <Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />{messages.addWorkPmLockedHint}
              </p>
            ) : selectedCategory && CATEGORY_HINT[selectedCategory.name] ? (
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
              lockedIds={pmLocked ? (catalogJobs ?? []).map((job) => job.id) : []}
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
                locked: messages.addWorkPmLocked,
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
                    {job.samsaraFaultCodes?.length ? (
                      <p className="truncate text-xs text-primary">{fillPlaceholders(messages.faultRecFrom, { codes: job.samsaraFaultCodes.join(', ') })}</p>
                    ) : null}
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
