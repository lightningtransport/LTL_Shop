'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { formatMileage } from '@/lib/format';
import { useCategories, useRepairHistory } from '@/lib/shop-data';
import { EmptyState, PageSkeleton, ScreenHeader } from '@/components/ui';

export default function RepairHistoryPage() {
  const { token, sessionLoading } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [categoryId, setCategoryId] = useState<string>('all');
  const { data: categoryData } = useCategories(!!token);
  const { data, error } = useRepairHistory(
    params.id,
    categoryId,
    !!token,
  );
  const categories = categoryData ?? [];
  const truck = data?.truck;
  const items = data?.items ?? [];

  useEffect(() => {
    if (!sessionLoading && !token) router.replace('/login');
  }, [sessionLoading, token, router]);

  if (!truck) {
    if (error instanceof Error) {
      return <p className="text-shop-muted">{error.message}</p>;
    }
    return <PageSkeleton label="Loading repair history" />;
  }

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
