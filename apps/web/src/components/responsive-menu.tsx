'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { Dialog as DialogPrimitive, DropdownMenu } from 'radix-ui';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsPhone } from '@/lib/use-is-phone';

export type MenuItem = {
  key: string;
  label: string;
  icon?: LucideIcon;
  onSelect?: () => void;
  href?: string;
  destructive?: boolean;
  /** A divider above this item. */
  separatorBefore?: boolean;
  testId?: string;
};

const ITEM = 'flex min-h-11 w-full cursor-pointer select-none items-center gap-2.5 rounded-md px-2.5 text-left text-sm outline-none [@media(pointer:fine)]:min-h-9 data-[highlighted]:bg-accent hover:bg-accent';

/**
 * Stage 8 (F3, mockups): one menu for "…" buttons — a dropdown on the card color with an optional header label,
 * icons and dividers; on phones a bottom sheet with a grab handle.
 */
export function ResponsiveMenu({
  trigger,
  label,
  items,
  align = 'end',
  contentTestId,
}: {
  trigger: ReactNode;
  /** Header label (e.g. "Work Order", the Job's name). Also the sheet's accessible name. */
  label: string;
  items: MenuItem[];
  align?: 'start' | 'end';
  contentTestId?: string;
}) {
  const phone = useIsPhone();
  const [open, setOpen] = useState(false);
  if (!items.length) return null;

  const body = (item: MenuItem) => {
    const Icon = item.icon;
    return <>{Icon ? <Icon aria-hidden="true" className="size-4 opacity-80" /> : null}<span className="min-w-0 flex-1 truncate">{item.label}</span></>;
  };

  if (phone) {
    return (
      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            data-testid={contentTestId}
            className="anim-sheet-in fixed inset-x-0 bottom-0 z-50 max-h-[80vh] overflow-y-auto rounded-t-2xl border-t bg-card p-2 pb-[calc(0.5rem+var(--app-safe-bottom))] text-card-foreground shadow-2xl focus:outline-none"
          >
            <div aria-hidden="true" className="mx-auto mb-1 mt-1 h-1 w-10 rounded-full bg-muted-foreground/40" />
            <DialogPrimitive.Title className="px-2.5 pb-1 pt-1.5 text-xs font-normal text-muted-foreground">{label}</DialogPrimitive.Title>
            <div role="menu" aria-label={label}>
              {items.map((item) => (
                <div key={item.key}>
                  {item.separatorBefore ? <div role="separator" className="my-1 h-px bg-border" /> : null}
                  {item.href ? (
                    <Link role="menuitem" href={item.href} data-testid={item.testId} className={cn(ITEM, item.destructive && 'text-destructive-text')} onClick={() => setOpen(false)}>{body(item)}</Link>
                  ) : (
                    <button
                      type="button"
                      role="menuitem"
                      data-testid={item.testId}
                      className={cn(ITEM, item.destructive && 'text-destructive-text hover:bg-destructive/15')}
                      onClick={() => { setOpen(false); item.onSelect?.(); }}
                    >
                      {body(item)}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    );
  }

  return (
    <DropdownMenu.Root modal={false} open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={align}
          sideOffset={6}
          collisionPadding={8}
          data-testid={contentTestId}
          className="anim-pop-in z-50 w-[248px] rounded-lg border bg-card p-1 text-card-foreground shadow-xl"
        >
          <DropdownMenu.Label className="px-2.5 pb-1 pt-1.5 text-xs text-muted-foreground">{label}</DropdownMenu.Label>
          {items.map((item) => (
            <div key={item.key}>
              {item.separatorBefore ? <DropdownMenu.Separator className="my-1 h-px bg-border" /> : null}
              {item.href ? (
                <DropdownMenu.Item asChild className={cn(ITEM, item.destructive && 'text-destructive-text')}>
                  <Link href={item.href} data-testid={item.testId}>{body(item)}</Link>
                </DropdownMenu.Item>
              ) : (
                <DropdownMenu.Item
                  data-testid={item.testId}
                  className={cn(ITEM, item.destructive && 'text-destructive-text data-[highlighted]:bg-destructive/15')}
                  onSelect={() => item.onSelect?.()}
                >
                  {body(item)}
                </DropdownMenu.Item>
              )}
            </div>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
