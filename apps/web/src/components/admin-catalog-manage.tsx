'use client';

import { forwardRef, useState } from 'react';
import Link from 'next/link';
import { Lock, MoreHorizontal, Pencil, Plus, Power, Trash2, X } from 'lucide-react';
import {
  CatalogStatus,
  ShopWorkflowStepKey,
  type AdminCatalogCategorySummaryDto,
  type AdminCatalogJobDto,
} from '@ltl-shop/shared';
import { useActionToast, type ActionToastAction } from './action-toast';
import { AdminNavLink } from './admin-nav-link';
import { RenameJobDialog } from './admin-catalog-write';
import { stepLabel } from './admin-shop-workflow';
import { ResponsiveMenu, type MenuItem } from './responsive-menu';
import { Badge, Button, DialogActions, InlineAlert, Input, Label, Modal } from './ui';
import {
  addAdminCatalogAlias,
  createAdminCatalogCategory,
  deleteAdminCatalogCategory,
  deleteAdminCatalogJob,
  removeAdminCatalogAlias,
  updateAdminCatalogCategory,
  updateAdminCatalogJob,
  useAdminCatalogSearch,
} from '@/lib/admin-data';
import { fillPlaceholders } from '@/lib/admin-next-step';
import type { AdminMessages } from '@/lib/admin-messages';
import { apiErrorCode } from '@/lib/api-error-message';
import { adminWriteFailureMessage } from '@/lib/system-admin';
import { ApiError } from '@/lib/api';
import { withoutTicketId } from '@/lib/catalog-reason';

const catalogCopy = (messages: AdminMessages) => ({
  locale: messages.locale,
  apiError: messages.apiError,
  forbidden: messages.catalogWriteForbidden,
  conflict: messages.catalogWriteConflict,
  failed: messages.catalogWriteFailed,
});

/** UX-7-003: an alias clash names the Job and Category that already have it (the API returns them). */
function failureText(failure: unknown, messages: AdminMessages) {
  if (failure instanceof ApiError && apiErrorCode(failure) === 'CATALOG_ALIAS_EXISTS') {
    const body = failure.body as { jobName?: string; categoryName?: string; aliasText?: string } | undefined;
    if (body?.jobName && body.aliasText) {
      return fillPlaceholders(messages.catalogAliasTaken, { alias: body.aliasText, job: body.jobName, category: body.categoryName ?? '' });
    }
  }
  return adminWriteFailureMessage(failure, catalogCopy(messages));
}

/** The "…" button. It forwards ref and props so the menu (Radix `asChild`) can open it. */
const MenuTrigger = forwardRef<HTMLButtonElement, { label: string } & React.ButtonHTMLAttributes<HTMLButtonElement>>(
  function MenuTrigger({ label, ...props }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        className="grid size-11 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground [@media(pointer:fine)]:size-9"
        aria-label={label}
        {...props}
      >
        <MoreHorizontal aria-hidden="true" className="size-4" />
      </button>
    );
  },
);

/** LTR-198 / D30: Add Category. */
export function AddCategoryButton({ messages, onAdded }: { messages: AdminMessages; onAdded: () => void }) {
  const { showToast } = useActionToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await createAdminCatalogCategory(name);
      showToast('success', messages.catalogCategoryAdded);
      setOpen(false);
      setName('');
      onAdded();
    } catch (failure) {
      setError(failureText(failure, messages));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}><Plus aria-hidden="true" />{messages.catalogAddCategory}</Button>
      <Modal open={open} title={messages.catalogAddCategory} onClose={() => setOpen(false)} closeLabel={messages.closeDialog} dismissible={!name.trim()}>
        <form className="space-y-4" onSubmit={(event) => void submit(event)}>
          <div className="space-y-1.5">
            <Label htmlFor="catalog-category-name">{messages.catalogCategoryName}</Label>
            <Input id="catalog-category-name" value={name} onChange={(event) => setName(event.target.value)} disabled={busy} autoComplete="off" />
          </div>
          {error ? <InlineAlert>{error}</InlineAlert> : null}
          <DialogActions>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>{messages.cancel}</Button>
            <Button type="submit" disabled={busy || !name.trim()}>{messages.catalogAddCategory}</Button>
          </DialogActions>
        </form>
      </Modal>
    </>
  );
}

type CategoryDialog = 'rename' | 'deactivate' | 'delete' | null;

