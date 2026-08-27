'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type {
  JobCategoryDto,
  RepairHistoryItemDto,
  TruckDto,
} from '@ltl-shop/shared';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';
import { formatMileage } from '@/lib/format';
import { EmptyState, ScreenHeader } from '@/components/ui';

export default function RepairHistoryPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [truck, setTruck] = useState<TruckDto | null>(null);
  const [items, setItems] = useState<RepairHistoryItemDto[]>([]);
  const [categories, setCategories] = useState<JobCategoryDto[]>([]);
  const [categoryId, setCategoryId] = useState<string>('all');

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    apiFetch<JobCategoryDto[]>('/api/catalog/categories').then(setCategories);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const qs =
      categoryId !== 'all' ? `?categoryId=${encodeURIComponent(categoryId)}` : '';
    apiFetch<{ truck: TruckDto; items: RepairHistoryItemDto[] }>(
      `/api/trucks/${params.id}/repair-history${qs}`,
    ).then((res) => {
      setTruck(res.truck);
      setItems(res.items);
    });
  }, [user, params.id, categoryId]);

  if (!truck) return <p className="text-shop-muted">Loading…</p>;

  return (
    <div>
      <button
        type="button"
        className="mb-3 text-sm text-shop-muted"
        onClick={() => router.back()}
      >
        ← Back
      </button>
      <ScreenHeader
        title="REPAIR HISTORY"
        subtitle={`#${truck.truckNumber}`}
      />

      <section className="card mb-4 text-sm">
        <p>
          {truck.make} | {truck.model} | {truck.year}
        </p>
        <p className="text-shop-muted">
          {formatMileage(truck.mileage)} | {truck.company} | {truck.owner}
        </p>
      </section>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        <FilterChip
          active={categoryId === 'all'}
          onClick={() => setCategoryId('all')}
          label="ALL"
        />
        {categories.slice(0, 6).map((c) => (
          <FilterChip
            key={c.id}
            active={categoryId === c.id}
            onClick={() => setCategoryId(c.id)}
            label={c.name}
          />
        ))}
      </div>

      {!items.length ? (
        <EmptyState>No repair history.</EmptyState>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <article key={item.workOrderId} className="card space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold uppercase tracking-wide">
                  {new Date(item.date).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
                <span className="text-shop-muted">#{item.truckNumber}</span>
              </div>
              <p>{item.primaryCategoryName}</p>
              <p className="text-sm text-shop-muted">
                Mechanic: {item.mechanicNames.join(' / ') || '—'}
              </p>
              <p className="text-sm text-shop-muted">
                Mileage: {formatMileage(item.mileage)}
              </p>
              <div>
                <p className="section-label mb-2">Work Performed</p>
                <div className="flex flex-wrap gap-2">
                  {item.jobs.map((j) => (
                    <span
                      key={j}
                      className="rounded-lg border border-shop-border px-2 py-1 text-xs"
                    >
                      {j}
                    </span>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? 'btn-primary whitespace-nowrap px-3 py-2 text-xs'
          : 'btn-secondary whitespace-nowrap px-3 py-2 text-xs'
      }
    >
      {label}
    </button>
  );
}
