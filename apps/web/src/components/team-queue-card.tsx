'use client';

import { useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { Users } from 'lucide-react';
import type { TeamQueueItemDto } from '@ltl-shop/shared';
import { apiFetch } from '@/lib/api';
import { apiErrorMessage } from '@/lib/api-error-message';
import { useShopLocale } from '@/lib/locale-context';
import { isWorkOrderRelatedListKey } from '@/lib/swr-cache-keys';
import { vehicleLine } from '@/lib/work-order-identity';
import { useActionToast } from './action-toast';
import { Button, CountChip, InlineAlert, PriorityBadge } from './ui';

export const TEAM_QUEUE_KEY = '/api/team-queue';

/**
 * LTR-197 / D28: Jobs of my Shop workflow steps that wait, with no owner, for someone on the team to take them.
 * Take makes the Job mine (first one wins); it then shows in my Work as usual. Hidden when the queue is empty.
 */
export function TeamQueueCard({ enabled }: { enabled: boolean }) {
  const { messages } = useShopLocale();
  const { showToast } = useActionToast();
  const { mutate: mutateGlobal } = useSWRConfig();
  const { data, mutate } = useSWR<TeamQueueItemDto[]>(enabled ? TEAM_QUEUE_KEY : null, { refreshInterval: 20_000, dedupingInterval: 5_000 });
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

  const teamSize = Math.max(...data.map((item) => item.teamSize));
  return (
    <section className="mb-6 space-y-2" aria-labelledby="team-queue-title" data-testid="team-queue">
      <div>
        <h2 id="team-queue-title" className="flex items-center gap-2 text-base font-semibold">
          <Users aria-hidden="true" className="size-4 text-muted-foreground" />
          {messages.teamQueueTitle}
          <CountChip>{data.length}</CountChip>
        </h2>
        <p className="text-xs text-muted-foreground">{messages.teamQueueHint(teamSize)}</p>
      </div>
      {error ? <InlineAlert>{error}</InlineAlert> : null}
      <ul className="divide-y rounded-xl border bg-card">
        {data.map((item) => (
          <li key={item.jobId} className="flex items-center gap-3 px-3 py-2" data-testid="team-queue-item">
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
