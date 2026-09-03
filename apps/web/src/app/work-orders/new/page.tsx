'use client';

import { type RefObject, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, ChevronDown, Trash2 } from 'lucide-react';
import { useSWRConfig } from 'swr';
import {
  Priority,
  type JobAliasOptionDto,
  type JobCategoryDto,
  type TruckDto,
  type WorkOrderSummaryDto,
} from '@ltl-shop/shared';
import { useAuth } from '@/lib/auth-context';
import { ApiError, apiFetch } from '@/lib/api';
import { formatMileage } from '@/lib/format';
import { filterAliasOptions } from '@/lib/job-catalog';
import {
  shopKeys,
  useAliasOptions,
  useCategories,
  useMechanics,
  useTrucks,
  type Mechanic,
} from '@/lib/shop-data';
import { EmptyState, Modal, PageSkeleton, ScreenHeader } from '@/components/ui';

type DraftJob = {
  key: string;
  catalogJobId?: string;
  categoryId: string;
  displayName: string;
  customDescription?: string;
};

export default function NewWorkOrderPage() {
  const { user, token, sessionLoading } = useAuth();
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const { data: categoryData, error: categoryError } = useCategories(!!token);
  const { data: mechanicData, error: mechanicError } = useMechanics(!!token);
  const { data: truckData, error: truckError } = useTrucks(!!token);
  const categories = categoryData ?? [];
  const mechanics = mechanicData ?? [];
  const pmCategory = categories.find((category) => category.name === 'PM');
  const standardCategories = categories.filter((category) => category.name !== 'PM');
  const isPmMechanic = !!user?.pmAuthorized;
  const [query, setQuery] = useState('');
  const [truck, setTruck] = useState<TruckDto | null>(null);
  const [openWo, setOpenWo] = useState<WorkOrderSummaryDto | null>(null);
  const [categoryId, setCategoryId] = useState('');
  const [jobs, setJobs] = useState<DraftJob[]>([]);
  const [workingWith, setWorkingWith] = useState<string[]>([]);
  const [priority, setPriority] = useState<Priority>(Priority.NORMAL);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [workingWithOpen, setWorkingWithOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeResult, setActiveResult] = useState(-1);
  const [openWoCheck, setOpenWoCheck] = useState<
    'idle' | 'checking' | 'verified' | 'error'
  >('idle');
  const openWoRequest = useRef(0);
  const addJobTriggerRef = useRef<HTMLButtonElement>(null);
  const workingWithTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!sessionLoading && !token) router.replace('/login');
  }, [sessionLoading, token, router]);

  useEffect(() => {
    if (isPmMechanic && pmCategory) {
      setCategoryId(pmCategory.id);
    }
  }, [isPmMechanic, pmCategory]);

  const availableCoworkers = mechanics.filter(
    (mechanic) => mechanic.id !== user?.id && !mechanic.pmAuthorized,
  );

  const results = useMemo(() => {
    const term = query.trim().replace(/^#/, '').toLowerCase();
    if (!term || truck) return [];
    return (truckData ?? [])
      .filter((item) => item.truckNumber.toLowerCase().includes(term))
      .slice(0, 20);
  }, [query, truck, truckData]);

  const hasSearchTerm = query.trim().replace(/^#/, '').length > 0;
  const resultsOpen = searchOpen && hasSearchTerm && !truck;

  useEffect(() => {
    setActiveResult(results.length ? 0 : -1);
  }, [results]);

  async function selectTruck(t: TruckDto) {
    const requestId = ++openWoRequest.current;
    setTruck(t);
    setQuery(t.truckNumber);
    setSearchOpen(false);
    setOpenWo(null);
    setOpenWoCheck('checking');
    setError(null);
    try {
      const open = await apiFetch<
        { exists: false } | { exists: true; workOrder: WorkOrderSummaryDto }
      >(`/api/trucks/${t.id}/open-work-order`);
      if (requestId !== openWoRequest.current) return;
      if (open.exists) setOpenWo(open.workOrder);
      setOpenWoCheck('verified');
    } catch {
      if (requestId !== openWoRequest.current) return;
      setOpenWoCheck('error');
      setError('Unable to verify open Work Orders. Retry before creating the Work Order.');
    }
  }

  async function create() {
    if (!truck || openWoCheck !== 'verified' || !categoryId || (!isPmMechanic && jobs.length === 0)) {
      setError(isPmMechanic ? 'Select a truck before creating the PM Work Order.' : 'Truck, category, and at least one job are required.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const wo = await apiFetch<{ id: string }>('/api/work-orders', {
        method: 'POST',
        body: JSON.stringify({
          truckId: truck.id,
          primaryCategoryId: categoryId,
          priority,
          ...(isPmMechanic ? {} : { notes: notes || undefined }),
          mechanicIds: isPmMechanic ? [] : workingWith,
          jobs: isPmMechanic ? [] : jobs.map((j) => ({
            catalogJobId: j.catalogJobId,
            categoryId: j.categoryId,
            displayName: j.displayName,
            customDescription: j.customDescription,
          })),
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      void mutate(shopKeys.workOrders);
      router.push(`/work-orders/${wo.id}`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        const body = e.body as { workOrder?: WorkOrderSummaryDto };
        if (body.workOrder) setOpenWo(body.workOrder);
        setError('Truck already has an open Work Order.');
      } else {
        setError(e instanceof Error ? e.message : 'Create failed');
      }
    } finally {
      setBusy(false);
    }
  }

  if (sessionLoading || !token) {
    return <PageSkeleton label="Restoring session" />;
  }

  return (
    <div>
      <ScreenHeader
        title={isPmMechanic ? 'New PM Service' : 'New Work Order'}
        subtitle={isPmMechanic ? 'Select a truck to create a PM service.' : 'Enter the required information.'}
        backHref="/"
      />

      <section className="card mb-4 space-y-3">
        <label className="section-label" htmlFor="truck-search">
          Truck
        </label>
        <div className="relative">
          <input
            id="truck-search"
            className="field"
            placeholder="Search Truck Number (e.g. #905)"
            value={query}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={resultsOpen}
            aria-controls="truck-search-results"
            aria-activedescendant={
              resultsOpen && activeResult >= 0
                ? `truck-result-${results[activeResult]?.id}`
                : undefined
            }
            onFocus={() => setSearchOpen(true)}
            onKeyDown={(event) => {
              if (!resultsOpen) return;
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActiveResult((current) =>
                  Math.min(current + 1, results.length - 1),
                );
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActiveResult((current) => Math.max(current - 1, 0));
              } else if (event.key === 'Enter' && activeResult >= 0) {
                event.preventDefault();
                const activeTruck = results[activeResult];
                if (activeTruck) void selectTruck(activeTruck);
              } else if (event.key === 'Escape') {
                setSearchOpen(false);
              }
            }}
            onChange={(e) => {
              openWoRequest.current += 1;
              setQuery(e.target.value);
              setTruck(null);
              setOpenWo(null);
              setOpenWoCheck('idle');
              setSearchOpen(true);
              setError(null);
            }}
          />
          {resultsOpen ? (
            <ul
              id="truck-search-results"
              role="listbox"
              className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-shop-border bg-shop-panel shadow-lg"
            >
              {results.map((t) => (
                <li key={t.id} role="presentation">
                  <button
                    id={`truck-result-${t.id}`}
                    type="button"
                    role="option"
                    aria-selected={results[activeResult]?.id === t.id}
                    className="min-h-11 w-full px-4 py-3 text-left text-sm hover:bg-shop-accent focus:bg-shop-accent"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => void selectTruck(t)}
                  >
                    #{t.truckNumber} · {t.make} {t.model}
                  </button>
                </li>
              ))}
              {!results.length ? (
                <li className="px-4 py-3 text-sm text-shop-muted" role="option">
                  No trucks found.
                </li>
              ) : null}
            </ul>
          ) : null}
          <div className="sr-only" aria-live="polite">
            {openWoCheck === 'checking'
              ? 'Checking for an open Work Order.'
              : resultsOpen
                ? `${results.length} truck results available.`
                : ''}
          </div>
        </div>
        {openWoCheck === 'error' && truck ? (
          <button
            type="button"
            className="btn-secondary w-full"
            onClick={() => void selectTruck(truck)}
          >
            Retry Work Order check
          </button>
        ) : null}

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="section-label">Truck Information</p>
          </div>
          {!truck ? (
            <EmptyState>Select a truck to show its details.</EmptyState>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-sm">
                <Info label="Make" value={truck.make} />
                <Info label="Model" value={truck.model} />
                <Info label="Year" value={truck.year?.toString()} />
                <Info label="Mileage" value={formatMileage(truck.mileage)} />
                <Info label="Company" value={truck.company} />
                <Info label="Owner" value={truck.owner} />
              </div>
              <Link
                href={`/trucks/${truck.id}/history?from=${encodeURIComponent('/work-orders/new')}`}
                className="btn-secondary w-full"
              >
                See Truck Repair History
              </Link>
            </div>
          )}
        </div>
      </section>

      {openWo ? (
        <div
          className="mb-4 rounded-2xl border border-[var(--warning)] bg-warning-surface p-4 text-warning-foreground"
          role="alert"
          aria-live="polite"
        >
          <p className="font-semibold">
            Truck #{truck?.truckNumber} already has an open Work Order.
          </p>
          <p className="mt-1 text-sm">
            {openWo.displayId} · {openWo.status} · {openWo.jobsCompleted}/
            {openWo.jobsTotal}
          </p>
          <Link
            href={`/work-orders/${openWo.id}`}
            className="btn-primary mt-3 w-full"
          >
            VIEW OPEN WORK ORDER
          </Link>
        </div>
      ) : null}

      {truck && !openWo ? (
        <>
          <section className="card mb-4 space-y-4">
            {!isPmMechanic ? (
              <div>
                <label className="section-label" htmlFor="work-order-category">
                  Category
                </label>
                <div className="relative mt-2">
                  <select
                    id="work-order-category"
                    className="field appearance-none pr-11"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                  >
                    <option value="" disabled>
                      Select a category
                    </option>
                    {standardCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-shop-muted" aria-hidden="true" />
                </div>
              </div>
            ) : null}

            {!isPmMechanic ? <div>
              <p className="section-label mb-2">Jobs To Do</p>
              {jobs.length === 0 ? (
                <EmptyState>Add at least one job.</EmptyState>
              ) : (
                <ul className="mb-3 space-y-2">
                  {jobs.map((j) => (
                    <li
                      key={j.key}
                      className="flex items-center justify-between rounded-xl border border-shop-border px-3 py-2 text-sm"
                    >
                      <span>{j.displayName}</span>
                      <button
                        type="button"
                        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-shop-muted hover:bg-shop-accent hover:text-primary-foreground"
                        aria-label={`Remove ${j.displayName}`}
                        onClick={() =>
                          setJobs((prev) => prev.filter((x) => x.key !== j.key))
                        }
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <button
                ref={addJobTriggerRef}
                type="button"
                className="btn-secondary w-full"
                disabled={!categoryId}
                onClick={() => setAddOpen(true)}
              >
                Add job +
              </button>
            </div> : null}

            {!isPmMechanic ? <div>
              <p className="section-label" id="working-with-label">
                Working With
              </p>
              <button
                ref={workingWithTriggerRef}
                type="button"
                className="field mt-2 flex items-center justify-between text-left"
                aria-labelledby="working-with-label working-with-summary"
                aria-haspopup="dialog"
                onClick={() => setWorkingWithOpen(true)}
              >
                <span id="working-with-summary">
                  {selectedMechanicSummary(availableCoworkers, workingWith)}
                </span>
                <ChevronDown className="h-5 w-5 text-shop-muted" aria-hidden="true" />
              </button>
            </div> : null}

            {!isPmMechanic ? <div>
              <p className="section-label mb-2">Priority</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {Object.values(Priority).map((p) => (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={priority === p}
                    className={
                      priority === p ? 'btn-primary' : 'btn-secondary'
                    }
                    onClick={() => setPriority(p)}
                  >
                    {p.toUpperCase()}
                  </button>
                ))}
              </div>
            </div> : null}

            {!isPmMechanic ? <div>
              <label className="section-label" htmlFor="work-order-notes">
                Notes (Optional)
              </label>
              <textarea
                id="work-order-notes"
                className="field mt-2 min-h-24"
                placeholder="Describe or add any information needed to perform the work"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div> : null}
          </section>

          {error ? (
            <p className="mb-3 text-sm text-red-300" role="alert" aria-live="assertive">
              {error}
            </p>
          ) : null}

          {categoryError || mechanicError || truckError ? (
            <p className="mb-3 text-sm text-red-300">
              Unable to load shop reference data.
            </p>
          ) : null}

          <button
            type="button"
            className="btn-primary w-full"
            disabled={busy || openWoCheck !== 'verified'}
            onClick={create}
          >
            {isPmMechanic ? 'Create PM Work Order' : 'Create Work Order'}
          </button>
        </>
      ) : null}

      <AddJobModal
        open={addOpen}
        categories={standardCategories}
        defaultCategoryId={categoryId}
        onClose={() => setAddOpen(false)}
        onAdd={(job) => {
          setJobs((prev) => [...prev, job]);
          setAddOpen(false);
        }}
        returnFocusRef={addJobTriggerRef}
      />
      <WorkingWithModal
        open={workingWithOpen}
        mechanics={availableCoworkers}
        selected={workingWith}
        onChange={setWorkingWith}
        onClose={() => setWorkingWithOpen(false)}
        returnFocusRef={workingWithTriggerRef}
      />
    </div>
  );
}

function selectedMechanicSummary(mechanics: Mechanic[], selected: string[]) {
  const names = mechanics
    .filter((mechanic) => selected.includes(mechanic.id))
    .map((mechanic) => mechanic.name);
  if (!names.length) return 'Select mechanics';
  if (names.length <= 2) return names.join(' / ');
  return `${names[0]} + ${names.length - 1} more`;
}

function WorkingWithModal({
  open,
  mechanics,
  selected,
  onChange,
  onClose,
  returnFocusRef,
}: {
  open: boolean;
  mechanics: Mechanic[];
  selected: string[];
  onChange: (ids: string[]) => void;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLElement | null>;
}) {
  return (
    <Modal
      open={open}
      title="Working With"
      onClose={onClose}
      returnFocusRef={returnFocusRef}
    >
      <fieldset className="space-y-2">
        <legend className="sr-only">Select mechanics</legend>
        {mechanics.map((mechanic) => {
          const checked = selected.includes(mechanic.id);
          return (
            <label
              key={mechanic.id}
              className="flex min-h-11 cursor-pointer items-center justify-between rounded-xl border border-shop-border px-3 py-2 hover:bg-shop-accent"
            >
              <span className="text-sm font-medium">{mechanic.name}</span>
              <span className="relative flex h-5 w-5 items-center justify-center rounded border border-shop-border bg-shop-panel">
                <input
                  type="checkbox"
                  className="peer absolute inset-0 cursor-pointer opacity-0"
                  checked={checked}
                  onChange={() =>
                    onChange(
                      checked
                        ? selected.filter((id) => id !== mechanic.id)
                        : [...selected, mechanic.id],
                    )
                  }
                />
                {checked ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
              </span>
            </label>
          );
        })}
      </fieldset>
      <button type="button" className="btn-primary mt-4 w-full" onClick={onClose}>
        Done
      </button>
    </Modal>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-shop-muted">
        {label}
      </p>
      <p className="font-medium">{value || '—'}</p>
    </div>
  );
}

function AddJobModal({
  open,
  categories,
  defaultCategoryId,
  onClose,
  onAdd,
  returnFocusRef,
}: {
  open: boolean;
  categories: JobCategoryDto[];
  defaultCategoryId: string;
  onClose: () => void;
  onAdd: (job: DraftJob) => void;
  returnFocusRef: RefObject<HTMLElement | null>;
}) {
  const [categoryId, setCategoryId] = useState(defaultCategoryId);
  const [q, setQ] = useState('');
  const [customOpen, setCustomOpen] = useState(false);
  const [customName, setCustomName] = useState('');
  const { data: aliasData } = useAliasOptions(categoryId, true);
  const allAliases: JobAliasOptionDto[] = aliasData ?? [];

  useEffect(() => {
    if (!open) return;
    setCategoryId(defaultCategoryId);
    setQ('');
  }, [open, defaultCategoryId]);

  const aliases = useMemo(
    () => filterAliasOptions(allAliases, q),
    [allAliases, q],
  );

  const categoryName = useMemo(
    () => categories.find((c) => c.id === categoryId)?.name ?? '',
    [categories, categoryId],
  );

  return (
    <Modal
      open={open}
      title="Add job"
      onClose={onClose}
      returnFocusRef={returnFocusRef}
    >
      <div className="space-y-3">
        <label className="section-label block" htmlFor="new-job-category">
          Category
        </label>
        <div className="relative">
          <select
            id="new-job-category"
            className="field appearance-none pr-11"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-shop-muted" aria-hidden="true" />
        </div>
        <label className="section-label block" htmlFor="new-job-search">
          Search job or alias
        </label>
        <input
          id="new-job-search"
          className="field"
          placeholder="Search job / alias (e.g. 3in1)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <ul className="max-h-56 space-y-1 overflow-auto">
          {aliases.length ? (
            aliases.map((alias) => (
              <li key={`${alias.catalogJobId}-${alias.aliasText}`}>
                <button
                  type="button"
                  className="w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-white/5"
                  onClick={() =>
                    onAdd({
                      key: crypto.randomUUID(),
                      catalogJobId: alias.catalogJobId,
                      categoryId: alias.categoryId,
                      displayName: alias.displayName,
                    })
                  }
                >
                  {alias.aliasText}
                </button>
              </li>
            ))
          ) : (
            <li className="px-3 py-2 text-sm text-shop-muted">
              {q.trim()
                ? 'No matching aliases.'
                : 'No aliases for this category.'}
            </li>
          )}
        </ul>
        <button
          type="button"
          className="btn-secondary w-full"
          onClick={() => setCustomOpen((v) => !v)}
        >
          JOB NOT LISTED
        </button>
        {customOpen ? (
          <div className="space-y-2">
            <p className="text-xs text-shop-muted">
              Custom job in {categoryName || 'selected category'}
            </p>
            <label className="section-label block" htmlFor="new-custom-job">
              Custom job description
            </label>
            <input
              id="new-custom-job"
              className="field"
              placeholder="Describe the job"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
            />
            <button
              type="button"
              className="btn-primary w-full"
              disabled={!customName.trim()}
              onClick={() =>
                onAdd({
                  key: crypto.randomUUID(),
                  categoryId,
                  displayName: customName.trim(),
                  customDescription: customName.trim(),
                })
              }
            >
              Add Custom Job
            </button>
          </div>
        ) : null}
        <button type="button" className="btn-secondary w-full" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Modal>
  );
}
