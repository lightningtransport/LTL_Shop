'use client';

import { useEffect, useState } from 'react';
import { CatalogStatus, type AdminCatalogCategorySummaryDto, type AdminCatalogJobDto } from '@ltl-shop/shared';
import { useActionToast } from './action-toast';
import { AdminWriteTip } from './admin-write-tip';
import { Button, InlineAlert, Input, Label, Modal, Select } from './ui';
import { createAdminCatalogJob, updateAdminCatalogJob } from '@/lib/admin-data';
import type { AdminMessages } from '@/lib/admin-messages';
import { adminWriteFailureMessage } from '@/lib/system-admin';

const catalogCopy = (messages: AdminMessages) => ({
  locale: messages.locale,
  apiError: messages.apiError,
  forbidden: messages.catalogWriteForbidden,
  conflict: messages.catalogWriteConflict,
  failed: messages.catalogWriteFailed,
});

export function AdminCatalogWriteActions({
  messages,
  categories,
  categoryId,
  onChanged,
}: {
  messages: AdminMessages;
  categories: AdminCatalogCategorySummaryDto[];
  categoryId?: string;
  onChanged: () => void;
}) {
  const { showToast } = useActionToast();
  const [jobOpen, setJobOpen] = useState(false);
  const activeCategories = categories.filter((category) => category.status === CatalogStatus.ACTIVE);
  const fixedCategory = categoryId ? activeCategories.find((category) => category.id === categoryId) ?? null : null;
  if (categoryId && !fixedCategory) return null;

  return (
    <>
      <Button type="button" onClick={() => setJobOpen(true)} disabled={!categoryId && activeCategories.length === 0}>
        {messages.catalogAddJob}
      </Button>
      <AddJobDialog
        open={jobOpen}
        messages={messages}
        categories={categoryId && fixedCategory ? [fixedCategory] : activeCategories}
        categoryId={categoryId}
        onClose={() => setJobOpen(false)}
        onCreated={() => {
          setJobOpen(false);
          showToast('success', messages.catalogJobAdded);
          onChanged();
        }}
      />
    </>
  );
}

export function AdminCatalogJobActions({
  job,
  messages,
  onChanged,
}: {
  job: AdminCatalogJobDto;
  messages: AdminMessages;
  onChanged: () => void;
}) {
  const { showToast } = useActionToast();
  const [renameOpen, setRenameOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function activate() {
    setBusy(true);
    setError(null);
    try {
      await updateAdminCatalogJob(job.id, { status: CatalogStatus.ACTIVE });
      showToast('success', messages.catalogJobActivated);
      onChanged();
    } catch (failure) {
      setError(adminWriteFailureMessage(failure, catalogCopy(messages)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => setRenameOpen(true)}>
          {messages.catalogRenameJob}
        </Button>
        {job.status === CatalogStatus.INACTIVE ? (
          <Button type="button" size="sm" onClick={() => void activate()} disabled={busy}>
            {messages.catalogActivateJob}
          </Button>
        ) : null}
      </div>
      {error ? <InlineAlert>{error}</InlineAlert> : null}
      <RenameJobDialog
        open={renameOpen}
        job={job}
        messages={messages}
        onClose={() => setRenameOpen(false)}
        onRenamed={() => {
          setRenameOpen(false);
          showToast('success', messages.catalogJobRenamed);
          onChanged();
        }}
      />
    </div>
  );
}

function AddJobDialog({
  open,
  messages,
  categories,
  categoryId,
  onClose,
  onCreated,
}: {
  open: boolean;
  messages: AdminMessages;
  categories: AdminCatalogCategorySummaryDto[];
  categoryId?: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [selectedCategoryId, setSelectedCategoryId] = useState(categoryId ?? '');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const resolvedCategoryId = categoryId ?? selectedCategoryId;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const name = displayName.trim();
    if (!resolvedCategoryId) {
      setError(categories.length === 0 ? messages.catalogActiveCategoryRequired : messages.catalogSelectCategoryRequired);
      return;
    }
    if (!name) {
      setError(messages.catalogJobNameRequired);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createAdminCatalogJob({ categoryId: resolvedCategoryId, displayName: name });
      setDisplayName('');
      setSelectedCategoryId(categoryId ?? '');
      onCreated();
    } catch (failure) {
      setError(adminWriteFailureMessage(failure, catalogCopy(messages)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} title={messages.catalogAddJob} onClose={onClose} closeLabel={messages.closeDialog}>
      <form className="space-y-4" onSubmit={(event) => void onSubmit(event)}>
        <AdminWriteTip>{messages.catalogAddJobTip}</AdminWriteTip>
        {categoryId ? null : (
          <div className="space-y-1.5">
            <Label htmlFor="catalog-job-category">{messages.catalogSelectCategory}</Label>
            <Select
              id="catalog-job-category"
              value={selectedCategoryId}
              onChange={(event) => setSelectedCategoryId(event.target.value)}
              disabled={busy || categories.length === 0}
            >
              <option value="">{messages.catalogSelectCategory}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </Select>
            {categories.length === 0 ? <p className="text-sm text-muted-foreground">{messages.catalogActiveCategoryRequired}</p> : null}
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="catalog-job-name">{messages.catalogJobName}</Label>
          <Input id="catalog-job-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} disabled={busy} autoComplete="off" />
        </div>
        {error ? <InlineAlert>{error}</InlineAlert> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>{messages.cancel}</Button>
          <Button type="submit" disabled={busy}>{messages.catalogAddJob}</Button>
        </div>
      </form>
    </Modal>
  );
}

function RenameJobDialog({
  open,
  job,
  messages,
  onClose,
  onRenamed,
}: {
  open: boolean;
  job: AdminCatalogJobDto;
  messages: AdminMessages;
  onClose: () => void;
  onRenamed: () => void;
}) {
  const [displayName, setDisplayName] = useState(job.displayName);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDisplayName(job.displayName);
    setError(null);
  }, [open, job.displayName]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const name = displayName.trim();
    if (!name) {
      setError(messages.catalogJobNameRequired);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateAdminCatalogJob(job.id, { displayName: name });
      onRenamed();
    } catch (failure) {
      setError(adminWriteFailureMessage(failure, catalogCopy(messages)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} title={messages.catalogRenameJob} onClose={onClose} closeLabel={messages.closeDialog}>
      <form className="space-y-4" onSubmit={(event) => void onSubmit(event)}>
        <AdminWriteTip>{messages.catalogAddJobTip}</AdminWriteTip>
        <div className="space-y-1.5">
          <Label htmlFor={`catalog-rename-${job.id}`}>{messages.catalogJobName}</Label>
          <Input
            id={`catalog-rename-${job.id}`}
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            disabled={busy}
            autoComplete="off"
          />
        </div>
        {error ? <InlineAlert>{error}</InlineAlert> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>{messages.cancel}</Button>
          <Button type="submit" disabled={busy}>{messages.catalogRenameJob}</Button>
        </div>
      </form>
    </Modal>
  );
}
