'use client';

import { type RefObject, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { useSWRConfig } from 'swr';
import {
  JobStatus,
  PAUSE_REASON_LABELS,
  PauseReason,
  Priority,
  type JobAliasOptionDto,
  type JobCategoryDto,
  type WorkOrderDetailDto,
} from '@ltl-shop/shared';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';
import { formatMileage, pauseLabel, statusLabel } from '@/lib/format';
import { filterAliasOptions } from '@/lib/job-catalog';
import {
  shopKeys,
  useAliasOptions,
  useCategories,
  useWorkOrder,
} from '@/lib/shop-data';
import {
  EmptyState,
  Modal,
  PageSkeleton,
  PriorityBadge,
  ScreenHeader,
} from '@/components/ui';

export default function WorkOrderDetailPage() {
  const { user, token, sessionLoading } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const id = params.id;
  const { mutate: mutateGlobal } = useSWRConfig();
  const {
    data: wo,
    error: loadError,
    mutate: mutateWorkOrder,
  } = useWorkOrder(id, !!token);
  const { data: categoryData } = useCategories(!!token);
  const categories = categoryData ?? [];

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [truckOpen, setTruckOpen] = useState(false);
  const [finishJob, setFinishJob] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [pauseReason, setPauseReason] = useState<PauseReason | ''>('');
  const [pauseNotes, setPauseNotes] = useState('');
  const [changeReason, setChangeReason] = useState<PauseReason | ''>('');
  const [addOpen, setAddOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [notesDirty, setNotesDirty] = useState(false);
  const pauseTriggerRef = useRef<HTMLButtonElement>(null);
  const addJobTriggerRef = useRef<HTMLButtonElement>(null);
  const finishJobTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!sessionLoading && !token) router.replace('/login');
  }, [sessionLoading, token, router]);

  useEffect(() => {
    const action = search.get('action');
    if (action === 'pause') setPauseOpen(true);
  }, [search]);

  useEffect(() => {
    if (!wo || notesDirty) return;
    setNotes(wo.notes ?? '');
  }, [wo, notesDirty]);

  async function run(
    action: () => Promise<WorkOrderDetailDto>,
    optimisticUpdate?: (
      current: WorkOrderDetailDto,
    ) => WorkOrderDetailDto,
  ) {
    const snapshot = wo;
    setBusy(true);
    setError(null);
    if (snapshot && optimisticUpdate) {
      await mutateWorkOrder(optimisticUpdate(snapshot), {
        revalidate: false,
      });
    }
    try {
      const updated = await action();
      await mutateWorkOrder(updated, { revalidate: false });
      void Promise.all([
        mutateGlobal(shopKeys.workOrders),
        mutateGlobal(
          (key) =>
            typeof key === 'string' && key.includes('/repair-history'),
        ),
      ]).catch(() => undefined);
    } catch (e) {
      if (snapshot && optimisticUpdate) {
        await mutateWorkOrder(snapshot, { revalidate: false });
      }
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  if (sessionLoading || !token || !wo) {
    if (error) return <p className="text-shop-muted" role="alert">{error}</p>;
    if (loadError instanceof Error) {
      return <p className="text-shop-muted" role="alert">{loadError.message}</p>;
    }
    return <PageSkeleton label="Loading work order" />;
  }

  const todo = wo.jobs.filter((j) => j.status === 'to_do');
  const done = wo.jobs.filter((j) => j.status === 'completed');

  return (
    <div>
      <ScreenHeader
        title={wo.displayId}
        subtitle={`#${wo.truckNumber} · ${statusLabel(wo.status)}`}
        backHref="/"
      />

      <div className="card mb-4 space-y-2">
        <div className="flex items-center justify-between">
          <PriorityBadge priority={wo.priority} />
          <span className="text-sm text-shop-muted">
            {wo.primaryCategoryName} — {wo.jobsCompleted} of {wo.jobsTotal}{' '}
            jobs
          </span>
        </div>
        {wo.currentPauseReason ? (
          <p className="text-sm font-medium text-warning-foreground">
            {pauseLabel(wo.currentPauseReason)}
          </p>
        ) : null}
      </div>

      {error ? (
        <p className="mb-3 text-sm text-red-300" role="alert" aria-live="assertive">
          {error}
        </p>
      ) : null}

      <section className="mb-4 space-y-2">
        <p className="section-label">Work Options</p>
        {wo.status === 'created' ? (
          <button
            type="button"
            className="btn-primary w-full"
            disabled={busy}
            onClick={() =>
              run(() =>
                apiFetch<WorkOrderDetailDto>(`/api/work-orders/${wo.id}/start`, {
                  method: 'POST',
                }),
              )
            }
          >
            Start Work
          </button>
        ) : null}
        {wo.status === 'in_progress' ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              ref={pauseTriggerRef}
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={() => setPauseOpen(true)}
            >
              Pause Work
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={busy}
              onClick={() =>
                run(() =>
                  apiFetch<WorkOrderDetailDto>(`/api/work-orders/${wo.id}/complete`, {
                    method: 'POST',
                  }),
                )
              }
            >
              Finish Work
            </button>
          </div>
        ) : null}
        {wo.status === 'waiting_paused' ? (
          <button
            type="button"
            className="btn-primary w-full"
            disabled={busy}
            onClick={() =>
              run(() =>
                apiFetch<WorkOrderDetailDto>(`/api/work-orders/${wo.id}/resume`, {
                  method: 'POST',
                }),
              )
            }
          >
            Resume Work
          </button>
        ) : null}
      </section>

      {wo.status === 'waiting_paused' ? (
        <section className="card mb-4 space-y-3">
          <label className="section-label" htmlFor="change-pause-reason">
            Change Pause Reason
          </label>
          <div className="relative">
            <select
              id="change-pause-reason"
              className="field appearance-none pr-11"
              value={changeReason || wo.currentPauseReason || ''}
              onChange={(e) => setChangeReason(e.target.value as PauseReason)}
            >
              {Object.values(PauseReason).map((r) => (
                <option key={r} value={r}>
                  {PAUSE_REASON_LABELS[r]}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-shop-muted" aria-hidden="true" />
          </div>
          <button
            type="button"
            className="btn-secondary w-full"
            disabled={busy}
            onClick={() =>
              run(() =>
                apiFetch<WorkOrderDetailDto>(`/api/work-orders/${wo.id}/pause-reason`, {
                  method: 'POST',
                  body: JSON.stringify({
                    reason: changeReason || wo.currentPauseReason,
                  }),
                }),
              )
            }
          >
            Update Pause
          </button>
        </section>
      ) : null}

      <section className="card mb-4">
        <button
          type="button"
          className="flex min-h-11 w-full items-center justify-between rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-shop-accent"
          onClick={() => setTruckOpen((v) => !v)}
          aria-expanded={truckOpen}
          aria-controls="truck-information-panel"
        >
          <span className="section-label">Truck Information</span>
          <ChevronDown
            className={`h-5 w-5 transition-transform ${truckOpen ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
        {truckOpen ? (
          <div id="truck-information-panel" className="mt-3 space-y-3">
            <div className="grid grid-cols-3 gap-2 text-sm">
              <Info label="Make" value={wo.truck.make} />
              <Info label="Model" value={wo.truck.model} />
              <Info label="Year" value={wo.truck.year?.toString()} />
              <Info label="Mileage" value={formatMileage(wo.truck.mileage)} />
              <Info label="Company" value={wo.truck.company} />
              <Info label="Owner" value={wo.truck.owner} />
            </div>
            <Link
              href={`/trucks/${wo.truckId}/history?from=${encodeURIComponent(`/work-orders/${wo.id}`)}`}
              className="btn-secondary w-full"
            >
              See Truck Repair History
            </Link>
          </div>
        ) : null}
      </section>

      <section className="mb-4">
        <p className="section-label mb-2">Jobs To Do</p>
        {todo.length === 0 ? (
          <EmptyState>No pending jobs</EmptyState>
        ) : (
          <ul className="mb-3 space-y-2">
            {todo.map((job) => (
              <li key={job.id}>
                <button
                  type="button"
                  className="card flex w-full items-center gap-3 text-left"
                  disabled={busy || wo.status !== 'in_progress'}
                  onClick={(event) => {
                    finishJobTriggerRef.current = event.currentTarget;
                    setFinishJob({ id: job.id, name: job.displayName });
                  }}
                >
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-shop-border text-xs">
                    ○
                  </span>
                  <span>{job.displayName}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {wo.status !== 'completed' && wo.status !== 'cancelled' ? (
          <button
            ref={addJobTriggerRef}
            type="button"
            className="btn-secondary w-full"
            onClick={() => setAddOpen(true)}
          >
            Add job +
          </button>
        ) : null}
      </section>

      <section className="mb-4">
        <p className="section-label mb-2">Completed</p>
        {done.length === 0 ? (
          <EmptyState>No completed jobs</EmptyState>
        ) : (
          <ul className="space-y-2">
            {done.map((job) => (
              <li
                key={job.id}
                className="card flex items-center gap-3 text-shop-success"
              >
                <span>✓</span>
                <span>{job.displayName}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card space-y-3">
        <div>
          <p className="section-label">Working With</p>
          <p className="mt-1 text-sm">
            {wo.mechanics.map((m) => m.mechanicName).join(' / ') || '—'}
          </p>
        </div>
        <div>
          <p className="section-label mb-2">Priority</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Work order priority">
            {Object.values(Priority).map((p) => (
              <span
                key={p}
                aria-label={`${p} priority${wo.priority === p ? ', selected' : ''}`}
                className={
                  wo.priority === p
                    ? 'btn-primary text-center'
                    : 'btn-secondary text-center opacity-60'
                }
              >
                {p.toUpperCase()}
              </span>
            ))}
          </div>
        </div>
        <div>
          <label className="section-label" htmlFor="wo-notes">
            Notes
          </label>
          <textarea
            id="wo-notes"
            className="field mt-2 min-h-20"
            placeholder="Add notes (optional)"
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              setNotesDirty(true);
            }}
          />
          {notesDirty ? (
            <button
              type="button"
              className="btn-secondary mt-2 w-full"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const updated = await apiFetch<WorkOrderDetailDto>(
                    `/api/work-orders/${wo.id}/notes`,
                    {
                    method: 'POST',
                    body: JSON.stringify({ notes: notes || undefined }),
                    },
                  );
                  setNotesDirty(false);
                  return updated;
                })
              }
            >
              Save Notes
            </button>
          ) : null}
        </div>
      </section>

      <Modal
        open={!!finishJob}
        title="JOB FINISHED"
        onClose={() => setFinishJob(null)}
        returnFocusRef={finishJobTriggerRef}
      >
        <p className="mb-4 text-lg">{finishJob?.name}</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setFinishJob(null)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={busy}
            onClick={() => {
              if (!finishJob) return;
              const jobId = finishJob.id;
              setFinishJob(null);
              run(
                () =>
                  apiFetch<WorkOrderDetailDto>(
                    `/api/work-orders/${wo.id}/jobs/${jobId}/complete`,
                    { method: 'POST' },
                  ),
                (current) => {
                  const completedAt = new Date().toISOString();
                  const jobs = current.jobs.map((job) =>
                    job.id === jobId
                      ? {
                          ...job,
                          status: JobStatus.COMPLETED,
                          completedAt,
                          completedById: user?.id ?? null,
                        }
                      : job,
                  );
                  return {
                    ...current,
                    jobs,
                    jobsCompleted: jobs.filter(
                      (job) => job.status === 'completed',
                    ).length,
                    version: current.version + 1,
                  };
                },
              );
            }}
          >
            Complete Job
          </button>
        </div>
      </Modal>

      <Modal
        open={pauseOpen}
        title="PAUSE WORK ORDER"
        onClose={() => setPauseOpen(false)}
        returnFocusRef={pauseTriggerRef}
      >
        <label className="section-label mb-2 block" htmlFor="pause-reason">
          Pause reason
        </label>
        <div className="relative mb-3">
          <select
            id="pause-reason"
            className="field appearance-none pr-11"
            value={pauseReason}
            onChange={(e) => setPauseReason(e.target.value as PauseReason)}
          >
            <option value="">Select an option</option>
            {Object.values(PauseReason).map((r) => (
              <option key={r} value={r}>
                {PAUSE_REASON_LABELS[r]}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-shop-muted" aria-hidden="true" />
        </div>
        {pauseReason === PauseReason.OTHER ? (
          <div className="mb-3">
            <label className="section-label mb-2 block" htmlFor="pause-notes">
              Additional details
            </label>
            <textarea
              id="pause-notes"
              className="field min-h-20"
              placeholder="Reason required for Other"
              value={pauseNotes}
              onChange={(e) => setPauseNotes(e.target.value)}
            />
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setPauseOpen(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={!pauseReason || busy}
            onClick={() => {
              setPauseOpen(false);
              run(() =>
                apiFetch<WorkOrderDetailDto>(`/api/work-orders/${wo.id}/pause`, {
                  method: 'POST',
                  body: JSON.stringify({
                    reason: pauseReason,
                    notes: pauseNotes || undefined,
                  }),
                }),
              );
            }}
          >
            Pause Work
          </button>
        </div>
      </Modal>

      <AddJobSheet
        open={addOpen}
        categories={categories}
        defaultCategoryId={wo.primaryCategoryId}
        onClose={() => setAddOpen(false)}
        onAdd={(body) => {
          setAddOpen(false);
          run(() =>
            apiFetch<WorkOrderDetailDto>(`/api/work-orders/${wo.id}/jobs`, {
              method: 'POST',
              body: JSON.stringify(body),
            }),
          );
        }}
        returnFocusRef={addJobTriggerRef}
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

function AddJobSheet({
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
  onAdd: (body: {
    catalogJobId?: string;
    categoryId: string;
    displayName: string;
    customDescription?: string;
  }) => void;
  returnFocusRef: RefObject<HTMLElement | null>;
}) {
  const [categoryId, setCategoryId] = useState(defaultCategoryId);
  const [q, setQ] = useState('');
  const [custom, setCustom] = useState('');
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

  return (
    <Modal
      open={open}
      title="Add job"
      onClose={onClose}
      returnFocusRef={returnFocusRef}
    >
      <div className="space-y-3">
        <label className="section-label block" htmlFor="detail-job-category">
          Category
        </label>
        <div className="relative">
          <select
            id="detail-job-category"
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
        <label className="section-label block" htmlFor="detail-job-search">
          Search job or alias
        </label>
        <input
          id="detail-job-search"
          className="field"
          placeholder="Search job / alias (e.g. 3in1)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <ul className="max-h-48 space-y-1 overflow-auto">
          {aliases.length ? (
            aliases.map((alias) => (
              <li key={`${alias.catalogJobId}-${alias.aliasText}`}>
                <button
                  type="button"
                  className="w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-white/5"
                  onClick={() =>
                    onAdd({
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
        <label className="section-label block" htmlFor="detail-custom-job">
          Job not listed
        </label>
        <input
          id="detail-custom-job"
          className="field"
          placeholder="Describe custom job"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
        />
        <button
          type="button"
          className="btn-primary w-full"
          disabled={!custom.trim()}
          onClick={() =>
            onAdd({
              categoryId,
              displayName: custom.trim(),
              customDescription: custom.trim(),
            })
          }
        >
          Add Custom Job
        </button>
      </div>
    </Modal>
  );
}
