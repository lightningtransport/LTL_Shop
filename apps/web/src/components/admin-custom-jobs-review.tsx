'use client';

import { useState } from 'react';
import { Link2, Plus, RotateCcw, Check } from 'lucide-react';
import type { AdminCustomJobGroupDto } from '@ltl-shop/shared';
import { useActionToast } from './action-toast';
import { AdminNavLink } from './admin-nav-link';
import { useAdminBreadcrumb } from './admin-breadcrumb';
import { AdminBackLink, Badge, Button, DialogActions, EmptyState, InlineAlert, Input, Label, LoadFailure, Modal, PageHeader, PageSkeleton } from './ui';
import { useCanShowManagerWrites } from '@/lib/admin-actor';
import { reviewAdminCustomJobs, undoAdminCustomJobs, useAdminCatalogSearch, useAdminCustomJobs } from '@/lib/admin-data';
import { fillPlaceholders } from '@/lib/admin-next-step';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';
import { apiErrorMessage } from '@/lib/api-error-message';
import { formatShortDateTime } from '@/lib/work-order-view';
import { cn } from '@/lib/utils';
import { useUrlFilters } from '@/lib/use-url-filters';

type Dialog = { kind: 'tie' | 'add'; group: AdminCustomJobGroupDto } | null;

/**
 * LTR-57 / D25: Job Catalog → Custom Jobs to review. Each card is a group (one category, one name ignoring capitals,
 * accents and spaces): how often it was used, where, the notes, and catalog Jobs that look alike. One tap settles the
 * whole group: tie it to a catalog Job (its name stays as an alias), add it to the catalog, or keep it as a one-off.
 * Reviewed groups can be undone. Work Orders keep their names.
 */
const CUSTOM_JOBS_FILTERS = { tab: '' };

