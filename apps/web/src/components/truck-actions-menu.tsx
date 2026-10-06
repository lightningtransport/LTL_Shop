'use client';

import Link from 'next/link';
import { DropdownMenu } from 'radix-ui';
import { MoreHorizontal } from 'lucide-react';
import type { AdminMessages } from '@/lib/admin-messages';
import { Button } from './ui';

const ITEM = 'flex min-h-11 cursor-pointer select-none items-center rounded-lg px-3 text-sm outline-none data-[highlighted]:bg-accent';

/**
 * Stage 4: the Truck's "…" — Open the Work Order, Pause Work Order… (a shortcut to the Work Order's
 * pause dialog, owner decision 2026-10-05), New Work Order and Copy link.
 */
export function TruckActionsMenu({
  messages,
  workOrder,
  pauseHref,
  onNewWorkOrder,
  onCopyLink,
}: {
  messages: AdminMessages;
  workOrder: { href: string; displayId: string } | null;
  /** Only while the Work Order is In progress and the user can pause it. */
  pauseHref: string | null;
  /** Only when there is no open Work Order and the user can create one. */
  onNewWorkOrder: (() => void) | null;
  onCopyLink: () => void;
}) {
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        <Button type="button" variant="outline" size="icon" aria-label={messages.moreActions}>
          <MoreHorizontal aria-hidden="true" className="size-5" />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          collisionPadding={8}
          className="z-50 min-w-56 rounded-xl border bg-popover p-1 text-popover-foreground shadow-soft"
          data-testid="truck-actions-menu"
        >
          {workOrder ? (
            <DropdownMenu.Item asChild className={ITEM}>
              <Link href={workOrder.href}>{messages.truckMenuOpenWorkOrder.replace('{workOrder}', workOrder.displayId)}</Link>
            </DropdownMenu.Item>
          ) : null}
          {pauseHref ? (
            <DropdownMenu.Item asChild className={ITEM}>
              <Link href={pauseHref}>{messages.truckMenuPause}</Link>
            </DropdownMenu.Item>
          ) : null}
          {onNewWorkOrder ? (
            <DropdownMenu.Item className={ITEM} onSelect={onNewWorkOrder}>{messages.truckNextStepCreateAction}</DropdownMenu.Item>
          ) : null}
          <DropdownMenu.Item className={ITEM} onSelect={onCopyLink}>{messages.copyLink}</DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
