'use client';

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { CatalogJobDto, JobCategoryDto } from '@ltl-shop/shared';
import type { AdminMessages } from '@/lib/admin-messages';
import { useCatalogJobs } from '@/lib/shop-data';
import { Button, Input, Label, Modal } from '@/components/ui';
import { CategoryJobList } from './category-job-list';

export type PickedJob = {
  catalogJobId?: string;
  categoryId: string;
  displayName: string;
  customDescription?: string;
};

function normalizeJobName(name: string) {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
}

/** Shared catalog picker for both draft creation and an existing Work Order. */
export function JobPickerDialog({
  open,
  defaultCategoryId,
  primaryCategoryName,
  categories,
  existingCatalogJobIds = [],
  existingCustomDisplayNames = [],
  messages,
  onClose,
  onAdd,
  returnFocusRef,
}: {
  open: boolean;
  defaultCategoryId: string;
  primaryCategoryName: string;
  categories: JobCategoryDto[];
  existingCatalogJobIds?: string[];
  existingCustomDisplayNames?: string[];
  messages: AdminMessages;
  onClose: () => void;
  onAdd: (job: PickedJob) => boolean | void | Promise<boolean | void>;
  returnFocusRef?: RefObject<HTMLElement | null>;
}) {
  const [categoryId, setCategoryId] = useState(defaultCategoryId);
  const [query, setQuery] = useState('');
  const [customOpen, setCustomOpen] = useState(false);
  const [customName, setCustomName] = useState('');
  const [submittingIds, setSubmittingIds] = useState<Set<string>>(() => new Set());
  const submittingRef = useRef(new Set<string>());
  const { data: catalogJobs, error: jobsError, isLoading: jobsLoading } = useCatalogJobs(categoryId, open);

  useEffect(() => {
    if (!open) return;
    setCategoryId(defaultCategoryId);
    setQuery('');
    setCustomOpen(false);
    setCustomName('');
    submittingRef.current.clear();
    setSubmittingIds(new Set());
  }, [defaultCategoryId, open]);

  const standardCategories = useMemo(
    () => {
      const active = categories.filter((category) => category.name !== 'PM');
      return active.length
        ? active
        : [{ id: defaultCategoryId, name: primaryCategoryName, sortOrder: 0 }];
    },
    [categories, defaultCategoryId, primaryCategoryName],
  );
  const selectedCategory = standardCategories.find((category) => category.id === categoryId);
  const normalizedExistingCustomNames = useMemo(
    () => new Set(existingCustomDisplayNames.map(normalizeJobName)),
    [existingCustomDisplayNames],
  );
  const availableJobs = useMemo(
    () => (catalogJobs ?? []).filter((job) => !existingCatalogJobIds.includes(job.id)),
    [catalogJobs, existingCatalogJobIds],
  );
  const customIsDuplicate = normalizedExistingCustomNames.has(normalizeJobName(customName));
  async function submit(job: PickedJob, key: string) {
    if (submittingRef.current.has(key)) return;
    submittingRef.current.add(key);
    setSubmittingIds(new Set(submittingRef.current));

    try {
      const added = await onAdd(job);
      if (added !== false) onClose();
    } finally {
      submittingRef.current.delete(key);
      setSubmittingIds(new Set(submittingRef.current));
    }
  }

  function selectCatalogJob(job: CatalogJobDto) {
    if (submittingIds.has(`catalog:${job.id}`)) return;
    void submit({
      catalogJobId: job.id,
      categoryId: job.categoryId,
      displayName: job.displayName,
    }, `catalog:${job.id}`);
  }

  return (
    <Modal open={open} title={messages.jobPickerTitle} onClose={onClose} returnFocusRef={returnFocusRef}>
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{messages.addJobsLabel}</p>
        <div>
          <Label className="section-label block" htmlFor="job-picker-category">{messages.jobPickerCategoryLabel}</Label>
          <select
            id="job-picker-category"
            className="mt-2 flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={categoryId}
            onChange={(event) => {
              setCategoryId(event.target.value);
              setQuery('');
              setCustomOpen(false);
              setCustomName('');
            }}
          >
            {standardCategories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </div>
        {!customOpen ? (
          <CategoryJobList
            categoryName={selectedCategory?.name ?? primaryCategoryName}
            jobs={availableJobs}
            isLoading={jobsLoading}
            error={Boolean(jobsError)}
            query={query}
            onQueryChange={setQuery}
            selectedIds={[]}
            onSelect={selectCatalogJob}
            copy={{
              searchLabel: messages.searchJobsLabel,
              loading: messages.loadingJobs,
              loadError: messages.loadError,
              emptyCategory: messages.noJobsInCategory,
              noMatches: messages.noMatchingCategoryJobs,
              listLabel: messages.categoryJobsLabel,
              addJob: messages.addCatalogJob,
            }}
          />
        ) : null}
        <Button
          variant="secondary"
          className="w-full"
          aria-expanded={customOpen}
          aria-controls="job-not-listed-form"
          onClick={() => setCustomOpen((current) => !current)}
        >
          {customOpen ? messages.backToListedJobs : messages.jobNotListed}
        </Button>
        {customOpen ? (
          <div id="job-not-listed-form" className="space-y-2">
            <p className="text-xs text-muted-foreground">{selectedCategory?.name ?? primaryCategoryName}</p>
            <Label className="section-label block" htmlFor="job-picker-custom">{messages.customJobPlaceholder}</Label>
            <Input
              id="job-picker-custom"
              placeholder={messages.customJobPlaceholder}
              value={customName}
              onChange={(event) => setCustomName(event.target.value)}
            />
            <Button
              className="w-full"
              disabled={!customName.trim() || customIsDuplicate || submittingIds.has('custom')}
              onClick={() => void submit({
                categoryId,
                displayName: customName.trim(),
                customDescription: customName.trim(),
              }, 'custom')}
            >
              {messages.addCustomJob}
            </Button>
            {customIsDuplicate ? <p className="text-sm text-muted-foreground" role="status">{messages.jobsInPlan}</p> : null}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
