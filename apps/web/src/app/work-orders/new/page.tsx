'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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

  useEffect(() => {
    if (!sessionLoading && !token) router.replace('/login');
  }, [sessionLoading, token, router]);

  useEffect(() => {
    if (!categoryId && categories[0]) setCategoryId(categories[0].id);
  }, [categories, categoryId]);

  useEffect(() => {
    if (!user) return;
    setWorkingWith((current) => (current.length ? current : [user.id]));
  }, [user]);

  const results = useMemo(() => {
    const term = query.trim().replace(/^#/, '').toLowerCase();
    if (!term || truck) return [];
    return (truckData ?? [])
      .filter((item) => item.truckNumber.toLowerCase().includes(term))
      .slice(0, 20);
  }, [query, truck, truckData]);

  async function selectTruck(t: TruckDto) {
    setTruck(t);
    setQuery(t.truckNumber);
    setOpenWo(null);
    const open = await apiFetch<
      { exists: false } | { exists: true; workOrder: WorkOrderSummaryDto }
    >(`/api/trucks/${t.id}/open-work-order`);
    if (open.exists) setOpenWo(open.workOrder);
  }

  async function create() {
    if (!truck || !categoryId || jobs.length === 0) {
      setError('Truck, category, and at least one job are required.');
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
          notes: notes || undefined,
          mechanicIds: workingWith,
          jobs: jobs.map((j) => ({
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
        title="New Work Order"
        subtitle="Enter the required information."
        backHref="/"
      />

      <section className="card mb-4 space-y-3">
        <label className="section-label">Truck</label>
        <div className="relative">
          <input
            className="field"
            placeholder="Search Truck Number (e.g. #905)"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setTruck(null);
              setOpenWo(null);
            }}
          />
          {results.length > 0 && !truck ? (
            <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-shop-border bg-shop-panel">
              {results.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    className="w-full px-4 py-3 text-left text-sm hover:bg-white/5"
                    onClick={() => selectTruck(t)}
                  >
                    #{t.truckNumber} · {t.make} {t.model}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

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
                href={`/trucks/${truck.id}/history`}
                className="btn-secondary w-full"
              >
                See Truck Repair History
              </Link>
            </div>
          )}
        </div>
      </section>

      {openWo ? (
        <div className="mb-4 rounded-2xl border border-amber-400/40 bg-amber-400/10 p-4">
          <p className="font-semibold text-amber-100">
            Truck #{truck?.truckNumber} already has an open Work Order.
          </p>
          <p className="mt-1 text-sm text-amber-100/80">
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
            <div>
              <label className="section-label">Category</label>
              <select
                className="field mt-2"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
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
                        className="text-shop-muted"
                        onClick={() =>
                          setJobs((prev) => prev.filter((x) => x.key !== j.key))
                        }
                      >
                        🗑
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                className="btn-secondary w-full"
                onClick={() => setAddOpen(true)}
              >
                Add job +
              </button>
            </div>

            <div>
              <label className="section-label">Working With</label>
              <select
                className="field mt-2"
                multiple
                value={workingWith}
                onChange={(e) =>
                  setWorkingWith(
                    Array.from(e.target.selectedOptions).map((o) => o.value),
                  )
                }
                size={Math.min(4, mechanics.length || 1)}
              >
                {mechanics.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <p className="section-label mb-2">Priority</p>
              <div className="grid grid-cols-4 gap-2">
                {Object.values(Priority).map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={
                      priority === p ? 'btn-primary' : 'btn-secondary'
                    }
                    onClick={() => setPriority(p)}
                  >
                    {p.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="section-label">Notes (Optional)</label>
              <textarea
                className="field mt-2 min-h-24"
                placeholder="Describe or add any information needed to perform the work"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </section>

          {error ? (
            <p className="mb-3 text-sm text-red-300">{error}</p>
          ) : null}

          {categoryError || mechanicError || truckError ? (
            <p className="mb-3 text-sm text-red-300">
              Unable to load shop reference data.
            </p>
          ) : null}

          <button
            type="button"
            className="btn-primary w-full"
            disabled={busy}
            onClick={create}
          >
            Create Work Order
          </button>
        </>
      ) : null}

      <AddJobModal
        open={addOpen}
        categories={categories}
        defaultCategoryId={categoryId}
        onClose={() => setAddOpen(false)}
        onAdd={(job) => {
          setJobs((prev) => [...prev, job]);
          setAddOpen(false);
        }}
      />
    </div>
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
}: {
  open: boolean;
  categories: JobCategoryDto[];
  defaultCategoryId: string;
  onClose: () => void;
  onAdd: (job: DraftJob) => void;
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
    <Modal open={open} title="Add job" onClose={onClose}>
      <div className="space-y-3">
        <select
          className="field"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
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
            <input
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
