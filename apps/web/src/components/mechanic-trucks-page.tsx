'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MechanicMode } from '@ltl-shop/shared';
import { useAuth } from '@/lib/auth-context';
import { formatVehicleYmm } from '@/lib/format';
import { useShopLocale } from '@/lib/locale-context';
import { replaceAppLocation } from '@/lib/session-restore';
import { useTrucks, useWorkOrders } from '@/lib/shop-data';
import { ChevronRight } from 'lucide-react';
import { rankTruckResults } from '@/lib/truck-search';
import { SessionSignInFallback } from './session-sign-in-fallback';
import { OpenWorkOrderTag } from './open-work-order-tag';
import { Card, CardListSkeleton, EmptyState, HomeTopBar, Input, Label, LoadFailure, PageHeader } from './ui';

/** LTR-133: a mechanic finds any Truck and opens its repair history. */
export function MechanicTrucksPage({ mode }: { mode: MechanicMode }) {
  const { token, sessionLoading } = useAuth();
  const { messages } = useShopLocale();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const { data: trucks, error, mutate } = useTrucks(!!token);
  // Stage MG-6 (UX-1-010): "Open WO-004 ›" leads to the Work Order when it has Jobs of mine.
  const { data: lists } = useWorkOrders(!!token, mode === MechanicMode.PM ? 'pm' : 'standard');
  const mine = useMemo(() => new Set([...(lists?.active ?? []), ...(lists?.created ?? []), ...(lists?.paused ?? [])].map((wo) => wo.id)), [lists]);
  // UX-7-007: the number keyboard when every truck number is digits.
  const numeric = Boolean(trucks?.length && trucks.every((truck) => /^\d+$/.test(truck.truckNumber)));
  const base = `/mechanic/${mode === MechanicMode.PM ? 'pm' : 'standard'}`;
  const { results } = useMemo(() => rankTruckResults(trucks ?? [], query), [trucks, query]);
  // LTR-208: before any search, the trucks whose open Work Order has Jobs of mine — no number to remember.
  const withMyJobs = useMemo(
    () => (trucks ?? []).filter((truck) => truck.openWorkOrder && mine.has(truck.openWorkOrder.id)),
    [trucks, mine],
  );
  const searching = Boolean(query.trim());
  const shown = searching ? results.slice(0, 20) : withMyJobs;

  useEffect(() => {
    if (!sessionLoading && !token) replaceAppLocation('/login', router);
  }, [sessionLoading, token, router]);
  if (!sessionLoading && !token) return <SessionSignInFallback />;

  return (
    <div>
      <HomeTopBar mode={mode} />
      <PageHeader className="mb-6" title={messages.mechanicTrucksTitle} subtitle={messages.mechanicTrucksSubtitle} />
      <Label htmlFor="mechanic-truck-search">{messages.truck}</Label>
      <Input
        id="mechanic-truck-search"
        type="search"
        inputMode={numeric ? 'numeric' : undefined}
        className="mb-4 mt-2"
        placeholder={messages.searchTruck}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {error ? <LoadFailure message={messages.unableToLoadTrucks} onRetry={() => void mutate()} retryLabel={messages.retry} /> : null}
      {!trucks && !error ? <CardListSkeleton count={2} /> : null}
      {searching && !results.length && trucks ? <EmptyState>{messages.noTrucks}</EmptyState> : null}
      {!searching && withMyJobs.length ? <h2 className="mb-2 text-sm font-semibold text-shop-muted">{messages.mechanicTrucksMine}</h2> : null}
      <ul className="space-y-2" data-testid={searching ? 'truck-search-results' : 'trucks-with-my-jobs'}>
        {shown.map((truck) => (
          <li key={truck.id}>
            <Card className="space-y-1 p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="font-display text-lg font-semibold">{messages.truckTitle(truck.truckNumber)}</p>
                {truck.openWorkOrder && mine.has(truck.openWorkOrder.id) ? (
                  <Link href={`/work-orders/${truck.openWorkOrder.id}`} className="inline-flex min-h-9 items-center gap-0.5 rounded-md px-2 text-sm font-medium text-primary hover:bg-accent" data-testid="open-my-work-order">
                    {messages.truckOpenWorkOrder(truck.openWorkOrder.displayId)}<ChevronRight aria-hidden="true" className="size-4" />
                  </Link>
                ) : truck.openWorkOrder ? <OpenWorkOrderTag label={messages.truckOpenWorkOrder(truck.openWorkOrder.displayId)} /> : null}
              </div>
              {formatVehicleYmm(truck) ? <p className="text-sm text-shop-muted">{formatVehicleYmm(truck)}</p> : null}
              <Link href={`/trucks/${truck.id}/history?from=${encodeURIComponent(`${base}/trucks`)}`} className="flex min-h-11 items-center justify-between text-sm font-medium text-primary">
                {messages.repairHistory}<ChevronRight aria-hidden="true" className="size-4" />
              </Link>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
