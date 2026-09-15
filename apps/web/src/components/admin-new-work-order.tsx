'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSWRConfig } from 'swr';
import {
  AppCapability,
  Priority,
  type CatalogJobDto,
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
import { useCatalogJobs, useCategories, useTrucks } from '@/lib/shop-data';
import { CategoryJobList } from './category-job-list';
import { rankTruckResults } from '@/lib/truck-search';
import { cn } from '@/lib/utils';
import { isWorkOrderRelatedListKey } from '@/lib/swr-cache-keys';
import {
  AdminBackLink,
  AdminPageHeader,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  EmptyState,
  InlineAlert,
  Input,
  Textarea,
} from './ui';
import { Field, FieldGroup, FieldLabel } from './ui/field';
import { NativeSelect } from './ui/native-select';

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

type OpenWorkOrderCheck = 'idle' | 'checking' | 'verified' | 'error';

function normalizeJobName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function formatCountMessage(template: string, count: number) {
  return template.replace('{count}', String(count));
}

export function AdminNewWorkOrder({
  locale,
  messages,
  preselectTruckId,
}: {
  locale: AdminLocale;
  messages: AdminMessages;
  preselectTruckId?: string;
}) {
  void locale;
  const router = useRouter();
  const { mutate } = useSWRConfig();
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
  const [preselectApplied, setPreselectApplied] = useState(false);
  const [openWorkOrderCheck, setOpenWorkOrderCheck] = useState<OpenWorkOrderCheck>('idle');
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);
  const openWorkOrderRequest = useRef(0);

  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedTruckQuery(truckQuery.trim()), 250);
    return () => window.clearTimeout(handle);
  }, [truckQuery]);

  const { data: truckData, error: truckError, isLoading: trucksLoading } = useTrucks(true);
  const { data: categories, error: categoriesError, isLoading: categoriesLoading } = useCategories(true);
  const { data: catalogJobs, error: jobsError, isLoading: jobsLoading } = useCatalogJobs(categoryId, Boolean(categoryId));
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

  const selectedCatalogJobIds = useMemo(
    () => jobs.flatMap((job) => (job.catalogJobId ? [job.catalogJobId] : [])),
    [jobs],
  );

  const resultsOpen = searchOpen && Boolean(debouncedTruckQuery) && !selectedTruck;
  const primaryCategoryId = jobs[0]?.categoryId ?? categoryId;
  const canSubmit = Boolean(selectedTruck)
    && openWorkOrderCheck === 'verified'
    && jobs.length > 0
    && !selectedTruck?.openWorkOrder
    && !busy;

  useEffect(() => {
    setActiveResult(trucks.length ? 0 : -1);
  }, [trucks]);

  useEffect(() => {
    setJobQuery('');
    setCustomName('');
  }, [categoryId]);

  function selectTruck(item: TruckDto) {
    const requestId = ++openWorkOrderRequest.current;
    setSelectedTruck({ truck: item, openWorkOrder: null });
    setTruckQuery(item.truckNumber);
    setSearchOpen(false);
    setError(null);
    setOpenWorkOrderCheck('checking');
    void apiFetch<{ exists: false } | { exists: true; workOrder?: WorkOrderSummaryDto }>(
      `/api/trucks/${item.id}/open-work-order`,
    ).then((open) => {
      if (requestId !== openWorkOrderRequest.current) return;
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
      setOpenWorkOrderCheck('verified');
    }).catch(() => {
      if (requestId !== openWorkOrderRequest.current) return;
      setOpenWorkOrderCheck('error');
    });
  }

  useEffect(() => {
    if (preselectApplied || !preselectTruckId || !truckData?.length) return;
    const match = truckData.find((item) => item.id === preselectTruckId);
    if (!match) return;
    selectTruck(match);
    setPreselectApplied(true);
  }, [preselectApplied, preselectTruckId, truckData]);

  function clearTruck() {
    openWorkOrderRequest.current += 1;
    setSelectedTruck(null);
    setTruckQuery('');
    setSearchOpen(false);
    setOpenWorkOrderCheck('idle');
    setActiveStep(1);
  }

  function toggleCatalogJob(job: CatalogJobDto) {
    if (!selectedCategory) return;
    setJobs((current) => {
      if (current.some((draft) => draft.catalogJobId === job.id)) {
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

  function removeJob(key: string) {
    setJobs((current) => current.filter((item) => item.key !== key));
    if (jobs.length === 1 && activeStep === 3) setActiveStep(2);
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
      void mutate(isWorkOrderRelatedListKey);
      router.push(`/admin/work-orders/${created.id}`);
    } catch (failure) {
      setError(failure instanceof ApiError && failure.message ? failure.message : messages.createWorkOrderFailed);
    } finally {
      setBusy(false);
    }
  }

  if (!canCreateWorkOrder) {
    return (
      <div className="flex flex-col gap-5">
        <AdminBackLink href="/admin/work-orders">{messages.backToWorkOrders}</AdminBackLink>
        <EmptyState>{messages.createRequiresManage}</EmptyState>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-24 xl:pb-0">
      <AdminBackLink href="/admin/work-orders">{messages.backToWorkOrders}</AdminBackLink>
      <AdminPageHeader eyebrow={messages.eyebrow} title={messages.newWorkOrderTitle} subtitle={messages.newWorkOrderSubtitle} />

      <ol className="grid grid-cols-3 gap-2" aria-label={messages.createFlowLabel}>
        <FlowStep
          number={1}
          label={messages.createStepTruck}
          state={activeStep === 1 ? 'current' : 'complete'}
          messages={messages}
          onClick={() => setActiveStep(1)}
        />
        <FlowStep
          number={2}
          label={messages.createStepWork}
          state={activeStep === 2 ? 'current' : activeStep > 2 ? 'complete' : 'upcoming'}
          messages={messages}
          disabled={!selectedTruck || Boolean(selectedTruck.openWorkOrder)}
          onClick={() => setActiveStep(2)}
        />
        <FlowStep
          number={3}
          label={messages.createStepReview}
          state={activeStep === 3 ? 'current' : 'upcoming'}
          messages={messages}
          disabled={!selectedTruck || jobs.length === 0 || Boolean(selectedTruck.openWorkOrder)}
          onClick={() => setActiveStep(3)}
        />
      </ol>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card className={cn(activeStep !== 1 && 'hidden xl:block')}>
            <CardHeader>
              <CardTitle>{messages.createStepTruck}</CardTitle>
              <CardDescription>{messages.selectTruckHelp}</CardDescription>
            </CardHeader>
            <CardContent>
              {selectedTruck ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/30 px-3 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground">{messages.selectedTruckLabel}</p>
                    <p className="truncate font-semibold">
                      #{selectedTruck.truck.truckNumber} · {selectedTruck.truck.make} {selectedTruck.truck.model}
                    </p>
                    {openWorkOrderCheck === 'checking' ? (
                      <p className="mt-1 text-xs text-muted-foreground" role="status">{messages.checkingOpenWorkOrder}</p>
                    ) : null}
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={clearTruck}>{messages.changeTruckAction}</Button>
                </div>
              ) : (
                <Field className="relative">
                  <FieldLabel className="text-xs text-muted-foreground" htmlFor="admin-truck-search">
                    {messages.searchTrucksLabel}
                  </FieldLabel>
                  <Input
                    id="admin-truck-search"
                    placeholder={messages.searchTruckPlaceholder}
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
                      openWorkOrderRequest.current += 1;
                      setTruckQuery(event.target.value);
                      setSelectedTruck(null);
                      setOpenWorkOrderCheck('idle');
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
                </Field>
              )}

              {openWorkOrderCheck === 'error' && selectedTruck ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <InlineAlert className="min-w-0 flex-1">{messages.verifyOpenWorkOrderError}</InlineAlert>
                  <Button type="button" variant="outline" size="sm" onClick={() => selectTruck(selectedTruck.truck)}>
                    {messages.retry}
                  </Button>
                </div>
              ) : null}

              {selectedTruck?.openWorkOrder ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <InlineAlert className="min-w-0 flex-1">{messages.openWoWarning}</InlineAlert>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/admin/work-orders/${selectedTruck.openWorkOrder.id}`}>
                      {messages.openExistingWorkOrder} {selectedTruck.openWorkOrder.displayId}
                    </Link>
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className={cn(activeStep !== 2 && 'hidden xl:block')}>
            <CardHeader>
              <CardTitle>{messages.createStepWork}</CardTitle>
              <CardDescription>{messages.addJobsHelp}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {categoriesError ? <InlineAlert>{messages.loadError}</InlineAlert> : null}
              {categoriesLoading && !categories ? (
                <p className="text-sm text-muted-foreground">{messages.loadingCategories}</p>
              ) : null}
              {!categoriesLoading && !categoriesError && standardCategories.length === 0 ? (
                <EmptyState>{messages.noCategoriesAvailable}</EmptyState>
              ) : null}

              {standardCategories.length ? (
                <Field>
                  <FieldLabel className="text-xs text-muted-foreground" htmlFor="admin-work-order-category">{messages.category}</FieldLabel>
                  <NativeSelect
                    id="admin-work-order-category"
                    aria-label={messages.category}
                    value={categoryId}
                    onChange={(event) => setCategoryId(event.target.value)}
                  >
                    <option value="">{messages.selectCategoryPlaceholder}</option>
                    {standardCategories.map((category) => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </NativeSelect>
                </Field>
              ) : null}

              {selectedCategory ? (
                <div className="flex flex-col gap-3">
                  <CategoryJobList
                    categoryName={selectedCategory.name}
                    jobs={catalogJobs ?? []}
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
                  <Field className="sm:flex-row sm:items-center sm:*:w-auto">
                    <FieldLabel className="sr-only" htmlFor="admin-custom-job">{messages.customJobPlaceholder}</FieldLabel>
                    <Input
                      id="admin-custom-job"
                      className="min-w-0 flex-1"
                      placeholder={messages.customJobPlaceholder}
                      value={customName}
                      onChange={(event) => setCustomName(event.target.value)}
                    />
                    <Button type="button" variant="outline" disabled={!customName.trim()} onClick={addCustomJob}>
                      {messages.addCustomJob}
                    </Button>
                  </Field>
                </div>
              ) : (
                <EmptyState>{messages.chooseCategoryFirst}</EmptyState>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className={cn('min-w-0 xl:sticky xl:top-4', activeStep !== 3 && 'hidden xl:block')}>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle>{messages.createStepReview}</CardTitle>
                <CardDescription>{messages.reviewWorkOrderHelp}</CardDescription>
              </div>
              <Badge variant={jobs.length ? 'secondary' : 'outline'}>
                {formatCountMessage(jobs.length === 1 ? messages.selectedJobCount : messages.selectedJobsCount, jobs.length)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {jobs.length ? (
              <div className="max-h-[38dvh] overflow-y-auto overscroll-contain rounded-xl border">
                {jobsByCategory.map(([categoryName, group]) => (
                  <section key={categoryName} className="border-b p-3 last:border-b-0">
                    <Badge variant="outline">{categoryName}</Badge>
                    <ul className="mt-2 divide-y">
                      {group.map((job) => (
                        <li key={job.key} className="flex flex-col gap-2 py-3 first:pt-1 last:pb-1">
                          <div className="flex items-start justify-between gap-2 text-sm">
                            <span className="min-w-0 font-medium">{job.displayName}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="shrink-0"
                              onClick={() => removeJob(job.key)}
                            >
                              {messages.removeJobAction}
                            </Button>
                          </div>
                          <Field>
                            <FieldLabel className="text-xs text-muted-foreground" htmlFor={`admin-job-assignee-${job.key}`}>{messages.assignJobOnCreate}</FieldLabel>
                            <NativeSelect
                              id={`admin-job-assignee-${job.key}`}
                              aria-label={`${messages.assignJobOnCreate}: ${job.displayName}`}
                              value={job.assignedMechanicId ?? ''}
                              onChange={(event) => setJobAssignee(job.key, event.target.value)}
                            >
                              <option value="">{messages.assignJobPlaceholder}</option>
                              {assignableMechanics.map((mechanic) => (
                                <option key={mechanic.id} value={mechanic.id}>{mechanic.name}</option>
                              ))}
                            </NativeSelect>
                          </Field>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            ) : (
              <EmptyState>{messages.noSelectedJobs}</EmptyState>
            )}
            {mechanicsError ? <InlineAlert>{messages.loadError}</InlineAlert> : null}

            <FieldGroup className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <Field>
                <FieldLabel className="text-xs text-muted-foreground" htmlFor="admin-work-order-priority">{messages.priority}</FieldLabel>
                <NativeSelect id="admin-work-order-priority" value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>
                  {Object.values(Priority).map((value) => (
                    <option key={value} value={value}>{value.toUpperCase()}</option>
                  ))}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel className="text-xs text-muted-foreground" htmlFor="admin-work-order-notes">{messages.notesOptional}</FieldLabel>
                <Textarea
                  id="admin-work-order-notes"
                  className="min-h-20"
                  placeholder={messages.notesPlaceholder}
                  value={notes}
                  maxLength={2000}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </Field>
            </FieldGroup>
            {error ? <InlineAlert>{error}</InlineAlert> : null}
          </CardContent>
          <CardFooter className="hidden border-t pt-4 xl:flex">
            <Button type="button" className="w-full" disabled={!canSubmit} onClick={submit}>
              {busy ? messages.creatingWorkOrder : messages.createWorkOrderSubmit}
            </Button>
          </CardFooter>
        </Card>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-4 pb-[calc(0.75rem+var(--app-safe-bottom))] pt-3 backdrop-blur md:left-[220px] xl:hidden">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <p className="min-w-0 flex-1 text-sm text-muted-foreground">
            {formatCountMessage(jobs.length === 1 ? messages.selectedJobCount : messages.selectedJobsCount, jobs.length)}
          </p>
          {activeStep === 1 ? (
            <Button
              type="button"
              className="shrink-0"
              disabled={!selectedTruck || openWorkOrderCheck !== 'verified' || Boolean(selectedTruck.openWorkOrder)}
              onClick={() => setActiveStep(2)}
            >
              {messages.continueToWork}
            </Button>
          ) : activeStep === 2 ? (
            <Button
              type="button"
              className="shrink-0"
              disabled={!selectedTruck || jobs.length === 0 || Boolean(selectedTruck.openWorkOrder)}
              onClick={() => setActiveStep(3)}
            >
              {messages.reviewWorkOrderAction}
            </Button>
          ) : (
            <Button type="button" className="shrink-0" disabled={!canSubmit} onClick={submit}>
              {busy ? messages.creatingWorkOrder : messages.createWorkOrderSubmit}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function FlowStep({
  number,
  label,
  state,
  messages,
  disabled = false,
  onClick,
}: {
  number: number;
  label: string;
  state: 'complete' | 'current' | 'upcoming';
  messages: AdminMessages;
  disabled?: boolean;
  onClick: () => void;
}) {
  const stateLabel = state === 'complete'
    ? messages.createStepComplete
    : state === 'current'
      ? messages.createStepCurrent
      : messages.createStepUpcoming;

  return (
    <li className="min-w-0">
      <button
        type="button"
        className={cn(
          'flex min-h-11 w-full min-w-0 items-center gap-2 rounded-xl border bg-card px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50',
          state === 'current' && 'border-primary bg-primary/10',
        )}
        aria-current={state === 'current' ? 'step' : undefined}
        aria-label={`${number}. ${label}: ${stateLabel}`}
        disabled={disabled}
        onClick={onClick}
      >
        <Badge variant={state === 'complete' ? 'secondary' : state === 'current' ? 'default' : 'outline'}>{number}</Badge>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{label}</span>
          <span className="hidden text-xs text-muted-foreground sm:block">{stateLabel}</span>
        </span>
      </button>
    </li>
  );
}
