'use client';

import { Wrench } from 'lucide-react';
import { useShopLocale } from '@/lib/locale-context';
import { Badge } from './ui';

/** D57 §3 (LTR-306): another mechanic has this truck; the text says who, with which Job, and to wait. */
export function TruckBusyBadge({ busy }: { busy: { holder: { id: string; name: string }; jobName: string } }) {
  const { messages } = useShopLocale();
  return (
    <Badge variant="warning" className="h-auto max-w-full gap-1.5 whitespace-normal py-1" data-testid="truck-busy">
      <Wrench aria-hidden="true" className="size-3.5 shrink-0" />
      <span>{messages.truckBusyBadge(busy.holder.name, busy.jobName)}</span>
    </Badge>
  );
}