export function AdminCustomJobsReview({ locale, messages }: { locale: AdminLocale; messages: AdminMessages }) {
  const canWrite = useCanShowManagerWrites();
  const { showToast } = useActionToast();
  // LTR-293 §9: the tab is in the URL (?tab=reviewed), so a reload, Back or a shared link keeps it.
  const { filters, set } = useUrlFilters(CUSTOM_JOBS_FILTERS);
  const tab: 'pending' | 'reviewed' = filters.tab === 'reviewed' ? 'reviewed' : 'pending';
  const setTab = (next: 'pending' | 'reviewed') => set('tab', next === 'reviewed' ? 'reviewed' : '');
  const { data, error, isLoading, mutate } = useAdminCustomJobs(tab);
  // LTR-245 (UX-5-007): "Job Catalog › Custom Jobs to review" in the top bar.
  useAdminBreadcrumb([{ label: messages.jobCatalog, href: '/admin/catalog' }, { label: messages.cjInbox }]);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const keyOf = (group: AdminCustomJobGroupDto) => `${group.categoryId}|${group.nameNorm}`;
  const failure = (cause: unknown) => apiErrorMessage(cause, messages, messages.catalogWriteFailed);

  async function act(group: AdminCustomJobGroupDto, run: () => Promise<string>) {
    setBusyKey(keyOf(group));
    setActionError(null);
    try {
      showToast('success', await run());
      setDialog(null);
      void mutate();
    } catch (cause) {
      setActionError(failure(cause));
    } finally {
      setBusyKey(null);
    }
  }

  const tie = (group: AdminCustomJobGroupDto, catalogJobId: string, jobName: string, addAlias = true) => act(group, async () => {
    const done = await reviewAdminCustomJobs({ categoryId: group.categoryId, nameNorm: group.nameNorm, action: 'map', catalogJobId, addAlias });
    return fillPlaceholders(messages.cjDoneMapped, { count: String(done.updated), job: done.catalogJob?.displayName ?? jobName });
  });

  return (
    <div className="space-y-6">
      <AdminBackLink href="/admin/catalog">{messages.backToCatalog}</AdminBackLink>
      <PageHeader title={messages.cjInbox} subtitle={messages.cjSubtitle} />
      <div role="tablist" aria-label={messages.cjInbox} className="flex gap-1 border-b">
        {(['pending', 'reviewed'] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={cn('-mb-px inline-flex items-center border-b-2 px-3 py-2 text-sm [@media(pointer:coarse)]:min-h-11', tab === value ? 'border-primary font-medium' : 'border-transparent text-muted-foreground hover:text-foreground')}
          >
            {value === 'pending' ? messages.cjPendingTab : messages.cjReviewedTab}
          </button>
        ))}
      </div>
      {actionError && !dialog ? <InlineAlert>{actionError}</InlineAlert> : null}
      {error ? <LoadFailure message={messages.loadError} retryLabel={messages.retry} onRetry={() => void mutate()} /> : null}
      {isLoading && !data ? <PageSkeleton label={messages.cjInbox} header={false} /> : null}
      {data && !data.length ? <EmptyState><p>{tab === 'pending' ? messages.cjEmptyPending : messages.cjEmptyReviewed}</p></EmptyState> : null}

      <ul className="space-y-3" data-testid="custom-job-groups">
        {(data ?? []).map((group) => {
          const busy = busyKey === keyOf(group);
          return (
            <li key={keyOf(group)} className="space-y-3 rounded-xl border bg-card p-4" data-testid="custom-job-group">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{group.displayName}</p>
                  <p className="text-xs text-muted-foreground">
                    {group.categoryName} · {group.count === 1
                      ? fillPlaceholders(messages.cjUsedOnce, { date: formatShortDateTime(group.lastAddedAt, locale) })
                      : fillPlaceholders(messages.cjUsed, { count: String(group.count), date: formatShortDateTime(group.lastAddedAt, locale) })}
                  </p>
                  {group.otherNames.length ? <p className="text-xs text-muted-foreground">{fillPlaceholders(messages.cjAlsoWritten, { names: group.otherNames.map((name) => `"${name}"`).join(', ') })}</p> : null}
                </div>
                {group.status !== 'pending_review' ? (
                  <Badge variant={group.status === 'kept' ? 'secondary' : 'success'}>
                    {group.status === 'kept' ? messages.cjStatusKept
                      : fillPlaceholders(group.status === 'added' ? messages.cjStatusAdded : messages.cjStatusMapped, { job: group.mappedTo?.displayName ?? '—' })}
                  </Badge>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-1.5 text-xs">
                {group.workOrders.map((workOrder) => (
                  <AdminNavLink key={workOrder.id} className="tap-inline rounded-md border px-1.5 py-0.5 font-mono text-muted-foreground hover:text-foreground" href={`/admin/work-orders/${workOrder.id}`}>
                    {workOrder.displayId} · {workOrder.truckNumber}
                  </AdminNavLink>
                ))}
              </div>
              {group.descriptions.length ? (
                <ul className="space-y-0.5 text-sm text-muted-foreground">
                  {group.descriptions.map((text) => <li key={text}>“{text}”</li>)}
                </ul>
              ) : null}

              {canWrite && group.status === 'pending_review' ? (
                <div className="space-y-2 border-t pt-3">
                  {group.suggestions.length ? (
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="text-muted-foreground">{messages.cjLooksLike}</span>
                      {group.suggestions.map((suggestion) => (
                        <Button key={suggestion.catalogJobId} type="button" size="sm" variant="outline" disabled={busy} onClick={() => void tie(group, suggestion.catalogJobId, suggestion.displayName)}>
                          <Link2 aria-hidden="true" />{fillPlaceholders(messages.cjTieTo, { job: `${suggestion.displayName} (${suggestion.categoryName})` })}
                        </Button>
                      ))}
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setDialog({ kind: 'tie', group })}><Link2 aria-hidden="true" />{messages.cjTieOther}</Button>
                    <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setDialog({ kind: 'add', group })}><Plus aria-hidden="true" />{messages.cjAdd}</Button>
                    <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void act(group, async () => {
                      await reviewAdminCustomJobs({ categoryId: group.categoryId, nameNorm: group.nameNorm, action: 'keep' });
                      return messages.cjDoneKept;
                    })}><Check aria-hidden="true" />{messages.cjKeep}</Button>
                  </div>
                </div>
              ) : null}
              {canWrite && group.status !== 'pending_review' ? (
                <div className="border-t pt-3">
                  <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void act(group, async () => {
                    await undoAdminCustomJobs(group.categoryId, group.nameNorm);
                    return messages.cjDoneUndo;
                  })}><RotateCcw aria-hidden="true" />{messages.cjUndo}</Button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {dialog?.kind === 'tie' ? (
        <TieDialog group={dialog.group} messages={messages} error={actionError} busy={busyKey === keyOf(dialog.group)} onClose={() => { setDialog(null); setActionError(null); }} onTie={(id, name, alias) => void tie(dialog.group, id, name, alias)} />
      ) : null}
      {dialog?.kind === 'add' ? (
        <AddDialog
          group={dialog.group}
          messages={messages}
          error={actionError}
          busy={busyKey === keyOf(dialog.group)}
          onClose={() => { setDialog(null); setActionError(null); }}
          onAdd={(displayName) => void act(dialog.group, async () => {
            const done = await reviewAdminCustomJobs({ categoryId: dialog.group.categoryId, nameNorm: dialog.group.nameNorm, action: 'add', displayName });
            return fillPlaceholders(messages.cjDoneAdded, { job: done.catalogJob?.displayName ?? displayName, count: String(done.updated) });
          })}
        />
      ) : null}
    </div>
  );
}

function TieDialog({ group, messages, error, busy, onClose, onTie }: {
  group: AdminCustomJobGroupDto;
  messages: AdminMessages;
  error: string | null;
  busy: boolean;
  onClose: () => void;
  onTie: (catalogJobId: string, name: string, addAlias: boolean) => void;
}) {
  const [query, setQuery] = useState(group.displayName);
  const [picked, setPicked] = useState<{ id: string; name: string } | null>(null);
  const [addAlias, setAddAlias] = useState(true);
  const { data: hits } = useAdminCatalogSearch(query);
  return (
    <Modal open title={fillPlaceholders(messages.cjTieTitle, { name: group.displayName })} description={fillPlaceholders(messages.cjTieHelp, { count: String(group.count) })} onClose={onClose} closeLabel={messages.closeDialog}>
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (picked) onTie(picked.id, picked.name, addAlias); }}>
        <div className="space-y-1.5">
          <Label htmlFor="custom-tie-search">{messages.cjSearchCatalog}</Label>
          <Input id="custom-tie-search" value={query} onChange={(event) => { setQuery(event.target.value); setPicked(null); }} autoComplete="off" disabled={busy} />
        </div>
        <ul className="max-h-64 divide-y overflow-y-auto rounded-lg border" role="listbox" aria-label={messages.cjSearchCatalog} data-testid="custom-tie-results">
          {(hits ?? []).filter((hit) => hit.status === 'active').map((hit) => (
            <li key={hit.jobId}>
              <button
                type="button"
                role="option"
                aria-selected={picked?.id === hit.jobId}
                onClick={() => setPicked({ id: hit.jobId, name: hit.displayName })}
                className={cn('flex w-full items-baseline justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent', picked?.id === hit.jobId && 'bg-primary/10')}
              >
                <span>{hit.displayName}{hit.matchedAlias ? <span className="ml-1 text-xs text-muted-foreground">({hit.matchedAlias})</span> : null}</span>
                <span className="text-xs text-muted-foreground">{hit.categoryName}</span>
              </button>
            </li>
          ))}
        </ul>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={addAlias} onChange={(event) => setAddAlias(event.target.checked)} disabled={busy} />
          {fillPlaceholders(messages.cjKeepAlias, { name: group.displayName })}
        </label>
        {error ? <InlineAlert>{error}</InlineAlert> : null}
        <DialogActions>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>{messages.cancel}</Button>
          <Button type="submit" disabled={busy || !picked}>{picked ? fillPlaceholders(messages.cjTieTo, { job: picked.name }) : messages.cjTie}</Button>
        </DialogActions>
      </form>
    </Modal>
  );
}

function AddDialog({ group, messages, error, busy, onClose, onAdd }: {
  group: AdminCustomJobGroupDto;
  messages: AdminMessages;
  error: string | null;
  busy: boolean;
  onClose: () => void;
  onAdd: (displayName: string) => void;
}) {
  const [name, setName] = useState(group.displayName.trim());
  return (
    <Modal open title={fillPlaceholders(messages.cjAddTitle, { name: group.displayName })} description={fillPlaceholders(messages.cjAddHelp, { category: group.categoryName, count: String(group.count) })} onClose={onClose} closeLabel={messages.closeDialog}>
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (name.trim()) onAdd(name.trim()); }}>
        <div className="space-y-1.5">
          <Label htmlFor="custom-add-name">{messages.cjCatalogName}</Label>
          <Input id="custom-add-name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="off" disabled={busy} />
        </div>
        {error ? <InlineAlert>{error}</InlineAlert> : null}
        <DialogActions>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>{messages.cancel}</Button>
          <Button type="submit" disabled={busy || !name.trim()}>{messages.cjAddButton}</Button>
        </DialogActions>
      </form>
    </Modal>
  );
}
