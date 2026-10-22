'use client';

import Link from 'next/link';
import { ClipboardCheck } from 'lucide-react';
import { MechanicMode } from '@ltl-shop/shared';
import { inspectionCopy } from '@/lib/inspection-copy';
import { useInspectionQueue } from '@/lib/inspection-data';
import { useShopLocale } from '@/lib/locale-context';
import { vehicleLine } from '@/lib/work-order-identity';
import { Button, CountChip } from './ui';

/**
 * D41 / HU-ME7: "To inspect" in My work, only for a mechanic with "Can inspect trucks". Hidden when nothing waits.
 * IN-7: the trucks I already inspected stay listed, after the waiting ones, while their Work Order is open (Add defects).
 * Start opens the same sheet the Manager uses; the Jobs it creates are born unowned for the Manager to assign.
 */
export function InspectionQueueCard({ enabled, mode }: { enabled: boolean; mode: MechanicMode }) {
  const { messages } = useShopLocale();
  const copy = inspectionCopy(messages.locale);
  const { data } = useInspectionQueue(enabled);
  if (!enabled || !data?.length) return null;
  const waiting = data.filter((item) => !item.inspectedAt).length;
  const base = `/mechanic/${mode === MechanicMode.PM ? 'pm' : 'standard'}`;
  const date = (iso: string) => new Date(iso).toLocaleDateString(messages.locale === 'es' ? 'es-US' : 'en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' }); // LTR-293 §13: the shop's day, not the phone's
  return (
    <section className="mb-6 space-y-2" aria-labelledby="inspection-queue-title" data-testid="inspection-queue">
      <div>
        <h2 id="inspection-queue-title" className="flex items-center gap-2 text-base font-semibold">
          <ClipboardCheck aria-hidden="true" className="size-4 text-muted-foreground" />
          {copy.toInspectTitle}
          {waiting ? <CountChip>{waiting}</CountChip> : null}
        </h2>
        <p className="text-xs text-muted-foreground">{copy.toInspectHint}</p>
      </div>
      <ul className="divide-y rounded-xl border bg-card">
        {data.map((item, index) => (
          <li key={item.workOrderId} className="flex min-h-14 items-center gap-3 px-3 py-2" data-testid="inspection-queue-item">
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {messages.truckTitle(item.truckNumber)} <span className="font-mono text-xs font-normal text-muted-foreground">{item.workOrderDisplayId}</span>
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {item.inspectedAt ? copy.inspectedByYou(date(item.inspectedAt)) : copy.waitingSince(date(item.waitingSince))}
                {vehicleLine(item) ? ` · ${vehicleLine(item)}` : ''}
              </p>
            </div>
            {/* IN-7: a truck I already inspected stays here while its Work Order is open, to add what I find later. */}
            <Button asChild size="sm" variant={index === 0 && !item.inspectedAt ? 'default' : 'outline'}>
              <Link href={`${base}/inspect/${item.truckId}`}>{item.inspectedAt ? copy.addDefects : copy.start}</Link>
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
