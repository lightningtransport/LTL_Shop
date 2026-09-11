'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppCapability, Priority, type AdminCatalogJobDto } from '@ltl-shop/shared';
import { ApiError } from '@/lib/api';
import {
  createAdminWorkOrder,
  useAdminCatalogCategories,
  useAdminCatalogCategory,
  useAdminMechanics,
  useAdminTrucks,
} from '@/lib/admin-data';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';
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
  Label,
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
};

export function AdminNewWorkOrder({
  locale,
  messages,
}: {
  locale: AdminLocale;
  messages: AdminMessages;
}) {
  void locale;
  const router = useRouter();
  const [truckQuery, setTruckQuery] = useState('');
  const [truckId, setTruckId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [jobs, setJobs] = useState<DraftJob[]>([]);
  const [priority, setPriority] = useState<Priority>(Priority.NORMAL);
  const [notes, setNotes] = useState('');
  const [assignees, setAssignees] = useState<string[]>([]);
  const [customName, setCustomName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: truckPages } = useAdminTrucks(truckQuery ? `q=${encodeURIComponent(truckQuery)}` : '');
  const { data: categories } = useAdminCatalogCategories();
  const { data: categoryDetail } = useAdminCatalogCategory(categoryId);
  const { data: mechanicPages } = useAdminMechanics('');

  const trucks = truckPages?.flatMap((page) => page.items) ?? [];
  const selectedTruck = trucks.find((item) => item.truck.id === truckId) ?? null;
  const standardCategories = (categories ?? []).filter((category) => category.name !== 'PM' && category.status === 'active');
  const selectedCategory = standardCategories.find((category) => category.id === categoryId) ?? null;
  const assignableMechanics = useMemo(
    () => (mechanicPages?.flatMap((page) => page.items) ?? []).filter(
      (mechanic) => mechanic.active && mechanic.capabilities.includes(AppCapability.MECHANIC_STANDARD),
    ),
    [mechanicPages],
  );

  const catalogJobs: AdminCatalogJobDto[] = (categoryDetail?.jobs ?? []).filter(
    (job) => job.status === 'active' && !jobs.some((draft) => draft.catalogJobId === job.id),
  );

  const primaryCategoryId = jobs[0]?.categoryId ?? categoryId;
  const canSubmit = Boolean(truckId) && jobs.length > 0 && !selectedTruck?.openWorkOrder && !busy;

  function addCatalogJob(job: AdminCatalogJobDto) {
    if (!selectedCategory) return;
    setJobs((current) => current.some((draft) => draft.catalogJobId === job.id)
      ? current
      : [...current, {
          key: crypto.randomUUID(),
          catalogJobId: job.id,
          categoryId: selectedCategory.id,
          categoryName: selectedCategory.name,
          displayName: job.displayName,
        }]);
  }

  function addCustomJob() {
    if (!selectedCategory || !customName.trim()) return;
    setJobs((current) => [...current, {
      key: crypto.randomUUID(),
      categoryId: selectedCategory.id,
      categoryName: selectedCategory.name,
      displayName: customName.trim(),
      customDescription: customName.trim(),
    }]);
    setCustomName('');
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

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const created = await createAdminWorkOrder({
        truckId,
        primaryCategoryId,
        priority,
        notes: notes.trim() || undefined,
        mechanicIds: assignees,
        jobs: jobs.map((job) => ({
          catalogJobId: job.catalogJobId,
          categoryId: job.categoryId,
          displayName: job.displayName,
          customDescription: job.customDescription,
        })),
      });
      router.push(`/admin/work-orders/${created.id}`);
    } catch (failure) {
      setError(failure instanceof ApiError && failure.message ? failure.message : messages.createWorkOrderFailed);
    } finally {
      setBusy(false);
    }
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
          <Input
            aria-label={messages.searchTrucksLabel}
            placeholder={messages.searchTrucksLabel}
            value={truckQuery}
            onChange={(event) => setTruckQuery(event.target.value)}
          />
          {trucks.length ? (
            <Select aria-label={messages.selectTruckLabel} value={truckId} onChange={(event) => setTruckId(event.target.value)}>
              <option value="">{messages.selectTruckLabel}</option>
              {trucks.map((item) => (
                <option key={item.truck.id} value={item.truck.id}>
                  #{item.truck.truckNumber} · {item.truck.make} {item.truck.model}
                </option>
              ))}
            </Select>
          ) : truckQuery ? (
            <EmptyState>{messages.noTrucksFound}</EmptyState>
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
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">{messages.category}</span>
              <Select aria-label={messages.category} value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                <option value="">{messages.category}</option>
                {standardCategories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </Select>
            </label>
          </div>

          {selectedCategory ? (
            <div className="space-y-2">
              <ul className="max-h-56 space-y-1 overflow-auto">
                {catalogJobs.length ? catalogJobs.map((job) => (
                  <li key={job.id}>
                    <Button type="button" variant="secondary" className="w-full justify-start" onClick={() => addCatalogJob(job)}>
                      {job.displayName}
                    </Button>
                  </li>
                )) : (
                  <li className="text-sm text-muted-foreground">{messages.noJobsYet}</li>
                )}
              </ul>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  aria-label={messages.addJobsLabel}
                  className="flex-1"
                  placeholder={messages.addJobsLabel}
                  value={customName}
                  onChange={(event) => setCustomName(event.target.value)}
                />
                <Button type="button" disabled={!customName.trim()} onClick={addCustomJob}>+</Button>
              </div>
            </div>
          ) : null}

          <div className="space-y-3">
            <p className="text-sm font-medium">{messages.jobsInPlan}</p>
            {jobs.length ? jobsByCategory.map(([categoryName, group]) => (
              <div key={categoryName} className="space-y-1">
                <Badge variant="outline">{categoryName}</Badge>
                <ul className="divide-y">
                  {group.map((job) => (
                    <li key={job.key} className="flex items-center justify-between py-2 text-sm">
                      <span>{job.displayName}</span>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setJobs((current) => current.filter((item) => item.key !== job.key))}>
                        ✕
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )) : (
              <EmptyState>{messages.noJobsYet}</EmptyState>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{messages.assigneesLabel}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {assignableMechanics.map((mechanic) => {
              const selected = assignees.includes(mechanic.id);
              return (
                <Button
                  key={mechanic.id}
                  type="button"
                  variant={selected ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setAssignees((current) => selected ? current.filter((id) => id !== mechanic.id) : [...current, mechanic.id])}
                >
                  {mechanic.name}
                </Button>
              );
            })}
          </div>
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
