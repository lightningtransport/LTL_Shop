'use client';

import { Plus } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { JobAliasOptionDto } from '@ltl-shop/shared';
import { canonicalAliasOptions } from '@/lib/job-catalog';
import { useAliasOptions } from '@/lib/shop-data';
import { Button, Input, Label, Modal } from '@/components/ui';

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
  categoryName,
  existingCatalogJobIds = [],
  existingDisplayNames = [],
  onClose,
  onAdd,
  returnFocusRef,
}: {
  open: boolean;
  defaultCategoryId: string;
  categoryName: string;
  existingCatalogJobIds?: string[];
  existingDisplayNames?: string[];
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
  const { data: aliasData } = useAliasOptions(categoryId, open);
  const allAliases = aliasData ?? [];

  useEffect(() => {
    if (!open) return;
    setCategoryId(defaultCategoryId);
    setQuery('');
    setCustomOpen(false);
    setCustomName('');
    submittingRef.current.clear();
    setSubmittingIds(new Set());
  }, [defaultCategoryId, open]);

  const normalizedExistingNames = useMemo(
    () => new Set(existingDisplayNames.map(normalizeJobName)),
    [existingDisplayNames],
  );
  const options = useMemo(
    () => canonicalAliasOptions(allAliases, query).filter(
      (option) =>
        !existingCatalogJobIds.includes(option.catalogJobId) &&
        !normalizedExistingNames.has(normalizeJobName(option.displayName)),
    ),
    [allAliases, existingCatalogJobIds, normalizedExistingNames, query],
  );
  const customIsDuplicate = normalizedExistingNames.has(normalizeJobName(customName));
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

  return (
    <Modal open={open} title="Add job" onClose={onClose} returnFocusRef={returnFocusRef}>
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Adding a job to {categoryName}.</p>
        {!customOpen && options.length > 6 ? <div>
          <Label className="section-label block" htmlFor="job-picker-search">Search job or alias</Label>
          <Input
            id="job-picker-search"
            className="mt-2"
            placeholder="Search job / alias (e.g. 3 in one)"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div> : null}
        {!customOpen ? <ul className="max-h-56 space-y-1 overflow-auto" aria-label="Available jobs">
          {options.length ? options.map((option) => {
            const key = `catalog:${option.catalogJobId}`;
            return (
              <li key={option.catalogJobId}>
                <Button
                  variant="ghost"
                  className="w-full justify-between px-3 text-left font-normal hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                  disabled={submittingIds.has(key)}
                  aria-label={`Add ${option.displayName}`}
                  onClick={() => void submit({
                    catalogJobId: option.catalogJobId,
                    categoryId: option.categoryId,
                    displayName: option.displayName,
                  }, key)}
                >
                  <span>{option.displayName}</span>
                  <Plus aria-hidden="true" className="size-4 shrink-0" />
                </Button>
              </li>
            );
          }) : (
            <li className="px-3 py-2 text-sm text-muted-foreground">
              {query.trim() ? 'No matching jobs.' : 'No listed jobs are available for this category.'}
            </li>
          )}
        </ul> : null}
        <Button
          variant="secondary"
          className="w-full"
          aria-expanded={customOpen}
          aria-controls="job-not-listed-form"
          onClick={() => setCustomOpen((current) => !current)}
        >
          {customOpen ? 'Back to listed jobs' : 'Job not listed'}
        </Button>
        {customOpen ? (
          <div id="job-not-listed-form" className="space-y-2">
            <p className="text-xs text-muted-foreground">Custom job in {categoryName}.</p>
            <Label className="section-label block" htmlFor="job-picker-custom">Custom job description</Label>
            <Input
              id="job-picker-custom"
              placeholder="Describe the job"
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
              Add custom job
            </Button>
            {customIsDuplicate ? <p className="text-sm text-muted-foreground" role="status">This job is already on the Work Order.</p> : null}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