/** LTR-198 / D30, D-SET9: a Category's "…" — rename, activate or deactivate (optional reason), delete. */
export function CategoryMenu({
  category,
  messages,
  onChanged,
  onDeleted,
}: {
  category: AdminCatalogCategorySummaryDto;
  messages: AdminMessages;
  onChanged: () => void;
  onDeleted?: () => void;
}) {
  const { showToast } = useActionToast();
  const [dialog, setDialog] = useState<CategoryDialog>(null);
  const [name, setName] = useState(category.name);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = Boolean(category.systemKey);
  const inactive = category.status === CatalogStatus.INACTIVE;

  function open(next: CategoryDialog) {
    setName(category.name);
    setReason('');
    setError(null);
    setDialog(next);
  }

  async function run(work: () => Promise<unknown>, done: string, after?: () => void) {
    setBusy(true);
    setError(null);
    try {
      await work();
      showToast('success', done);
      setDialog(null);
      (after ?? onChanged)();
    } catch (failure) {
      setError(failureText(failure, messages));
    } finally {
      setBusy(false);
    }
  }

  const items: MenuItem[] = locked ? [] : ([
    // LTR-293 §13: menu items that open a dialog end in "…".
    { key: 'rename', label: `${messages.catalogRenameCategory}…`, icon: Pencil, onSelect: () => open('rename') },
    inactive
      ? { key: 'activate', label: messages.catalogActivateCategory, icon: Power, onSelect: () => void run(() => updateAdminCatalogCategory(category.id, { status: CatalogStatus.ACTIVE }), messages.catalogCategoryActivated) }
      : category.holdsSystemJob ? null : { key: 'deactivate', label: `${messages.catalogDeactivateCategory}…`, icon: Power, onSelect: () => open('deactivate') },
    { key: 'delete', label: `${messages.catalogDeleteCategory}…`, icon: Trash2, destructive: true, separatorBefore: true, onSelect: () => open('delete') },
  ] as Array<MenuItem | null>).filter((item): item is MenuItem => item !== null);

  if (!items.length) return null;
  return (
    <>
      <ResponsiveMenu label={category.name} items={items} trigger={<MenuTrigger label={fillPlaceholders(messages.catalogCategoryActions, { name: category.name })} />} />
      {error && !dialog ? <InlineAlert>{error}</InlineAlert> : null}
      <Modal open={dialog === 'rename'} title={messages.catalogRenameCategory} onClose={() => setDialog(null)} closeLabel={messages.closeDialog}>
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void run(() => updateAdminCatalogCategory(category.id, { name: name.trim() }), messages.catalogCategoryRenamed); }}>
          <div className="space-y-1.5">
            <Label htmlFor={`category-rename-${category.id}`}>{messages.catalogCategoryName}</Label>
            <Input id={`category-rename-${category.id}`} value={name} onChange={(event) => setName(event.target.value)} disabled={busy} autoComplete="off" />
          </div>
          {error ? <InlineAlert>{error}</InlineAlert> : null}
          <DialogActions>
            <Button type="button" variant="outline" onClick={() => setDialog(null)} disabled={busy}>{messages.cancel}</Button>
            <Button type="submit" disabled={busy || !name.trim() || name.trim() === category.name}>{messages.catalogRenameCategory}</Button>
          </DialogActions>
        </form>
      </Modal>
      <Modal open={dialog === 'deactivate'} title={messages.catalogDeactivateCategory} description={category.name} onClose={() => setDialog(null)} closeLabel={messages.closeDialog}>
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void run(() => updateAdminCatalogCategory(category.id, { status: CatalogStatus.INACTIVE, inactiveReason: reason.trim() || null }), messages.catalogCategoryDeactivated); }}>
          <p className="text-sm text-muted-foreground">{messages.catalogDeactivateCategoryHint}</p>
          <div className="space-y-1.5">
            <Label htmlFor={`category-reason-${category.id}`}>{messages.catalogDeactivateReason}</Label>
            <Input id={`category-reason-${category.id}`} value={reason} maxLength={200} onChange={(event) => setReason(event.target.value)} disabled={busy} autoComplete="off" />
          </div>
          {error ? <InlineAlert>{error}</InlineAlert> : null}
          <DialogActions>
            <Button type="button" variant="outline" onClick={() => setDialog(null)} disabled={busy}>{messages.cancel}</Button>
            <Button type="submit" variant="destructive" disabled={busy}>{messages.catalogDeactivateCategory}</Button>
          </DialogActions>
        </form>
      </Modal>
      <Modal open={dialog === 'delete'} title={messages.catalogDeleteCategory} onClose={() => setDialog(null)} closeLabel={messages.closeDialog}>
        <div className="space-y-4">
          <p className="text-sm">{fillPlaceholders(messages.catalogDeleteCategoryConfirm, { name: category.name })}</p>
          {error ? <InlineAlert>{error}</InlineAlert> : null}
          <DialogActions>
            <Button type="button" variant="outline" onClick={() => setDialog(null)} disabled={busy}>{messages.cancel}</Button>
            <Button type="button" variant="destructive" disabled={busy} onClick={() => void run(() => deleteAdminCatalogCategory(category.id), messages.catalogCategoryDeleted, onDeleted)}>{messages.catalogDeleteCategory}</Button>
          </DialogActions>
        </div>
      </Modal>
    </>
  );
}

