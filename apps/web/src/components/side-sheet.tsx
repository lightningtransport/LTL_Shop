'use client';

import type { ReactNode } from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { X } from 'lucide-react';
import { Button } from './ui';

/**
 * Stage 4 (T5, UX-5-006): a panel on the right on desktop and a full-height sheet on phones, so a
 * long form (Add work) opens next to the button that asked for it instead of at the end of the page.
 * The body scrolls; the footer (the form's actions) stays fixed.
 */
export function SideSheet({
  open,
  title,
  description,
  closeLabel,
  onClose,
  footer,
  children,
  testId,
}: {
  open: boolean;
  title: string;
  description?: ReactNode;
  closeLabel: string;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <DialogPrimitive.Content
          data-testid={testId}
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => event.preventDefault()}
          className="fixed inset-x-0 bottom-0 top-[calc(0.5rem+var(--app-safe-top))] z-50 flex flex-col rounded-t-xl border bg-popover text-popover-foreground shadow-xl focus:outline-none sm:inset-y-0 sm:left-auto sm:right-0 sm:top-0 sm:w-full sm:max-w-xl sm:rounded-none sm:rounded-l-xl"
        >
          <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
            <div className="min-w-0 space-y-1">
              <DialogPrimitive.Title className="font-display text-xl font-bold leading-tight">{title}</DialogPrimitive.Title>
              {description ? <div className="text-sm text-muted-foreground">{description}</div> : null}
            </div>
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="icon" aria-label={closeLabel}>
                <X aria-hidden="true" className="size-5" />
              </Button>
            </DialogPrimitive.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer ? <div className="border-t px-5 py-3 pb-[calc(0.75rem+var(--app-safe-bottom))]">{footer}</div> : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
