'use client';

import Link from 'next/link';
import { FilePlus, TriangleAlert, Wrench } from 'lucide-react';
import type { YardSamsaraPlacesDto } from '@ltl-shop/shared';
import type { AdminMessages } from '@/lib/admin-messages';
import { adminTruckHref } from '@/lib/admin-truck-origin';
import { fillYardText } from '@/lib/yard-card';
import { cn } from '@/lib/utils';

const FROM = '/admin/yard-operations';

/**
 * D51: where the trucks are by Samsara (D49), as counters above the Shop board — In shop and In yard without a Work
 * Order (the truck arrived and nobody opened one). Each opens Trucks with that filter. Where Dispatch's typed location
 * says otherwise is one line below.
 */
export function YardSamsaraCounters({ messages, places }: { messages: AdminMessages; places: YardSamsaraPlacesDto }) {
  const counters = [
    { key: 'in_shop', label: messages.presenceInShop, count: places.inShop.length, icon: Wrench, tone: 'text-primary', warn: false },
    { key: 'in_yard_no_wo', label: messages.yardCounterInYardNoWo, count: places.inYard.length, icon: FilePlus, tone: 'text-warning-foreground dark:text-warning', warn: places.inYard.length > 0 },
  ];
  return (
    <section className="space-y-2" aria-label={messages.yardSamsaraNow} data-testid="yard-samsara-counters">
      <p className="text-xs text-muted-foreground">{messages.yardSamsaraNow}</p>
      <div className="flex flex-wrap gap-2">
        {counters.map(({ key, label, count, icon: Icon, tone, warn }) => (
          <Link
            key={key}
            href={`/admin/trucks?place=${key}`}
            className={cn('inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-accent', warn && 'border-warning/40 bg-warning-surface/50')}
            data-testid={`yard-counter-${key}`}
          >
            <Icon aria-hidden="true" className={cn('size-4', tone)} />
            <span className="tnum font-semibold">{count}</span>
            <span>{label}</span>
          </Link>
        ))}
      </div>
      {places.dispatchDisagrees.length ? (
        <details className="text-xs" data-testid="yard-dispatch-disagrees">
          <summary className="inline-flex min-h-11 cursor-pointer items-center gap-1 text-warning-foreground dark:text-warning [@media(pointer:fine)]:min-h-0">
            <TriangleAlert aria-hidden="true" className="size-3.5" />
            {fillYardText(messages.yardDispatchDisagrees, { count: String(places.dispatchDisagrees.length) })}
          </summary>
          <ul className="mt-1 space-y-1">
            {places.dispatchDisagrees.map((row) => (
              <li key={row.truckId}>
                <Link className="tap-inline font-semibold text-primary hover:underline" href={adminTruckHref(row.truckId, FROM)}>{row.truckNumber}</Link>
                <span className="text-muted-foreground"> · {fillYardText(messages.yardDispatchSays, { location: row.dispatch })} · {row.samsara === 'in_yard' ? messages.yardSamsaraInYardShort : messages.yardSamsaraOutsideShort}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