/** Badges and the one-line note under a Category's name: Shop workflow lock, inactive and why. */
export function CategoryStatusNote({ category, messages }: { category: AdminCatalogCategorySummaryDto; messages: AdminMessages }) {
  return (
    <>
      {category.systemKey ? <Badge variant="outline"><Lock aria-hidden="true" className="size-3" />{messages.catalogSystemBadge}</Badge> : null}
      {category.status === CatalogStatus.INACTIVE ? <Badge variant="secondary">{messages.catalogInactive}</Badge> : null}
      {category.status === CatalogStatus.INACTIVE && category.inactiveReason ? (
        <span className="w-full text-xs text-muted-foreground">{withoutTicketId(category.inactiveReason)}</span>
      ) : null}
    </>
  );
}

/**
 * LTR-198 / D30: one Job of a Category — status, the System Job lock, "Used by", alias chips (add and remove) and
 * its "…" (rename, activate or deactivate, delete if never used — otherwise it says to deactivate).
 */
export function CatalogJobRow({
  job,
  categoryActive,
  messages,
  onChanged,
}: {
  job: AdminCatalogJobDto;
  categoryActive: boolean;
  messages: AdminMessages;
  onChanged: () => void;
}) {
  const { showToast } = useActionToast();
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [alias, setAlias] = useState('');
  const [addingAlias, setAddingAlias] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inactive = job.status === CatalogStatus.INACTIVE;
  const locked = Boolean(job.systemKey);
  const used = job.workOrderCount ?? 0;

  async function run(work: () => Promise<unknown>, done: string, after?: () => void, action?: ActionToastAction) {
    setBusy(true);
    setError(null);
    try {
      await work();
      showToast('success', done, action);
      after?.();
      onChanged();
    } catch (failure) {
      setError(failureText(failure, messages));
    } finally {
      setBusy(false);
    }
  }

  const items: MenuItem[] = [
    { key: 'rename', label: messages.catalogRenameJob, icon: Pencil, onSelect: () => setRenameOpen(true) },
    ...(locked ? [] : ([
      inactive
        ? (categoryActive ? { key: 'activate', label: messages.catalogActivateJob, icon: Power, onSelect: () => void run(() => updateAdminCatalogJob(job.id, { status: CatalogStatus.ACTIVE }), messages.catalogJobActivated) } : null)
        : { key: 'deactivate', label: messages.catalogDeactivateJob, icon: Power, onSelect: () => void run(() => updateAdminCatalogJob(job.id, { status: CatalogStatus.INACTIVE }), messages.catalogJobDeactivated) },
      { key: 'delete', label: messages.catalogDeleteJob, icon: Trash2, destructive: true, separatorBefore: true, onSelect: () => { setError(null); setDeleteOpen(true); } },
    ] as Array<MenuItem | null>).filter((item): item is MenuItem => item !== null)),
  ];
  const nameNorm = job.displayName.trim().toLowerCase();

  return (
    <li className="grid gap-2 px-4 py-3 md:grid-cols-[minmax(0,14rem)_6rem_minmax(0,1fr)_minmax(0,10rem)_2.5rem] md:items-start" data-testid="catalog-job-row">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <p className="font-medium">{job.displayName}</p>
        {locked ? <Badge variant="outline" title={messages.catalogSystemJobHint}><Lock aria-hidden="true" className="size-3" />{messages.catalogSystemJob}</Badge> : null}
      </div>
      <div>{inactive ? <Badge variant="secondary">{messages.catalogInactive}</Badge> : <Badge variant="success" dot>{messages.catalogActive}</Badge>}</div>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5" aria-label={messages.catalogJobAliases}>
        {(job.aliasItems ?? []).map((item) => (
          <span key={item.id} className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-0.5 text-xs">
            {item.text}
            {item.text.trim().toLowerCase() !== nameNorm ? (
              <button
                type="button"
                className="tap-inline text-muted-foreground hover:text-foreground"
                aria-label={fillPlaceholders(messages.catalogRemoveAlias, { alias: item.text })}
                disabled={busy}
                // LTR-293 §6: the X removes at once, so the toast offers the alias back.
                onClick={() => void run(() => removeAdminCatalogAlias(job.id, item.id), messages.catalogAliasRemoved, undefined, {
                  label: messages.undo,
                  onAction: () => void run(() => addAdminCatalogAlias(job.id, item.text), messages.catalogAliasAdded),
                })}
              >
                <X aria-hidden="true" className="size-3" />
              </button>
            ) : null}
          </span>
        ))}
        {addingAlias ? (
          <form
            className="flex items-center gap-1"
            onSubmit={(event) => {
              event.preventDefault();
              if (!alias.trim()) return;
              void run(() => addAdminCatalogAlias(job.id, alias), messages.catalogAliasAdded, () => { setAlias(''); setAddingAlias(false); });
            }}
          >
            <Input
              autoFocus
              value={alias}
              onChange={(event) => setAlias(event.target.value)}
              aria-label={fillPlaceholders(messages.catalogAddAliasLabel, { job: job.displayName })}
              className="h-8 w-40"
              disabled={busy}
              onKeyDown={(event) => { if (event.key === 'Escape') { setAddingAlias(false); setAlias(''); } }}
            />
            <Button type="submit" size="sm" disabled={busy || !alias.trim()}>{messages.catalogAddAlias}</Button>
          </form>
        ) : (
          <button type="button" className="tap-inline inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground" onClick={() => setAddingAlias(true)}>
            <Plus aria-hidden="true" className="size-3" />{messages.catalogAddAlias}
          </button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {job.usedByStep ? (
          <AdminNavLink className="tap-inline text-primary hover:underline" href="/admin/setup/workflow">
            {fillPlaceholders(messages.catalogUsedByStep, { step: stepLabel(job.usedByStep as ShopWorkflowStepKey, messages) })}
          </AdminNavLink>
        ) : null}
        {job.usedByStep && used ? ' · ' : null}
        {used ? fillPlaceholders(messages.catalogWorkOrderCount, { count: String(used) }) : job.usedByStep ? null : messages.catalogNotUsed}
      </p>
      <div className="justify-self-end">
        <ResponsiveMenu label={job.displayName} items={items} trigger={<MenuTrigger label={fillPlaceholders(messages.catalogJobActions, { name: job.displayName })} />} />
      </div>
      {error ? <InlineAlert className="md:col-span-5">{error}</InlineAlert> : null}
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
      <Modal open={deleteOpen} title={messages.catalogDeleteJob} onClose={() => setDeleteOpen(false)} closeLabel={messages.closeDialog}>
        <div className="space-y-4">
          <p className="text-sm">
            {used
              ? fillPlaceholders(messages.catalogDeleteJobInUse, { name: job.displayName, count: String(used) })
              : fillPlaceholders(messages.catalogDeleteJobConfirm, { name: job.displayName })}
          </p>
          {error ? <InlineAlert>{error}</InlineAlert> : null}
          <DialogActions>
            <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)} disabled={busy}>{messages.cancel}</Button>
            {used ? (
              !inactive ? (
                <Button type="button" disabled={busy} onClick={() => void run(() => updateAdminCatalogJob(job.id, { status: CatalogStatus.INACTIVE }), messages.catalogJobDeactivated, () => setDeleteOpen(false))}>
                  {messages.catalogDeactivateJob}
                </Button>
              ) : null
            ) : (
              <Button type="button" variant="destructive" disabled={busy} onClick={() => void run(() => deleteAdminCatalogJob(job.id), messages.catalogJobDeleted, () => setDeleteOpen(false))}>
                {messages.catalogDeleteJob}
              </Button>
            )}
          </DialogActions>
        </div>
      </Modal>
    </li>
  );
}

