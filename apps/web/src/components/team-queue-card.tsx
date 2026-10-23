'use client';

import { useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { Users, Wrench } from 'lucide-react';
import { SHOP_WORK_QUEUE_KEY, type TeamQueueItemDto } from '@ltl-shop/shared';
import { apiFetch } from '@/lib/api';
import { apiErrorMessage } from '@/lib/api-error-message';
import { useShopLocale } from '@/lib/locale-context';
import { isWorkOrderRelatedListKey } from '@/lib/swr-cache-keys';
import { LIVE_REFRESH_MS } from '@/lib/live-refresh';
import { vehicleLine } from '@/lib/work-order-identity';
import { useActionToast } from './action-toast';
import { Button, CountChip, InlineAlert, PriorityBadge } from './ui';

export const TEAM_QUEUE_KEY = '/api/team-queue';

/**
 * LTR-197 / D28: Jobs of my Shop workflow steps that wait, with no owner, for someone on the team to take them.
 * Take makes the Job mine (first one wins); it then shows in my Work as usual. Hidden when the queue is empty.
 * D57 §5 (LTR-305): the Shop Work queue (repairs nobody took) is its own list, "Available in the shop".
 */
export function TeamQueueCard({ enabled }: { enabled: boolean }) {
  const { messages } = useShopLocale();
  const { showToast } = useActionToast();
  const { mutate: mutateGlobal } = useSWRConfig();
  const { data, mutate } = useSWR<TeamQueueItemDto[]>(enabled ? TEAM_QUEUE_KEY : null, { refreshInterval: LIVE_REFRESH_MS.board, dedupingInterval: 5_000 });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!data?.length) return null;

  async function take(item: TeamQueueItemDto) {
    setBusy(item.jobId);
    setError(null);
    try {
      const next = await apiFetch<TeamQueueItemDto[]>(`/api/team-queue/${item.jobId}/take`, { method: 'POST' });
      await mutate(next, { revalidate: false });
      await mutateGlobal(isWorkOrderRelatedListKey, undefined, { revalidate: true, populateCache: false });
      showToast('success', messages.teamQueueTaken(item.displayName, item.truck.truckNumber));
    } catch (failure) {
      setError(apiErrorMessage(failure, messages, messages.unableToLoadWorkOrders));
      void mutate();
    } finally {
      setBusy(null);
    }
  }

  const team = data.filter((item) => item.stepKey !== SHOP_WORK_QUEUE_KEY);
  const shop = data.filter((item) => item.stepKey === SHOP_WORK_QUEUE_KEY);

  function list(items: TeamQueueItemDto[], kind: 'team' | 'shop') {
    if (!items.length) return null;
    const titleId = `${kind}-queue-title`;
    const teamSize = Math.max(...items.map((item) => item.teamSize));
    const Icon = kind === 'shop' ? Wrench : Users;
    return (
      <section className="mb-6 space-y-2" aria-labelledby={titleId} data-testid={kind === 'shop' ? 'shop-queue' : 'team-queue'}>
        <div>
          <h2 id={titleId} className="flex items-center gap-2 text-base font-semibold">
            <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
            {kind === 'shop' ? messages.shopQueueTitle : messages.teamQueueTitle}
            <CountChip>{items.length}</CountChip>
          </h2>
          <p className="text-xs text-muted-foreground">{kind === 'shop' ? messages.shopQueueHint : messages.teamQueueHint(teamSize)}</p>
        </div>
        <ul className="divide-y rounded-xl border bg-card">
          {items.map((item) => (
            <li key={item.jobId} className="flex items-center gap-3 px-3 py-2" data-testid={kind === 'shop' ? 'shop-queue-item' : 'team-queue-item'}>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                  {messages.truckTitle(item.truck.truckNumber)}
                  {item.priority === 'high' || item.priority === 'critical' ? <PriorityBadge priority={item.priority}>{messages.priority[item.priority as keyof typeof messages.priority] ?? item.priority}</PriorityBadge> : null}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {item.displayName}
                  {vehicleLine(item.truck) ? ` · ${vehicleLine(item.truck)}` : ''}
                  {' · '}
                  <span className="font-mono">{item.workOrderDisplayId}</span>
                </p>
              </div>
              <Button type="button" size="sm" disabled={busy !== null} onClick={() => void take(item)}>
                {messages.teamQueueTake}
              </Button>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <>
      {error ? <InlineAlert>{error}</InlineAlert> : null}
      {list(team, 'team')}
      {list(shop, 'shop')}
    </>
  );
}
