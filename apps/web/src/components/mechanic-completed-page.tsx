'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MechanicMode } from '@ltl-shop/shared';
import { useAuth } from '@/lib/auth-context';
import { useShopLocale } from '@/lib/locale-context';
import { replaceAppLocation } from '@/lib/session-restore';
import { useWorkOrders } from '@/lib/shop-data';
import { jobCategoriesLine, vehicleLine } from '@/lib/work-order-identity';
import { SessionSignInFallback } from './session-sign-in-fallback';
import { Card, CardListSkeleton, EmptyState, HomeTopBar, LoadFailure, PageHeader } from './ui';

/** LTR-133: completed work has its own screen in both mechanic workspaces. */
export function MechanicCompletedPage({ mode }: { mode: MechanicMode }) {
  const { token, sessionLoading } = useAuth();
  const { messages } = useShopLocale();
  const router = useRouter();
  const isPm = mode === MechanicMode.PM;
  const { data, error, mutate } = useWorkOrders(!!token, isPm ? 'pm' : 'standard');

  useEffect(() => {
    if (!sessionLoading && !token) replaceAppLocation('/login', router);
  }, [sessionLoading, token, router]);
  if (!sessionLoading && !token) return <SessionSignInFallback />;

  const completed = data?.completed ?? [];
  return (
    <div>
      <HomeTopBar mode={mode} />
      <PageHeader className="mb-6" title={messages.mechanicCompletedTitle} subtitle={messages.mechanicCompletedSubtitle} />
      {error ? <LoadFailure message={messages.unableToLoadWorkOrders} onRetry={() => void mutate()} retryLabel={messages.retry} /> : null}
      {!data && !error ? <CardListSkeleton /> : null}
      {data && !completed.length ? <EmptyState>{messages.noCompletedWork}</EmptyState> : null}
      <ul className="space-y-2">
        {completed.map((wo) => {
          const pmJob = isPm && wo.primaryCategoryName !== 'PM' ? wo.pmJob : null;
          const description = pmJob
            ? messages.pmJobOnWorkOrder(pmJob.displayName, wo.displayId)
            : wo.primaryCategoryName === 'PM'
              ? `${messages.pmServiceLabel} · ${messages.workOrder} ${wo.displayId}`
              : [`${messages.workOrder} ${wo.displayId}`, jobCategoriesLine(wo.jobs)].filter(Boolean).join(' · ');
          return (
            <li key={wo.id}>
              <Link href={`/work-orders/${wo.id}${pmJob ? '?view=pm' : ''}`} className="block">
                <Card className="p-3 transition hover:border-primary/50">
                  <p className="font-display text-lg font-semibold">{messages.truckTitle(wo.truckNumber)}</p>
                  {vehicleLine(wo.truckVehicle) ? <p className="text-sm text-shop-muted">{vehicleLine(wo.truckVehicle)}</p> : null}
                  <p className="mt-1 text-sm text-shop-muted">{description}</p>
                </Card>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
