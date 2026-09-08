'use client';

import { type ReactNode, type RefObject, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, ChevronDown, Trash2 } from 'lucide-react';
import { useSWRConfig } from 'swr';
import {
  Priority,
  type TruckDto,
  type WorkOrderSummaryDto,
} from '@ltl-shop/shared';
import { useAuth } from '@/lib/auth-context';
import { ApiError, apiFetch } from '@/lib/api';
import { formatMileage } from '@/lib/format';
import {
  shopKeys,
  useCategories,
  useMechanics,
  useTrucks,
  type Mechanic,
} from '@/lib/shop-data';
import {
  Button,
  CardListSkeleton,
  EmptyState,
  InlineAlert,
  Input,
  Label,
  LoadFailure,
  Modal,
  PageSkeleton,
  ScreenHeader,
  Select,
  Textarea,
} from '@/components/ui';
import { JobPickerDialog } from '@/components/job-picker-dialog';
import { useShopLocale } from '@/lib/locale-context';
import { statusLabel } from '@/lib/format';

type DraftJob = {
  key: string;
  catalogJobId?: string;
  categoryId: string;
  displayName: string;
  customDescription?: string;
};

export default function NewWorkOrderPage() {
  const { user, token, sessionLoading, profileLoading, sessionError, retrySession } = useAuth();
  const { messages } = useShopLocale();
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const { data: categoryData, error: categoryError, mutate: mutateCategories } = useCategories(!!token);
  const { data: mechanicData, error: mechanicError, mutate: mutateMechanics } = useMechanics(!!token);
  const { data: truckData, error: truckError, mutate: mutateTrucks } = useTrucks(!!token);
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
    if (!sessionLoading && !token && !sessionError) router.replace('/login');
  }, [sessionLoading, token, sessionError, router]);

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
  const createBlocked = busy || openWoCheck !== 'verified' || !categoryId || (!isPmMechanic && jobs.length === 0);
  const createActionLabel = isPmMechanic
    ? openWoCheck === 'checking'
      ? 'Checking truck…'
      : messages.createPmService
    : !categoryId
      ? 'Choose a category'
      : jobs.length === 0
        ? 'Add a job to continue'
        : messages.createWorkOrder;

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
      setError(messages.locale === 'es' ? 'No pudimos verificar los Work Orders abiertos. Reintenta antes de crear el Work Order.' : 'Unable to verify open Work Orders. Retry before creating the Work Order.');
    }
  }

  async function create() {
    if (!truck || openWoCheck !== 'verified' || !categoryId || (!isPmMechanic && jobs.length === 0)) {
      setError(isPmMechanic ? (messages.locale === 'es' ? 'Selecciona una unidad antes de crear el Work Order de PM.' : 'Select a truck before creating the PM Work Order.') : (messages.locale === 'es' ? 'Se requieren una unidad, una categoría y al menos un Job.' : 'Truck, category, and at least one job are required.'));
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
      router.push(`/work-orders/${wo.id}`, { scroll: true });
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        const body = e.body as { workOrder?: WorkOrderSummaryDto };
        if (body.workOrder) setOpenWo(body.workOrder);
        setError(messages.workOrderOpen(truck.truckNumber));
      } else {
        setError(e instanceof Error ? e.message : 'Create failed');
      }
    } finally {
      setBusy(false);
    }
  }

  if (sessionLoading && !token) {
    return <NewWorkOrderLoading label={messages.locale === 'es' ? 'Restaurando sesión' : 'Restoring session'} />;
  }

  if (!token && sessionError) {
    return (
      <NewWorkOrderLoading>
        <LoadFailure message={sessionError} onRetry={retrySession} retryLabel={messages.retry} />
      </NewWorkOrderLoading>
    );
  }

  if (!token) {
    return <PageSkeleton label={messages.locale === 'es' ? 'Restaurando sesión' : 'Restoring session'} />;
  }

  if (profileLoading || !user) {
    return (
      <NewWorkOrderLoading>
        {sessionError ? (
            <LoadFailure message={sessionError} onRetry={retrySession} retryLabel={messages.retry} />
        ) : (
          <CardListSkeleton count={2} />
        )}
      </NewWorkOrderLoading>
    );
  }

  const referenceError = categoryError || mechanicError || truckError;
  if (referenceError || !categoryData || !mechanicData || !truckData) {
    return (
      <NewWorkOrderLoading>
        {referenceError ? (
          <LoadFailure
            message="Unable to load shop reference data."
            onRetry={() => void Promise.all([mutateCategories(), mutateMechanics(), mutateTrucks()])}
            retryLabel={messages.retry}
          />
        ) : (
          <CardListSkeleton count={2} />
        )}
      </NewWorkOrderLoading>
    );
  }

  return (
    <div className={truck && !openWo ? 'pb-[calc(6rem+env(safe-area-inset-bottom))]' : undefined}>
      <ScreenHeader
        title={isPmMechanic ? messages.newPmService : messages.newWorkOrder}
        subtitle={isPmMechanic ? messages.pmServiceHint : messages.workOrderHint}
        backHref="/"
      />

      <section className="card mb-4 space-y-3">
        <Label className="section-label" htmlFor="truck-search">
          {messages.truck}
        </Label>
        <div className="relative">
          <Input
            id="truck-search"
            placeholder={messages.searchTruck}
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
                  <Button
                    id={`truck-result-${t.id}`}
                    role="option"
                    aria-selected={results[activeResult]?.id === t.id}
                    variant="ghost"
                    className="w-full justify-start rounded-none px-4 py-3 text-left font-normal hover:bg-shop-accent focus:bg-shop-accent"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => void selectTruck(t)}
                  >
                    #{t.truckNumber} · {t.make} {t.model}
                  </Button>
                </li>
              ))}
              {!results.length ? (
                <li className="px-4 py-3 text-sm text-shop-muted" role="option">
                  {messages.noTrucks}
                </li>
              ) : null}
            </ul>
          ) : null}
          <div className="sr-only" aria-live="polite">
            {openWoCheck === 'checking'
              ? messages.checkingOpenWorkOrder
              : resultsOpen
                ? messages.truckResults(results.length)
                : ''}
          </div>
        </div>
        {openWoCheck === 'error' && truck ? (
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => void selectTruck(truck)}
          >
            {messages.retryWorkOrderCheck}
          </Button>
        ) : null}

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="section-label">{messages.truckInformation}</p>
          </div>
          {!truck ? (
            <EmptyState>{messages.selectTruck}</EmptyState>
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
              <Button asChild variant="secondary" className="w-full">
                <Link href={`/trucks/${truck.id}/history?from=${encodeURIComponent('/work-orders/new')}`}>
                  {messages.repairHistory}
                </Link>
              </Button>
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
            {messages.workOrderOpen(truck?.truckNumber ?? '')}
          </p>
          <p className="mt-1 text-sm">
            {messages.workOrderSummary(openWo.displayId, messages.status[openWo.status] ?? statusLabel(openWo.status), openWo.jobsCompleted, openWo.jobsTotal)}
          </p>
          {openWo.primaryCategoryName === 'PM' && !user.pmAuthorized && user.role !== 'admin' ? (
            <div className="mt-3 space-y-2">
              <p className="text-sm">{messages.noAccessToPmWorkOrder}</p>
              <Button asChild variant="secondary" className="w-full">
                <Link href="/work-orders/new">{messages.chooseAnotherWorkOrder}</Link>
              </Button>
            </div>
          ) : (
            <Button asChild className="mt-3 w-full">
              <Link href={`/work-orders/${openWo.id}`}>{messages.openWorkOrder}</Link>
            </Button>
          )}
        </div>
      ) : null}

      {truck && !openWo ? (
        <>
          {!isPmMechanic ? <section className="card mb-4 space-y-4">
            {!isPmMechanic ? (
              <div>
                <Label className="section-label" htmlFor="work-order-category">
                  Category
                </Label>
                <div className="mt-2">
                  <Select
                    id="work-order-category"
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
                  </Select>
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
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-shop-muted hover:bg-shop-accent hover:text-primary-foreground"
                        aria-label={`Remove ${j.displayName}`}
                        onClick={() =>
                          setJobs((prev) => prev.filter((x) => x.key !== j.key))
                        }
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <Button
                ref={addJobTriggerRef}
                variant="secondary"
                className="w-full"
                disabled={!categoryId}
                onClick={() => setAddOpen(true)}
              >
                Add job +
              </Button>
            </div> : null}

            {!isPmMechanic ? <div>
              <p className="section-label" id="working-with-label">
                Working With
              </p>
              <Button
                ref={workingWithTriggerRef}
                variant="outline"
                className="mt-2 w-full justify-between text-left font-normal"
                aria-labelledby="working-with-label working-with-summary"
                aria-haspopup="dialog"
                onClick={() => setWorkingWithOpen(true)}
              >
                <span id="working-with-summary">
                  {selectedMechanicSummary(availableCoworkers, workingWith)}
                </span>
                <ChevronDown className="h-5 w-5 text-shop-muted" aria-hidden="true" />
              </Button>
            </div> : null}

            {!isPmMechanic ? <div>
              <p className="section-label mb-2">Priority</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {Object.values(Priority).map((p) => (
                  <Button
                    key={p}
                    aria-pressed={priority === p}
                    variant={priority === p ? 'default' : 'secondary'}
                    onClick={() => setPriority(p)}
                  >
                    {p.toUpperCase()}
                  </Button>
                ))}
              </div>
            </div> : null}

            {!isPmMechanic ? <div>
              <Label className="section-label" htmlFor="work-order-notes">
                Notes (Optional)
              </Label>
              <Textarea
                id="work-order-notes"
                className="mt-2"
                placeholder="Describe or add any information needed to perform the work"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div> : null}
          </section> : null}

          {error ? (
            <InlineAlert className="mb-3">{error}</InlineAlert>
          ) : null}

          <div className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 mx-auto max-w-[calc(28rem-2rem)] rounded-xl border border-shop-border bg-background/95 p-2 shadow-lg backdrop-blur">
            <Button
              className="w-full"
              disabled={createBlocked}
              onClick={create}
            >
              {createActionLabel}
            </Button>
          </div>
        </>
      ) : null}

      <JobPickerDialog
        open={addOpen}
        categories={standardCategories}
        defaultCategoryId={categoryId}
        onClose={() => setAddOpen(false)}
        onAdd={(job) => {
          let added = false;
          setJobs((current) => {
            const duplicate = current.some((existing) =>
              (job.catalogJobId && existing.catalogJobId === job.catalogJobId) ||
              normalizeJobName(existing.displayName) === normalizeJobName(job.displayName),
            );
            if (duplicate) return current;
            added = true;
            return [...current, { ...job, key: crypto.randomUUID() }];
          });
          return added;
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

function NewWorkOrderLoading({
  label,
  children,
}: {
  label?: string;
  children?: ReactNode;
}) {
  const { messages } = useShopLocale();
  return (
    <div>
      <ScreenHeader title={messages.newWorkOrder} subtitle={messages.workOrderHint} backHref="/" />
      {children ?? <PageSkeleton label={label ?? (messages.locale === 'es' ? 'Cargando formulario de Work Order' : 'Loading Work Order form')} />}
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
      <Button className="mt-4 w-full" onClick={onClose}>
        Done
      </Button>
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

function normalizeJobName(name: string) {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
}