/** LTR-198 / JC2: Jobs and aliases matching the search, across every Category (accents and capitals ignored). */
export function CatalogSearchResults({ query, messages }: { query: string; messages: AdminMessages }) {
  const { data } = useAdminCatalogSearch(query);
  if (query.trim().length < 2 || !data) return null;
  return (
    <section className="overflow-hidden rounded-xl border bg-card" aria-labelledby="catalog-search-results" data-testid="catalog-search-results">
      <h2 id="catalog-search-results" className="border-b px-4 py-2.5 text-base font-semibold">{messages.catalogSearchResults}</h2>
      {data.length ? (
        <ul className="divide-y">
          {data.map((hit) => (
            <li key={hit.jobId}>
              {/* LTR-293 §12: a link, so Cmd/Ctrl-click and the middle button open it in a new tab. */}
              <Link
                className="flex min-h-11 w-full flex-wrap items-center gap-x-2 gap-y-0.5 px-4 py-2 text-left text-sm hover:bg-accent/40"
                href={`/admin/catalog/categories/${hit.categoryId}`}
              >
                <span className="font-medium">{hit.displayName}</span>
                {hit.matchedAlias ? <span className="text-xs text-muted-foreground">{fillPlaceholders(messages.catalogMatchedAlias, { alias: hit.matchedAlias })}</span> : null}
                <span className="text-xs text-muted-foreground">· {hit.categoryName}</span>
                {hit.status === CatalogStatus.INACTIVE || hit.categoryStatus === CatalogStatus.INACTIVE ? <Badge variant="secondary">{messages.catalogInactive}</Badge> : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : <p className="px-4 py-3 text-sm text-muted-foreground">{messages.catalogSearchNoJobs}</p>}
    </section>
  );
}
