'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AppCapability,
  Priority,
  type JobAliasOptionDto,
  type TruckDto,
  type WorkOrderSummaryDto,
} from '@ltl-shop/shared';
import { ApiError, apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  createAdminWorkOrder,
  useAdminMechanics,
} from '@/lib/admin-data';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';
import { canonicalAliasOptions } from '@/lib/job-catalog';
import { useAliasOptions, useCategories, useTrucks } from '@/lib/shop-data';
import { rankTruckResults } from '@/lib/truck-search';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  InlineAlert,
  Input,
  Select,
  Textarea,
} from './ui';

type DraftJob = {
  key: string;
  catalogJobId?: string;
  categoryId: string;
  categoryName: string;
  displayName: string;
  customDescription?: string;
  assignedMechanicId?: string;
};

type SelectedTruck = {
  truck: TruckDto;
  openWorkOrder: { id: string; displayId: string } | null;
};

function normalizeJobName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function AdminNewWorkOrder({
  locale,
  messages,
}: {
  locale: AdminLocale;
  messages: AdminMessages;
}) {
  void locale;
  const router = useRouter();
  const { user } = useAuth();
  const canCreateWorkOrder = !!user?.capabilities.includes(AppCapability.WORK_ORDERS_MANAGE);
  const [truckQuery, setTruckQuery] = useState('');
  const [debouncedTruckQuery, setDebouncedTruckQuery] = useState('');
  const [selectedTruck, setSelectedTruck] = useState<SelectedTruck | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeResult, setActiveResult] = useState(-1);
  const [categoryId, setCategoryId] = useState('');
  const [jobQuery, setJobQuery] = useState('');
  const [jobs, setJobs] = useState<DraftJob[]>([]);
  const [priority, setPriority] = useState<Priority>(Priority.NORMAL);
  const [notes, setNotes] = useState('');
  const [customName, setCustomName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedTruckQuery(truckQuery.trim()), 250);
    return () => window.clearTimeout(handle);
  }, [truckQuery]);

  const { data: truckData, error: truckError, isLoading: trucksLoading } = useTrucks(true);
  const { data: categories, error: categoriesError, isLoading: categoriesLoading } = useCategories(true);
  const { data: aliasData, error: jobsError, isLoading: jobsLoading } = useAliasOptions(categoryId, Boolean(categoryId));
  const { data: mechanicPages, error: mechanicsError } = useAdminMechanics('');

  const trucks = useMemo(
    () => (debouncedTruckQuery && !selectedTruck
      ? rankTruckResults(truckData ?? [], debouncedTruckQuery).results
      : []),
    [debouncedTruckQuery, selectedTruck, truckData],
  );
  const standardCategories = (categories ?? []).filter((category) => category.name !== 'PM');
  const selectedCategory = standardCategories.find((category) => category.id === categoryId) ?? null;
  const assignableMechanics = useMemo(
    () => (mechanicPages?.flatMap((page) => page.items) ?? []).filter(
      (mechanic) => mechanic.active && mechanic.capabilities.includes(AppCapability.MECHANIC_STANDARD),
    ),
    [mechanicPages],
  );

  const catalogJobs = useMemo(
    () => canonicalAliasOptions(aliasData ?? [], jobQuery).filter(
      (option) => !jobs.some((draft) => draft.catalogJobId === option.catalogJobId),
    ),
    [aliasData, jobQuery, jobs],
  );

  const resultsOpen = searchOpen && Boolean(debouncedTruckQuery) && !selectedTruck;
  const primaryCategoryId = jobs[0]?.categoryId ?? categoryId;
  const canSubmit = Boolean(selectedTruck) && jobs.length > 0 && !selectedTruck?.openWorkOrder && !busy;

  useEffect(() => {
    setActiveResult(trucks.length ? 0 : -1);
  }, [trucks]);

  useEffect(() => {
    setJobQuery('');
    setCustomName('');
  }, [categoryId]);

  function selectTruck(item: TruckDto) {
    setSelectedTruck({ truck: item, openWorkOrder: null });
    setTruckQuery(item.truckNumber);
    setSearchOpen(false);
    setError(null);
    void apiFetch<{ exists: false } | { exists: true; workOrder?: WorkOrderSummaryDto }>(
      `/api/trucks/${item.id}/open-work-order`,
    ).then((open) => {
      setSelectedTruck((current) => (
        current?.truck.id === item.id
          ? {
            truck: item,
            openWorkOrder: open.exists && open.workOrder
              ? { id: open.workOrder.id, displayId: open.workOrder.displayId }
              : null,
          }
          : current
      ));
    }).catch(() => {
      setError(messages.loadError);
    });
  }

  function clearTruck() {
    setSelectedTruck(null);
    setTruckQuery('');
    setSearchOpen(false);
  }

  function addCatalogJob(option: JobAliasOptionDto) {
    if (!selectedCategory) return;
    setJobs((current) => {
      if (current.some((draft) => draft.catalogJobId === option.catalogJobId)) return current;
      return [...current, {
        key: crypto.randomUUID(),
        catalogJobId: option.catalogJobId,
        categoryId: selectedCategory.id,
        categoryName: selectedCategory.name,
        displayName: option.displayName,
      }];
    });
  }

  function addCustomJob() {
    if (!selectedCategory || !customName.trim()) return;
    const name = customName.trim();
    setJobs((current) => {
      if (current.some((draft) => !draft.catalogJobId && normalizeJobName(draft.displayName) === normalizeJobName(name))) {
        return current;
      }
      return [...current, {
        key: crypto.randomUUID(),
        categoryId: selectedCategory.id,
        categoryName: selectedCategory.name,
        displayName: name,
        customDescription: name,
      }];
    });
    setCustomName('');
  }

  function setJobAssignee(key: string, mechanicId: string) {
    setJobs((current) => current.map((job) => (
      job.key === key
        ? { ...job, assignedMechanicId: mechanicId || undefined }
        : job
    )));
  }

  const jobsByCategory = useMemo(() => {
    const groups = new Map<string, DraftJob[]>();
    for (const job of jobs) {
      const list = groups.get(job.categoryName) ?? [];
      list.push(job);
      groups.set(job.categoryName, list);
    }
    return [...groups.entries()];
  }, [jobs]);

  const teamMechanicIds = useMemo(
    () => Array.from(new Set(jobs.map((job) => job.assignedMechanicId).filter((id): id is string => Boolean(id)))),
    [jobs],
  );

  async function submit() {
    if (!canSubmit || !selectedTruck) return;
    setBusy(true);
    setError(null);
    try {
      const created = await createAdminWorkOrder({
        truckId: selectedTruck.truck.id,
        primaryCategoryId,
        priority,
        notes: notes.trim() || undefined,
        mechanicIds: teamMechanicIds,
        jobs: jobs.map((job) => ({
          catalogJobId: job.catalogJobId,
          categoryId: job.categoryId,
          displayName: job.displayName,
          customDescription: job.customDescription,
          assignedMechanicId: job.assignedMechanicId,
        })),
      });
      router.push(`/admin/work-orders/${created.id}`);
    } catch (failure) {
      setError(failure instanceof ApiError && failure.message ? failure.message : messages.createWorkOrderFailed);
    } finally {
      setBusy(false);
    }
  }

  if (!canCreateWorkOrder) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/work-orders">← {messages.backToWorkOrders}</Link>
        </Button>
        <EmptyState>{messages.createRequiresManage}</EmptyState>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{messages.newWorkOrderTitle}</h1>
        <p className="text-sm text-muted-foreground">{messages.newWorkOrderSubtitle}</p>
      </div>

      <Card>
        <CardHeader><CardTitle>{messages.selectTruckLabel}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Input
              aria-label={messages.searchTrucksLabel}
              placeholder={messages.searchTrucksLabel}
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={resultsOpen}
              aria-controls="admin-truck-search-results"
              aria-activedescendant={
                resultsOpen && activeResult >= 0
                  ? `admin-truck-result-${trucks[activeResult]?.id}`
                  : undefined
              }
              value={truckQuery}
              onFocus={() => setSearchOpen(true)}
              onKeyDown={(event) => {
                if (!resultsOpen) return;
                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  setActiveResult((current) => Math.min(current + 1, trucks.length - 1));
                } else if (event.key === 'ArrowUp') {
                  event.preventDefault();
                  setActiveResult((current) => Math.max(current - 1, 0));
                } else if (event.key === 'Enter' && activeResult >= 0) {
                  event.preventDefault();
                  const active = trucks[activeResult];
                  if (active) selectTruck(active);
                } else if (event.key === 'Escape') {
                  setSearchOpen(false);
                }
              }}
              onChange={(event) => {
                setTruckQuery(event.target.value);
                setSelectedTruck(null);
                setSearchOpen(true);
                setError(null);
              }}
            />
            {resultsOpen ? (
              <ul
                id="admin-truck-search-results"
                role="listbox"
                className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-xl border bg-popover shadow-lg"
              >
                {trucksLoading ? (
                  <li className="px-4 py-3 text-sm text-muted-foreground">{messages.searchingTrucks}</li>
                ) : truckError ? (
                  <li className="px-4 py-3 text-sm text-destructive">{messages.loadError}</li>
                ) : trucks.length ? trucks.map((item, index) => (
                  <li key={item.id} role="presentation">
                    <Button
                      id={`admin-truck-result-${item.id}`}
                      type="button"
                      role="option"
                      aria-selected={activeResult === index}
                      variant="ghost"
                      className="w-full justify-start rounded-none px-4 py-3 text-left font-normal"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => selectTruck(item)}
                    >
                      #{item.truckNumber} · {item.make} {item.model}
                    </Button>
                  </li>
                )) : (
                  <li className="px-4 py-3 text-sm text-muted-foreground">{messages.noTrucksFound}</li>
                )}
              </ul>
            ) : null}
          </div>

          {selectedTruck ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm">
              <div>
                <p className="text-xs font-medium text-muted-foreground">{messages.selectedTruckLabel}</p>
                <p className="font-medium">
                  #{selectedTruck.truck.truckNumber} · {selectedTruck.truck.make} {selectedTruck.truck.model}
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={clearTruck}>{messages.removeJobAction}</Button>
            </div>
          ) : null}

          {selectedTruck?.openWorkOrder ? (
            <InlineAlert>{messages.openWoWarning}</InlineAlert>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{messages.addJobsLabel}</CardTitle>
          <CardDescription>{messages.noJobsYet}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
                aria-label={messages.category}
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
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
              <Input
                aria-label={messages.searchJobsLabel}
                placeholder={messages.searchJobsLabel}
                value={jobQuery}
                onChange={(event) => setJobQuery(event.target.value)}
              />
              {jobsError ? <InlineAlert>{messages.loadError}</InlineAlert> : null}
              {jobsLoading && !aliasData ? (
                <p className="text-sm text-muted-foreground">{messages.loadingJobs}</p>
              ) : null}
              <ul className="max-h-56 space-y-1 overflow-auto" aria-label={`${messages.addJobsLabel}: ${selectedCategory.name}`}>
                {catalogJobs.length ? catalogJobs.map((job) => (
                  <li key={job.catalogJobId}>
                    <Button type="button" variant="secondary" className="w-full justify-start" onClick={() => addCatalogJob(job)}>
                      {job.displayName}
                    </Button>
                  </li>
                )) : !jobsLoading ? (
                  <li className="text-sm text-muted-foreground">{messages.noJobsYet}</li>
                ) : null}
              </ul>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  aria-label={messages.customJobPlaceholder}
                  className="flex-1"
                  placeholder={messages.customJobPlaceholder}
                  value={customName}
                  onChange={(event) => setCustomName(event.target.value)}
                />
                <Button type="button" disabled={!customName.trim()} onClick={addCustomJob}>
                  {messages.addCustomJob}
                </Button>
              </div>
            </div>
          ) : null}

          <div className="space-y-3">
            <p className="text-sm font-medium">{messages.workPlanTitle}</p>
            {jobs.length ? jobsByCategory.map(([categoryName, group]) => (
              <div key={categoryName} className="space-y-2">
                <Badge variant="outline">{categoryName}</Badge>
                <ul className="divide-y rounded-xl border">
                  {group.map((job) => (
                    <li key={job.key} className="space-y-2 px-3 py-3">
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="font-medium">{job.displayName}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setJobs((current) => current.filter((item) => item.key !== job.key))}
                        >
                          {messages.removeJobAction}
                        </Button>
                      </div>
                      <label className="block space-y-1">
                        <span className="text-xs font-medium text-muted-foreground">{messages.assignJobOnCreate}</span>
                        <Select
                          aria-label={`${messages.assignJobOnCreate}: ${job.displayName}`}
                          value={job.assignedMechanicId ?? ''}
                          onChange={(event) => setJobAssignee(job.key, event.target.value)}
                        >
                          <option value="">{messages.assignJobPlaceholder}</option>
                          {assignableMechanics.map((mechanic) => (
                            <option key={mechanic.id} value={mechanic.id}>{mechanic.name}</option>
                          ))}
                        </Select>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            )) : (
              <EmptyState>{messages.noJobsYet}</EmptyState>
            )}
            {mechanicsError ? <InlineAlert>{messages.loadError}</InlineAlert> : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{messages.priority}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted-foreground">{messages.priority}</span>
            <Select aria-label={messages.priority} value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>
              {Object.values(Priority).map((value) => (
                <option key={value} value={value}>{value.toUpperCase()}</option>
              ))}
            </Select>
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted-foreground">{messages.notes}</span>
            <Textarea aria-label={messages.notes} value={notes} maxLength={2000} onChange={(event) => setNotes(event.target.value)} />
          </label>
        </CardContent>
      </Card>

      {error ? <InlineAlert>{error}</InlineAlert> : null}

      <Button type="button" className="w-full" disabled={!canSubmit} onClick={submit}>
        {busy ? messages.creatingWorkOrder : messages.createWorkOrderSubmit}
      </Button>
    </div>
  );
}
