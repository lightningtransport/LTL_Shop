'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MechanicMode } from '@ltl-shop/shared';
import { useAuth } from '@/lib/auth-context';
import { formatVehicleYmm } from '@/lib/format';
import { useShopLocale } from '@/lib/locale-context';
import { replaceAppLocation } from '@/lib/session-restore';
import { useTrucks } from '@/lib/shop-data';
import { rankTruckResults } from '@/lib/truck-search';
import { SessionSignInFallback } from './session-sign-in-fallback';
import { OpenWorkOrderTag } from './open-work-order-tag';
import { Card, EmptyState, HomeTopBar, Input, Label, LoadFailure, PageHeader } from './ui';

/** LTR-133: a mechanic finds any Truck and opens its repair history. */
export function MechanicTrucksPage({ mode }: { mode: MechanicMode }) {
  const { token, sessionLoading } = useAuth();
  const { messages } = useShopLocale();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const { data: trucks, error, mutate } = useTrucks(!!token);
  const base = `/mechanic/${mode === MechanicMode.PM ? 'pm' : 'standard'}`;
  const { results } = useMemo(() => rankTruckResults(trucks ?? [], query), [trucks, query]);

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
        className="mb-4 mt-2"
        placeholder={messages.searchTruck}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {error ? <LoadFailure message={messages.unableToLoadWorkOrders} onRetry={() => void mutate()} retryLabel={messages.retry} /> : null}
      {query.trim() && !results.length && trucks ? <EmptyState>{messages.noTrucks}</EmptyState> : null}
      <ul className="space-y-2">
        {results.slice(0, 20).map((truck) => (
          <li key={truck.id}>
            <Link href={`/trucks/${truck.id}/history?from=${encodeURIComponent(`${base}/trucks`)}`} className="block">
              <Card className="p-3 transition hover:border-primary/50">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-display text-lg font-semibold">{messages.truckTitle(truck.truckNumber)}</p>
                  {truck.openWorkOrder ? <OpenWorkOrderTag label={messages.truckOpenWorkOrder(truck.openWorkOrder.displayId)} /> : null}
                </div>
                {formatVehicleYmm(truck) ? <p className="text-sm text-shop-muted">{formatVehicleYmm(truck)}</p> : null}
                <p className="mt-1 text-sm text-primary">{messages.repairHistory}</p>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
